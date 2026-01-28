from django.urls import path
from .views import api

urlpatterns = [
    path("v1/", api.urls),
]
