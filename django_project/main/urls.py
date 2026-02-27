from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('submit/', views.submit_problem, name='submit'),
    path('api/problem/create/', views.api_create_problem),
    path('api/problem/status/<int:pk>/', views.api_get_status),
]
