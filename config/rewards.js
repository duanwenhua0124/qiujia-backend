// 积分兑换商城配置 - 球家宝贝成长社

module.exports = {
  // 即时小奖（10-50积分）
  SMALL_REWARDS: [
    {
      id: 'small_1',
      name: '额外30分钟娱乐时间',
      points_cost: 10,
      description: '可自由使用手机、平板或看电视30分钟',
      category: 'small',
      icon: 'game',
      stock: -1,  // -1表示无限库存
      active: true
    },
    {
      id: 'small_2',
      name: '零食/奶茶',
      points_cost: 30,
      description: '可以选择喜欢的零食或奶茶一杯',
      category: 'small',
      icon: 'snack',
      stock: -1,
      active: true
    },
    {
      id: 'small_3',
      name: '周末汉堡',
      points_cost: 50,
      description: '周末可以去吃一次汉堡大餐',
      category: 'small',
      icon: 'burger',
      stock: -1,
      active: true
    }
  ],

  // 月度大奖（50-100积分）
  MEDIUM_REWARDS: [
    {
      id: 'medium_1',
      name: '运动装备',
      points_cost: 100,
      description: '运动手套、护腕、运动袜等任选一件',
      category: 'medium',
      icon: 'sports',
      stock: -1,
      active: true
    },
    {
      id: 'medium_2',
      name: '视频/游戏会员（30元以内）',
      points_cost: 200,
      description: '可兑换爱奇艺/腾讯/优酷月卡或游戏月卡',
      category: 'medium',
      icon: 'vip',
      stock: -1,
      active: true
    }
  ],

  // 长期特权（150+积分）
  LARGE_REWARDS: [
    {
      id: 'large_1',
      name: '主导1次家庭短途游',
      points_cost: 200,
      description: '可以自主选择目的地，策划一次家庭短途游',
      category: 'large',
      icon: 'travel',
      stock: -1,
      active: true
    },
    {
      id: 'large_2',
      name: '心仪大件物品',
      points_cost: 400,
      description: '球鞋、自行车、滑板等任选一件（需家长确认）',
      category: 'large',
      icon: 'gift',
      stock: -1,
      active: true
    }
  ],

  // 奖励分类
  CATEGORIES: {
    SMALL: 'small',      // 即时小奖
    MEDIUM: 'medium',    // 月度大奖
    LARGE: 'large'       // 长期特权
  },

  // 奖励状态
  STATUS: {
    PENDING: 'pending',    // 待兑换
    APPROVED: 'approved',  // 已通过
    REJECTED: 'rejected',  // 已拒绝
    COMPLETED: 'completed' // 已完成
  }
};
