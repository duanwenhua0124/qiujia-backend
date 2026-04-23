module.exports = {
  // 积分配置
  POINTS: {
    BASE_POINTS: 10,           // 完成任务基础积分
    DISH_WASHING_BONUS: 20,    // 洗碗额外积分
    MISSED_BRUSH_PENALTY: -50, // 刷牙未完成扣分
    MISSED_HOMEWORK_PENALTY: -50, // 作业未完成扣分
    INITIAL_POINTS: 100        // 新用户初始积分
  },
  
  // 时间段定义
  TIME_PERIODS: {
    MORNING: { start: 5, end: 12, name: 'morning' },
    NOON: { start: 12, end: 18, name: 'noon' },
    EVENING: { start: 18, end: 24, name: 'evening' }
  },
  
  // 任务配置
  TASKS: {
    MORNING: [
      { name: '刷牙', icon: 'tooth', extra_points: 0 }
    ],
    NOON: [
      { name: '洗碗', icon: 'bowl', extra_points: 20 },
      { name: '整理餐桌', icon: 'table', extra_points: 0 }
    ],
    EVENING: [
      { name: '完成作业', icon: 'homework', extra_points: 0 },
      { name: '洗碗', icon: 'bowl', extra_points: 20 },
      { name: '整理餐桌', icon: 'table', extra_points: 0 },
      { name: '倒垃圾', icon: 'trash', extra_points: 0 },
      { name: '拖地', icon: 'mop', extra_points: 0 },
      { name: '刷牙', icon: 'tooth', extra_points: 0 }
    ]
  },
  
  // 验证码配置
  SMS: {
    CODE_LENGTH: 6,
    EXPIRES_IN: 300 // 5分钟
  }
};
