const mongoose = require('mongoose');

const customTaskSchema = new mongoose.Schema({
  creator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  points_required: {
    type: Number,
    required: true,
    min: 1
  },
  points_reward: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'completed', 'cancelled'],
    default: 'open'
  },
  assignee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  completed_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// 索引
customTaskSchema.index({ creator_id: 1 });
customTaskSchema.index({ assignee_id: 1 });
customTaskSchema.index({ status: 1 });

module.exports = mongoose.model('CustomTask', customTaskSchema);
