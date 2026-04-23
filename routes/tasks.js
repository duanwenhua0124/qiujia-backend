const express = require('express');
const router = express.Router();
const { Task, Checkin, User, CustomTask, PointTransaction } = require('../db/models');
const { auth } = require('../middleware/auth');
const CONFIG = require('../config');
const TASK_CONFIG = require('../config/tasks');

// 判断是否为周末
function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

// 获取今日任务列表
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const isWeekendDay = isWeekend();
    
    let currentPeriod = 'morning';
    if (currentHour >= 12 && currentHour < 18) currentPeriod = 'noon';
    else if (currentHour >= 18) currentPeriod = 'evening';
    
    const checkins = Checkin.findByUser(req.userId, { date: today });
    const checkedTaskIds = new Set(checkins.map(c => c.task_id));
    
    const filters = { is_active: true };
    if (!isWeekendDay) {
      filters.weekend_only = false;
    }
    
    const tasks = Task.findAll(filters);
    
    const groupedTasks = {
      daily: [],
      advanced: [],
      growth: [],
      currentPeriod,
      isWeekend: isWeekendDay
    };
    
    tasks.forEach(task => {
      const taskObj = {
        _id: task.id,
        name: task.name,
        icon: task.icon,
        description: task.description || '',
        base_points: task.base_points,
        extra_points: task.extra_points,
        total_points: task.base_points + task.extra_points,
        category: task.category,
        time_period: task.time_period,
        status: checkedTaskIds.has(task.id) ? 'completed' : 'pending'
      };
      
      if (checkedTaskIds.has(task.id)) {
        const checkin = checkins.find(c => c.task_id === task.id);
        taskObj.checked_at = checkin.checked_at;
      }
      
      if (task.category === 'daily') groupedTasks.daily.push(taskObj);
      else if (task.category === 'advanced') groupedTasks.advanced.push(taskObj);
      else if (task.category === 'growth') groupedTasks.growth.push(taskObj);
    });
    
    res.json({ code: 200, data: groupedTasks });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ code: 500, message: '获取任务列表失败' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const tasks = Task.findAll({});
    res.json({ code: 200, data: tasks });
  } catch (error) {
    res.status(500).json({ code: 500, message: '获取任务列表失败' });
  }
});

router.post('/checkin', auth, async (req, res) => {
  try {
    const { task_id, is_makeup = false } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const task = Task.findById(task_id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    
    const existingCheckin = Checkin.findOne({ user_id: req.userId, task_id, date: today });
    if (existingCheckin) return res.status(400).json({ code: 400, message: '今日已完成此任务打卡' });
    
    let pointsEarned = task.base_points;
    
    if (is_makeup) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayCheckin = Checkin.findOne({ user_id: req.userId, task_id, date: yesterdayStr });
      if (yesterdayCheckin) return res.status(400).json({ code: 400, message: '该任务昨日已完成，无需补做' });
      pointsEarned = Math.floor(pointsEarned / 2);
    }
    
    Checkin.create({ user_id: req.userId, task_id, date: today, status: 'completed', points_earned: pointsEarned, is_makeup });
    
    User.updatePoints(req.userId, pointsEarned, true);
    let user = User.findById(req.userId);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let newStreak = user.checkin_streak;
    if (user.last_checkin_date === yesterdayStr) newStreak = user.checkin_streak + 1;
    else if (user.last_checkin_date !== today) newStreak = 1;
    
    User.updateById(req.userId, {
      checkin_streak: newStreak,
      max_checkin_streak: Math.max(user.max_checkin_streak, newStreak),
      last_checkin_date: today,
      total_checkin_days: user.total_checkin_days + 1
    });
    
    user = User.findById(req.userId);
    
    let streakBonus = 0;
    if (TASK_CONFIG.POINTS.STREAK_REWARDS[user.checkin_streak]) {
      streakBonus = TASK_CONFIG.POINTS.STREAK_REWARDS[user.checkin_streak];
      User.updatePoints(req.userId, streakBonus, true);
      user = User.findById(req.userId);
    }
    
    PointTransaction.create({ user_id: req.userId, amount: pointsEarned, type: 'earn', reason: `${is_makeup ? '补做' : ''}完成任务：${task.name}`, related_task_id: task_id, balance: user.points });
    
    if (streakBonus > 0) {
      PointTransaction.create({ user_id: req.userId, amount: streakBonus, type: 'bonus', reason: `连续打卡${user.checkin_streak}天奖励`, balance: user.points });
    }
    
    res.json({ code: 200, message: is_makeup ? '补做成功' : '打卡成功', data: { points_earned: pointsEarned, streak_bonus: streakBonus, total_points: user.points, checkin_streak: user.checkin_streak } });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({ code: 500, message: '打卡失败' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const user = User.findById(req.userId);
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const todayCheckins = Checkin.findByUser(req.userId, { date: today });
    const weekCheckins = Checkin.findByUser(req.userId, { dateFrom: weekStartStr });
    
    res.json({ code: 200, data: { checkin_streak: user.checkin_streak, max_checkin_streak: user.max_checkin_streak, total_checkin_days: user.total_checkin_days, today_checkins: todayCheckins.length, week_checkins: weekCheckins.length, points: user.points } });
  } catch (error) {
    res.status(500).json({ code: 500, message: '获取统计失败' });
  }
});

router.post('/admin/create', auth, async (req, res) => {
  try {
    const user = User.findById(req.userId);
    if (user.role !== 'admin') return res.status(403).json({ code: 403, message: '无权限' });
    
    const { tasks } = req.body;
    for (const taskData of tasks) Task.upsert(taskData);
    
    res.json({ code: 200, message: '任务更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: '创建任务失败' });
  }
});

router.post('/custom', auth, async (req, res) => {
  try {
    const { title, description, points_reward } = req.body;
    if (!title || !points_reward) return res.status(400).json({ code: 400, message: '任务标题和奖励积分不能为空' });
    
    const user = User.findById(req.userId);
    if (user.points < points_reward) return res.status(422).json({ code: 422, message: '积分不足，无法发布此任务' });
    
    User.updatePoints(req.userId, -points_reward, false);
    const customTask = CustomTask.create({ creator_id: req.userId, title, description, points_required: points_reward, points_reward });
    
    const updatedUser = User.findById(req.userId);
    PointTransaction.create({ user_id: req.userId, amount: -points_reward, type: 'publish', reason: `发布自定义任务：${title}`, related_custom_task_id: customTask.id, balance: updatedUser.points });
    
    res.json({ code: 200, message: '任务发布成功', data: { custom_task_id: customTask.id } });
  } catch (error) {
    res.status(500).json({ code: 500, message: '发布任务失败' });
  }
});

router.get('/custom', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filters = status ? { status } : {};
    const tasks = CustomTask.findWithUser(filters);
    res.json({ code: 200, data: { list: tasks } });
  } catch (error) {
    res.status(500).json({ code: 500, message: '获取任务列表失败' });
  }
});

router.post('/custom/:id/accept', auth, async (req, res) => {
  try {
    const task = CustomTask.findById(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    if (task.status !== 'open') return res.status(400).json({ code: 400, message: '任务已被接取或已完成' });
    
    CustomTask.update(task.id, { assignee_id: req.userId, status: 'assigned' });
    res.json({ code: 200, message: '接取成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: '接取任务失败' });
  }
});

router.post('/custom/:id/complete', auth, async (req, res) => {
  try {
    const task = CustomTask.findById(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    if (task.status !== 'assigned') return res.status(400).json({ code: 400, message: '任务状态不正确' });
    
    CustomTask.update(task.id, { status: 'completed', completed_at: new Date().toISOString() });
    User.updatePoints(task.creator_id, task.points_reward, true);
    
    const updatedCreator = User.findById(task.creator_id);
    PointTransaction.create({ user_id: task.creator_id, amount: task.points_reward, type: 'reward', reason: `自定义任务完成奖励：${task.title}`, related_custom_task_id: task.id, balance: updatedCreator.points });
    
    res.json({ code: 200, message: '任务完成，奖励已发放' });
  } catch (error) {
    res.status(500).json({ code: 500, message: '完成任务失败' });
  }
});

router.post('/custom/:id/cancel', auth, async (req, res) => {
  try {
    const task = CustomTask.findById(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    if (task.creator_id !== req.userId) return res.status(403).json({ code: 403, message: '只能取消自己发布的任务' });
    if (task.status === 'completed') return res.status(400).json({ code: 400, message: '已完成的任务不能取消' });
    
    CustomTask.update(task.id, { status: 'cancelled' });
    User.updatePoints(req.userId, task.points_required, true);
    
    const user = User.findById(req.userId);
    PointTransaction.create({ user_id: req.userId, amount: task.points_required, type: 'refund', reason: `任务取消返还：${task.title}`, related_custom_task_id: task.id, balance: user.points });
    
    res.json({ code: 200, message: '任务已取消，积分已返还' });
  } catch (error) {
    res.status(500).json({ code: 500, message: '取消任务失败' });
  }
});

module.exports = router;
