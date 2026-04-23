const mongoose = require('mongoose');

const pointTransactionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['earn', 'deduct', 'reward', 'adjust', 'publish', 'accept'],
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  related_task_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  related_custom_task_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomTask',
    default: null
  },
  balance: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// 索引
pointTransactionSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);
