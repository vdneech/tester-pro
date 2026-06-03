import hashlib
import uuid
from django.db import models
from django.utils.text import slugify
from pytils.translit import slugify as cyrillic_slugify

class TestSuite(models.Model):
    """
    Модель самого теста.
    Вместо обычного id (1, 2, 3...) используем UUID, чтобы ссылку 
    нельзя было угадать перебором. Линк будет иметь вид: /quiz/<uuid>/
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Уникальный ID теста"
    )

    slug = models.CharField(max_length=50, verbose_name="Уникальный слаг", unique=True, null=True)

    views = models.BigIntegerField(default=0, verbose_name="Просмотры")
    title = models.CharField(
        max_length=255,
        verbose_name="Название теста"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Дата создания"
    )

    group = models.CharField(max_length=50, blank=True, null=True, verbose_name="Группа")

    @property
    def _base_color(self) -> str:
        h = hashlib.sha1(f"{self.group}".encode('utf-8')).hexdigest()[:6]
        r, g, b = [int(h[i:i + 2], 16) for i in (0, 2, 4)]

        r = 50 + int((r / 255) * 155)
        g = 50 + int((g / 255) * 155)
        b = 50 + int((b / 255) * 155)

        return f"{r:02x}{g:02x}{b:02x}"

    @property
    def group_color(self) -> str:
        base = self._base_color
        return f"#{base}{int(0.25 * 255):02x}"

    @property
    def group_border_color(self) -> str:
        base = self._base_color
        return f"#{base}{int(1 * 255):02x}"




    class Meta:
        verbose_name = "Тест"
        verbose_name_plural = "Тесты"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.id})"


class Question(models.Model):
    """
    Модель вопроса внутри теста.
    """
    test_suite = models.ForeignKey(
        TestSuite,
        on_delete=models.CASCADE,
        related_name='questions',
        verbose_name="Тест"
    )
    number = models.IntegerField(
        verbose_name="Порядковый номер вопроса"
    )
    text = models.TextField(
        verbose_name="Текст вопроса"
    )

    # JSONField идеально подходит для гибкой структуры ответов.
    # Пример структуры: 
    # {
    #   "type": "single_choice", 
    #   "answers": ["Да", "Нет", "Не знаю"], 
    #   "correct": "Да"
    # }
    options = models.JSONField(
        verbose_name="Варианты ответов и метаданные"
    )

    class Meta:
        verbose_name = "Вопрос"
        verbose_name_plural = "Вопросы"
        ordering = ['number']
        # Гарантирует, что в рамках одного теста не будет двух вопросов с одинаковым номером
        unique_together = ('test_suite', 'number')

    def __str__(self):
        return f"Вопрос №{self.number} для теста {self.test_suite.title}"


class QuestionImage(models.Model):
    """
    Модель для хранения картинок к вопросам.
    Один вопрос может содержать до 3-х изображений (контролируется в uploader).
    """
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name="Вопрос"
    )
    # Картинки будут загружаться в директорию media/test_images/
    image = models.ImageField(
        upload_to='test_images/',
        verbose_name="Изображение"
    )

    class Meta:
        verbose_name = "Изображение к вопросу"
        verbose_name_plural = "Изображения к вопросам"

    def __str__(self):
        return f"Картинка для вопроса №{self.question.number}"