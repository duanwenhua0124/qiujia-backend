const express = require('express');
const router = express.Router();
const { Redemption, User, PointTransaction } = require('../db/models');
const { auth } = require('../middleware/auth');
const REWARD_CONFIG = require('../config/rewards');

// 获取奖励列表
router.get('/list', auth, async (req, res) => {
  try {
    const { category } = req.query;
    const user = User.findById(req.userId);
    
    let rewards = [];
    if (category === 'small') rewards = REWARD_CONFIG.SMALL_REWARDS.filter(r => r.active);
    else if (category === 'medium') rewards = REWARD_CONFIG.MEDIUM_REWARDS.filter(r => r.active);
    else if (category === 'large') rewards = REWARD_CONFIG.LARGE_REWARDS.filter(r => r.active);
    else rewards = [...REWARD_CONFIG.SMALL_REWARDS.filter(r => r.active), ...REWARD_CONFIG.MEDIUM_REWARDS.filter(r => r.active), ...REWARD_CONFIG.LARGE_REWARDS.filter(r => r.active)];
    
    rewards = rewards.map(reward => ({ ...reward, can_redeem: user.points >= reward.points_cost }));
    
    const groupedRewards = {
      small: REWARD_CONFIG.SMALL_REWARDS.filter(r => r.active).map(reward => ({ ...reward, can_redeem: user.points >= reward.points_cost })),
      medium: REWARD_CONFIG.MEDIUM_REWARDS.filter(r => r.active).map(reward => ({ ...reward, can_redeem: user.points >= reward.points_cost })),
      large: REWARD_CONFIG.LARGE_REWARDS.filter(r => r.active).map(reward => ({ ...reward, can_redeem: user.points >= reward.points_cost }))
    };
    
    res.json({ code: 200, data: { rewards, groupedRewards, user_points: user.points } });
  } catch (error) {
    console.error('获取奖励列表失败:', error);
    res.status(500).json({ code: 500, message: '获取奖励列表失败' });
  }
});

// 兑换奖励
router.post('/redeem', auth, async (req, res) => {
  try {
    const { reward_id, note = '' } = req.body;
    
    let reward = REWARD_CONFIG.SMALL_REWARDS.find(r => r.id === reward_id);
    if (!reward) reward = REWARD_CONFIG.MEDIUM_REWARDS.find(r => r.id === reward_id);
    if (!reward) reward = REWARD_CONFIG.LARGE_REWARDS.find(r => r.id === reward_id);
    
    if (!reward) return res.status(404).json({ code: 404, message: '奖励不存在' });
    if (!reward.active) return res.status(400).json({ code: 400, message: '该奖励已下架' });
    
    const user = User.findById(req.userId);
    if (user.points < reward.points_cost) {
      return res.status(422).json({ code: 422, message: `积分不足，还需${reward.points_cost - user.points}积分` });
    }
    
    User.updatePoints(req.userId, -reward.points_cost, false);
    
    const status = reward.category === 'small' ? 'completed' : 'pending';
    const redemption = Redemption.create({
      user_id: req.userId,
      reward_id: reward.id,
      reward_name: reward.name,
      points_spent: reward.points_cost,
      status,
      note
    });
    
    if (reward.category === 'small') {
      Redemption.update(redemption.id, { status: 'completed', handled_at: new Date().toISOString() });
    }
    
    const updatedUser = User.findById(req.userId);
    PointTransaction.create({
      user_id: req.userId,
      amount: -reward.points_cost,
      type: 'redeem',
      reason: `兑换奖励：${reward.name}`,
      balance: updatedUser.points
    });
    
    res.json({
      code: 200,
      message: reward.category === 'small' ? '兑换成功，奖励已发放！' : '兑换申请已提交，请等待审核',
      data: { redemption_id: redemption.id, status: reward.category === 'small' ? 'completed' : 'pending', remaining_points: updatedUser.points }
    });
  } catch (error) {
    console.error('兑换奖励失败:', error);
    res.status(500).json({ code: 500, message: '兑换奖励失败' });
  }
});

// 获取兑换记录
router.get('/history', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = Redemption.findByUser(req.userId, { status, page: parseInt(page), limit: parseInt(limit) });
    
    res.json({
      code: 200,
      data: {
        list: result.list,
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages
      }
    });
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    res.status(500).json({ code: 500, message: '获取兑换记录失败' });
  }
});

// ============ 管理员接口 ============

router.get('/admin/pending', auth, async (req, res) => {
  try {
    const user = User.findById(req.userId);
    if (user.role !== 'admin') return res.status(403).json({ code: 403, message: '无权限' });
    
    const { status } = req.query;
    const redemptions = Redemption.findAll({ status });
    
    res.json({ code: 200, data: redemptions });
  } catch (error) {
    console.error('获取兑换申请失败:', error);
    res.status(500).json({ code: 500, message: '获取兑换申请失败' });
  }
});

router.post('/admin/review', auth, async (req, res) => {
  try {
    const user = User.findById(req.userId);
    if (user.role !== 'admin') return res.status(403).json({ code: 403, message: '无权限' });
    
    const { redemption_id, action, reject_reason = '' } = req.body;
    
    const redemption = Redemption.findById(redemption_id);
    if (!redemption) return res.status(404).json({ code: 404, message: '兑换记录不存在' });
    if (redemption.status !== 'pending') return res.status(400).json({ code: 400, message: '该申请已处理' });
    
    const updates = { handled_by: req.userId, handled_at: new Date().toISOString() };
    
    if (action === 'approve') {
      updates.status = 'approved';
    } else if (action === 'reject') {
      updates.status = 'rejected';
      User.updatePoints(redemption.user_id, redemption.points_spent, true);
      
      const redemptionUser = User.findById(redemption.user_id);
      PointTransaction.create({
        user_id: redemption.user_id,
        amount: redemption.points_spent,
        type: 'refund',
        reason: `兑换申请被拒绝：${reject_reason || redemption.reward_name}`,
        balance: redemptionUser.points
      });
    } else if (action === 'complete') {
      updates.status = 'completed';
    }
    
    Redemption.update(redemption_id, updates);
    
    res.json({ code: 200, message: '处理成功' });
  } catch (error) {
    console.error('审核失败:', error);
    res.status(500).json({ code: 500, message: '审核失败' });
  }
});

module.exports = router;
