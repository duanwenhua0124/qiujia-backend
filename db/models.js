/**
 * SQLite数据库连接和模型层
 */
const db = require('./init');
const bcrypt = require('bcryptjs');

/**
 * 用户模型
 */
const User = {
  /**
   * 根据ID查找用户
   */
  findById: (id) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (user) delete user.password;
    return user;
  },

  /**
   * 根据手机号查找用户
   */
  findByPhone: (phone) => {
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  },

  /**
   * 创建用户
   */
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO users (phone, password, nickname, avatar, points, total_points, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.phone,
      data.password || null,
      data.nickname || '新用户',
      data.avatar || '',
      data.points || 100,
      data.total_points || 100,
      data.role || 'user'
    );
    return { id: result.lastInsertRowid, ...data };
  },

  /**
   * 更新用户
   */
  updateById: (id, updates) => {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) return null;
    
    fields.push('updated_at = datetime("now", "localtime")');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  /**
   * 更新积分
   */
  updatePoints: (id, amount, isAdd = true) => {
    const user = User.findById(id);
    if (!user) return null;
    
    const newPoints = isAdd ? user.points + amount : user.points - amount;
    const newTotalPoints = isAdd && amount > 0 ? user.total_points + amount : user.total_points;
    
    if (newPoints < 0) return null;
    
    db.prepare(`
      UPDATE users SET points = ?, total_points = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newPoints, newTotalPoints, id);
    
    return { points: newPoints, total_points: newTotalPoints };
  },

  /**
   * 密码比对
   */
  comparePassword: (user, candidatePassword) => {
    return bcrypt.compare(candidatePassword, user.password);
  },

  /**
   * 分页获取用户列表
   */
  findAll: (options = {}) => {
    const { page = 1, limit = 20, keyword = '' } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    const params = [];
    
    if (keyword) {
      whereClause += ' AND (phone LIKE ? OR nickname LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`).get(...params);
    const users = db.prepare(`SELECT id, phone, nickname, avatar, points, total_points, role, created_at FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    
    return {
      list: users,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }
};

/**
 * 任务模型
 */
const Task = {
  /**
   * 根据ID查找任务
   */
  findById: (id) => {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  },

  /**
   * 获取所有任务
   */
  findAll: (filters = {}) => {
    let whereClause = '1=1';
    const params = [];
    
    if (filters.is_active !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(filters.is_active ? 1 : 0);
    }
    
    if (filters.weekend_only !== undefined && !filters.weekend_only) {
      whereClause += ' AND weekend_only = 0';
    }
    
    if (filters.time_period) {
      whereClause += ' AND (time_period = ? OR time_period = "anytime")';
      params.push(filters.time_period);
    }
    
    if (filters.category) {
      whereClause += ' AND category = ?';
      params.push(filters.category);
    }
    
    return db.prepare(`SELECT * FROM tasks WHERE ${whereClause} ORDER BY priority ASC, time_period ASC`).all(...params);
  },

  /**
   * 创建或更新任务
   */
  upsert: (data) => {
    const existing = db.prepare('SELECT id FROM tasks WHERE name = ?').get(data.name);
    
    if (existing) {
      db.prepare(`
        UPDATE tasks SET icon = ?, description = ?, time_period = ?, base_points = ?, 
        extra_points = ?, category = ?, weekend_only = ?, is_active = ?, priority = ?,
        updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(data.icon, data.description || '', data.time_period, data.base_points || 2, 
        data.extra_points || 0, data.category || 'daily', data.weekend_only ? 1 : 0, 
        data.is_active !== false ? 1 : 0, data.priority || 100, existing.id);
      return { ...data, id: existing.id };
    } else {
      const result = db.prepare(`
        INSERT INTO tasks (name, icon, description, time_period, base_points, extra_points, category, weekend_only, is_active, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(data.name, data.icon, data.description || '', data.time_period, 
        data.base_points || 2, data.extra_points || 0, data.category || 'daily', 
        data.weekend_only ? 1 : 0, data.is_active !== false ? 1 : 0, data.priority || 100);
      return { ...data, id: result.lastInsertRowid };
    }
  }
};

/**
 * 打卡记录模型
 */
const Checkin = {
  /**
   * 查找打卡记录
   */
  findOne: (filters) => {
    let whereClause = '1=1';
    const params = [];
    
    if (filters.user_id) {
      whereClause += ' AND user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.task_id) {
      whereClause += ' AND task_id = ?';
      params.push(filters.task_id);
    }
    if (filters.date) {
      whereClause += ' AND date = ?';
      params.push(filters.date);
    }
    
    return db.prepare(`SELECT * FROM checkins WHERE ${whereClause} LIMIT 1`).get(...params);
  },

  /**
   * 查找用户的打卡记录
   */
  findByUser: (userId, filters = {}) => {
    let whereClause = 'user_id = ?';
    const params = [userId];
    
    if (filters.date) {
      whereClause += ' AND date = ?';
      params.push(filters.date);
    }
    
    if (filters.dateFrom) {
      whereClause += ' AND date >= ?';
      params.push(filters.dateFrom);
    }
    
    return db.prepare(`SELECT * FROM checkins WHERE ${whereClause} ORDER BY checked_at DESC`).all(...params);
  },

  /**
   * 创建打卡记录
   */
  create: (data) => {
    const result = db.prepare(`
      INSERT INTO checkins (user_id, task_id, date, status, points_earned, is_makeup)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.user_id, data.task_id, data.date, data.status || 'completed', 
      data.points_earned || 0, data.is_makeup ? 1 : 0);
    return { id: result.lastInsertRowid, ...data };
  },

  /**
   * 获取用户打卡统计
   */
  getStats: (userId) => {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const todayCount = db.prepare('SELECT COUNT(*) as count FROM checkins WHERE user_id = ? AND date = ?').get(userId, today);
    const weekCount = db.prepare('SELECT COUNT(*) as count FROM checkins WHERE user_id = ? AND date >= ?').get(userId, weekStartStr);
    
    return {
      today_checkins: todayCount.count,
      week_checkins: weekCount.count
    };
  }
};

/**
 * 积分变动记录模型
 */
const PointTransaction = {
  /**
   * 创建积分变动记录
   */
  create: (data) => {
    const result = db.prepare(`
      INSERT INTO point_transactions (user_id, amount, type, reason, related_task_id, related_custom_task_id, balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.user_id, data.amount, data.type, data.reason || '', 
      data.related_task_id || null, data.related_custom_task_id || null, data.balance);
    return { id: result.lastInsertRowid, ...data };
  },

  /**
   * 获取用户的积分记录
   */
  findByUser: (userId, options = {}) => {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const transactions = db.prepare(`
      SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
    
    const countResult = db.prepare('SELECT COUNT(*) as total FROM point_transactions WHERE user_id = ?').get(userId);
    
    return {
      list: transactions,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }
};

/**
 * 自定义任务模型
 */
const CustomTask = {
  /**
   * 根据ID查找
   */
  findById: (id) => {
    return db.prepare('SELECT * FROM custom_tasks WHERE id = ?').get(id);
  },

  /**
   * 创建自定义任务
   */
  create: (data) => {
    const result = db.prepare(`
      INSERT INTO custom_tasks (creator_id, title, description, points_required, points_reward, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(data.creator_id, data.title, data.description || '', 
      data.points_required, data.points_reward);
    return { id: result.lastInsertRowid, ...data };
  },

  /**
   * 更新自定义任务
   */
  update: (id, updates) => {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(key === 'completed_at' && value ? value : value);
      }
    }
    
    if (fields.length === 0) return null;
    
    fields.push('updated_at = datetime("now", "localtime")');
    values.push(id);
    
    return db.prepare(`UPDATE custom_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  /**
   * 查找自定义任务
   */
  find: (filters = {}) => {
    let whereClause = '1=1';
    const params = [];
    
    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.creator_id) {
      whereClause += ' AND creator_id = ?';
      params.push(filters.creator_id);
    }
    
    if (filters.assignee_id) {
      whereClause += ' AND assignee_id = ?';
      params.push(filters.assignee_id);
    }
    
    return db.prepare(`SELECT * FROM custom_tasks WHERE ${whereClause} ORDER BY created_at DESC`).all(...params);
  },

  /**
   * 带用户信息的查询
   */
  findWithUser: (filters = {}) => {
    let whereClause = '1=1';
    const params = [];
    
    if (filters.status) {
      whereClause += ' AND ct.status = ?';
      params.push(filters.status);
    }
    
    const tasks = db.prepare(`
      SELECT ct.*, u.nickname as creator_nickname, u.avatar as creator_avatar
      FROM custom_tasks ct
      LEFT JOIN users u ON ct.creator_id = u.id
      WHERE ${whereClause}
      ORDER BY ct.created_at DESC
    `).all(...params);
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      points_reward: task.points_reward,
      status: task.status,
      creator: { nickname: task.creator_nickname, avatar: task.creator_avatar },
      created_at: task.created_at
    }));
  }
};

/**
 * 兑换记录模型
 */
const Redemption = {
  /**
   * 根据ID查找
   */
  findById: (id) => {
    return db.prepare('SELECT * FROM redemptions WHERE id = ?').get(id);
  },

  /**
   * 创建兑换记录
   */
  create: (data) => {
    const result = db.prepare(`
      INSERT INTO redemptions (user_id, reward_id, reward_name, points_spent, status, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.user_id, data.reward_id, data.reward_name, 
      data.points_spent, data.status || 'pending', data.note || '');
    return { id: result.lastInsertRowid, ...data };
  },

  /**
   * 更新兑换记录
   */
  update: (id, updates) => {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(key === 'handled_at' && value ? value : value);
      }
    }
    
    if (fields.length === 0) return null;
    
    fields.push('updated_at = datetime("now", "localtime")');
    values.push(id);
    
    return db.prepare(`UPDATE redemptions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  /**
   * 查找用户的兑换记录
   */
  findByUser: (userId, options = {}) => {
    const { status, page = 1, limit = 20 } = options;
    let whereClause = 'user_id = ?';
    const params = [userId];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const records = db.prepare(`
      SELECT * FROM redemptions WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM redemptions WHERE ${whereClause}`).get(...params);
    
    return {
      list: records,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(countResult.total / parseInt(limit))
    };
  },

  /**
   * 获取所有兑换申请
   */
  findAll: (options = {}) => {
    const { status } = options;
    let whereClause = '1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }
    
    const records = db.prepare(`
      SELECT r.*, u.nickname as user_nickname, u.phone as user_phone,
             h.nickname as handler_nickname
      FROM redemptions r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users h ON r.handled_by = h.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
    `).all(...params);
    
    return records;
  }
};

module.exports = {
  db,
  User,
  Task,
  Checkin,
  PointTransaction,
  CustomTask,
  Redemption
};
