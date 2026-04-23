const mongoose = require('mongoose');

const checkinSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  task_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD格式
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'completed'
  },
  points_earned: {
    type: Number,
    default: 0
  },
  checked_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 联合唯一索引，防止重复打卡
checkinSchema.index({ user_id: 1, date: 1, task_id: 1 }, { unique: true });

module.exports = mongoose.model('Checkin', checkinSchema);
