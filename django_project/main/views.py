import json
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
from .models import Problem

def home(request):
    return render(request, 'home.html')

def submit_problem(request):
    if request.method == 'POST':
        full_name = request.POST.get('full_name')
        phone = request.POST.get('phone')
        problem_type = request.POST.get('problem_type')
        description = request.POST.get('description')
        
        # Simple validation
        if full_name and phone and problem_type and description:
            Problem.objects.create(
                full_name=full_name,
                phone=phone,
                problem_type=problem_type,
                description=description
            )
            return render(request, 'home.html', {'success': True})
            
    return render(request, 'submit_problem.html')

@csrf_exempt
def api_create_problem(request):
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        full_name = data.get('full_name')
        phone = data.get('phone')
        problem_type = data.get('problem_type')
        description = data.get('description')
        telegram_id = data.get('telegram_id')

        # Anti-spam
        today = timezone.now().date()
        if telegram_id:
            count = Problem.objects.filter(telegram_id=telegram_id, created_at__date=today).count()
            if count >= 5:
                return JsonResponse({'ok': False, 'error': 'Kunlik limitga yetdingiz (max 5)'}, status=400)
            
            duplicate = Problem.objects.filter(
                telegram_id=telegram_id, 
                description=description, 
                created_at__gte=timezone.now() - timedelta(minutes=5)
            ).exists()
            if duplicate:
                return JsonResponse({'ok': False, 'error': '❌ Siz yaqinda shu murojaatni yuborgansiz. 5 daqiqadan keyin urinib ko‘ring.'}, status=400)

        problem = Problem.objects.create(
            full_name=full_name,
            phone=phone,
            problem_type=problem_type,
            description=description,
            telegram_id=telegram_id
        )
        return JsonResponse({'ok': True, 'id': problem.id})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)

def api_get_status(request, pk):
    try:
        p = Problem.objects.get(pk=pk)
        return JsonResponse({
            'ok': True,
            'id': p.id,
            'status': p.get_status_display(),
            'admin_reply': p.admin_reply or "",
            'replied_at': p.replied_at.isoformat() if p.replied_at else None
        })
    except Problem.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Murojaat topilmadi'}, status=404)
