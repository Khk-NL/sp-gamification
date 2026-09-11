import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTENT, advanceBattleStory, checkIn, createInitialState, getComputedStats, onDayChecked, onFocusTimeAdded, onPetConnectionChecked, onTaskCompleted, purchaseItem, equipItem, seedFocusTime, startBattle, useSkill } from '../dist/index.js';

test('任务不直接发金币经验，完成委托后发经验且任务不重复结算', () => {
  let state = createInitialState('2026-09-10T08:00:00+08:00');
  state = onTaskCompleted(state, { taskId: 'a' }).state;
  const duplicate = onTaskCompleted(state, { taskId: 'a' });
  state = onTaskCompleted(state, { taskId: 'b' }).state;
  const completed = onTaskCompleted(state, { taskId: 'c' });
  assert.equal(duplicate.events.length, 0); assert.equal(completed.state.totalTasksCompleted, 3); assert.equal(completed.state.coins, 0); assert.equal(completed.state.xp, 30); assert.equal(completed.events.some((entry) => entry.type === 'COMMISSION_COMPLETED'), true);
});

test('连续自然日增长 streak，中断后归零', () => {
  let state = createInitialState('2026-09-08T08:00:00'); state = onTaskCompleted(state, { taskId: 'a', occurredAt: '2026-09-08T09:00:00' }).state; state = onTaskCompleted(state, { taskId: 'b', occurredAt: '2026-09-09T09:00:00' }).state; assert.equal(state.streak, 2); state = onDayChecked(state, '2026-09-11T08:00:00').state; assert.equal(state.streak, 0);
});

test('专注按观察差值推进委托且不重复', () => {
  let state = seedFocusTime(createInitialState(), 'task-1', 60).state; state = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 109 }).state; assert.equal(state.xp, 0); const reward = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 110 }); assert.equal(reward.state.xp, 40); const duplicate = onFocusTimeAdded(reward.state, { sourceId: 'task-1', sourceTotalMinutes: 110 }); assert.equal(duplicate.state.totalFocusMinutes, 50); assert.equal(duplicate.events.length, 0);
});

test('签到奖励随连续签到增加且同日只领一次', () => {
  let state = createInitialState('2026-09-10T08:00:00'); const first = checkIn(state, '2026-09-10T09:00:00'); const duplicate = checkIn(first.state, '2026-09-10T10:00:00'); const second = checkIn(first.state, '2026-09-11T09:00:00'); assert.equal(first.state.coins, 7); assert.equal(duplicate.events.length, 0); assert.equal(second.state.coins, 16); assert.equal(second.state.checkIn.streak, 2);
});

test('战斗包含可跳过的战前战后剧情且奖励只结算一次', () => {
  const content = structuredClone(DEFAULT_CONTENT); content.chapters = [{ ...content.chapters[0], enemies: [{ ...content.chapters[0].enemies[0], maxHp: 1, xp: 20, coins: 10, storyBefore: ['前'], storyAfter: ['后'] }] }];
  let state = startBattle(createInitialState(), content).state; assert.equal(state.adventure.activeBattle.phase, 'story_before'); state = advanceBattleStory(state, true, content).state; assert.equal(state.adventure.activeBattle.phase, 'combat'); const won = useSkill(state, 'strike', content); assert.equal(won.state.adventure.activeBattle.phase, 'story_after'); assert.equal(won.state.coins, 10); const duplicate = useSkill(won.state, 'strike', content); assert.equal(duplicate.state.coins, 10); const finished = advanceBattleStory(won.state, true, content); assert.equal(finished.state.adventure.activeBattle, null); assert.equal(finished.state.adventure.chapterIndex, 0);
});

test('每回合资源上限加一并回满，敌方行动意图生效', () => {
  let state = startBattle(createInitialState(), DEFAULT_CONTENT).state; state = advanceBattleStory(state, true, DEFAULT_CONTENT).state; const turn = useSkill(state, 'strike', DEFAULT_CONTENT); assert.equal(turn.state.adventure.activeBattle.turn, 2); assert.equal(turn.state.adventure.activeBattle.maxResource, 2); assert.equal(turn.state.adventure.activeBattle.resource, 2); assert.ok(turn.state.pet.hp < 100);
});

test('装备属性与先遣套装效果会进入最终战斗属性', () => {
  let state = createInitialState(); state.coins = 200; state = purchaseItem(state, 'pioneer-blade').state; state = purchaseItem(state, 'pioneer-coat').state; state = equipItem(state, 'pioneer-blade').state; state = equipItem(state, 'pioneer-coat').state; const stats = getComputedStats(state); assert.equal(stats.attack, 19); assert.equal(stats.defense, 10); assert.equal(stats.maxHp, 115);
});

test('桌宠长时间断连会按间隔降低状态值', () => {
  const state = createInitialState('2026-09-10T08:00:00Z'); const result = onPetConnectionChecked(state, false, '2026-09-10T10:05:00Z', { disconnectDecayMinutes: 60, disconnectDecayAmount: 3 }); assert.equal(result.state.pet.condition, 94); assert.equal(result.events[0].payload.lost, 6);
});
