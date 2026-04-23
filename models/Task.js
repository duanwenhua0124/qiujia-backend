const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  time_period: {
    type: String,
    enum: ['morning', 'noon', 'evening', 'weekend', 'anytime'],
    required: true
  },
  base_points: {
    type: Number,
    default: 2
  },
  extra_points: {
    type: Number,
    default: 0
  },
  // 任务分类: daily-每日基础任务, advanced-进阶家务任务, growth-成长责任任务
  category: {
    type: String,
    enum: ['daily', 'advanced', 'growth'],
    default: 'daily'
  },
  // 是否周末专属任务
  weekend_only: {
    type: Boolean,
    default: false
  },
  // 是否活跃
  is_active: {
    type: Boolean,
    default: true
  },
  // 任务优先级（数字越小优先级越高）
  priority: {
    type: Number,
    default: 100
  }
}, {
  timestamps: true
});

// 索引
taskSchema.index({ is_active: 1, time_period: 1 });
taskSchema.index({ category: 1, is_active: 1 });

module.exports = mongoose.model('Task', taskSchema);
