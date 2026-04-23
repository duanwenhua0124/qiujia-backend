const express = require('express');
const router = express.Router();
const { User, Checkin, PointTransaction, CustomTask } = require('../db/models');
const { auth, admin } = require('../middleware/auth');

// 获取用户列表（管理员）
router.get('/users', auth, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '' } = req.query;
    const result = User.findAll({ page: parseInt(page), limit: parseInt(limit), keyword });
    
    res.json({
      code: 200,
      data: {
        list: result.list,
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ code: 500, message: '获取用户列表失败' });
  }
});

// 获取用户详情（管理员）
router.get('/users/:id', auth, admin, async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    
    const checkins = Checkin.findByUser(req.params.id);
    const totalDays = new Set(checkins.map(c => c.date)).size;
    
    const recentTransactions = PointTransaction.findByUser(req.params.id, { page: 1, limit: 10 });
    
    res.json({
      code: 200,
      data: {
        user,
        checkin_stats: { total_days: totalDays, completed_tasks: checkins.length },
        recent_transactions: recentTransactions.list
      }
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({ code: 500, message: '获取用户详情失败' });
  }
});

// 调整用户积分（管理员）
router.post('/users/:id/adjust-points', auth, admin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (amount === undefined || amount === 0) return res.status(400).json({ code: 400, message: '调整积分不能为0' });
    
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    
    // 先检查是否会导致积分变为负数
    if (amount < 0 && user.points + amount < 0) {
      return res.status(422).json({ code: 422, message: '积分不足' });
    }
    
    const newPoints = user.points + amount;
    User.updateById(req.params.id, { points: newPoints, total_points: amount > 0 ? user.total_points + amount : user.total_points });
    
    const updatedUser = User.findById(req.params.id);
    PointTransaction.create({
      user_id: req.params.id,
      amount,
      type: 'adjust',
      reason: reason || (amount > 0 ? '管理员增加积分' : '管理员扣除积分'),
      balance: updatedUser.points
    });
    
    res.json({ code: 200, message: '积分调整成功', data: { new_points: updatedUser.points, adjusted_amount: amount } });
  } catch (error) {
    console.error('调整积分失败:', error);
    res.status(500).json({ code: 500, message: '调整积分失败' });
  }
});

module.exports = router;
