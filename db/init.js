/**
 * SQLite数据库初始化脚本
 * 自动创建数据库表结构
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

// 确保data目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

/**
 * 初始化数据库表结构
 */
function initDatabase() {
  console.log('📦 初始化SQLite数据库...');

  // 创建用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password TEXT,
      nickname TEXT DEFAULT '新用户',
      avatar TEXT DEFAULT '',
      points INTEGER DEFAULT 100,
      total_points INTEGER DEFAULT 100,
      checkin_streak INTEGER DEFAULT 0,
      max_checkin_streak INTEGER DEFAULT 0,
      last_checkin_date TEXT,
      total_checkin_days INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 创建任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT DEFAULT '',
      time_period TEXT NOT NULL CHECK(time_period IN ('morning', 'noon', 'evening', 'weekend', 'anytime')),
      base_points INTEGER DEFAULT 2,
      extra_points INTEGER DEFAULT 0,
      category TEXT DEFAULT 'daily' CHECK(category IN ('daily', 'advanced', 'growth')),
      weekend_only INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 100,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 创建打卡记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed')),
      points_earned INTEGER DEFAULT 0,
      is_makeup INTEGER DEFAULT 0,
      checked_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      UNIQUE(user_id, date, task_id)
    )
  `);

  // 创建积分变动记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('earn', 'deduct', 'reward', 'adjust', 'bonus', 'publish', 'accept', 'redeem', 'refund')),
      reason TEXT DEFAULT '',
      related_task_id INTEGER,
      related_custom_task_id INTEGER,
      balance INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (related_task_id) REFERENCES tasks(id),
      FOREIGN KEY (related_custom_task_id) REFERENCES custom_tasks(id)
    )
  `);

  // 创建自定义任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      points_required INTEGER NOT NULL,
      points_reward INTEGER NOT NULL,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'assigned', 'completed', 'cancelled')),
      assignee_id INTEGER,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (creator_id) REFERENCES users(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id)
    )
  `);

  // 创建兑换记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reward_id TEXT NOT NULL,
      reward_name TEXT NOT NULL,
      points_spent INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed')),
      note TEXT DEFAULT '',
      handled_by INTEGER,
      handled_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (handled_by) REFERENCES users(id)
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_checkins_task ON checkins(task_id);
    CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_custom_tasks_status ON custom_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_custom_tasks_assignee ON custom_tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_active_period ON tasks(is_active, time_period);
  `);

  console.log('✅ 数据库表结构创建完成');
}

/**
 * 初始化默认任务数据
 */
function initDefaultTasks() {
  const existingTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  
  if (existingTasks.count > 0) {
    console.log('📋 默认任务数据已存在，跳过初始化');
    return;
  }

  console.log('📝 初始化默认任务数据...');

  const defaultTasks = [
    // 早晨任务
    { name: '起床整理床铺', icon: '🛏️', description: '把被子叠好，枕头摆正', time_period: 'morning', base_points: 2, category: 'daily', priority: 1 },
    { name: '自己穿衣服', icon: '👕', description: '自己穿好衣服和袜子', time_period: 'morning', base_points: 2, category: 'daily', priority: 2 },
    { name: '刷牙洗脸', icon: '🪥', description: '认真刷牙2分钟，洗脸清洁', time_period: 'morning', base_points: 2, category: 'daily', priority: 3 },
    { name: '吃早餐', icon: '🥣', description: '认真吃完早餐，不挑食', time_period: 'morning', base_points: 3, category: 'daily', priority: 4 },
    { name: '整理书包', icon: '🎒', description: '检查作业是否带齐，准备上学物品', time_period: 'morning', base_points: 2, category: 'daily', priority: 5 },
    
    // 中午任务
    { name: '饭前洗手', icon: '🧼', description: '用洗手液认真洗手', time_period: 'noon', base_points: 1, category: 'daily', priority: 10 },
    { name: '好好吃午饭', icon: '🍚', description: '不挑食，吃完自己的一份', time_period: 'noon', base_points: 3, category: 'daily', priority: 11 },
    { name: '收拾碗筷', icon: '🍽️', description: '把碗筷收到厨房水池', time_period: 'noon', base_points: 2, category: 'daily', priority: 12 },
    { name: '午休/安静活动', icon: '😴', description: '午休或进行安静的活动', time_period: 'noon', base_points: 2, category: 'daily', priority: 13 },
    
    // 傍晚任务
    { name: '放学回家问候', icon: '🏠', description: '回家后主动问好', time_period: 'evening', base_points: 1, category: 'daily', priority: 20 },
    { name: '先写作业', icon: '📚', description: '完成学校布置的作业', time_period: 'evening', base_points: 5, category: 'daily', priority: 21 },
    { name: '检查作业', icon: '✓', description: '自己检查作业完成情况', time_period: 'evening', base_points: 2, category: 'daily', priority: 22 },
    { name: '整理房间', icon: '🧹', description: '把玩具和书本放回原位', time_period: 'evening', base_points: 3, category: 'daily', priority: 23 },
    { name: '帮忙做家务', icon: '🧺', description: '帮助家人做一些力所能及的家务', time_period: 'evening', base_points: 4, category: 'daily', priority: 24 },
    { name: '晚餐', icon: '🍜', description: '和家人一起愉快用餐', time_period: 'evening', base_points: 3, category: 'daily', priority: 25 },
    { name: '亲子时光', icon: '📖', description: '和爸爸妈妈一起阅读或玩游戏', time_period: 'evening', base_points: 3, category: 'daily', priority: 26 },
    { name: '洗漱准备睡觉', icon: '🛁', description: '洗澡/洗脚，刷牙，准备睡觉', time_period: 'evening', base_points: 3, category: 'daily', priority: 27 },
    { name: '按时睡觉', icon: '🌙', description: '在规定时间前上床睡觉', time_period: 'evening', base_points: 2, category: 'daily', priority: 28 },
    
    // 周末专属进阶任务
    { name: '打扫自己的房间', icon: '🧸', description: '扫地、拖地、整理物品', time_period: 'weekend', base_points: 5, category: 'advanced', weekend_only: 1, priority: 30 },
    { name: '帮忙洗菜', icon: '🥬', description: '帮爸爸妈妈洗菜准备做饭', time_period: 'weekend', base_points: 3, category: 'advanced', weekend_only: 1, priority: 31 },
    { name: '整理衣柜', icon: '👔', description: '整理自己的衣服，叠好放整齐', time_period: 'weekend', base_points: 3, category: 'advanced', weekend_only: 1, priority: 32 },
    { name: '浇花或照顾植物', icon: '🌷', description: '给家里的植物浇水', time_period: 'anytime', base_points: 2, category: 'advanced', priority: 33 },
    { name: '喂养宠物', icon: '🐕', description: '给宠物喂食和添水', time_period: 'anytime', base_points: 2, category: 'advanced', priority: 34 },
    
    // 成长责任任务
    { name: '照顾弟弟妹妹', icon: '👶', description: '陪伴和照顾家里的小宝宝', time_period: 'anytime', base_points: 5, category: 'growth', priority: 40 },
    { name: '独立完成一件有挑战的事', icon: '⭐', description: '独立完成一件以前没做过的事', time_period: 'anytime', base_points: 8, category: 'growth', priority: 41 },
    { name: '教爸爸妈妈一个新知识', icon: '🎓', description: '把学到的新东西教给家人', time_period: 'anytime', base_points: 5, category: 'growth', priority: 42 },
    { name: '帮忙取快递/买东西', icon: '📦', description: '帮家人取快递或买东西', time_period: 'anytime', base_points: 3, category: 'growth', priority: 43 }
  ];

  const insertTask = db.prepare(`
    INSERT INTO tasks (name, icon, description, time_period, base_points, extra_points, category, weekend_only, is_active, priority)
    VALUES (@name, @icon, @description, @time_period, @base_points, @extra_points, @category, @weekend_only, 1, @priority)
  `);

  // 补全任务数据，确保所有字段都有值
  const completeTask = (t) => ({
    name: t.name,
    icon: t.icon,
    description: t.description || '',
    time_period: t.time_period,
    base_points: t.base_points || 2,
    extra_points: t.extra_points || 0,
    category: t.category || 'daily',
    weekend_only: t.weekend_only ? 1 : 0,
    priority: t.priority || 100
  });

  const insertMany = db.transaction((tasks) => {
    for (const task of tasks) {
      const t = completeTask(task);
      insertTask.run(t);
    }
  });

  insertMany(defaultTasks);
  console.log(`✅ 已添加 ${defaultTasks.length} 个默认任务`);
}

/**
 * 创建管理员账户（如果不存在）
 */
function initAdminUser() {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
  
  if (!existingAdmin) {
    console.log('👤 创建默认管理员账户...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    db.prepare(`
      INSERT INTO users (phone, password, nickname, role, points, total_points)
      VALUES (?, ?, ?, 'admin', ?, ?)
    `).run('13800138000', hashedPassword, '管理员', 9999, 9999);
    
    console.log('✅ 默认管理员: 手机号 13800138000, 密码 admin123');
  } else {
    console.log('👤 管理员账户已存在');
  }
}

// 初始化数据库
initDatabase();
initDefaultTasks();
initAdminUser();

module.exports = db;
