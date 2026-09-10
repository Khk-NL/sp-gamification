import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDebugXp,
  createInitialState,
  onDayChecked,
  onFocusTimeAdded,
  onTaskCompleted,
  purchaseItem,
  seedFocusTime,
  xpRequiredForLevel,
} from '../dist/index.js';

test('任务完成奖励只结算一次', () => {
  const initial = createInitialState('2026-09-10T08:00:00+08:00');
  const first = onTaskCompleted(initial, {
    taskId: 'task-1',
    occurredAt: '2026-09-10T09:00:00+08:00',
  });
  const duplicate = onTaskCompleted(first.state, {
    taskId: 'task-1',
    occurredAt: '2026-09-10T09:01:00+08:00',
  });

  assert.equal(first.state.xp, 10);
  assert.equal(first.state.coins, 5);
  assert.equal(first.state.totalTasksCompleted, 1);
  assert.equal(first.state.today.tasksCompleted, 1);
  assert.equal(duplicate.state.xp, 10);
  assert.equal(duplicate.events.length, 0);
});

test('困难标签增加 Boss 伤害，Boss 击败后推进章节', () => {
  let state = createInitialState('2026-09-10T08:00:00');
  state.adventure.boss.hp = 20;
  const result = onTaskCompleted(state, { taskId: 'hard-1', tags: ['hard'] });
  assert.equal(result.state.adventure.stage, 2);
  assert.equal(result.state.adventure.zoneIndex, 1);
  assert.equal(result.events.some((event) => event.type === 'BOSS_DEFEATED'), true);
});

test('金币可购买饰品且不会重复扣费', () => {
  const initial = createInitialState();
  initial.coins = 30;
  const first = purchaseItem(initial, 'sun-band');
  const duplicate = purchaseItem(first.state, 'sun-band');
  assert.equal(first.state.coins, 0);
  assert.deepEqual(first.state.inventory, ['sun-band']);
  assert.equal(duplicate.state.coins, 0);
  assert.equal(duplicate.events.length, 0);
});

test('连续自然日增长 streak，中断后从 1 开始', () => {
  let state = createInitialState('2026-09-08T08:00:00');
  state = onTaskCompleted(state, { taskId: 'a', occurredAt: '2026-09-08T09:00:00' }).state;
  state = onTaskCompleted(state, { taskId: 'b', occurredAt: '2026-09-09T09:00:00' }).state;
  assert.equal(state.streak, 2);

  state = onDayChecked(state, '2026-09-11T08:00:00').state;
  assert.equal(state.streak, 0);
  state = onTaskCompleted(state, { taskId: 'c', occurredAt: '2026-09-11T09:00:00' }).state;
  assert.equal(state.streak, 1);
});

test('专注按累计 25 分钟奖励且观察总量不会重复结算', () => {
  let state = createInitialState('2026-09-10T08:00:00');
  state = seedFocusTime(state, 'task-1', 60).state;
  let result = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 84 });
  assert.equal(result.state.totalFocusMinutes, 24);
  assert.equal(result.state.xp, 0);

  result = onFocusTimeAdded(result.state, { sourceId: 'task-1', sourceTotalMinutes: 85 });
  assert.equal(result.state.totalFocusMinutes, 25);
  assert.equal(result.state.xp, 5);
  assert.equal(result.events[0].type, 'FOCUS_REWARD');

  result = onFocusTimeAdded(result.state, { sourceId: 'task-1', sourceTotalMinutes: 85 });
  assert.equal(result.state.totalFocusMinutes, 25);
  assert.equal(result.state.xp, 5);
  assert.equal(result.events.length, 0);
});

test('XP 达到当前等级阈值后升级并保留余量', () => {
  const initial = createInitialState('2026-09-10T08:00:00');
  const result = addDebugXp(initial, xpRequiredForLevel(1) + 7);
  assert.equal(result.state.level, 2);
  assert.equal(result.state.xp, 7);
  assert.equal(result.events.at(-1).type, 'LEVEL_UP');
});
