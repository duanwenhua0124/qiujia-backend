require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { Reward } = require('../models/Reward');
const CONFIG = require('../config');
const TASK_CONFIG = require('../config/tasks');
const REWARD_CONFIG = require('../config/rewards');

async function initDatabase() {
  try {
    // 连接数据库
    console.log('🔄 连接数据库...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task_checkin', {
      serverSelectionTimeoutMS: 30000
    });
    console.log('  ✓ 数据库连接成功\n');
    
    console.log('🔄 开始初始化数据库...\n');

    // ========== 初始化任务 ==========
    console.log('📋 初始化任务数据...');
    
    // 删除现有任务
    await Task.deleteMany({});
    console.log('  ✓ 已清空现有任务数据');

    // 插入每日基础任务
    const dailyTasks = TASK_CONFIG.DAILY_TASKS.map((task, index) => ({
      ...task,
      priority: index + 1,
      weekend_only: false
    }));
    await Task.insertMany(dailyTasks);
    console.log(`  ✓ 已添加 ${dailyTasks.length} 个每日基础任务`);

    // 插入进阶家务任务
    const advancedTasks = TASK_CONFIG.ADVANCED_TASKS.map((task, index) => ({
      ...task,
      priority: 100 + index + 1,
      weekend_only: true
    }));
    await Task.insertMany(advancedTasks);
    console.log(`  ✓ 已添加 ${advancedTasks.length} 个进阶家务任务`);

    // 插入成长责任任务
    const growthTasks = TASK_CONFIG.GROWTH_TASKS.map((task, index) => ({
      ...task,
      priority: 200 + index + 1,
      weekend_only: false
    }));
    await Task.insertMany(growthTasks);
    console.log(`  ✓ 已添加 ${growthTasks.length} 个成长责任任务`);

    // ========== 初始化奖励 ==========
    console.log('\n🎁 初始化奖励数据...');
    
    // 删除现有奖励
    await Reward.deleteMany({});
    console.log('  ✓ 已清空现有奖励数据');

    // 准备奖励数据
    const rewardsData = [
      ...REWARD_CONFIG.SMALL_REWARDS.map((r, i) => ({ ...r, reward_id: `small_${i+1}`, sort_order: i + 1 })),
      ...REWARD_CONFIG.MEDIUM_REWARDS.map((r, i) => ({ ...r, reward_id: `medium_${i+1}`, sort_order: 10 + i + 1 })),
      ...REWARD_CONFIG.LARGE_REWARDS.map((r, i) => ({ ...r, reward_id: `large_${i+1}`, sort_order: 20 + i + 1 }))
    ];

    await Reward.insertMany(rewardsData);
    console.log(`  ✓ 已添加 ${rewardsData.length} 个奖励项目`);

    // ========== 完成 ==========
    console.log('\n✅ 数据库初始化完成！');
    console.log('\n📊 数据统计:');
    console.log(`   - 每日基础任务: ${dailyTasks.length} 个`);
    console.log(`   - 进阶家务任务: ${advancedTasks.length} 个`);
    console.log(`   - 成长责任任务: ${growthTasks.length} 个`);
    console.log(`   - 奖励项目: ${rewardsData.length} 个`);

    // 显示所有任务
    console.log('\n📝 当前任务列表:');
    const allTasks = await Task.find().sort({ priority: 1 });
    allTasks.forEach(task => {
      const categoryLabel = {
        daily: '【每日】',
        advanced: '【进阶】',
        growth: '【成长】'
      }[task.category] || '【其他】';
      console.log(`   ${categoryLabel} ${task.name} - ${task.base_points}分 (${task.time_period})`);
    });

    // 显示所有奖励
    console.log('\n🎁 当前奖励列表:');
    const categoryNames = { small: '即时小奖', medium: '月度大奖', large: '长期特权' };
    Object.entries(categoryNames).forEach(([cat, name]) => {
      const catRewards = rewardsData.filter(r => r.category === cat);
      console.log(`   ${name}:`);
      catRewards.forEach(r => {
        console.log(`     - ${r.name} (${r.points_cost}积分)`);
      });
    });

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

initDatabase();
