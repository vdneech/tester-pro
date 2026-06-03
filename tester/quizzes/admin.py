from django.contrib import admin
from django.utils.safestring import mark_safe
from .models import TestSuite, Question, QuestionImage  # Импортируем модель картинок


class QuestionImageInline(admin.TabularInline):
    """
    Позволяет загружать и удалять фотографии прямо со страницы редактирования вопроса
    """
    model = QuestionImage
    extra = 1  # Количество пустых слотов для загрузки новых фото
    max_num = 3  # Жесткое ограничение бизнес-логики: не более 3 фото на вопрос
    fields = ('image', 'get_preview')
    readonly_fields = ('get_preview',)

    @admin.display(description='Превью')
    def get_preview(self, obj):
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" style="max-height: 80px; border-radius: 4px;" />')
        return "Нет изображения"


class QuestionInline(admin.TabularInline):
    """Позволяет редактировать и смотреть вопросы прямо внутри страницы теста"""
    model = Question
    extra = 1
    fields = ('number', 'text', 'options')
    ordering = ('number',)


@admin.register(TestSuite)
class TestSuiteAdmin(admin.ModelAdmin):
    list_display = ('title', 'get_group_badge', 'get_questions_count', 'created_at')
    search_fields = ('title', 'group')
    list_filter = ('group', 'created_at')
    inlines = [QuestionInline]
    ordering = ('-created_at',)

    @admin.display(description='Учебная группа')
    def get_group_badge(self, obj):
        return obj.group if obj.group else "-"

    @admin.display(description='Кол-во вопросов')
    def get_questions_count(self, obj):
        return obj.questions.count()


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('number', 'test_suite', 'text', 'get_images_count')
    list_filter = ('test_suite__group', 'test_suite')
    search_fields = ('text', 'test_suite__title')
    ordering = ('test_suite', 'number')

    # Встраиваем загрузку картинок внутрь страницы редактирования вопроса
    inlines = [QuestionImageInline]

    @admin.display(description='Загружено фото')
    def get_images_count(self, obj):
        count = obj.images.count()
        if count == 0:
            return "0 / 3"
        return f"{count} / 3"


@admin.register(QuestionImage)
class QuestionImageAdmin(admin.ModelAdmin):
    """
    Отдельный полноценный раздел для контроля всех загруженных медиа-файлов
    """
    list_display = ('id', 'get_test_title', 'get_question_number', 'get_table_preview', 'image')
    list_filter = ('question__test_suite__group', 'question__test_suite')
    readonly_fields = ('get_table_preview',)

    @admin.display(description='Тест')
    def get_test_title(self, obj):
        return obj.question.test_suite.title

    @admin.display(description='№ Вопроса')
    def get_question_number(self, obj):
        return f"Вопрос №{obj.question.number}"

    @admin.display(description='Миниатюра')
    def get_table_preview(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-height: 50px; border-radius: 4px; border: 1px solid #10b981;" />')
        return "—"