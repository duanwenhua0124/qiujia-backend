const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Checkin = require('../models/Checkin');
const PointTransaction = require('../models/PointTransaction');
const CustomTask = require('../models/CustomTask');
const { auth, admin } = require('../middleware/auth');

// 获取用户列表（管理员）
router.get('/users', auth, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (keyword) {
      query.$or = [
        { phone: { $regex: keyword, $options: 'i' } },
        { nickname: { $regex: keyword, $options: 'i' } }
      ];
    }
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    res.json({
      code: 200,
      data: {
        list: users,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户列表失败'
    });
  }
});

// 获取用户详情（管理员）
router.get('/users/:id', auth, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }
    
    // 获取打卡统计
    const checkins = await Checkin.find({ user_id: req.params.id });
    const totalDays = new Set(checkins.map(c => c.date)).size;
    const completedTasks = checkins.length;
    
    // 获取最近积分变动
    const recentTransactions = await PointTransaction.find({ user_id: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      code: 200,
      data: {
        user,
        checkin_stats: {
          total_days: totalDays,
          completed_tasks: completedTasks
        },
        recent_transactions: recentTransactions
      }
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户详情失败'
    });
  }
});

// 调整用户积分（管理员）
router.post('/users/:id/adjust-points', auth, admin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    if (amount === undefined || amount === 0) {
      return res.status(400).json({
        code: 400,
        message: '调整积分不能为0'
      });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }
    
    // 调整积分
    user.points += amount;
    if (amount > 0) {
      user.total_points += amount;
    }
    
    // 确保积分不为负
    if (user.points < 0) {
      return res.status(422).json({
        code: 422,
        message: '积分不足'
      });
    }
    
    await user.save();
    
    // 记录积分变动
    await PointTransaction.create({
      user_id: req.params.id,
      amount,
      type: 'adjust',
      reason: reason || (amount > 0 ? '管理员增加积分' : '管理员扣除积分'),
      balance: user.points
    });
    
    res.json({
      code: 200,
      message: '积分调整成功',
      data: {
        new_points: user.points,
        adjusted_amount: amount
      }
    });
  } catch (error) {
    console.error('调整积分失败:', error);
    res.status(500).json({
      code: 500,
      message: '调整积分失败'
    });
  }
});

module.exports = router;
