import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTENT, EventBus, advanceBattleStory, checkIn, claimMapReward, conditionRewardMultiplier, createInitialState, endTurn, getComputedStats, normalizeContent, onDailyReviewCompleted, onDayChecked, onFocusTimeAdded, onPetConnectionChecked, onPetTouched, onTaskCompleted, purchaseItem, equipItem, seedFocusTime, setEquippedSkills, setPlayMode, startBattle, startBattleAt, useSkill } from '../dist/index.js';

test('任务不直接发金币经验，完成委托后发经验且任务不重复结算', () => {
  let state = createInitialState('2026-09-10T08:00:00+08:00');
  state = onTaskCompleted(state, { taskId: 'a' }).state;
  const duplicate = onTaskCompleted(state, { taskId: 'a' });
  state = onTaskCompleted(state, { taskId: 'b' }).state;
  const completed = onTaskCompleted(state, { taskId: 'c' });
  assert.equal(duplicate.events.length, 0); assert.equal(completed.state.totalTasksCompleted, 3); assert.equal(completed.state.coins, 5); assert.equal(completed.state.xp, 30); assert.equal(completed.events.some((entry) => entry.type === 'COMMISSION_COMPLETED'), true);
});

test('连续自然日增长 streak，中断后归零', () => {
  let state = createInitialState('2026-09-08T08:00:00'); state = onTaskCompleted(state, { taskId: 'a', occurredAt: '2026-09-08T09:00:00' }).state; state = onTaskCompleted(state, { taskId: 'b', occurredAt: '2026-09-09T09:00:00' }).state; assert.equal(state.streak, 2); state = onDayChecked(state, '2026-09-11T08:00:00').state; assert.equal(state.streak, 0);
});

test('漏登每天扣 10 状态，状态耗尽后扣 HP，且同日不重复', () => {
  const state = createInitialState('2026-09-01T08:00:00'); state.pet.condition = 15; state.pet.hp = 100;
  const result = onDayChecked(state, '2026-09-05T08:00:00');
  assert.equal(result.state.pet.condition, 0); assert.equal(result.state.pet.hp, 85); assert.equal(result.state.lastLoginDate, '2026-09-05');
  assert.equal(result.events[0].payload.missedDays, 3); assert.equal(result.events[0].payload.hpLost, 15);
  const duplicate = onDayChecked(result.state, '2026-09-05T20:00:00'); assert.equal(duplicate.state.pet.hp, 85); assert.equal(duplicate.events.length, 0);
});

test('专注按观察差值推进委托且不重复', () => {
  let state = seedFocusTime(createInitialState(), 'task-1', 60).state; state = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 119 }).state; assert.equal(state.xp, 0); const reward = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 120 }); assert.equal(reward.state.xp, 30); const duplicate = onFocusTimeAdded(reward.state, { sourceId: 'task-1', sourceTotalMinutes: 120 }); assert.equal(duplicate.state.totalFocusMinutes, 60); assert.equal(duplicate.events.length, 0);
});

test('签到奖励随连续签到增加且同日只领一次', () => {
  let state = createInitialState('2026-09-10T08:00:00'); const first = checkIn(state, '2026-09-10T09:00:00'); const duplicate = checkIn(first.state, '2026-09-10T10:00:00'); const second = checkIn(first.state, '2026-09-11T09:00:00'); assert.equal(first.state.coins, 7); assert.equal(duplicate.events.length, 0); assert.equal(second.state.coins, 16); assert.equal(second.state.checkIn.streak, 2);
});

test('战斗包含可跳过的战前战后剧情且奖励只结算一次', () => {
  const content = structuredClone(DEFAULT_CONTENT); content.chapters = [{ ...content.chapters[0], enemies: [{ ...content.chapters[0].enemies[0], maxHp: 1, xp: 20, coins: 10, storyBefore: ['前'], storyAfter: ['后'] }] }];
  let initial = createInitialState(); initial.pet.condition = 50; let state = startBattle(initial, content).state; assert.equal(state.adventure.activeBattle.phase, 'story_before'); state = advanceBattleStory(state, true, content).state; assert.equal(state.adventure.activeBattle.phase, 'combat'); const won = useSkill(state, 'strike', content); assert.equal(won.state.adventure.activeBattle.phase, 'story_after'); assert.equal(won.state.coins, 10); const duplicate = useSkill(won.state, 'strike', content); assert.equal(duplicate.state.coins, 10); const finished = advanceBattleStory(won.state, true, content); assert.equal(finished.state.adventure.activeBattle, null); assert.equal(finished.state.adventure.chapterIndex, 0);
});

test('单回合可以连续使用技能，结束回合后敌人才行动且资源回到 5', () => {
  let state = startBattle(createInitialState(), DEFAULT_CONTENT).state; state = advanceBattleStory(state, true, DEFAULT_CONTENT).state; const first = useSkill(state, 'strike', DEFAULT_CONTENT); const second = useSkill(first.state, 'strike', DEFAULT_CONTENT); assert.equal(second.state.adventure.activeBattle.turn, 1); assert.equal(second.state.adventure.activeBattle.resource, 3); assert.equal(second.state.pet.hp, 100); const turn = endTurn(second.state, DEFAULT_CONTENT); assert.equal(turn.state.adventure.activeBattle.turn, 2); assert.equal(turn.state.adventure.activeBattle.maxResource, 5); assert.equal(turn.state.adventure.activeBattle.resource, 5); assert.ok(turn.state.pet.hp < 100);
});

test('小地图每层只能选择一条路线且最终层必须打 Boss', () => {
  const state = createInitialState(); state.pet.hp = 50;
  const reward = claimMapReward(state, 0); const duplicate = claimMapReward(reward.state, 0);
  assert.equal(reward.state.coins, 4); assert.equal(reward.state.pet.hp, 56); assert.equal(duplicate.events.length, 0);
  assert.equal(reward.state.adventure.encounterIndex, 1); assert.equal(startBattleAt(reward.state, 0).events.length, 0); assert.equal(startBattleAt(reward.state, 1).events[0].type, 'BATTLE_STARTED'); assert.equal(claimMapReward({ ...reward.state, adventure: { ...reward.state.adventure, encounterIndex: DEFAULT_CONTENT.chapters[0].enemies.length - 1 } }, 2).events.length, 0);
});

test('最多装备四个已学习技能', () => {
  const content = structuredClone(DEFAULT_CONTENT); let state = createInitialState(); assert.deepEqual(state.pet.equippedSkills, ['strike', 'brace', 'ember-shot', 'tide-cut']); state.pet.learnedSkills = content.skills.map((skill) => skill.id); const result = setEquippedSkills(state, content.skills.map((skill) => skill.id), content); assert.equal(result.state.pet.equippedSkills.length, 4); assert.deepEqual(result.state.pet.equippedSkills, content.skills.slice(0, 4).map((skill) => skill.id));
});

test('元素克制、同属性护盾减伤与物理独立规则使用明确倍率', () => {
  const content = structuredClone(DEFAULT_CONTENT); content.skills.push({ id: 'test-fire', name: '测试火击', nameEn: 'Test Fire', description: '', cost: 1, type: 'fire', power: 1 }); content.chapters[0].enemies[0] = { ...content.chapters[0].enemies[0], element: 'ice', maxHp: 200, defense: 0, resistances: { physical: 0, fire: 0, water: 0, ice: 0, electric: 0 } };
  let state = createInitialState(); state.pet.learnedSkills.push('test-fire'); state.pet.equippedSkills = ['strike', 'test-fire']; state = advanceBattleStory(startBattle(state, content).state, true, content).state;
  const strong = useSkill(state, 'test-fire', content); assert.equal(strong.events[0].payload.multiplier, 1.5); assert.equal(strong.events[0].payload.damage, 18);
  state = structuredClone(state); state.adventure.activeBattle.enemyBlock = 100; state.adventure.activeBattle.enemyBlockType = 'fire'; const sameShield = useSkill(state, 'test-fire', content); assert.equal(sameShield.events[0].payload.multiplier, 0.5); assert.equal(sameShield.events[0].payload.blockAbsorbed, 6);
  state = structuredClone(state); state.adventure.activeBattle.enemyBlock = 100; state.adventure.activeBattle.enemyBlockType = 'fire'; const physical = useSkill(state, 'strike', content); assert.equal(physical.events[0].payload.multiplier, 1); assert.equal(physical.events[0].payload.blockAbsorbed, 12);
});

test('外部内容的倍率和百分比会归入简化档位', () => {
  const content = structuredClone(DEFAULT_CONTENT); content.skills[0].power = 1.25; content.skills[0].weaken = 15; content.items[0].effects = { xpBonus: 33, damageBonus: { fire: 49 } };
  const normalized = normalizeContent(content); assert.equal(normalized.skills[0].power, 1); assert.equal(normalized.skills[0].weaken, 10); assert.equal(normalized.items[0].effects.xpBonus, 20); assert.equal(normalized.items[0].effects.damageBonus.fire, 50);
});

test('装备属性与先遣套装效果会进入最终战斗属性', () => {
  let state = createInitialState(); state.coins = 200; state = purchaseItem(state, 'pioneer-blade').state; state = purchaseItem(state, 'pioneer-coat').state; state = equipItem(state, 'pioneer-blade').state; state = equipItem(state, 'pioneer-coat').state; const stats = getComputedStats(state); assert.equal(stats.attack, 19); assert.equal(stats.defense, 10); assert.equal(stats.maxHp, 115);
});

test('桌宠长时间断连会按间隔降低状态值', () => {
  const state = createInitialState('2026-09-10T08:00:00Z'); const result = onPetConnectionChecked(state, false, '2026-09-10T10:05:00Z', { disconnectDecayMinutes: 60, disconnectDecayAmount: 3 }); assert.equal(result.state.pet.condition, 94); assert.equal(result.events[0].payload.lost, 6);
});

test('统一事件总线按注册顺序异步分发并可取消监听', async () => {
  const bus = new EventBus(); const received = []; const off = bus.on('TASK_COMPLETED', async ({ taskId }) => { received.push(taskId); }); await bus.emit('TASK_COMPLETED', { taskId: 'a' }); off(); await bus.emit('TASK_COMPLETED', { taskId: 'b' }); assert.deepEqual(received, ['a']);
});

test('四类每日委托受每日 XP 上限约束并恢复状态与增加好感', () => {
  let state = createInitialState('2026-09-12T08:00:00'); state.pet.condition = 50;
  state = onTaskCompleted(state, { taskId: 'p', highPriority: true }).state;
  state = onTaskCompleted(state, { taskId: 'b' }).state;
  state = onTaskCompleted(state, { taskId: 'c' }).state;
  state = onFocusTimeAdded(state, { minutes: 60 }).state;
  state = onDailyReviewCompleted(state).state;
  assert.equal(state.today.xpEarned, 100); assert.equal(state.xp, 100); assert.equal(state.pet.condition, 74); assert.equal(state.pet.affinity.points, 8);
});

test('抚摸每日最多增加三点好感，陪伴模式禁止进入战斗', () => {
  let state = createInitialState('2026-09-12T08:00:00'); for (let index = 0; index < 5; index += 1) state = onPetTouched(state, '2026-09-12T09:00:00').state; assert.equal(state.pet.affinity.points, 3);
  state = setPlayMode(state, 'companion').state; assert.equal(state.mode, 'companion'); assert.equal(startBattle(state).events.length, 0);
});

test('状态值使用四档明确倍率调整战斗收益', () => {
  assert.deepEqual([100, 80, 79, 50, 49, 20, 19, 0].map(conditionRewardMultiplier), [1.2, 1.2, 1, 1, .9, .9, .8, .8]);
});
