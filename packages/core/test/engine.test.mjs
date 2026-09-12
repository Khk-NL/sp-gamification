import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATTLE_CONDITION_COST, BATTLE_RESOURCE_PER_TURN, DEFAULT_CONTENT, EventBus,
  advanceBattleStory, checkIn, claimMapReward,
  conditionRewardMultiplier, createInitialState, elementMultiplier, equipItem,
  leaveMapShop,
  normalizeContent, onDayChecked, onFocusSessionCompleted, onFocusTimeAdded,
  onGoalProgressUpdated, onPetConnectionChecked, onPetTouched, onTaskCompleted, openMapShop,
  purchaseItem, purchaseMapItem, recruit, refreshShop, scaleEnemy, seedFocusTime,
  setEquippedSkills, setPlayMode, startBattle, startBattleAt, useItem,
} from '../dist/index.js';

test('任务去重并恢复状态，但不会触发或推进战斗', () => {
  let state = startBattle(createInitialState(), DEFAULT_CONTENT).state;
  state.pet.condition = 50;
  const battleBefore = structuredClone(state.adventure.activeBattle);
  const result = onTaskCompleted(state, { taskId: 'a' }, DEFAULT_CONTENT);
  assert.equal(result.state.pet.condition, 52);
  assert.deepEqual(result.state.adventure.activeBattle, battleBefore);
  assert.equal(result.events.some((entry) => entry.type === 'SKILL_USED'), false);
  const duplicate = onTaskCompleted(result.state, { taskId: 'a' }, DEFAULT_CONTENT);
  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.state.pet.condition, 52);
});

test('专注奖励恢复状态且不重复结算，不会推进战斗', () => {
  let state = startBattle(createInitialState(), DEFAULT_CONTENT).state;
  state.pet.condition = 40;
  state = seedFocusTime(state, 'task-1', 0).state;
  const battleBefore = structuredClone(state.adventure.activeBattle);
  state = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 24 }, DEFAULT_CONTENT).state;
  assert.equal(state.pet.condition, 40);
  const rewarded = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 25 }, DEFAULT_CONTENT);
  assert.equal(rewarded.state.pet.condition, 42);
  assert.deepEqual(rewarded.state.adventure.activeBattle, battleBefore);
  const duplicate = onFocusTimeAdded(rewarded.state, { sourceId: 'task-1', sourceTotalMinutes: 25 }, DEFAULT_CONTENT);
  assert.equal(duplicate.state.pet.condition, 42);
});

test('确认战前剧情后，自动战斗使用每回合 5 RP 并一次结算到底', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  content.chapters[0].enemies[0].hpMultiplier = 3;
  const started = startBattle(createInitialState(), content);
  assert.equal(started.state.pet.condition, 100 - BATTLE_CONDITION_COST);
  assert.equal(started.state.adventure.activeBattle.resource, BATTLE_RESOURCE_PER_TURN);
  const result = advanceBattleStory(started.state, true, content);
  assert.equal(result.state.adventure.activeBattle.phase, 'story_after');
  assert.equal(result.events.some((entry) => entry.type === 'SKILL_USED'), true);
  assert.equal(result.events.some((entry) => entry.type === 'ENEMY_ACTION'), true);
  assert.equal(result.events.some((entry) => entry.type === 'BATTLE_WON'), true);
  assert.ok(result.events.filter((entry) => entry.type === 'SKILL_USED').every((entry) => entry.payload.cost <= BATTLE_RESOURCE_PER_TURN));
});

test('自动战斗从最多四个已装备技能中选择预计伤害最高者', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  content.chapters[0].enemies[0].defenseElement = 'ice';
  let state = createInitialState();
  state.pet.learnedSkills = content.skills.map((skill) => skill.id);
  state = setEquippedSkills(state, ['strike', 'tide-cut', 'frost-ward', 'ember-shot'], content).state;
  state = startBattle(state, content).state;
  const result = advanceBattleStory(state, true, content);
  assert.equal(result.events.find((entry) => entry.type === 'SKILL_USED').payload.skill, '灼流弹');
  assert.equal(result.events.find((entry) => entry.type === 'SKILL_USED').payload.multiplier, 1.5);
});

test('元素克制倍率固定为 1.5、0.75、1，物理恒为 1', () => {
  assert.equal(elementMultiplier('fire', 'ice'), 1.5);
  assert.equal(elementMultiplier('fire', 'water'), .75);
  assert.equal(elementMultiplier('fire', 'electric'), 1);
  assert.equal(elementMultiplier('physical', 'ice'), 1);
});

test('技能配置最多保留四个已学习技能', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  const state = createInitialState();
  state.pet.learnedSkills = content.skills.map((skill) => skill.id);
  const result = setEquippedSkills(state, content.skills.map((skill) => skill.id), content);
  assert.equal(result.state.pet.equippedSkills.length, 4);
  assert.deepEqual(result.state.pet.equippedSkills, content.skills.slice(0, 4).map((skill) => skill.id));
});

test('武器只应用一个 20% 战斗效果，饰品只应用一个 10% 成长效果', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  content.chapters[0].enemies[0] = { ...content.chapters[0].enemies[0], defenseElement: 'ice', hpMultiplier: .3, defenseMultiplier: .5 };
  let state = createInitialState();
  state.pet.inventory['ember-lance'] = 1;
  state = equipItem(state, 'ember-lance', content).state;
  state.pet.learnedSkills.push('ember-shot');
  state.pet.equippedSkills = ['ember-shot'];
  state = startBattle(state, content).state;
  const attack = advanceBattleStory(state, true, content);
  const skillEvent = attack.events.find((entry) => entry.type === 'SKILL_USED');
  assert.equal(skillEvent.payload.weaponMultiplier, 1.2);

  state = createInitialState();
  state.pet.inventory['study-charm'] = 1;
  state = equipItem(state, 'study-charm', content).state;
  state.pet.equippedSkills = ['ember-shot'];
  state = startBattle(state, content).state;
  state.adventure.activeBattle.enemyHp = 1;
  const expectedXp = Math.round(state.adventure.activeBattle.enemyXp * 1.1 * 1.2);
  const victory = advanceBattleStory(state, true, content);
  const won = victory.events.find((entry) => entry.type === 'BATTLE_WON');
  assert.equal(won.payload.xp, expectedXp);
});

test('怪物数值按章节、节点与 Boss 公式自动增长', () => {
  const selectStats = ({ maxHp, attack, defense, xp, coins }) => ({ maxHp, attack, defense, xp, coins });
  assert.deepEqual(selectStats(scaleEnemy(DEFAULT_CONTENT, 0, 0)), { maxHp: 38, attack: 7, defense: 1, xp: 16, coins: 7 });
  assert.deepEqual(selectStats(scaleEnemy(DEFAULT_CONTENT, 0, 2)), { maxHp: 132, attack: 14, defense: 3, xp: 56, coins: 28 });
});

test('战斗保留可跳过的战前、战后剧情，胜利奖励仅结算一次', () => {
  let state = startBattle(createInitialState(), DEFAULT_CONTENT).state;
  assert.equal(state.adventure.activeBattle.phase, 'story_before');
  state.adventure.activeBattle.enemyHp = 1;
  const won = advanceBattleStory(state, true, DEFAULT_CONTENT);
  assert.equal(won.state.adventure.activeBattle.phase, 'story_after');
  const coins = won.state.coins;
  const noSecondReward = onTaskCompleted(won.state, { taskId: 'after-story' }, DEFAULT_CONTENT);
  assert.equal(noSecondReward.state.coins, coins);
  assert.equal(advanceBattleStory(won.state, true, DEFAULT_CONTENT).state.adventure.activeBattle, null);
});

test('小地图每层只能选择当前节点且最终节点为 Boss', () => {
  const state = createInitialState(); state.pet.hp = 50;
  const reward = claimMapReward(state, 0); const duplicate = claimMapReward(reward.state, 0);
  assert.equal(reward.state.coins, 4); assert.equal(reward.state.pet.hp, 56); assert.equal(duplicate.events.length, 0);
  assert.equal(startBattleAt(reward.state, 0).events.length, 0); assert.equal(startBattleAt(reward.state, 1).events[0].type, 'BATTLE_STARTED');
});

test('地图商店提供构筑内容，基础补给商店只出售消耗品', () => {
  let state = createInitialState(); state.coins = 200;
  assert.equal(purchaseItem(state, 'ember-chip').events.length, 0);
  state = openMapShop(state, 0).state;
  assert.equal(state.adventure.activeMapShopIndex, 0);
  const bought = purchaseMapItem(state, 'ember-chip');
  assert.equal(bought.state.pet.learnedSkills.includes('ember-shot'), true);
  assert.equal(bought.events[0].payload.source, 'map');
  const left = leaveMapShop(bought.state);
  assert.equal(left.state.adventure.encounterIndex, 1);
  assert.equal(left.state.adventure.activeMapShopIndex, null);
});

test('连续自然日增长 streak，中断后归零；漏登先扣状态再扣 HP', () => {
  let state = createInitialState('2026-09-08T08:00:00');
  state = onTaskCompleted(state, { taskId: 'a', occurredAt: '2026-09-08T09:00:00' }).state;
  state = onTaskCompleted(state, { taskId: 'b', occurredAt: '2026-09-09T09:00:00' }).state;
  assert.equal(state.streak, 2);
  state.pet.condition = 15; state.pet.hp = 100;
  const result = onDayChecked(state, '2026-09-13T08:00:00');
  assert.equal(result.state.streak, 0); assert.equal(result.state.pet.condition, 0); assert.equal(result.state.pet.hp, 85);
});

test('桌宠专注计时奖励按 sessionId 去重', () => {
  const state = createInitialState('2026-09-12T08:00:00');
  const first = onFocusSessionCompleted(state, { sessionId: 'focus-1', minutes: 25, occurredAt: '2026-09-12T09:00:00' });
  const duplicate = onFocusSessionCompleted(first.state, { sessionId: 'focus-1', minutes: 25, occurredAt: '2026-09-12T09:30:00' });
  assert.equal(first.state.totalFocusMinutes, 25); assert.equal(duplicate.events.length, 0); assert.equal(duplicate.state.totalFocusMinutes, 25);
});

test('基础补给商店只保留消耗品购买与刷新流程', () => {
  let state = createInitialState(); state.coins = 200;
  state = purchaseItem(state, 'repair-spray').state; state.pet.hp = 20;
  state = useItem(state, 'repair-spray').state; assert.equal(state.pet.hp, 60);
  const refreshed = refreshShop(state); assert.equal(refreshed.state.coins, 170); assert.ok(refreshed.state.shop.rotation.length > 0);
  assert.ok(refreshed.state.shop.rotation.every((id) => DEFAULT_CONTENT.items.find((item) => item.id === id).shop === 'supply'));
});

test('外部内容只保留轻量技能、武器和饰品字段', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  content.skills[0].baseDamage = 16;
  content.items[0].combatEffect = { type: 'boss_damage', percent: 10 };
  const normalized = normalizeContent(content);
  assert.equal(normalized.skills[0].baseDamage, 16);
  assert.equal(normalized.items[0].combatEffect, undefined);
});

test('连接衰减、陪伴模式、签到、招募与事件总线保持可用', async () => {
  let state = createInitialState('2026-09-10T08:00:00Z');
  const decay = onPetConnectionChecked(state, false, '2026-09-10T10:05:00Z', { disconnectDecayMinutes: 60, disconnectDecayAmount: 3 });
  assert.equal(decay.state.pet.condition, 94);
  state = setPlayMode(decay.state, 'companion').state; assert.equal(startBattle(state).events.length, 0);
  state = checkIn(state, '2026-09-10T11:00:00').state; assert.equal(state.checkIn.streak, 1);
  state = onPetTouched(state, '2026-09-10T12:00:00').state; assert.equal(state.pet.affinity.points, 3);
  state = onGoalProgressUpdated(state, 'goal', 100, '2026-09-10T13:00:00').state; assert.equal(state.recruitment.tickets, 1);
  assert.equal(recruit(state, 'seed').state.recruitment.tickets, 0);
  const bus = new EventBus(); const received = []; const off = bus.on('TASK_COMPLETED', ({ taskId }) => { received.push(taskId); }); await bus.emit('TASK_COMPLETED', { taskId: 'a' }); off(); await bus.emit('TASK_COMPLETED', { taskId: 'b' }); assert.deepEqual(received, ['a']);
  assert.deepEqual([100, 50, 20, 0].map(conditionRewardMultiplier), [1.2, 1, .9, .8]);
});

test('已记录的任务专注基线不会被当成新增奖励', () => {
  let state = seedFocusTime(createInitialState(), 'task-1', 60).state;
  state = onFocusTimeAdded(state, { sourceId: 'task-1', sourceTotalMinutes: 84 }).state;
  assert.equal(state.today.focusRewardSteps, 0);
});
