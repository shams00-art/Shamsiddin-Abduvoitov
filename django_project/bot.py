import os
import asyncio
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove

# Configuration
API_URL = "http://127.0.0.1:8000/api/problem"
BOT_TOKEN = os.getenv("BOT_TOKEN", "8697646411:AAHSw6M1SpJtxoNdYDmVw1vSjulUViwoWcA")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

class Form(StatesGroup):
    full_name = State()
    phone = State()
    problem_type = State()
    description = State()

class CheckStatus(StatesGroup):
    id = State()

def main_menu():
    kb = [
        [KeyboardButton(text="📩 Muammo yuborish")],
        [KeyboardButton(text="🔎 Holatini tekshirish")]
    ]
    return ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "Assalomu alaykum! Raqamli Mahalla botiga xush kelibsiz.",
        reply_markup=main_menu()
    )

# --- Submit Flow ---
@dp.message(F.text == "📩 Muammo yuborish")
async def start_form(message: types.Message, state: FSMContext):
    await state.set_state(Form.full_name)
    await message.answer("Ism familiyangizni yozing:", reply_markup=ReplyKeyboardRemove())

@dp.message(Form.full_name)
async def process_name(message: types.Message, state: FSMContext):
    await state.update_data(full_name=message.text)
    await state.set_state(Form.phone)
    kb = [[KeyboardButton(text="📞 Telefonni yuborish", request_contact=True)]]
    await message.answer(
        "Telefon raqamingizni tugma orqali yuboring:",
        reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    )

@dp.message(Form.phone)
async def process_phone(message: types.Message, state: FSMContext):
    phone = ""
    if message.contact:
        phone = message.contact.phone_number
        if not phone.startswith('+'): phone = '+' + phone
    else:
        phone = message.text
        if not phone.startswith('+998') or len(phone) != 13:
            await message.answer("❌ Telefon noto‘g‘ri formatda. Iltimos, +998901234567 formatda yoki tugma orqali yuboring.")
            return

    await state.update_data(phone=phone)
    await state.set_state(Form.problem_type)
    kb = [
        [KeyboardButton(text="Yo'l"), KeyboardButton(text="Suv")],
        [KeyboardButton(text="Chiroq"), KeyboardButton(text="Axlat")],
        [KeyboardButton(text="Boshqa")]
    ]
    await message.answer(
        "Muammo turini tanlang:",
        reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    )

@dp.message(Form.problem_type)
async def process_type(message: types.Message, state: FSMContext):
    types_map = {"Yo'l": "yol", "Suv": "suv", "Chiroq": "chiroq", "Axlat": "axlat", "Boshqa": "boshqa"}
    if message.text not in types_map:
        await message.answer("Iltimos, tugmalardan birini tanlang.")
        return
    
    await state.update_data(problem_type=types_map[message.text])
    await state.set_state(Form.description)
    await message.answer("Muammo tavsifini yozing:", reply_markup=ReplyKeyboardRemove())

@dp.message(Form.description)
async def process_desc(message: types.Message, state: FSMContext):
    data = await state.get_data()
    data['description'] = message.text
    data['telegram_id'] = message.from_user.id
    
    try:
        response = requests.post(f"{API_URL}/create/", json=data)
        res_data = response.json()
        if response.status_code == 200:
            await message.answer(
                f"✅ Murojaat qabul qilindi! ID: {res_data['id']}\n🔎 Holatini tekshirish uchun ID ni saqlab qo‘ying.",
                reply_markup=main_menu()
            )
        else:
            await message.answer(f"❌ Xato: {res_data.get('error', 'Noma\'lum xato')}", reply_markup=main_menu())
    except Exception:
        await message.answer("❌ Server xatosi. Keyinroq urinib ko‘ring.", reply_markup=main_menu())
    
    await state.clear()

# --- Check Status Flow ---
@dp.message(F.text == "🔎 Holatini tekshirish")
async def start_check(message: types.Message, state: FSMContext):
    await state.set_state(CheckStatus.id)
    await message.answer("Murojaat ID raqamini kiriting:", reply_markup=ReplyKeyboardRemove())

@dp.message(CheckStatus.id)
async def process_check(message: types.Message, state: FSMContext):
    if not message.text.isdigit():
        await message.answer("Iltimos, faqat raqam kiriting.")
        return
    
    try:
        response = requests.get(f"{API_URL}/status/{message.text}/")
        data = response.json()
        if response.status_code == 200:
            msg = f"📌 Holati: {data['status']}\n"
            msg += f"💬 Javob: {data['admin_reply']}" if data['admin_reply'] else "💬 Javob: Hozircha javob yo‘q."
            await message.answer(msg, reply_markup=main_menu())
        else:
            await message.answer("❌ Murojaat topilmadi.", reply_markup=main_menu())
    except Exception:
        await message.answer("❌ Server xatosi.", reply_markup=main_menu())
    
    await state.clear()

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
