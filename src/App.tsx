import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  PlusCircle, 
  Settings, 
  Phone, 
  User, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search,
  Filter,
  ArrowLeft,
  Send,
  Menu,
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ProblemType = 'yol' | 'suv' | 'chiroq' | 'axlat' | 'boshqa';
type Status = 'Yangi' | 'Ko\'rilmoqda' | 'Hal qilindi' | 'Rad etildi';

interface Problem {
  id: number;
  public_id: string;
  full_name: string;
  phone: string;
  pinfl: string;
  nationality: string;
  email: string;
  category: 'general' | 'adliya' | 'prokuratura' | 'davlat_xizmatlari';
  region: string;
  district: string;
  problem_type: ProblemType;
  description: string;
  status: Status;
  admin_reply: string;
  replied_at: string | null;
  created_at: string;
  latitude?: number;
  longitude?: number;
  assigned_official: string;
}

const REGIONS = [
  "Toshkent sh.", "Toshkent vil.", "Andijon", "Buxoro", "Farg'ona", 
  "Jizzax", "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", 
  "Qoraqalpog'iston", "Samarqand", "Sirdaryo", "Surxondaryo"
];

const DISTRICTS: any = {
  "Toshkent sh.": ["Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Mirobod", "Yakkasaroy", "Shayxontohur", "Olmazor", "Sergeli", "Yashnobod", "Bektemir", "Uchtepa", "Yangihayot"],
  "Andijon": ["Andijon sh.", "Asaka", "Baliqchi", "Bo'ston", "Buloqboshi", "Izboskan", "Jalaquduq", "Marhamat", "Oltinko'l", "Paxtaobod", "Qo'rg'ontepa", "Shahrixon", "Ulug'nor", "Xo'jaobod"],
  "Buxoro": ["Buxoro sh.", "G'ijduvon", "Kogon", "Olot", "Peshku", "Qorako'l", "Qorovulbozor", "Romitan", "Shofirkon", "Vobkent"],
  "Farg'ona": ["Farg'ona sh.", "Marg'ilon", "Qo'qon", "Quva", "Oltiariq", "Bog'dod", "Beshariq", "Uchko'prik", "Rishton", "Yozyovon"],
  "Samarqand": ["Samarqand sh.", "Bulung'ur", "Ishtixon", "Jomboy", "Kattaqo'rg'on", "Narpay", "Nurobod", "Oqdaryo", "Paxtachi", "Payariq", "Pastdarg'om", "Toyloq", "Urgut"]
};

const TYPE_LABELS: Record<ProblemType, string> = {
  yol: "Yo'l",
  suv: "Suv",
  chiroq: "Chiroq",
  axlat: "Axlat",
  boshqa: "Boshqa"
};

const STATUS_COLORS: Record<Status, string> = {
  'Yangi': 'bg-blue-100 text-blue-700 border-blue-200',
  'Ko\'rilmoqda': 'bg-amber-100 text-amber-700 border-amber-200',
  'Hal qilindi': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rad etildi': 'bg-red-100 text-red-700 border-red-200'
};

export default function App() {
  const [view, setView] = useState<'home' | 'submit' | 'admin' | 'check'>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', type: '', search: '' });

  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Status check state
  const [checkId, setCheckId] = useState('');
  const [checkResult, setCheckResult] = useState<Problem | null>(null);
  const [checkError, setCheckError] = useState('');

  // Admin reply state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adminReply, setAdminReply] = useState('');
  const [selectedOfficial, setSelectedOfficial] = useState('Mahalla raisi');

  const officials = [
    { id: 'raisi', name: 'Mahalla raisi', icon: '🏛️' },
    { id: 'yordamchi', name: 'Hokim yordamchisi', icon: '🤝' },
    { id: 'xotin_qizlar', name: 'Xotin-qizlar faoli', icon: '👩' },
    { id: 'yoshlar', name: 'Yoshlar yetakchisi', icon: '👦' },
    { id: 'inspektor', name: 'Profilaktika inspektori', icon: '👮' },
    { id: 'soliq', name: 'Soliq inspektori', icon: '💰' },
    { id: 'ijtimoiy', name: 'Ijtimoiy xodim', icon: '🏥' }
  ];

  const handleAssign = async (problemId: number, official: string) => {
    try {
      const res = await fetch(`/api/admin/problems/${problemId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ official })
      });
      if (res.ok) {
        fetchProblems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '+998',
    pinfl: '',
    nationality: 'O\'zbek',
    email: '',
    category: 'general' as Problem['category'],
    region: '',
    district: '',
    problem_type: 'yol' as ProblemType,
    description: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined
  });
  const [captcha, setCaptcha] = useState({ q: '', a: 0 });
  const [userCaptcha, setUserCaptcha] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    // Auto-admin detection from URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setView('admin');
    }
    generateCaptcha();
  }, []);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setCaptcha({ q: `${n1} + ${n2} = ?`, a: n1 + n2 });
  };

  useEffect(() => {
    if (view === 'admin' && isAdmin) {
      fetchProblems();
    }
  }, [view, filters, isAdmin]);

  useEffect(() => {
    if (view === 'submit') {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          setFormData(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        });
      }
    }
  }, [view]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (data.ok) {
        setIsAdmin(true);
      } else {
        setLoginError(data.error);
      }
    } catch (err) {
      setLoginError('Server xatosi');
    } finally {
      setLoading(false);
    }
  };

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/admin/problems?${query}`);
      const data = await res.json();
      setProblems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (parseInt(userCaptcha) !== captcha.a) {
      setFormError('Captcha noto\'g\'ri');
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/problem/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.ok) {
        setFormSuccess(true);
        setTimeout(() => {
          setFormSuccess(false);
          setView('home');
          setFormData({ 
            full_name: '', 
            phone: '+998', 
            pinfl: '',
            nationality: 'O\'zbek',
            email: '',
            category: 'general',
            region: '',
            district: '',
            problem_type: 'yol', 
            description: '', 
            latitude: undefined, 
            longitude: undefined 
          });
          setUserCaptcha('');
          generateCaptcha();
        }, 2000);
      } else {
        setFormError(data.error);
        generateCaptcha();
      }
    } catch (err) {
      setFormError('Server bilan bog\'lanishda xatolik');
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: Status, reply?: string) => {
    try {
      await fetch(`/api/admin/problems/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_reply: reply })
      });
      setEditingId(null);
      setAdminReply('');
      fetchProblems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError('');
    setCheckResult(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/problem/status/${checkId}`);
      const data = await res.json();
      if (data.ok) {
        setCheckResult(data);
      } else {
        setCheckError(data.error);
      }
    } catch (err) {
      setCheckError('Server xatosi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 relative overflow-x-hidden">
      {/* Background Watermark */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-0">
        <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/Coat_of_arms_of_Uzbekistan.svg" alt="" className="w-[800px]" />
      </div>

      {/* State Header */}
      <div className="bg-[#001529] border-b border-slate-800 py-3 px-6 relative z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img src="https://upload.wikimedia.org/wikipedia/commons/8/84/Flag_of_Uzbekistan.svg" alt="Flag" className="w-6 shadow-sm" />
              <span>O'zbekiston Respublikasi</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 border-l border-slate-700 pl-8">
              <img src="https://raw.githubusercontent.com/shamsiddin-dev/assets/main/uzb-gerb.png" alt="Gerb" className="w-6" onError={(e) => {
                (e.target as HTMLImageElement).src = "https://upload.wikimedia.org/wikipedia/commons/7/70/Coat_of_arms_of_Uzbekistan.svg";
              }} />
              <span>Davlat xizmatlari portali</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            <span className="text-emerald-400">Yagona interaktiv davlat xizmatlari portali</span>
            <span className="text-white">Ishonch telefoni: 1148</span>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between h-24 items-center">
            <div 
              className="flex items-center gap-5 cursor-pointer group" 
              onClick={() => setView('home')}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/Coat_of_arms_of_Uzbekistan.svg" alt="Gerb" className="w-16 h-16 group-hover:scale-110 transition-all duration-500 drop-shadow-md" />
              <div className="flex flex-col">
                <span className="font-black text-2xl tracking-tighter text-[#001529] leading-none">RAQAMLI</span>
                <span className="font-black text-sm tracking-[0.3em] text-emerald-600 leading-none mt-1">MAHALLA.UZ</span>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-1">
              <NavButton active={view === 'home'} onClick={() => setView('home')}>Bosh sahifa</NavButton>
              <NavButton active={view === 'submit'} onClick={() => setView('submit')}>Yuborish</NavButton>
              <NavButton active={view === 'check'} onClick={() => setView('check')}>Tekshirish</NavButton>
              <div className="w-px h-4 bg-slate-200 mx-3" />
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-3 rounded-2xl hover:bg-slate-100 text-slate-600 transition-all"
              >
                <Menu size={24} />
              </button>
            </div>

            <button 
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-3 rounded-2xl hover:bg-slate-100 text-slate-600 transition-all"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white z-[70] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-3">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/Coat_of_arms_of_Uzbekistan.svg" alt="Gerb" className="w-8" />
                  <span className="font-black text-lg tracking-tight">Menyu</span>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-3 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-2 flex-1">
                <MenuLink active={view === 'home'} onClick={() => { setView('home'); setIsMenuOpen(false); }} icon={<Home size={20} />}>Bosh sahifa</MenuLink>
                <MenuLink active={view === 'submit'} onClick={() => { setView('submit'); setIsMenuOpen(false); }} icon={<PlusCircle size={20} />}>Murojaat yuborish</MenuLink>
                <MenuLink active={view === 'check'} onClick={() => { setView('check'); setIsMenuOpen(false); }} icon={<Search size={20} />}>Holatni tekshirish</MenuLink>
                
                <div className="h-px bg-slate-100 my-6" />
                
                <a 
                  href="https://t.me/raqamlimahalla_bot" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-emerald-50 text-emerald-600 font-bold transition-all group selection:bg-transparent"
                >
                  <div className="flex items-center gap-4">
                    <MessageSquare size={20} className="text-emerald-500" />
                    <span>Bizning Telegram botimiz</span>
                  </div>
                  <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-all" />
                </a>

                <button 
                  onClick={() => { setView('admin'); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-100 text-slate-600 font-bold transition-all selection:bg-transparent"
                >
                  <ShieldCheck size={20} className="text-slate-400" />
                  <span>Adminlar uchun kirish</span>
                </button>
              </div>

              <div className="pt-8 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  © 2024 Raqamli Mahalla • O'zbekiston
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-32"
            >
              <div className="text-center space-y-10 py-20">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
                >
                  Mahalla obodonlashtirish platformasi
                </motion.div>
                <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-8">
                  Mahallangizni <br />
                  <span className="text-emerald-600">birga obod qilamiz.</span>
                </h1>
                <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
                  Muammolarni tezkor yuboring, holatini kuzating va natijaga erishing. Hammasi raqamli, shaffof va ishonchli.
                </p>
                <div className="flex flex-wrap justify-center gap-6 pt-8">
                  <button 
                    onClick={() => setView('submit')}
                    className="bg-slate-900 hover:bg-black text-white px-12 py-6 rounded-2xl font-black text-xl shadow-2xl shadow-slate-300 transition-all active:scale-95 flex items-center gap-3 border-b-4 border-slate-700"
                  >
                    <PlusCircle size={24} />
                    Muammo yuborish
                  </button>
                  <button 
                    onClick={() => setView('check')}
                    className="bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 px-12 py-6 rounded-2xl font-black text-xl shadow-sm transition-all active:scale-95 flex items-center gap-3 border-b-4 border-slate-100"
                  >
                    <Search size={24} />
                    Holatni tekshirish
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                <FeatureCard 
                  number="01"
                  title="Xabar bering"
                  desc="Yo'l, suv, chiroq yoki boshqa muammolarni bir zumda yuboring. Lokatsiyangizni ham ilova qilishingiz mumkin."
                />
                <FeatureCard 
                  number="02"
                  title="Kuzatib boring"
                  desc="Murojaatingiz qaysi bosqichda ekanligini real vaqtda ko'ring. Admin bilan to'g'ridan-to'g'ri muloqot qiling."
                />
                <FeatureCard 
                  number="03"
                  title="Natija oling"
                  desc="Muammolar hal qilingach, sizga bot orqali xabar boradi. Mahallangiz rivojiga o'z hissangizni qo'shing."
                />
              </div>

              {/* Stats Section */}
              <div className="bg-slate-900 rounded-[48px] p-16 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                  <div>
                    <div className="text-5xl font-black mb-2">1,200+</div>
                    <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Hal etilgan muammolar</div>
                  </div>
                  <div>
                    <div className="text-5xl font-black mb-2">450+</div>
                    <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aktiv foydalanuvchilar</div>
                  </div>
                  <div>
                    <div className="text-5xl font-black mb-2">24/7</div>
                    <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tezkor aloqa</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'submit' && (
            <motion.div 
              key="submit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/40 border border-slate-200/50 p-12">
                <div className="mb-12">
                  <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Murojaat yaratish</h2>
                  <p className="text-lg text-slate-500 font-medium">Iltimos, barcha ma'lumotlarni aniq to'ldiring.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-10">
                  {formError && (
                    <div className="bg-red-50 text-red-600 p-5 rounded-2xl flex items-center gap-3 border border-red-100">
                      <AlertCircle size={20} />
                      <span className="text-sm font-bold">{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="bg-emerald-50 text-emerald-600 p-5 rounded-2xl flex items-center gap-3 border border-emerald-100">
                      <CheckCircle2 size={20} />
                      <span className="text-sm font-bold">Murojaat muvaffaqiyatli yuborildi!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">F.I.O (To'liq)</label>
                        <input 
                          required
                          type="text"
                          placeholder="Shakirdjan Rametov Ermatovich"
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                          value={formData.full_name}
                          onChange={e => setFormData({...formData, full_name: e.target.value})}
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">PINFL (Ixtiyoriy)</label>
                        <input 
                          type="text"
                          maxLength={14}
                          placeholder="00000000000000"
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                          value={formData.pinfl}
                          onChange={e => setFormData({...formData, pinfl: e.target.value})}
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Millati (Ixtiyoriy)</label>
                        <input 
                          type="text"
                          placeholder="O'zbek"
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                          value={formData.nationality}
                          onChange={e => setFormData({...formData, nationality: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Telefon raqam</label>
                        <input 
                          required
                          type="text"
                          placeholder="+998901234567"
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Email manzili</label>
                        <input 
                          type="email"
                          placeholder="example@mail.uz"
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Murojaat yo'nalishi</label>
                        <select 
                          required
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 font-bold appearance-none"
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value as any})}
                        >
                          <option value="general">Umumiy muammolar</option>
                          <option value="adliya">Adliyaga murojaat</option>
                          <option value="prokuratura">Prokuraturaga murojaat</option>
                          <option value="davlat_xizmatlari">Davlat xizmatlari</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Viloyat</label>
                      <select 
                        required
                        className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 font-bold appearance-none"
                        value={formData.region}
                        onChange={e => setFormData({...formData, region: e.target.value, district: ''})}
                      >
                        <option value="">Tanlang</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Tuman / Shahar</label>
                      <select 
                        required
                        disabled={!formData.region}
                        className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 font-bold appearance-none disabled:opacity-50"
                        value={formData.district}
                        onChange={e => setFormData({...formData, district: e.target.value})}
                      >
                        <option value="">Tanlang</option>
                        {(DISTRICTS[formData.region] || ["Boshqa"]).map((d: string) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Muammo turi</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({...formData, problem_type: val as ProblemType})}
                          className={cn(
                            "px-4 py-4 rounded-2xl text-sm font-black transition-all border-2",
                            formData.problem_type === val 
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100 scale-105" 
                              : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Tavsif</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="Muammoni batafsil tushuntiring..."
                      className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all resize-none text-slate-900 placeholder:text-slate-400 font-bold"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Captcha: {captcha.q}</label>
                    <input 
                      required
                      type="number"
                      placeholder="Natijani kiriting"
                      className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                      value={userCaptcha}
                      onChange={e => setUserCaptcha(e.target.value)}
                    />
                  </div>

                  <button 
                    disabled={loading}
                    type="submit"
                    className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {loading ? "Yuborilmoqda..." : "Yuborish"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'check' && (
            <motion.div 
              key="check"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/40 border border-slate-200/50 p-12">
                <div className="mb-12">
                  <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Holatni tekshirish</h2>
                  <p className="text-lg text-slate-500 font-medium">Murojaat ID raqamini kiriting.</p>
                </div>

                <form onSubmit={handleCheckStatus} className="flex flex-col sm:flex-row gap-4 mb-12">
                  <input 
                    type="text" 
                    placeholder="Masalan: ABC123"
                    className="flex-1 px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 text-xl font-bold"
                    value={checkId}
                    onChange={e => setCheckId(e.target.value.toUpperCase())}
                    required
                  />
                  <button 
                    type="submit"
                    className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                  >
                    Tekshirish
                  </button>
                </form>

                {checkError && (
                  <div className="text-center py-8 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-red-600 font-bold">{checkError}</p>
                  </div>
                )}

                {checkResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 pt-6 border-t border-slate-100"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Holati</span>
                      <span className={cn("px-4 py-1.5 rounded-full text-xs font-bold border", STATUS_COLORS[checkResult.status])}>
                        {checkResult.status}
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chat tarixi</span>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Siz (Asosiy)</span>
                          <p className="text-slate-700 text-sm">{checkResult.description}</p>
                        </div>
                        
                        <ChatHistory problemId={checkResult.id} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'admin' && !isAdmin && (
            <motion.div 
              key="admin-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/40 border border-slate-200/50 p-12">
                <div className="mb-12 text-center">
                  <div className="bg-slate-900 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-slate-200">
                    <Settings className="text-white w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Admin Kirish</h2>
                  <p className="text-lg text-slate-500 font-medium">Tizimga kirish uchun ma'lumotlarni kiriting.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-8">
                  {loginError && (
                    <div className="bg-red-50 text-red-600 p-5 rounded-2xl text-sm font-bold border border-red-100 text-center">
                      {loginError}
                    </div>
                  )}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                    <input 
                      type="text"
                      className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none transition-all text-lg font-medium"
                      value={loginData.username}
                      onChange={e => setLoginData({...loginData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Parol</label>
                    <input 
                      type="password"
                      className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none transition-all text-lg font-medium"
                      value={loginData.password}
                      onChange={e => setLoginData({...loginData, password: e.target.value})}
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 rounded-2xl bg-slate-900 text-white font-bold text-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 shadow-2xl shadow-slate-200"
                  >
                    {loading ? "Kirilmoqda..." : "Kirish"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'admin' && isAdmin && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              {/* Officials Dashboard */}
              <div className="bg-white p-2 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
                {officials.map(off => (
                  <button
                    key={off.id}
                    onClick={() => setSelectedOfficial(off.name)}
                    className={cn(
                      "flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm transition-all whitespace-nowrap",
                      selectedOfficial === off.name 
                        ? "bg-[#001529] text-white shadow-lg shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-xl">{off.icon}</span>
                    {off.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center gap-4">
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{selectedOfficial}</h2>
                    <button 
                      onClick={() => setIsAdmin(false)}
                      className="text-xs font-bold text-red-500 hover:underline"
                    >Chiqish</button>
                  </div>
                  <p className="text-slate-500 mt-1">Sizga biriktirilgan murojaatlarni nazorat qiling.</p>
                </div>
                
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Qidirish..."
                      className="pl-12 pr-6 py-3 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none w-full transition-all"
                      value={filters.search}
                      onChange={e => setFilters({...filters, search: e.target.value})}
                    />
                  </div>
                  <select 
                    className="px-6 py-3 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    value={filters.status}
                    onChange={e => setFilters({...filters, status: e.target.value})}
                  >
                    <option value="">Barcha holatlar</option>
                    <option value="Yangi">Yangi</option>
                    <option value="Ko'rilmoqda">Ko'rilmoqda</option>
                    <option value="Hal qilindi">Hal qilindi</option>
                    <option value="Rad etildi">Rad etildi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {loading ? (
                  <div className="text-center py-40 text-slate-400 font-bold text-2xl animate-pulse tracking-tight">Yuklanmoqda...</div>
                ) : problems.length === 0 ? (
                  <div className="text-center py-40 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-slate-400 text-xl font-medium">
                    Murojaatlar topilmadi
                  </div>
                ) : problems.filter(p => p.assigned_official === selectedOfficial).length === 0 ? (
                  <div className="text-center py-40 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-slate-400 text-xl font-medium">
                    Bu xodimga biriktirilgan murojaatlar yo'q
                  </div>
                ) : (
                  problems.filter(p => p.assigned_official === selectedOfficial).map(problem => (
                      <motion.div 
                      layout
                      key={problem.id} 
                      className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200/60 hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500"
                    >
                      <div className="flex flex-col lg:flex-row justify-between gap-12">
                        <div className="space-y-6 flex-1">
                          <div className="flex flex-wrap items-center gap-4">
                            <span className={cn("px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.1em] border-2", STATUS_COLORS[problem.status])}>
                              {problem.status}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-full">
                              ID: {problem.public_id} • {new Date(problem.created_at).toLocaleDateString('uz-UZ')}
                            </span>
                          </div>
                          <h3 className="text-3xl font-black text-slate-900 tracking-tight">{problem.full_name}</h3>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-slate-500">
                            <span>📍 {problem.region}, {problem.district}</span>
                            <span>🆔 PINFL: {problem.pinfl || 'Mavjud emas'}</span>
                            <span>📧 {problem.email || 'Email yo\'q'}</span>
                            <span className="text-emerald-600 uppercase tracking-widest text-[10px] bg-emerald-50 px-2 py-1 rounded-md">
                              {problem.category === 'general' ? 'Umumiy' : problem.category.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <span className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100"><Phone size={16} className="text-slate-400" /> {problem.phone}</span>
                            <span className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100"><Filter size={16} className="text-slate-400" /> {TYPE_LABELS[problem.problem_type]}</span>
                            {problem.latitude && problem.longitude && (
                              <a 
                                href={`https://www.google.com/maps?q=${problem.latitude},${problem.longitude}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-2xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                              >
                                <Settings size={16} /> Lokatsiya
                              </a>
                            )}
                          </div>
                          <div className="bg-slate-50/80 p-8 rounded-3xl border border-slate-100 relative">
                            <MessageSquare className="absolute -top-3 -left-3 text-slate-200 w-8 h-8" />
                            <p className="text-slate-700 text-lg font-medium leading-relaxed">
                              {problem.description}
                            </p>
                          </div>
                          {problem.admin_reply && (
                            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100/50">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-2">Sizning javobingiz</span>
                              <p className="text-emerald-800 text-sm leading-relaxed">{problem.admin_reply}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-row md:flex-col gap-2 justify-end min-w-[160px]">
                          <StatusButton 
                            active={problem.status === 'Yangi'} 
                            onClick={() => updateStatus(problem.id, 'Yangi')}
                            color="blue"
                          >Yangi</StatusButton>
                          <StatusButton 
                            active={problem.status === 'Ko\'rilmoqda'} 
                            onClick={() => updateStatus(problem.id, 'Ko\'rilmoqda')}
                            color="amber"
                          >Ko'rilmoqda</StatusButton>
                          <StatusButton 
                            active={problem.status === 'Hal qilindi'} 
                            onClick={() => updateStatus(problem.id, 'Hal qilindi')}
                            color="emerald"
                          >Hal qilindi</StatusButton>
                          <StatusButton 
                            active={problem.status === 'Rad etildi'} 
                            onClick={() => updateStatus(problem.id, 'Rad etildi')}
                            color="red"
                          >Rad etildi</StatusButton>
                          
                          <div className="mt-4 space-y-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Mas'ul xodim</span>
                            <select 
                              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
                              value={problem.assigned_official}
                              onChange={(e) => handleAssign(problem.id, e.target.value)}
                            >
                              {officials.map(off => (
                                <option key={off.id} value={off.name}>{off.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <button 
                            onClick={() => {
                              setEditingId(problem.id);
                              setAdminReply(problem.admin_reply);
                            }}
                            className="mt-4 py-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                          >
                            Javob yozish
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {editingId === problem.id && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-8 pt-8 border-t border-slate-100 space-y-4 overflow-hidden"
                          >
                            <textarea 
                              className="w-full p-6 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 placeholder:text-slate-300"
                              placeholder="Javob matnini kiriting..."
                              value={adminReply}
                              onChange={e => setAdminReply(e.target.value)}
                              rows={3}
                            />
                            <div className="flex justify-end gap-3">
                              <button onClick={() => setEditingId(null)} className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600">Bekor qilish</button>
                              <button 
                                onClick={() => updateStatus(problem.id, problem.status, adminReply)}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95"
                              >
                                Saqlash va jo'natish
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ChatHistory({ problemId }: { problemId: number }) {
  const [messages, setMessages] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch(`/api/problem/messages/${problemId}`)
      .then(res => res.json())
      .then(setMessages);
  }, [problemId]);

  return (
    <>
      {messages.map(m => (
        <div 
          key={m.id} 
          className={cn(
            "p-4 rounded-2xl border",
            m.sender === 'admin' ? "bg-emerald-50 border-emerald-100 ml-4" : "bg-slate-50 border-slate-100 mr-4"
          )}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
            {m.sender === 'admin' ? '👨‍💼 Admin' : '👤 Siz'}
          </span>
          <p className="text-slate-700 text-sm">{m.message}</p>
        </div>
      ))}
    </>
  );
}

function MenuLink({ children, active, onClick, icon }: { children: React.ReactNode, active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all",
        active 
          ? "bg-[#001529] text-white shadow-xl shadow-slate-200" 
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      <span className={cn("transition-colors", active ? "text-white" : "text-slate-400")}>{icon}</span>
      <span className="selection:bg-transparent">{children}</span>
    </button>
  );
}

function NavButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300",
        active 
          ? "bg-slate-900 text-white shadow-xl shadow-slate-200 scale-105" 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      )}
    >
      {children}
    </button>
  );
}

function FeatureCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="bg-white p-12 rounded-[48px] shadow-sm border border-slate-200/60 hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-emerald-50 transition-colors duration-500" />
      <span className="text-6xl font-black text-slate-100 group-hover:text-emerald-100 transition-colors duration-500 block mb-8 relative z-10">{number}</span>
      <h3 className="text-3xl font-black mb-4 text-slate-900 relative z-10 tracking-tight">{title}</h3>
      <p className="text-lg text-slate-500 leading-relaxed font-medium relative z-10">{desc}</p>
    </div>
  );
}

function StatusButton({ children, active, onClick, color }: { children: React.ReactNode, active: boolean, onClick: () => void, color: 'blue' | 'amber' | 'emerald' | 'red' }) {
  const colors = {
    blue: active ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" : "hover:bg-blue-50 text-blue-600 border-slate-100",
    amber: active ? "bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-100" : "hover:bg-amber-50 text-amber-600 border-slate-100",
    emerald: active ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100" : "hover:bg-emerald-50 text-emerald-600 border-slate-100",
    red: active ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-100" : "hover:bg-red-50 text-red-600 border-slate-100",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
        colors[color]
      )}
    >
      {children}
    </button>
  );
}
