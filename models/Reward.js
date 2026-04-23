const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  // 奖励ID（如 small_1, medium_1）
  reward_id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  points_cost: {
    type: Number,
    required: true
  },
  // 奖励分类: small-即时小奖, medium-月度大奖, large-长期特权
  category: {
    type: String,
    enum: ['small', 'medium', 'large'],
    required: true
  },
  icon: {
    type: String,
    default: 'gift'
  },
  // 库存（-1表示无限）
  stock: {
    type: Number,
    default: -1
  },
  // 是否启用
  is_active: {
    type: Boolean,
    default: true
  },
  // 排序优先级
  sort_order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 兑换记录模型
const redemptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reward_id: {
    type: String,
    required: true
  },
  reward_name: {
    type: String,
    required: true
  },
  points_spent: {
    type: Number,
    required: true
  },
  // 状态: pending-待审核, approved-已通过, rejected-已拒绝, completed-已完成
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  // 兑换备注
  note: {
    type: String,
    default: ''
  },
  // 处理人（管理员）
  handled_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // 处理时间
  handled_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// 索引
redemptionSchema.index({ user_id: 1, status: 1 });
redemptionSchema.index({ created_at: -1 });

const Reward = mongoose.model('Reward', rewardSchema);
const Redemption = mongoose.model('Redemption', redemptionSchema);

module.exports = { Reward, Redemption };
