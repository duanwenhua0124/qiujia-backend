const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const CustomTask = require('../models/CustomTask');
const PointTransaction = require('../models/PointTransaction');
const { auth } = require('../middleware/auth');
const CONFIG = require('../config');
const TASK_CONFIG = require('../config/tasks');
const mongoose = require('mongoose');

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
    
    // 确定当前时间段
    let currentPeriod = 'morning';
    if (currentHour >= 12 && currentHour < 18) currentPeriod = 'noon';
    else if (currentHour >= 18) currentPeriod = 'evening';
    
    // 获取今日打卡记录
    const checkins = await Checkin.find({
      user_id: req.userId,
      date: today
    });
    
    const checkedTaskIds = new Set(checkins.map(c => c.task_id.toString()));
    
    // 获取所有活跃任务
    let query = { is_active: true };
    
    // 如果不是周末，排除周末专属的进阶任务
    if (!isWeekendDay) {
      query.weekend_only = { $ne: true };
    }
    
    const tasks = await Task.find(query).sort({ priority: 1, time_period: 1 });
    
    // 按时间段和类别分组
    const groupedTasks = {
      daily: [],
      advanced: [],
      growth: [],
      currentPeriod,
      isWeekend: isWeekendDay
    };
    
    tasks.forEach(task => {
      const taskObj = {
        _id: task._id,
        name: task.name,
        icon: task.icon,
        description: task.description || '',
        base_points: task.base_points,
        extra_points: task.extra_points,
        total_points: task.base_points + task.extra_points,
        category: task.category,
        time_period: task.time_period,
        status: checkedTaskIds.has(task._id.toString()) ? 'completed' : 'pending'
      };
      
      if (checkedTaskIds.has(task._id.toString())) {
        const checkin = checkins.find(c => c.task_id.toString() === task._id.toString());
        taskObj.checked_at = checkin.checked_at;
      }
      
      // 按类别分组
      if (task.category === 'daily') {
        groupedTasks.daily.push(taskObj);
      } else if (task.category === 'advanced') {
        groupedTasks.advanced.push(taskObj);
      } else if (task.category === 'growth') {
        groupedTasks.growth.push(taskObj);
      }
    });
    
    res.json({
      code: 200,
      data: groupedTasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取任务列表失败'
    });
  }
});

// 获取所有任务（管理员用）
router.get('/all', auth, async (req, res) => {
  try {
    const tasks = await Task.find().sort({ category: 1, priority: 1 });
    res.json({
      code: 200,
      data: tasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取任务列表失败'
    });
  }
});

// 任务打卡
router.post('/checkin', auth, async (req, res) => {
  try {
    const { task_id, is_makeup = false } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // 验证任务
    const task = await Task.findById(task_id);
    if (!task) {
      return res.status(404).json({
        code: 404,
        message: '任务不存在'
      });
    }
    
    // 检查是否已打卡
    const existingCheckin = await Checkin.findOne({
      user_id: req.userId,
      task_id,
      date: today
    });
    
    if (existingCheckin) {
      return res.status(400).json({
        code: 400,
        message: '今日已完成此任务打卡'
      });
    }
    
    // 计算积分
    let pointsEarned = task.base_points;
    
    // 如果是补做且在24小时内，只发一半积分
    if (is_makeup) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // 检查是否有昨日未完成记录
      const yesterdayCheckin = await Checkin.findOne({
        user_id: req.userId,
        task_id,
        date: yesterdayStr
      });
      
      // 如果昨天已完成，则不能补做
      if (yesterdayCheckin) {
        return res.status(400).json({
          code: 400,
          message: '该任务昨日已完成，无需补做'
        });
      }
      
      pointsEarned = Math.floor(pointsEarned / 2); // 只发一半积分
    }
    
    // 创建打卡记录
    await Checkin.create({
      user_id: req.userId,
      task_id,
      date: today,
      status: 'completed',
      points_earned: pointsEarned,
      is_makeup: is_makeup
    });
    
    // 更新用户积分
    const user = await User.findById(req.userId);
    user.points += pointsEarned;
    user.total_points += pointsEarned;
    
    // 更新连续打卡
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (user.last_checkin_date === yesterdayStr) {
      // 昨天有打卡，连续天数+1
      user.checkin_streak += 1;
    } else if (user.last_checkin_date !== today) {
      // 昨天没打卡，重新开始计数
      user.checkin_streak = 1;
    }
    
    user.last_checkin_date = today;
    user.total_checkin_days += 1;
    
    // 更新最长连续记录
    if (user.checkin_streak > user.max_checkin_streak) {
      user.max_checkin_streak = user.checkin_streak;
    }
    
    await user.save();
    
    // 检查连续打卡奖励
    let streakBonus = 0;
    if (TASK_CONFIG.POINTS.STREAK_REWARDS[user.checkin_streak]) {
      streakBonus = TASK_CONFIG.POINTS.STREAK_REWARDS[user.checkin_streak];
      user.points += streakBonus;
      user.total_points += streakBonus;
      await user.save();
    }
    
    // 记录积分变动
    await PointTransaction.create({
      user_id: req.userId,
      amount: pointsEarned,
      type: 'earn',
      reason: `${is_makeup ? '补做' : ''}完成任务：${task.name}`,
      related_task_id: task_id,
      balance: user.points
    });
    
    // 如果有连续打卡奖励，记录
    if (streakBonus > 0) {
      await PointTransaction.create({
        user_id: req.userId,
        amount: streakBonus,
        type: 'bonus',
        reason: `连续打卡${user.checkin_streak}天奖励`,
        balance: user.points
      });
    }
    
    res.json({
      code: 200,
      message: is_makeup ? '补做成功' : '打卡成功',
      data: {
        points_earned: pointsEarned,
        streak_bonus: streakBonus,
        total_points: user.points,
        checkin_streak: user.checkin_streak
      }
    });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({
      code: 500,
      message: '打卡失败'
    });
  }
});

// 获取打卡统计
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // 获取今日打卡情况
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = await Checkin.find({
      user_id: req.userId,
      date: today
    });
    
    // 获取本周打卡情况
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const weekCheckins = await Checkin.find({
      user_id: req.userId,
      date: { $gte: weekStartStr }
    });
    
    res.json({
      code: 200,
      data: {
        checkin_streak: user.checkin_streak,
        max_checkin_streak: user.max_checkin_streak,
        total_checkin_days: user.total_checkin_days,
        today_checkins: todayCheckins.length,
        week_checkins: weekCheckins.length,
        points: user.points
      }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取统计失败'
    });
  }
});

// ============ 管理员接口 ============

// 创建/更新任务（管理员）
router.post('/admin/create', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({
        code: 403,
        message: '无权限'
      });
    }
    
    const { tasks } = req.body;
    
    for (const taskData of tasks) {
      const existingTask = await Task.findOne({ name: taskData.name });
      if (existingTask) {
        await Task.findByIdAndUpdate(existingTask._id, taskData);
      } else {
        await Task.create(taskData);
      }
    }
    
    res.json({
      code: 200,
      message: '任务更新成功'
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({
      code: 500,
      message: '创建任务失败'
    });
  }
});

// ============ 自定义任务 ============

// 创建自定义任务
router.post('/custom', auth, async (req, res) => {
  try {
    const { title, description, points_reward } = req.body;
    
    if (!title || !points_reward) {
      return res.status(400).json({
        code: 400,
        message: '任务标题和奖励积分不能为空'
      });
    }
    
    const user = await User.findById(req.userId);
    
    if (user.points < points_reward) {
      return res.status(422).json({
        code: 422,
        message: '积分不足，无法发布此任务'
      });
    }
    
    // 扣除积分
    user.points -= points_reward;
    await user.save();
    
    // 创建任务
    const customTask = await CustomTask.create({
      creator_id: req.userId,
      title,
      description,
      points_required: points_reward,
      points_reward,
      status: 'open'
    });
    
    // 记录积分变动
    await PointTransaction.create({
      user_id: req.userId,
      amount: -points_reward,
      type: 'publish',
      reason: `发布自定义任务：${title}`,
      related_custom_task_id: customTask._id,
      balance: user.points
    });
    
    res.json({
      code: 200,
      message: '任务发布成功',
      data: { custom_task_id: customTask._id }
    });
  } catch (error) {
    console.error('发布任务失败:', error);
    res.status(500).json({
      code: 500,
      message: '发布任务失败'
    });
  }
});

// 获取自定义任务列表
router.get('/custom', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    const tasks = await CustomTask.find(query)
      .populate('creator_id', 'nickname avatar')
      .sort({ created_at: -1 });
    
    // 格式化返回数据
    const formattedTasks = tasks.map(task => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      points_reward: task.points_reward,
      status: task.status,
      creator: task.creator_id,
      created_at: task.created_at
    }));
    
    res.json({
      code: 200,
      data: {
        list: formattedTasks
      }
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取任务列表失败'
    });
  }
});

// 接取自定义任务
router.post('/custom/:id/accept', auth, async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        code: 404,
        message: '任务不存在'
      });
    }
    
    if (task.status !== 'open') {
      return res.status(400).json({
        code: 400,
        message: '任务已被接取或已完成'
      });
    }
    
    task.accepter_id = req.userId;
    task.status = 'accepted';
    await task.save();
    
    res.json({
      code: 200,
      message: '接取成功'
    });
  } catch (error) {
    console.error('接取任务失败:', error);
    res.status(500).json({
      code: 500,
      message: '接取任务失败'
    });
  }
});

// 完成自定义任务
router.post('/custom/:id/complete', auth, async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        code: 404,
        message: '任务不存在'
      });
    }
    
    if (task.status !== 'accepted') {
      return res.status(400).json({
        code: 400,
        message: '任务状态不正确'
      });
    }
    
    // 更新任务状态
    task.status = 'completed';
    task.completed_at = new Date();
    await task.save();
    
    // 返还发布者积分并奖励接取者
    const creator = await User.findById(task.creator_id);
    const accepter = await User.findById(req.userId);
    
    // 返还发布者积分
    creator.points += task.points_reward;
    await creator.save();
    
    // 奖励接取者
    accepter.points += task.points_reward;
    accepter.total_points += task.points_reward;
    await accepter.save();
    
    // 记录积分变动
    await PointTransaction.create({
      user_id: task.creator_id,
      amount: task.points_reward,
      type: 'return',
      reason: `自定义任务完成返还：${task.title}`,
      related_custom_task_id: task._id,
      balance: creator.points
    });
    
    await PointTransaction.create({
      user_id: req.userId,
      amount: task.points_reward,
      type: 'earn',
      reason: `完成任务奖励：${task.title}`,
      related_custom_task_id: task._id,
      balance: accepter.points
    });
    
    res.json({
      code: 200,
      message: '任务完成',
      data: {
        points_earned: task.points_reward,
        total_points: accepter.points
      }
    });
  } catch (error) {
    console.error('完成任务失败:', error);
    res.status(500).json({
      code: 500,
      message: '完成任务失败'
    });
  }
});

// 取消自定义任务
router.post('/custom/:id/cancel', auth, async (req, res) => {
  try {
    const task = await CustomTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        code: 404,
        message: '任务不存在'
      });
    }
    
    if (task.creator_id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        code: 403,
        message: '只能取消自己发布的任务'
      });
    }
    
    if (task.status !== 'open') {
      return res.status(400).json({
        code: 400,
        message: '任务已被接取，无法取消'
      });
    }
    
    // 返还积分
    const user = await User.findById(req.userId);
    user.points += task.points_reward;
    await user.save();
    
    task.status = 'cancelled';
    await task.save();
    
    // 记录积分变动
    await PointTransaction.create({
      user_id: req.userId,
      amount: task.points_reward,
      type: 'return',
      reason: `取消任务返还：${task.title}`,
      related_custom_task_id: task._id,
      balance: user.points
    });
    
    res.json({
      code: 200,
      message: '任务已取消，积分已返还'
    });
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({
      code: 500,
      message: '取消任务失败'
    });
  }
});

module.exports = router;
