const express = require('express');
const router = express.Router();
const { PointTransaction } = require('../db/models');
const { auth } = require('../middleware/auth');

// 获取积分变动记录
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = PointTransaction.findByUser(req.userId, { page: parseInt(page), limit: parseInt(limit) });
    
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
    console.error('获取积分记录失败:', error);
    res.status(500).json({ code: 500, message: '获取积分记录失败' });
  }
});

module.exports = router;
