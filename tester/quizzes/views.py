import json

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, Http404
from .models import TestSuite


def run_test_view(request, test_slug):
    try:
        test_suite: TestSuite = TestSuite.objects.get(slug=test_slug)

        questions_list = []
        questions_queryset = test_suite.questions.all().order_by('number')

        for q in questions_queryset:
            questions_list.append({
                "id": q.id,
                "number": q.number,
                "text": q.text,
                "options": q.options,
                "images": [img.image.url for img in q.images.all()]
            })

        context = {
            'test_suite': test_suite,
            # Передаем количество вопросов для использования в SEO/OG-тегах
            'questions_count': questions_queryset.count(),
            'questions_json': json.dumps(questions_list, ensure_ascii=False)
        }

        test_suite.views += 1
        test_suite.save()
        return render(request, 'quizzes/run_test.html', context)
    except Exception as e:
        raise Http404


def submit_test_view(request, test_id):
    """
    Принимает ответы пользователя, сверяет с правильными в БД и возвращает результат.
    Работает в формате stateless (зашел-вышел, посчитал, забыл).
    Предполагается, что фронтенд отправляет JSON вида:
    {
        "answers": {
            "1": "Да",
            "2": "Мадрид"
        }
    }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Метод не поддерживается'}, status=405)

    test_suite = get_object_or_404(TestSuite, id=test_id)

    import json
    try:
        user_data = json.loads(request.body)
        user_answers = user_data.get('answers', {})
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Некорректный JSON'}, status=400)

    questions = test_suite.questions.all()

    total_questions = questions.count()
    correct_count = 0
    detailed_results = []

    for question in questions:
        user_answer = user_answers.get(str(question.number)) or user_answers.get(question.number)
        correct_answer = question.options.get('correct')

        is_correct = False
        if user_answer is not None and str(user_answer).strip().lower() == str(correct_answer).strip().lower():
            is_correct = True
            correct_count += 1

        detailed_results.append({
            'question_number': question.number,
            'is_correct': is_correct,
            'user_answer': user_answer,
            'correct_answer': correct_answer if is_correct else None
        })

    score_percentage = round((correct_count / total_questions) * 100, 1) if total_questions > 0 else 0

    return JsonResponse({
        'test_title': test_suite.title,
        'total_questions': total_questions,
        'correct_count': correct_count,
        'score_percentage': score_percentage,
        'details': detailed_results
    })
