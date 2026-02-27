from django.contrib import admin
from .models import Problem

@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ('id', 'problem_type', 'full_name', 'phone', 'status', 'created_at', 'replied_at')
    list_filter = ('status', 'problem_type')
    search_fields = ('full_name', 'phone', 'description', 'admin_reply')
    list_editable = ('status',)
    readonly_fields = ('created_at', 'replied_at')
    
    fieldsets = (
        ('Asosiy ma\'lumotlar', {
            'fields': ('full_name', 'phone', 'problem_type', 'description', 'telegram_id')
        }),
        ('Holat va Javob', {
            'fields': ('status', 'admin_reply', 'replied_at', 'created_at')
        }),
    )
