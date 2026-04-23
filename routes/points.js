const express = require('express');
const router = express.Router();
const PointTransaction = require('../models/PointTransaction');
const { auth } = require('../middleware/auth');

// 获取积分变动记录
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [transactions, total] = await Promise.all([
      PointTransaction.find({ user_id: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PointTransaction.countDocuments({ user_id: req.userId })
    ]);
    
    res.json({
      code: 200,
      data: {
        list: transactions,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取积分记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取积分记录失败'
    });
  }
});

module.exports = router;
