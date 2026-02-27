import express from "express";
import { createServer as createViteServer } from "vite";
import { problemService } from "./src/db.ts";
import { Telegraf, session, Scenes, Markup } from "telegraf";
import * as dotenv from "dotenv";

dotenv.config();

const REGIONS = [
  "Toshkent sh.", "Toshkent vil.", "Andijon", "Buxoro", "Farg'ona", 
  "Jizzax", "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", 
  "Qoraqalpog'iston", "Samarqand", "Sirdaryo", "Surxondaryo"
];

const DISTRICTS: any = {
  "Toshkent sh.": ["Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Mirobod", "Yakkasaroy", "Shayxontohur", "Olmazor", "Sergeli", "Yashnobod", "Bektemir", "Uchtepa", "Yangihayot"],
  "Andijon": ["Andijon sh.", "Asaka", "Baliqchi", "Bo'ston", "Buloqboshi", "Izboskan", "Jalaquduq", "Marhamat", "Oltinko'l", "Paxtaobod", "Qo'rg'ontepa", "Shahrixon", "Ulug'nor", "Xo'jaobod"],
  // Simplified for other regions
  "Buxoro": ["Buxoro sh.", "G'ijduvon", "Kogon", "Olot", "Peshku", "Qorako'l", "Qorovulbozor", "Romitan", "Shofirkon", "Vobkent"],
  "Farg'ona": ["Farg'ona sh.", "Marg'ilon", "Qo'qon", "Quva", "Oltiariq", "Bog'dod", "Beshariq", "Uchko'prik", "Rishton", "Yozyovon"],
  "Samarqand": ["Samarqand sh.", "Bulung'ur", "Ishtixon", "Jomboy", "Kattaqo'rg'on", "Narpay", "Nurobod", "Oqdaryo", "Paxtachi", "Payariq", "Pastdarg'om", "Toyloq", "Urgut"]
};

const app = express();
const PORT = 3000;

app.use(express.json());

// --- API Endpoints ---

app.post("/api/problem/create/", (req, res) => {
  const { full_name, phone, problem_type, description, pinfl, nationality, email, category } = req.body;

  // Validation
  if (!full_name || !phone || !problem_type || !description) {
    return res.status(400).json({ ok: false, error: "Barcha maydonlarni to'ldiring" });
  }

  const phoneRegex = /^\+998\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ ok: false, error: "Telefon formati noto'g'ri" });
  }

  // Anti-spam
  const dailyCount = problemService.getStats(phone, false);
  if (dailyCount >= 5) {
    return res.status(429).json({ ok: false, error: "Kunlik limitga yetdingiz (max 5)" });
  }

  const isDuplicate = problemService.checkDuplicate(description, phone, false);
  if (isDuplicate) {
    return res.status(429).json({ ok: false, error: "Siz yaqinda shunday muammo yuborgansiz" });
  }

  try {
    const id = problemService.create({ 
      full_name, 
      phone, 
      pinfl,
      nationality,
      email,
      category,
      region: req.body.region,
      district: req.body.district,
      problem_type, 
      description,
      latitude: req.body.latitude,
      longitude: req.body.longitude
    });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Server xatosi" });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  const admin = problemService.adminLogin(username, password);
  if (admin) {
    res.json({ ok: true, admin: { username: (admin as any).username } });
  } else {
    res.status(401).json({ ok: false, error: "Username yoki parol noto'g'ri" });
  }
});

app.get("/api/problem/status/:id", (req, res) => {
  const { id } = req.params;
  const problem = problemService.getById(id);
  if (!problem) {
    return res.status(404).json({ ok: false, error: "Murojaat topilmadi" });
  }
  res.json({
    ok: true,
    id: problem.public_id,
    status: problem.status,
    admin_reply: problem.admin_reply,
    replied_at: problem.replied_at
  });
});

app.get("/api/admin/problems", (req, res) => {
  const { status, type, search } = req.query;
  const problems = problemService.getAll({ 
    status: status as string, 
    type: type as string, 
    search: search as string 
  });
  res.json(problems);
});

app.patch("/api/admin/problems/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, admin_reply } = req.body;
  problemService.updateStatus(Number(id), status, admin_reply);

  if (admin_reply) {
    problemService.addMessage(Number(id), 'admin', admin_reply);
  }

  // Notify user via Telegram if they submitted via bot
  if (admin_reply && bot) {
    const problem = problemService.getById(id);
    if (problem && problem.telegram_id) {
      try {
        const message = `🔔 Murojaatingizga javob keldi!\n\n` +
                        `📌 ID: ${problem.public_id}\n` +
                        `📝 Muammo: ${problem.description.substring(0, 50)}${problem.description.length > 50 ? '...' : ''}\n` +
                        `✅ Holat: ${status}\n` +
                        `👨‍💼 Admin javobi: ${admin_reply}\n\n` +
                        `✍️ Savolingiz bo'lsa, shu yerga yozishingiz mumkin.`;
        await bot.telegram.sendMessage(problem.telegram_id, message);
      } catch (err) {
        console.error("Telegram notification error:", err);
      }
    }
  }
  
  res.json({ ok: true });
});

app.post("/api/admin/problems/:id/assign", (req, res) => {
  const { id } = req.params;
  const { official } = req.body;
  try {
    problemService.updateAssignedOfficial(Number(id), official);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Server xatosi" });
  }
});

app.get("/api/problem/messages/:id", (req, res) => {
  const messages = problemService.getMessages(Number(req.params.id));
  res.json(messages);
});

// --- Telegram Bots ---

const botToken = process.env.TELEGRAM_BOT_TOKEN || "8697646411:AAHSw6M1SpJtxoNdYDmVw1vSjulUViwoWcA";
const adminBotToken = "8643318907:AAHPlMUDgt3cN-vF17reWXP9HcpeY7PdcX4";
let bot: Telegraf | null = null;
let adminBot: Telegraf | null = null;

const APP_URL = process.env.APP_URL || "https://ais-dev-eayt57mhgjj4a442o2ki7w-418668258129.asia-southeast1.run.app";

if (botToken) {
  bot = new Telegraf(botToken);
  
  // Scene for submitting problem
  const submitScene = new Scenes.WizardScene(
    'submit_problem',
    async (ctx: any) => {
      await ctx.reply("F.I.O (To'liq) kiriting:", Markup.removeKeyboard());
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      ctx.wizard.state.full_name = ctx.message.text;
      await ctx.reply("PINFL (14 ta raqam) kiriting (ixtiyoriy):", 
        Markup.keyboard([["O'tkazib yuborish"]]).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      const text = ctx.message.text;
      if (text !== "O'tkazib yuborish") {
        if (!/^\d{14}$/.test(text)) {
          return ctx.reply("PINFL 14 ta raqamdan iborat bo'lishi kerak. Qaytadan kiriting yoki o'tkazib yuboring:");
        }
        ctx.wizard.state.pinfl = text;
      }
      await ctx.reply("Millatingizni kiriting (ixtiyoriy):", 
        Markup.keyboard([["O'tkazib yuborish"]]).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      const text = ctx.message.text;
      if (text !== "O'tkazib yuborish") {
        ctx.wizard.state.nationality = text;
      }
      await ctx.reply("Telefon raqamingizni tugma orqali yuboring:", 
        Markup.keyboard([Markup.button.contactRequest("📞 Telefonni yuborish")]).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      let phone = "";
      if (ctx.message.contact) {
        phone = ctx.message.contact.phone_number;
        if (!phone.startsWith('+')) phone = '+' + phone;
      } else {
        await ctx.reply("❌ Telefon noto‘g‘ri formatda. Iltimos, tugma orqali yuboring.");
        return;
      }
      ctx.wizard.state.phone = phone;

      await ctx.reply("Viloyatingizni tanlang:", 
        Markup.keyboard(REGIONS.map(r => [r])).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      const region = ctx.message.text;
      if (!REGIONS.includes(region)) {
        return ctx.reply("Iltimos, ro'yxatdan tanlang.");
      }
      ctx.wizard.state.region = region;
      const districts = DISTRICTS[region] || ["Boshqa"];
      await ctx.reply("Tuman/Shaharni tanlang:", 
        Markup.keyboard(districts.map((d: string) => [d])).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      ctx.wizard.state.district = ctx.message.text;
      await ctx.reply("Manzilingizni aniqroq aniqlash uchun lokatsiyangizni yuboring (ixtiyoriy):", 
        Markup.keyboard([
          [Markup.button.locationRequest("📍 Lokatsiyani yuborish")],
          ["O'tkazib yuborish"]
        ]).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      if (ctx.message.location) {
        ctx.wizard.state.latitude = ctx.message.location.latitude;
        ctx.wizard.state.longitude = ctx.message.location.longitude;
      }
      
      await ctx.reply("Muammo turini tanlang:", 
        Markup.keyboard([
          ["Yo'l", "Suv"],
          ["Chiroq", "Axlat"],
          ["Boshqa"]
        ]).oneTime().resize()
      );
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      const typeMap: any = { "Yo'l": "yol", "Suv": "suv", "Chiroq": "chiroq", "Axlat": "axlat", "Boshqa": "boshqa" };
      const type = typeMap[ctx.message.text];
      if (!type) {
        await ctx.reply("Iltimos, tugmalardan birini tanlang.");
        return;
      }
      ctx.wizard.state.problem_type = type;
      await ctx.reply("Muammo tavsifini yozing:", Markup.removeKeyboard());
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      const description = ctx.message.text;
      const { full_name, phone, pinfl, nationality, region, district, problem_type, latitude, longitude } = ctx.wizard.state;
      const telegram_id = ctx.from.id.toString();

      try {
        const id = problemService.create({ 
          full_name, 
          phone, 
          pinfl,
          nationality,
          email: undefined,
          category: 'general',
          region,
          district,
          problem_type, 
          description, 
          telegram_id,
          latitude,
          longitude
        });
        await ctx.reply(`✅ Murojaat qabul qilindi! ID: ${id}\n\n🔎 Holatini tekshirish uchun ID ni saqlab qo‘ying.`,
          Markup.keyboard([
            ["📩 Muammo yuborish"],
            ["🔎 Holatini tekshirish"],
            [Markup.button.webApp("🌐 Saytni ochish", APP_URL)]
          ]).resize()
        );
        
        // Notify Admins
        const admins = problemService.getLoggedInAdmins();
        const adminMsg = `🆕 Yangi murojaat!\n\n` +
                         `🆔 ID: ${id}\n` +
                         `👤 Kimdan: ${full_name}\n` +
                         `📍 Manzil: ${region}, ${district}\n` +
                         `📝 Muammo: ${description}\n` +
                         `📞 Tel: ${phone}`;
        for (const admin of admins) {
          try {
            await adminBot?.telegram.sendMessage(admin.telegram_id, adminMsg);
          } catch (e) {}
        }
      } catch (e) {
        await ctx.reply("❌ Server xatosi. Keyinroq urinib ko‘ring.");
      }
      return ctx.scene.leave();
    }
  );

  const stage = new Scenes.Stage([submitScene] as any);
  bot.use(session());
  bot.use(stage.middleware() as any);

  bot.start((ctx) => {
    ctx.reply("Assalomu alaykum! Raqamli Mahalla botiga xush kelibsiz.", 
      Markup.keyboard([
        ["📩 Muammo yuborish"],
        ["🔎 Holatini tekshirish"],
        [Markup.button.webApp("🌐 Saytni ochish", APP_URL)]
      ]).resize()
    );
  });

  bot.hears("📩 Muammo yuborish", (ctx: any) => ctx.scene.enter('submit_problem'));

  bot.hears("🔎 Holatini tekshirish", async (ctx) => {
    await ctx.reply("Murojaat ID raqamini kiriting (Masalan: ABC123):");
  });

  bot.on("text", async (ctx, next) => {
    const text = ctx.message.text;
    const telegram_id = ctx.from.id.toString();

    // Check if it's a follow-up message (not a command or menu button)
    if (!text.startsWith('/') && !["📩 Muammo yuborish", "🔎 Holatini tekshirish"].includes(text)) {
      // Find the last problem submitted by this user
      const problems = problemService.getAll({ search: telegram_id });
      const lastProblem = problems.sort((a, b) => b.id - a.id)[0];
      
      if (lastProblem) {
        problemService.addMessage(lastProblem.id, 'user', text);
        
        // Notify admins
        const admins = problemService.getLoggedInAdmins();
        const adminMsg = `💬 Yangi xabar (ID: ${lastProblem.public_id})\n` +
                         `👤 ${lastProblem.full_name}:\n` +
                         `"${text}"`;
        for (const admin of admins) {
          try {
            await adminBot?.telegram.sendMessage(admin.telegram_id, adminMsg);
          } catch (e) {}
        }
        return ctx.reply("✅ Xabaringiz adminlarga yuborildi.");
      }
    }

    if (/^[A-Z0-9]{6}$/.test(text.toUpperCase())) {
      const problem = problemService.getById(text.toUpperCase());
      if (problem) {
        let response = `📌 ID: ${problem.public_id}\n`;
        response += `📝 Muammo: ${problem.description}\n`;
        response += `✅ Holati: ${problem.status}\n`;
        
        const messages = problemService.getMessages(problem.id);
        if (messages.length > 0) {
          response += `\n💬 Chat tarixi:\n`;
          messages.forEach(m => {
            response += `${m.sender === 'admin' ? '👨‍💼 Admin' : '👤 Siz'}: ${m.message}\n`;
          });
        }
        
        await ctx.reply(response);
      } else {
        await ctx.reply("❌ Murojaat topilmadi.");
      }
      return;
    }
    return next();
  });

  bot.launch().catch(err => console.error("Bot launch error:", err));
  console.log("Citizen bot started");
}

if (adminBotToken) {
  adminBot = new Telegraf(adminBotToken);

  const adminLoginScene = new Scenes.WizardScene(
    'admin_login',
    async (ctx: any) => {
      await ctx.reply("Admin loginini kiriting:", Markup.removeKeyboard());
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      ctx.wizard.state.username = ctx.message.text;
      await ctx.reply("Parolni kiriting:");
      return ctx.wizard.next();
    },
    async (ctx: any) => {
      const password = ctx.message.text;
      const username = ctx.wizard.state.username;
      const admin = problemService.adminLogin(username, password, ctx.from.id.toString());
      
      if (admin) {
        await ctx.reply("✅ Muvaffaqiyatli kirdingiz! Endi yangi murojaatlar haqida xabar olasiz.",
          Markup.keyboard([
            [Markup.button.webApp("⚙️ Boshqaruv paneli", `${APP_URL}?admin=true`)]
          ]).resize()
        );
      } else {
        await ctx.reply("❌ Login yoki parol xato. Qaytadan urinib ko'ring.",
          Markup.keyboard([["🔐 Kirish"]]).resize()
        );
      }
      return ctx.scene.leave();
    }
  );

  const adminStage = new Scenes.Stage([adminLoginScene] as any);
  adminBot.use(session());
  adminBot.use(adminStage.middleware() as any);

  adminBot.start((ctx: any) => {
    ctx.reply("Assalomu alaykum Admin! Boshqaruv paneliga xush kelibsiz.", 
      Markup.keyboard([
        ["🔐 Kirish"],
        ["📋 Murojaatlar"],
        [Markup.button.webApp("⚙️ Boshqaruv paneli", `${APP_URL}?admin=true`)]
      ]).resize()
    );
  });

  adminBot.hears("🔐 Kirish", (ctx: any) => ctx.scene.enter('admin_login'));

  adminBot.hears("📋 Murojaatlar", async (ctx: any) => {
    const admin = problemService.getAdminByTelegramId(ctx.from.id.toString());
    if (!admin) return ctx.reply("Iltimos, avval tizimga kiring.");

    const problems = problemService.getAll({ status: 'Yangi' }).slice(0, 10);
    if (problems.length === 0) return ctx.reply("Hozircha yangi murojaatlar yo'q.");

    for (const p of problems) {
      await ctx.reply(
        `🆔 ID: ${p.public_id}\n` +
        `👤 Kimdan: ${p.full_name}\n` +
        `📍 Manzil: ${p.region || 'Noma\'lum'}, ${p.district || 'Noma\'lum'}\n` +
        `📝 Muammo: ${p.description}\n` +
        `📞 Tel: ${p.phone}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("✅ Ko'rildi", `status_${p.id}_Ko'rilmoqda`)],
          [Markup.button.callback("➡️ Hokim yordamchisiga", `assign_${p.id}_Hokim yordamchisi`)],
          [Markup.button.callback("➡️ Inspektorga", `assign_${p.id}_Profilaktika inspektori`)]
        ])
      );
    }
  });

  adminBot.action(/status_(\d+)_(.+)/, async (ctx: any) => {
    const id = parseInt(ctx.match[1]);
    const status = ctx.match[2];
    problemService.updateStatus(id, status as any);
    await ctx.answerCbQuery(`Holat o'zgardi: ${status}`);
    await ctx.editMessageText(ctx.callbackQuery.message.text + `\n\n✅ Holat: ${status}`);
  });

  adminBot.action(/assign_(\d+)_(.+)/, async (ctx: any) => {
    const id = parseInt(ctx.match[1]);
    const official = ctx.match[2];
    problemService.updateAssignedOfficial(id, official);
    await ctx.answerCbQuery(`Yo'naltirildi: ${official}`);
    await ctx.editMessageText(ctx.callbackQuery.message.text + `\n\n➡️ Yo'naltirildi: ${official}`);
  });

  adminBot.on('text', async (ctx) => {
    const admin = problemService.getAdminByTelegramId(ctx.from.id.toString());
    if (!admin) return ctx.reply("Iltimos, avval tizimga kiring.");

    if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message) {
      const originalText = ctx.message.reply_to_message.text || "";
      const match = originalText.match(/ID: ([A-Z0-9]{6})/);
      if (match) {
        const publicId = match[1];
        const problem = problemService.getById(publicId);
        if (problem) {
          problemService.updateStatus(problem.id, problem.status, ctx.message.text);
          problemService.addMessage(problem.id, 'admin', ctx.message.text);
          
          // Notify user
          if (problem.telegram_id && bot) {
            await bot.telegram.sendMessage(problem.telegram_id, `👨‍💼 Admin javobi (ID: ${publicId}):\n\n"${ctx.message.text}"`);
          }
          ctx.reply("✅ Javobingiz yuborildi.");
        }
      }
    }
  });

  adminBot.launch().catch(err => console.error("Admin Bot launch error:", err));
  console.log("Admin bot started");
}

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
