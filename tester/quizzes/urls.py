from django.urls import path
from . import views

app_name = 'quizzes'


urlpatterns = [
    path('quiz/<slug:test_slug>/', views.run_test_view, name='run_test'),
    path('quiz/<slug:test_slug>/submit/', views.submit_test_view, name='submit_test'),
]