// 任务配置 - 球家宝贝成长社

module.exports = {
  // 每日公共基础任务
  DAILY_TASKS: [
    { name: '整理床铺', icon: 'bed', base_points: 2, time_period: 'morning', category: 'daily' },
    { name: '早晨刷牙', icon: 'tooth', base_points: 2, time_period: 'morning', category: 'daily' },
    { name: '午餐收拾餐桌、洗碗', icon: 'bowl', base_points: 3, time_period: 'noon', category: 'daily' },
    { name: '晚上客厅拖地', icon: 'mop', base_points: 3, time_period: 'evening', category: 'daily' },
    { name: '晚上收拾餐桌、洗碗', icon: 'bowl', base_points: 3, time_period: 'evening', category: 'daily' },
    { name: '倒全家垃圾', icon: 'trash', base_points: 2, time_period: 'evening', category: 'daily' },
    { name: '完成作业', icon: 'homework', base_points: 2, time_period: 'evening', category: 'daily' },
    { name: '晚上刷牙', icon: 'tooth', base_points: 2, time_period: 'evening', category: 'daily' }
  ],

  // 进阶家务任务（周末）
  ADVANCED_TASKS: [
    { name: '擦全屋家具门窗', icon: 'wipe', base_points: 5, time_period: 'weekend', category: 'advanced' },
    { name: '清洗卫生间/厨房台面', icon: 'clean', base_points: 6, time_period: 'weekend', category: 'advanced' },
    { name: '家庭跑腿采购', icon: 'shopping', base_points: 5, time_period: 'weekend', category: 'advanced' }
  ],

  // 成长责任任务（高价值）
  GROWTH_TASKS: [
    { name: '帮长辈处理手机事务', icon: 'phone', base_points: 7, time_period: 'anytime', category: 'growth' },
    { name: '学会并实操新家务技能', icon: 'skill', base_points: 6, time_period: 'anytime', category: 'growth' }
  ],

  // 积分规则配置
  POINTS: {
    // 每日任务未完成扣分
    DAILY_TASK_PENALTY: -2,
    // 进阶/成长任务未完成扣分
    ADVANCED_TASK_PENALTY: -10,
    // 补做积分（24小时内完成，只发一半积分，不扣分）
    MAKEUP_HALF_POINTS: true,
    // 补做时限（小时）
    MAKEUP_TIME_LIMIT: 24,
    // 连续打卡奖励
    STREAK_REWARDS: {
      7: 10,   // 连续7天 +10分
      30: 50   // 连续30天 +50分
    }
  },

  // 时间段定义
  TIME_PERIODS: {
    MORNING: { start: 5, end: 12, name: 'morning', label: '早上' },
    NOON: { start: 12, end: 18, name: 'noon', label: '中午' },
    EVENING: { start: 18, end: 24, name: 'evening', label: '晚上' },
    WEEKEND: { name: 'weekend', label: '周末' },
    ANYTIME: { name: 'anytime', label: '随时' }
  },

  // 任务类别
  CATEGORIES: {
    DAILY: 'daily',      // 每日基础任务
    ADVANCED: 'advanced', // 进阶家务任务
    GROWTH: 'growth'     // 成长责任任务
  }
};
