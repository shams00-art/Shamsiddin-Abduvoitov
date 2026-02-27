from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone

phone_validator = RegexValidator(
    regex=r'^\+998\d{9}$',
    message="Telefon raqam +998 bilan boshlansin va 9 ta raqam bo‘lsin. Masalan: +998901234567"
)

class Problem(models.Model):
    TYPE_CHOICES = [
        ('yol', "Yo'l"),
        ('suv', "Suv"),
        ('chiroq', "Chiroq"),
        ('axlat', "Axlat"),
        ('boshqa', "Boshqa"),
    ]
    
    STATUS_CHOICES = [
        ('Yangi', "Yangi"),
        ('Korilmoqda', "Ko'rilmoqda"),
        ('HalQilindi', "Hal qilindi"),
        ('RadEtildi', "Rad etildi"),
    ]

    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=13, validators=[phone_validator])
    problem_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Yangi')
    admin_reply = models.TextField(blank=True, null=True)
    replied_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    telegram_id = models.BigIntegerField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.admin_reply and not self.replied_at:
            self.replied_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} - {self.problem_type}"
