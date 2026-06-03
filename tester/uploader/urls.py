from django.urls import path
from . import views

app_name = 'uploader'

urlpatterns = [
    # Главная страница загрузки: /
    path('', views.upload_test_view, name='upload_test'),

    # Страница успешной генерации: /share/<uuid>/
    path('share/<slug:test_slug>/', views.test_share_page_view, name='test_share_page'),
    path('tests/', views.test_list_view, name='test_list'),
]