import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'mahalla.db'));

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    pinfl TEXT,
    nationality TEXT,
    email TEXT,
    category TEXT DEFAULT 'general',
    region TEXT,
    district TEXT,
    problem_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'Yangi',
    admin_reply TEXT DEFAULT '',
    replied_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    telegram_id TEXT,
    latitude REAL,
    longitude REAL,
    assigned_official TEXT DEFAULT 'Mahalla raisi'
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    telegram_id TEXT
  );

  CREATE TABLE IF NOT EXISTS problem_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    sender TEXT NOT NULL, -- 'user' or 'admin'
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(problem_id) REFERENCES problems(id)
  );
`);

// Seed admin if not exists
const adminExists = db.prepare("SELECT COUNT(*) as count FROM admins").get() as any;
if (adminExists.count === 0) {
  db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run('admin', 'admin123');
}

// Migration: Add public_id if missing
const tableInfo = db.prepare("PRAGMA table_info(problems)").all() as any[];
const columnNames = tableInfo.map(col => col.name);

if (!columnNames.includes('public_id')) {
  db.exec("ALTER TABLE problems ADD COLUMN public_id TEXT");
  // Update existing rows with random IDs
  const rows = db.prepare("SELECT id FROM problems").all() as any[];
  for (const row of rows) {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.prepare("UPDATE problems SET public_id = ? WHERE id = ?").run(randomId, row.id);
  }
}

// Migration: Add location columns if missing
if (!columnNames.includes('latitude')) {
  db.exec("ALTER TABLE problems ADD COLUMN latitude REAL");
}
if (!columnNames.includes('longitude')) {
  db.exec("ALTER TABLE problems ADD COLUMN longitude REAL");
}

// Migration: Add new columns if missing
if (!columnNames.includes('pinfl')) db.exec("ALTER TABLE problems ADD COLUMN pinfl TEXT");
if (!columnNames.includes('nationality')) db.exec("ALTER TABLE problems ADD COLUMN nationality TEXT");
if (!columnNames.includes('email')) db.exec("ALTER TABLE problems ADD COLUMN email TEXT");
if (!columnNames.includes('category')) db.exec("ALTER TABLE problems ADD COLUMN category TEXT DEFAULT 'general'");
if (!columnNames.includes('assigned_official')) db.exec("ALTER TABLE problems ADD COLUMN assigned_official TEXT DEFAULT 'Mahalla raisi'");

export interface Problem {
  id: number;
  public_id: string;
  full_name: string;
  phone: string;
  pinfl?: string;
  nationality?: string;
  email?: string;
  category?: 'general' | 'adliya' | 'prokuratura' | 'davlat_xizmatlari';
  region: string;
  district: string;
  problem_type: 'yol' | 'suv' | 'chiroq' | 'axlat' | 'boshqa';
  description: string;
  status: 'Yangi' | 'Ko\'rilmoqda' | 'Hal qilindi' | 'Rad etildi';
  admin_reply: string;
  replied_at: string | null;
  created_at: string;
  telegram_id?: string;
  latitude?: number;
  longitude?: number;
  assigned_official: string;
}

export const problemService = {
  create: (data: Omit<Problem, 'id' | 'public_id' | 'status' | 'created_at' | 'admin_reply' | 'replied_at' | 'assigned_official'> & { admin_reply?: string; replied_at?: string | null; assigned_official?: string; category?: Problem['category'] }) => {
    const public_id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const stmt = db.prepare(`
      INSERT INTO problems (public_id, full_name, phone, pinfl, nationality, email, category, region, district, problem_type, description, telegram_id, latitude, longitude, assigned_official)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      public_id, 
      data.full_name, 
      data.phone, 
      data.pinfl || null,
      data.nationality || null,
      data.email || null,
      data.category || 'general',
      data.region || null,
      data.district || null,
      data.problem_type, 
      data.description, 
      data.telegram_id || null,
      data.latitude || null,
      data.longitude || null,
      data.assigned_official || 'Mahalla raisi'
    );
    return public_id;
  },

  getAll: (filters?: { status?: string; type?: string; search?: string }) => {
    let query = 'SELECT * FROM problems WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.type) {
      query += ' AND problem_type = ?';
      params.push(filters.type);
    }
    if (filters?.search) {
      query += ' AND (full_name LIKE ? OR phone LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...params) as Problem[];
  },

  updateStatus: (id: number, status: string, admin_reply?: string) => {
    if (admin_reply !== undefined) {
      const stmt = db.prepare('UPDATE problems SET status = ?, admin_reply = ?, replied_at = CURRENT_TIMESTAMP WHERE id = ?');
      return stmt.run(status, admin_reply, id);
    } else {
      const stmt = db.prepare('UPDATE problems SET status = ? WHERE id = ?');
      return stmt.run(status, id);
    }
  },

  updateAssignedOfficial: (id: number, official: string) => {
    const stmt = db.prepare('UPDATE problems SET assigned_official = ? WHERE id = ?');
    return stmt.run(official, id);
  },

  getById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM problems WHERE public_id = ? OR id = ?');
    return stmt.get(id, id) as Problem | undefined;
  },

  adminLogin: (username: string, password: string, telegram_id?: string) => {
    const stmt = db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?');
    const admin = stmt.get(username, password);
    if (admin && telegram_id) {
      db.prepare('UPDATE admins SET telegram_id = ? WHERE id = ?').run(telegram_id, (admin as any).id);
    }
    return admin;
  },

  getAdminByTelegramId: (telegram_id: string) => {
    return db.prepare('SELECT * FROM admins WHERE telegram_id = ?').get(telegram_id);
  },

  getLoggedInAdmins: () => {
    return db.prepare('SELECT telegram_id FROM admins WHERE telegram_id IS NOT NULL').all() as { telegram_id: string }[];
  },

  addMessage: (problem_id: number, sender: 'user' | 'admin', message: string) => {
    const stmt = db.prepare('INSERT INTO problem_messages (problem_id, sender, message) VALUES (?, ?, ?)');
    return stmt.run(problem_id, sender, message);
  },

  getMessages: (problem_id: number) => {
    return db.prepare('SELECT * FROM problem_messages WHERE problem_id = ? ORDER BY created_at ASC').all() as any[];
  },

  getStats: (identifier: string, isTelegram: boolean) => {
    const field = isTelegram ? 'telegram_id' : 'phone';
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM problems 
      WHERE ${field} = ? AND created_at > datetime('now', '-1 day')
    `);
    return (stmt.get(identifier) as any).count;
  },

  checkDuplicate: (description: string, identifier: string, isTelegram: boolean) => {
    const field = isTelegram ? 'telegram_id' : 'phone';
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM problems 
      WHERE description = ? AND ${field} = ? AND created_at > datetime('now', '-5 minutes')
    `);
    return (stmt.get(description, identifier) as any).count > 0;
  }
};
