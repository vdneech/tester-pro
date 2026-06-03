from django.db.models import Q
from django.shortcuts import render, get_object_or_404, redirect
from quizzes.models import TestSuite
from .services import handle_uploaded_test_file


def test_list_view(request):
    query = request.GET.get('q', '').strip()

    test_suites = TestSuite.objects.all().order_by('-created_at')

    if query:
        test_suites = test_suites.filter(
            Q(title__icontains=query) | Q(group__icontains=query)
        )

    context = {
        'test_suites': test_suites,
        'query': query,
    }
    return render(request, 'uploader/test_list.html', context)


def upload_test_view(request):
    """
    Главная страница сервиса. Принимает файл и метаданные группы через POST.
    """
    if request.method == 'POST' and request.FILES.get('test_file'):
        uploaded_file = request.FILES['test_file']

        group_name = request.POST.get('group_name', '').strip()

        try:
            test_suite = handle_uploaded_test_file(uploaded_file, group_from_ui=group_name)

            return redirect('uploader:test_share_page', test_slug=test_suite.slug)

        except Exception as e:
            return render(request, 'index.html', {'error': str(e)})

    # Рендерим index.html при обычном GET-запросе
    return render(request, 'index.html')


def test_share_page_view(request, test_slug):
    """
    Страница, которая показывает пользователю его постоянную slug-ссылку на созданный тест.
    """
    test_suite: TestSuite = TestSuite.objects.get(slug=test_slug)

    full_url = request.build_absolute_uri(f'/quiz/{test_suite.slug}/')

    context = {
        'test_suite': test_suite,
        'full_url': full_url
    }
    return render(request, 'uploader/share.html', context)