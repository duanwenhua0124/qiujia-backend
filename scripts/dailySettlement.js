require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const Checkin = require('../models/Checkin');
const PointTransaction = require('../models/PointTransaction');
const CONFIG = require('../config');
const TASK_CONFIG = require('../config/tasks');

async function dailySettlement() {
  try {
    console.log('🔄 开始每日积分结算...\n');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const isYesterdayWeekend = yesterday.getDay() === 0 || yesterday.getDay() === 6;
    
    // 获取所有用户
    const users = await User.find({ role: 'user' });
    
    // 获取所有任务
    const allTasks = await Task.find({ is_active: true });
    
    // 按类别分组任务
    const dailyTasks = allTasks.filter(t => t.category === 'daily');
    const advancedTasks = isYesterdayWeekend ? allTasks.filter(t => t.category === 'advanced') : [];
    const growthTasks = allTasks.filter(t => t.category === 'growth');
    
    let settlementCount = 0;
    
    for (const user of users) {
      // 获取昨日打卡记录
      const yesterdayCheckins = await Checkin.find({
        user_id: user._id,
        date: yesterdayStr
      });
      
      const completedTaskIds = yesterdayCheckins.map(c => c.task_id.toString());
      let penaltyTotal = 0;
      const penalties = [];
      
      // 检查每日任务未完成
      for (const task of dailyTasks) {
        if (!completedTaskIds.includes(task._id.toString())) {
          penaltyTotal += TASK_CONFIG.POINTS.DAILY_TASK_PENALTY;
          penalties.push({
            name: task.name,
            points: TASK_CONFIG.POINTS.DAILY_TASK_PENALTY,
            category: 'daily'
          });
        }
      }
      
      // 检查进阶任务未完成（仅周末）
      if (isYesterdayWeekend) {
        for (const task of advancedTasks) {
          if (!completedTaskIds.includes(task._id.toString())) {
            penaltyTotal += TASK_CONFIG.POINTS.ADVANCED_TASK_PENALTY;
            penalties.push({
              name: task.name,
              points: TASK_CONFIG.POINTS.ADVANCED_TASK_PENALTY,
              category: 'advanced'
            });
          }
        }
      }
      
      // 检查成长任务未完成
      for (const task of growthTasks) {
        if (!completedTaskIds.includes(task._id.toString())) {
          penaltyTotal += TASK_CONFIG.POINTS.ADVANCED_TASK_PENALTY;
          penalties.push({
            name: task.name,
            points: TASK_CONFIG.POINTS.ADVANCED_TASK_PENALTY,
            category: 'growth'
          });
        }
      }
      
      // 执行扣分
      if (penaltyTotal !== 0) {
        user.points += penaltyTotal;
        if (user.points < 0) user.points = 0;
        
        // 检查是否中断了连续打卡
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
        
        // 如果前天有打卡记录但昨天没打卡，中断连续
        if (user.last_checkin_date === twoDaysAgoStr) {
          console.log(`  ⚠️ ${user.nickname} 连续打卡中断`);
          user.checkin_streak = 0;
        }
        
        await user.save();
        
        console.log(`用户 ${user.nickname} (${user.phone}):`);
        penalties.forEach(p => console.log(`  - ${p.name} [${p.category}]: ${p.points}积分`));
        console.log(`  合计扣除: ${Math.abs(penaltyTotal)}积分, 当前余额: ${user.points}`);
        console.log(`  连续打卡: ${user.checkin_streak}天\n`);
        
        // 记录积分变动
        await PointTransaction.create({
          user_id: user._id,
          amount: penaltyTotal,
          type: 'penalty',
          reason: `日常任务未完成扣分（${penalties.map(p => p.name).join('、')}）`,
          balance: user.points
        });
        
        settlementCount++;
      }
    }
    
    console.log(`\n✅ 结算完成，共处理 ${settlementCount} 个用户的积分扣减`);
    
    // 统计今日打卡情况
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = await Checkin.find({ date: today });
    const checkinUsers = new Set(todayCheckins.map(c => c.user_id.toString()));
    
    console.log(`📊 今日打卡情况: ${checkinUsers.size}/${users.length} 人已打卡`);
    
    // 也可以在这里添加定时任务重置今日打卡状态
    // await Checkin.deleteMany({ date: new Date().toISOString().split('T')[0] });
    
  } catch (error) {
    console.error('❌ 结算失败:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// 运行结算
dailySettlement();
