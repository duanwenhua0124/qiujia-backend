const express = require('express');
const router = express.Router();
const { Reward, Redemption } = require('../models/Reward');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { auth } = require('../middleware/auth');
const REWARD_CONFIG = require('../config/rewards');
const mongoose = require('mongoose');

// 获取奖励列表
router.get('/list', auth, async (req, res) => {
  try {
    const { category } = req.query;
    
    // 从配置文件获取奖励列表
    let rewards = [];
    
    if (category) {
      if (category === 'small') {
        rewards = REWARD_CONFIG.SMALL_REWARDS.filter(r => r.active);
      } else if (category === 'medium') {
        rewards = REWARD_CONFIG.MEDIUM_REWARDS.filter(r => r.active);
      } else if (category === 'large') {
        rewards = REWARD_CONFIG.LARGE_REWARDS.filter(r => r.active);
      }
    } else {
      // 返回所有奖励
      rewards = [
        ...REWARD_CONFIG.SMALL_REWARDS.filter(r => r.active),
        ...REWARD_CONFIG.MEDIUM_REWARDS.filter(r => r.active),
        ...REWARD_CONFIG.LARGE_REWARDS.filter(r => r.active)
      ];
    }
    
    // 获取用户当前积分
    const user = await User.findById(req.userId);
    
    // 判断用户是否有足够的积分兑换
    rewards = rewards.map(reward => ({
      ...reward,
      can_redeem: user.points >= reward.points_cost,
      is_expensive: user.points < reward.points_cost
    }));
    
    // 按分类组织返回
    const groupedRewards = {
      small: REWARD_CONFIG.SMALL_REWARDS.filter(r => r.active).map(reward => ({
        ...reward,
        can_redeem: user.points >= reward.points_cost
      })),
      medium: REWARD_CONFIG.MEDIUM_REWARDS.filter(r => r.active).map(reward => ({
        ...reward,
        can_redeem: user.points >= reward.points_cost
      })),
      large: REWARD_CONFIG.LARGE_REWARDS.filter(r => r.active).map(reward => ({
        ...reward,
        can_redeem: user.points >= reward.points_cost
      }))
    };
    
    res.json({
      code: 200,
      data: {
        rewards,
        groupedRewards,
        user_points: user.points
      }
    });
  } catch (error) {
    console.error('获取奖励列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取奖励列表失败'
    });
  }
});

// 兑换奖励
router.post('/redeem', auth, async (req, res) => {
  try {
    const { reward_id, note = '' } = req.body;
    
    // 查找奖励配置
    let reward = REWARD_CONFIG.SMALL_REWARDS.find(r => r.id === reward_id);
    if (!reward) {
      reward = REWARD_CONFIG.MEDIUM_REWARDS.find(r => r.id === reward_id);
    }
    if (!reward) {
      reward = REWARD_CONFIG.LARGE_REWARDS.find(r => r.id === reward_id);
    }
    
    if (!reward) {
      return res.status(404).json({
        code: 404,
        message: '奖励不存在'
      });
    }
    
    if (!reward.active) {
      return res.status(400).json({
        code: 400,
        message: '该奖励已下架'
      });
    }
    
    // 检查用户积分
    const user = await User.findById(req.userId);
    if (user.points < reward.points_cost) {
      return res.status(422).json({
        code: 422,
        message: `积分不足，还需${reward.points_cost - user.points}积分`
      });
    }
    
    // 扣除积分
    user.points -= reward.points_cost;
    await user.save();
    
    // 创建兑换记录
    const redemption = await Redemption.create({
      user_id: req.userId,
      reward_id: reward.id,
      reward_name: reward.name,
      points_spent: reward.points_cost,
      status: reward.category === 'small' ? 'approved' : 'pending', // 小奖励直接通过
      note
    });
    
    // 如果是小奖励，自动完成
    if (reward.category === 'small') {
      redemption.status = 'completed';
      redemption.handled_at = new Date();
      await redemption.save();
    }
    
    // 记录积分变动
    await PointTransaction.create({
      user_id: req.userId,
      amount: -reward.points_cost,
      type: 'redeem',
      reason: `兑换奖励：${reward.name}`,
      related_redemption_id: redemption._id,
      balance: user.points
    });
    
    res.json({
      code: 200,
      message: reward.category === 'small' ? '兑换成功，奖励已发放！' : '兑换申请已提交，请等待审核',
      data: {
        redemption_id: redemption._id,
        status: redemption.status,
        remaining_points: user.points
      }
    });
  } catch (error) {
    console.error('兑换奖励失败:', error);
    res.status(500).json({
      code: 500,
      message: '兑换奖励失败'
    });
  }
});

// 获取兑换记录
router.get('/history', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { user_id: req.userId };
    
    if (status) {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [redemptions, total] = await Promise.all([
      Redemption.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Redemption.countDocuments(query)
    ]);
    
    res.json({
      code: 200,
      data: {
        list: redemptions,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取兑换记录失败'
    });
  }
});

// ============ 管理员接口 ============

// 获取所有兑换申请
router.get('/admin/pending', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({
        code: 403,
        message: '无权限'
      });
    }
    
    const { status } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    const redemptions = await Redemption.find(query)
      .populate('user_id', 'nickname phone')
      .sort({ created_at: -1 });
    
    res.json({
      code: 200,
      data: redemptions
    });
  } catch (error) {
    console.error('获取兑换申请失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取兑换申请失败'
    });
  }
});

// 审核兑换申请
router.post('/admin/review', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({
        code: 403,
        message: '无权限'
      });
    }
    
    const { redemption_id, action, reject_reason = '' } = req.body;
    
    const redemption = await Redemption.findById(redemption_id);
    if (!redemption) {
      return res.status(404).json({
        code: 404,
        message: '兑换记录不存在'
      });
    }
    
    if (redemption.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        message: '该申请已处理'
      });
    }
    
    if (action === 'approve') {
      redemption.status = 'approved';
    } else if (action === 'reject') {
      redemption.status = 'rejected';
      // 返还积分
      const redemptionUser = await User.findById(redemption.user_id);
      redemptionUser.points += redemption.points_spent;
      await redemptionUser.save();
      
      // 记录积分返还
      await PointTransaction.create({
        user_id: redemption.user_id,
        amount: redemption.points_spent,
        type: 'refund',
        reason: `兑换申请被拒绝：${reject_reason || redemption.reward_name}`,
        related_redemption_id: redemption._id,
        balance: redemptionUser.points
      });
    } else if (action === 'complete') {
      redemption.status = 'completed';
    }
    
    redemption.handled_by = req.userId;
    redemption.handled_at = new Date();
    await redemption.save();
    
    res.json({
      code: 200,
      message: '处理成功'
    });
  } catch (error) {
    console.error('审核失败:', error);
    res.status(500).json({
      code: 500,
      message: '审核失败'
    });
  }
});

module.exports = router;
