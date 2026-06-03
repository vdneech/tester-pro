import json
import logging
import os
import zipfile
from collections import defaultdict
from io import BytesIO
from django.db import transaction
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.db.models import QuerySet

from quizzes.models import TestSuite, Question, QuestionImage
from django.utils.text import slugify
from pytils.translit import slugify as cyrillic_slugify

logger = logging.getLogger(__name__)

# Разрешенные расширения для изображений
VALID_IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')


def _clean_mac_artifacts(namelist: list) -> list:
    """
    Фильтрует список файлов внутри архива, полностью очищая его от
    системных метаданных macOS (__MACOSX, скрытые файлы-двойники с точкой).
    """
    clean_files = []
    for f in namelist:
        f_lower = f.lower()
        filename = os.path.basename(f)

        if (
                f_lower.endswith(VALID_IMAGE_EXTENSIONS) and
                'img' in f_lower and
                '__macosx' not in f_lower and
                not filename.startswith('.')
        ):
            clean_files.append(f)
    return clean_files


def _parse_question_number(filename: str) -> int:
    """
    Извлекает и валидирует номер вопроса из имени файла (например, '12_2.png' -> 12).
    Возвращает None, если парсинг не удался.
    """
    try:
        raw_part = filename.split('_')[0]
        q_number_str = ''.join(filter(str.isdigit, raw_part))
        return int(q_number_str) if q_number_str else None
    except (ValueError, IndexError):
        return None


def process_json_questions(test_suite: TestSuite, json_data: dict) -> dict:
    """
    Парсит список вопросов из JSON и массово сохраняет их в базу данных.
    Возвращает мапу {номер_вопроса: объект_Question}.
    """
    questions_data = json_data.get('questions', [])
    created_questions = {}

    for q_data in questions_data:
        try:
            q = Question.objects.create(
                test_suite=test_suite,
                number=int(q_data['number']),
                text=q_data['text'],
                options=q_data.get('options', {})
            )
            created_questions[q.number] = q
        except (ValueError, KeyError) as e:
            logger.error(f"Ошибка валидации структуры вопроса в JSON для теста {test_suite.id}: {e}")
            raise ValueError("Некорректная структура данных внутри списка вопросов.")

    return created_questions


def handle_uploaded_test_file(uploaded_file, group_from_ui: str = None) -> TestSuite:
    """
    Основной сервис-воркер продакшен-уровня.
    Определяет тип файла, извлекает группы, парсит структуру тестов
    и атомарно сохраняет всю медиа-графику.
    """
    filename = uploaded_file.name
    data = {}
    zip_archive = None

    try:
        if filename.endswith('.json'):
            try:
                data = json.load(uploaded_file)
            except json.JSONDecodeError as e:
                logger.warning(f"Ошибка декодирования загруженного JSON: {e}")
                raise ValueError("Некорректный формат JSON-файла.")

        elif filename.endswith('.zip'):
            try:
                zip_archive = zipfile.ZipFile(uploaded_file)
            except zipfile.BadZipFile:
                raise ValueError("Загруженный ZIP-архив поврежден или не является валидным архивом.")

            namelist = zip_archive.namelist()

            json_file_path = next(
                (f for f in namelist if f.endswith('.json') and not f.startswith('__MACOSX')),
                None
            )
            if not json_file_path:
                raise ValueError("Внутри ZIP-архива не найден конфигурационный .json файл.")

            with zip_archive.open(json_file_path) as json_file:
                try:
                    data = json.loads(json_file.read().decode('utf-8'))
                except json.JSONDecodeError:
                    raise ValueError(f"Конфигурационный файл {json_file_path} внутри архива содержит невалидный JSON.")
        else:
            raise ValueError("Неподдерживаемый тип файла. Допустимы только файлы конфигурации .json или пакеты .zip")

        title = data.get('title') or data.get('test_title') or 'Тест без названия'
        group_from_json = data.get('group') or data.get('group_tag') or data.get('class')

        if group_from_json:
            group_from_json = str(group_from_json).strip()

        final_group = group_from_json or group_from_ui or None

        with transaction.atomic():
            slug = generate_slug_from_title(title)
            test_suite = TestSuite.objects.create(title=title, group=final_group, slug=slug)
            questions_map = process_json_questions(test_suite, data)

            if zip_archive:
                clean_img_paths = _clean_mac_artifacts(zip_archive.namelist())

                images_counter = defaultdict(int)

                for img_path in clean_img_paths:
                    filename_only = os.path.basename(img_path)
                    q_number = _parse_question_number(filename_only)

                    if q_number is None:
                        logger.info(f"Файл {filename_only} пропущен: не распознан паттерн номера вопроса.")
                        continue

                    question = questions_map.get(q_number)
                    if not question:
                        logger.warning(f"Изображение {filename_only} ссылается на несуществующий вопрос №{q_number}.")
                        continue

                    if images_counter[q_number] < 3:
                        try:
                            img_data = zip_archive.read(img_path)
                            img_io = BytesIO(img_data)

                            ext = filename_only.split('.')[-1].lower()
                            content_type = f"image/{ext}"

                            django_file = InMemoryUploadedFile(
                                file=img_io,
                                field_name='image',
                                name=filename_only,
                                content_type=content_type,
                                size=len(img_data),
                                charset=None
                            )

                            QuestionImage.objects.create(question=question, image=django_file)
                            images_counter[q_number] += 1

                        except Exception as img_err:
                            logger.error(f"Не удалось обработать файл изображения {img_path} в архиве: {img_err}")
                            continue
                    else:
                        logger.info(
                            f"Для вопроса №{q_number} достигнут лимит в 3 изображения. Файл {filename_only} пропущен.")

        return test_suite

    finally:
        if zip_archive:
            zip_archive.close()


def generate_slug_from_title(title: str) -> str:
    base_slug = cyrillic_slugify(title)[:45]

    if not base_slug:
        base_slug = "default"

    slug = base_slug
    counter = 1

    queryset: QuerySet = TestSuite.objects.filter(slug=slug)

    while queryset.exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

        queryset = TestSuite.objects.filter(slug=slug)

    return slug

