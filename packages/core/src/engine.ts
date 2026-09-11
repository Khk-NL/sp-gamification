import { DEFAULT_CONTENT, ZERO_RESISTANCE, normalizeContent } from './catalog.js';
import type { BattleState, CombatStats, DamageType, EnemyDefinition, EngineResult, FocusTimeInput, GameContent, GameRules, ItemDefinition, SPPetEvent, SPPetEventType, SPPetState, TaskCompletedInput } from './types.js';

export const DEFAULT_RULES: Required<GameRules> = { commissionTaskTarget: 3, commissionTaskXp: 30, commissionFocusTarget: 50, commissionFocusXp: 40, disconnectDecayMinutes: 60, disconnectDecayAmount: 2 };
const asDate = (value?: Date | string | number): Date => { const date = value instanceof Date ? value : new Date(value ?? Date.now()); return Number.isNaN(date.getTime()) ? new Date() : date; };
export const localDateKey = (value?: Date | string | number): string => { const date = asDate(value); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); };
const nonNegativeInt = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
const positiveInt = (value: unknown, fallback: number): number => Math.max(1, nonNegativeInt(value, fallback));
const stringArray = (value: unknown, max: number): string[] => Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry)))].slice(-max) : [];
const damageTypes: DamageType[] = ['physical', 'fire', 'water', 'ice', 'electric'];
const STARTER_SKILLS = ['strike', 'brace', 'ember-shot', 'tide-cut'];
const damageType = (value: unknown): DamageType | null => typeof value === 'string' && damageTypes.includes(value as DamageType) ? value as DamageType : null;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const percentTier = (value: unknown): number => { const number = nonNegativeInt(value); if (!number) return 0; if (number <= 15) return 10; if (number <= 35) return 20; return 50; };
const dateDistance = (from: string, to: string): number => { const parse = (value: string) => { const [y, m, d] = value.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((parse(to) - parse(from)) / 86_400_000); };
const event = (type: SPPetEventType, payload: SPPetEvent['payload'], now: Date): SPPetEvent => ({ id: globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${type}-${Math.random().toString(36).slice(2, 9)}`, type, timestamp: now.toISOString(), payload });
const touch = (state: SPPetState, now: Date): void => { state.updatedAt = now.toISOString(); };
export const xpRequiredForLevel = (level: number): number => 100 + Math.max(1, Math.floor(level)) * 25;
const rulesOf = (rules?: GameRules): Required<GameRules> => ({ commissionTaskTarget: positiveInt(rules?.commissionTaskTarget, 3), commissionTaskXp: positiveInt(rules?.commissionTaskXp, 30), commissionFocusTarget: positiveInt(rules?.commissionFocusTarget, 50), commissionFocusXp: positiveInt(rules?.commissionFocusXp, 40), disconnectDecayMinutes: positiveInt(rules?.disconnectDecayMinutes, 60), disconnectDecayAmount: positiveInt(rules?.disconnectDecayAmount, 2) });
const commissionsFor = (date: string, rules: Required<GameRules>) => ({ date, tasks: { progress: 0, target: rules.commissionTaskTarget, claimed: false }, focus: { progress: 0, target: rules.commissionFocusTarget, claimed: false } });

export const createInitialState = (now?: Date | string | number): SPPetState => {
  const date = asDate(now); const day = localDateKey(date); const rules = DEFAULT_RULES;
  return { version: 3, level: 1, xp: 0, coins: 0, streak: 0, lastActiveDate: null, lastLoginDate: day, totalTasksCompleted: 0, totalFocusMinutes: 0, totalBattlesWon: 0, today: { date: day, tasksCompleted: 0 }, processedTaskIds: [], observedFocusMinutesByTask: {}, commissions: commissionsFor(day, rules), checkIn: { lastDate: null, streak: 0 }, pet: { name: 'PRTS-β', condition: 100, hp: 100, baseStats: { maxHp: 100, attack: 12, defense: 5, resistances: { ...ZERO_RESISTANCE } }, learnedSkills: [...STARTER_SKILLS], equippedSkills: [...STARTER_SKILLS], inventory: {}, equipped: { weapon: null, armor: null, accessory: null }, skinPart: null, buff: { xpBonus: 0, coinBonus: 0, attackBonus: 0, battlesRemaining: 0 }, lastConnectedAt: date.toISOString(), lastConditionDecayAt: date.toISOString() }, adventure: { chapterIndex: 0, encounterIndex: 0, claimedMapRewards: [], activeBattle: null }, updatedAt: date.toISOString() };
};

export const hydrateState = (input: unknown, now?: Date | string | number, rulesInput?: GameRules): SPPetState => {
  const initial = createInitialState(now); if (!input || typeof input !== 'object') return initial;
  const value = input as Partial<SPPetState> & { dailyQuests?: SPPetState['commissions']; inventory?: string[]; equippedAccessory?: string | null };
  const rules = rulesOf(rulesInput); const todayValue = value.today && typeof value.today === 'object' ? value.today : initial.today; const day = typeof todayValue.date === 'string' ? todayValue.date : initial.today.date;
  const oldQuest = value.commissions ?? value.dailyQuests; const commissions = oldQuest?.date === day ? oldQuest : commissionsFor(day, rules);
  const oldInventory = Array.isArray(value.inventory) ? Object.fromEntries(value.inventory.map((id) => [id, 1])) : {};
  const pet = value.pet && typeof value.pet === 'object' ? value.pet : initial.pet; const inventory = pet.inventory && typeof pet.inventory === 'object' ? Object.fromEntries(Object.entries(pet.inventory).filter(([id]) => Boolean(id)).map(([id, count]) => [id, positiveInt(count, 1)])) : oldInventory;
  const nowIso = asDate(now).toISOString();
  return {
    version: 3, level: Math.max(1, nonNegativeInt(value.level, 1)), xp: nonNegativeInt(value.xp), coins: nonNegativeInt(value.coins), streak: nonNegativeInt(value.streak), lastActiveDate: typeof value.lastActiveDate === 'string' ? value.lastActiveDate : null, lastLoginDate: typeof value.lastLoginDate === 'string' ? value.lastLoginDate : day,
    totalTasksCompleted: nonNegativeInt(value.totalTasksCompleted), totalFocusMinutes: nonNegativeInt(value.totalFocusMinutes), totalBattlesWon: nonNegativeInt(value.totalBattlesWon), today: { date: day, tasksCompleted: nonNegativeInt(todayValue.tasksCompleted) },
    processedTaskIds: Array.isArray(value.processedTaskIds) ? [...new Set(value.processedTaskIds.filter((id): id is string => typeof id === 'string'))].slice(-5000) : [], observedFocusMinutesByTask: value.observedFocusMinutesByTask && typeof value.observedFocusMinutesByTask === 'object' ? Object.fromEntries(Object.entries(value.observedFocusMinutesByTask).map(([id, minutes]) => [id, nonNegativeInt(minutes)])) : {},
    commissions: { date: commissions.date, tasks: { progress: nonNegativeInt(commissions.tasks?.progress), target: positiveInt(commissions.tasks?.target, rules.commissionTaskTarget), claimed: Boolean(commissions.tasks?.claimed) }, focus: { progress: nonNegativeInt(commissions.focus?.progress), target: positiveInt(commissions.focus?.target, rules.commissionFocusTarget), claimed: Boolean(commissions.focus?.claimed) } },
    checkIn: { lastDate: typeof value.checkIn?.lastDate === 'string' ? value.checkIn.lastDate : null, streak: nonNegativeInt(value.checkIn?.streak) },
    pet: { name: typeof pet.name === 'string' && pet.name.trim() ? pet.name.slice(0, 20) : initial.pet.name, condition: clamp(nonNegativeInt(pet.condition, 100), 0, 100), hp: nonNegativeInt(pet.hp, 100), baseStats: { maxHp: positiveInt(pet.baseStats?.maxHp, 100), attack: positiveInt(pet.baseStats?.attack, 12), defense: nonNegativeInt(pet.baseStats?.defense, 5), resistances: { ...ZERO_RESISTANCE, ...(pet.baseStats?.resistances ?? {}) } }, learnedSkills: Array.isArray(pet.learnedSkills) ? [...new Set([...STARTER_SKILLS, ...pet.learnedSkills.filter((id): id is string => typeof id === 'string')])] : [...STARTER_SKILLS], equippedSkills: Array.isArray(pet.equippedSkills) ? stringArray(pet.equippedSkills, 4) : [...STARTER_SKILLS], inventory, equipped: { weapon: typeof pet.equipped?.weapon === 'string' ? pet.equipped.weapon : null, armor: typeof pet.equipped?.armor === 'string' ? pet.equipped.armor : null, accessory: typeof pet.equipped?.accessory === 'string' ? pet.equipped.accessory : value.equippedAccessory ?? null }, skinPart: typeof pet.skinPart === 'string' ? pet.skinPart : null, buff: { xpBonus: percentTier(pet.buff?.xpBonus), coinBonus: percentTier(pet.buff?.coinBonus), attackBonus: nonNegativeInt(pet.buff?.attackBonus), battlesRemaining: nonNegativeInt(pet.buff?.battlesRemaining) }, lastConnectedAt: typeof pet.lastConnectedAt === 'string' ? pet.lastConnectedAt : nowIso, lastConditionDecayAt: typeof pet.lastConditionDecayAt === 'string' ? pet.lastConditionDecayAt : nowIso },
    adventure: { chapterIndex: nonNegativeInt(value.adventure?.chapterIndex), encounterIndex: nonNegativeInt(value.adventure?.encounterIndex), claimedMapRewards: stringArray(value.adventure?.claimedMapRewards, 200), activeBattle: value.adventure?.activeBattle && typeof value.adventure.activeBattle === 'object' ? { ...value.adventure.activeBattle, enemyBlockType: damageType(value.adventure.activeBattle.enemyBlockType), playerBlockType: damageType(value.adventure.activeBattle.playerBlockType), enemyWeaken: percentTier(value.adventure.activeBattle.enemyWeaken), resource: clamp(nonNegativeInt(value.adventure.activeBattle.resource, 5), 0, 5), maxResource: 5, actionsThisTurn: nonNegativeInt(value.adventure.activeBattle.actionsThisTurn), phase: value.adventure.activeBattle.phase ?? 'combat', storyIndex: nonNegativeInt(value.adventure.activeBattle.storyIndex), rewardsClaimed: Boolean(value.adventure.activeBattle.rewardsClaimed) } : null }, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso,
  };
};

const awardXp = (state: SPPetState, amount: number, now: Date): SPPetEvent[] => {
  const events: SPPetEvent[] = []; state.xp += nonNegativeInt(amount); let gained = 0; let levelCoins = 0;
  while (state.xp >= xpRequiredForLevel(state.level)) { state.xp -= xpRequiredForLevel(state.level); state.level += 1; gained += 1; const coins = 10 + state.level * 2; levelCoins += coins; state.coins += coins; state.pet.baseStats.maxHp += 8; state.pet.baseStats.attack += 2; state.pet.baseStats.defense += 1; state.pet.hp += 8; }
  if (gained) events.push(event('LEVEL_UP', { level: state.level, levelsGained: gained, coins: levelCoins, maxHp: state.pet.baseStats.maxHp, attack: state.pet.baseStats.attack, defense: state.pet.baseStats.defense }, now));
  return events;
};

export const onDayChecked = (current: SPPetState, occurredAt?: Date | string | number, rulesInput?: GameRules): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now, rulesInput); const day = localDateKey(now); const rules = rulesOf(rulesInput); const events: SPPetEvent[] = []; let changed = false;
  if (state.lastLoginDate !== day) { const missedDays = state.lastLoginDate ? Math.max(0, dateDistance(state.lastLoginDate, day) - 1) : 0; if (missedDays > 0) { const penalty = missedDays * 10; const conditionLost = Math.min(state.pet.condition, penalty); const hpLost = Math.min(state.pet.hp, penalty - conditionLost); state.pet.condition -= conditionLost; state.pet.hp -= hpLost; events.push(event('PET_CONDITION_CHANGED', { reason: 'missed_login', missedDays, condition: state.pet.condition, lost: conditionLost, hp: state.pet.hp, hpLost }, now)); } state.lastLoginDate = day; changed = true; }
  if (state.today.date !== day) { state.today = { date: day, tasksCompleted: 0 }; state.commissions = commissionsFor(day, rules); changed = true; }
  if (state.lastActiveDate && dateDistance(state.lastActiveDate, day) > 1 && state.streak) { state.streak = 0; changed = true; }
  if (changed) touch(state, now); return { state, events };
};

const claimCommissions = (state: SPPetState, rules: Required<GameRules>, now: Date): SPPetEvent[] => {
  const events: SPPetEvent[] = [];
  if (!state.commissions.tasks.claimed && state.commissions.tasks.progress >= state.commissions.tasks.target) { state.commissions.tasks.claimed = true; events.push(event('COMMISSION_COMPLETED', { commission: 'tasks', xp: rules.commissionTaskXp }, now), ...awardXp(state, rules.commissionTaskXp, now)); }
  if (!state.commissions.focus.claimed && state.commissions.focus.progress >= state.commissions.focus.target) { state.commissions.focus.claimed = true; events.push(event('COMMISSION_COMPLETED', { commission: 'focus', xp: rules.commissionFocusXp }, now), ...awardXp(state, rules.commissionFocusXp, now)); }
  return events;
};

export const onTaskCompleted = (current: SPPetState, input: TaskCompletedInput): EngineResult => {
  const now = asDate(input.occurredAt); const rules = rulesOf(input.rules); const dayResult = onDayChecked(current, now, rules); const state = dayResult.state;
  if (!input.taskId || state.processedTaskIds.includes(input.taskId)) return { state, events: dayResult.events };
  const day = localDateKey(now); const first = state.lastActiveDate !== day; if (first) { const distance = state.lastActiveDate ? dateDistance(state.lastActiveDate, day) : null; state.streak = distance === 1 ? state.streak + 1 : 1; state.lastActiveDate = day; }
  state.processedTaskIds = [...state.processedTaskIds, input.taskId].slice(-5000); state.totalTasksCompleted += 1; state.today.tasksCompleted += 1; state.commissions.tasks.progress += 1;
  const events = [...dayResult.events, event('TASK_COMPLETED', { taskId: input.taskId, progress: state.commissions.tasks.progress, target: state.commissions.tasks.target }, now)]; if (first) events.push(event('STREAK_UPDATED', { streak: state.streak }, now)); events.push(...claimCommissions(state, rules, now)); touch(state, now); return { state, events };
};

export const seedFocusTime = (current: SPPetState, sourceId: string, totalMinutes: number, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); if (!sourceId) return { state, events: [] }; const total = nonNegativeInt(totalMinutes); const previous = state.observedFocusMinutesByTask[sourceId]; if (previous === undefined || total > previous) { state.observedFocusMinutesByTask[sourceId] = total; touch(state, now); } return { state, events: [] }; };
export const onFocusTimeAdded = (current: SPPetState, input: FocusTimeInput): EngineResult => {
  const now = asDate(input.occurredAt); const rules = rulesOf(input.rules); const dayResult = onDayChecked(current, now, rules); const state = dayResult.state; let added = nonNegativeInt(input.minutes);
  if (input.sourceId && input.sourceTotalMinutes !== undefined) { const total = nonNegativeInt(input.sourceTotalMinutes); const previous = state.observedFocusMinutesByTask[input.sourceId] ?? total; added = Math.max(0, total - previous); state.observedFocusMinutesByTask[input.sourceId] = Math.max(previous, total); }
  if (!added) return { state, events: dayResult.events }; state.totalFocusMinutes += added; state.commissions.focus.progress += added; const events = [...dayResult.events, ...claimCommissions(state, rules, now)]; touch(state, now); return { state, events };
};

export const checkIn = (current: SPPetState, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const dayResult = onDayChecked(current, now); const state = dayResult.state; const day = localDateKey(now); if (state.checkIn.lastDate === day) return { state, events: dayResult.events };
  const distance = state.checkIn.lastDate ? dateDistance(state.checkIn.lastDate, day) : null; state.checkIn.streak = distance === 1 ? state.checkIn.streak + 1 : 1; state.checkIn.lastDate = day; const coins = 5 + Math.min(7, state.checkIn.streak) * 2; state.coins += coins; touch(state, now); return { state, events: [...dayResult.events, event('CHECK_IN', { streak: state.checkIn.streak, coins }, now)] };
};

export const getComputedStats = (stateInput: SPPetState, contentInput?: GameContent): CombatStats => {
  const state = hydrateState(stateInput); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const stats: CombatStats = { maxHp: state.pet.baseStats.maxHp, attack: state.pet.baseStats.attack + state.pet.buff.attackBonus, defense: state.pet.baseStats.defense, resistances: { ...state.pet.baseStats.resistances }, damageBonus: {} };
  const equipped = Object.values(state.pet.equipped).filter((id): id is string => Boolean(id)); const items = equipped.map((id) => content.items.find((item) => item.id === id)).filter((item): item is ItemDefinition => Boolean(item));
  for (const item of items) { const effect = item.effects ?? {}; stats.maxHp += effect.maxHp ?? 0; stats.attack += effect.attack ?? 0; stats.defense += effect.defense ?? 0; for (const type of Object.keys(stats.resistances) as DamageType[]) stats.resistances[type] += effect.resistance?.[type] ?? 0; for (const [type, amount] of Object.entries(effect.damageBonus ?? {})) stats.damageBonus[type as DamageType] = (stats.damageBonus[type as DamageType] ?? 0) + Number(amount); }
  const setCounts = new Map<string, number>(); for (const item of items) if (item.setId) setCounts.set(item.setId, (setCounts.get(item.setId) ?? 0) + 1);
  if ((setCounts.get('pioneer') ?? 0) >= 2) { stats.attack += 3; stats.defense += 2; }
  if ((setCounts.get('frostline') ?? 0) >= 2) stats.damageBonus.ice = (stats.damageBonus.ice ?? 0) + 20;
  for (const type of Object.keys(stats.resistances) as DamageType[]) stats.resistances[type] = clamp(stats.resistances[type], -50, 80);
  return stats;
};

const enemyAt = (state: SPPetState, content: GameContent): EnemyDefinition => { const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; return chapter.enemies[state.adventure.encounterIndex % chapter.enemies.length]; };
export const getBattleStory = (stateInput: SPPetState, contentInput?: GameContent): { before: string[]; after: string[] } => {
  const state = hydrateState(stateInput); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; const enemy = enemyAt(state, content);
  return { before: enemy.storyBefore?.length ? enemy.storyBefore : [`行动记录 // ${chapter.name}`, `${enemy.name} 出现在前方。观察它的行动意图，谨慎部署技能。`], after: enemy.storyAfter?.length ? enemy.storyAfter : [`${enemy.name} 已被压制。`, enemy.isBoss ? `本章行动完成：${chapter.summary}` : '路线暂时安全，队伍继续向核心区域推进。'] };
};

export const startBattle = (current: SPPetState, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.adventure.activeBattle) return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const enemy = enemyAt(state, content); const stats = getComputedStats(state, content); state.pet.hp = clamp(state.pet.hp || Math.ceil(stats.maxHp * .35), 1, stats.maxHp);
  state.adventure.activeBattle = { enemyId: enemy.id, enemyName: enemy.name, enemyHp: enemy.maxHp, enemyMaxHp: enemy.maxHp, enemyDefense: enemy.defense, enemyResistances: { ...enemy.resistances }, enemyAttack: enemy.attack, enemyBlock: 0, enemyBlockType: null, enemyAttackBuff: 0, playerBlock: 0, playerBlockType: null, enemyBurn: 0, enemyWeaken: 0, turn: 1, resource: 5, maxResource: 5, actionsThisTurn: 0, intentIndex: 0, log: [`侦测到目标：${enemy.name}（${enemy.element ?? 'physical'}）`], phase: 'story_before', storyIndex: 0, rewardsClaimed: false };
  touch(state, now); return { state, events: [event('BATTLE_STARTED', { enemy: enemy.name, element: enemy.element ?? 'physical', boss: Boolean(enemy.isBoss) }, now)] };
};

export const startBattleAt = (current: SPPetState, encounterIndex: number, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (nonNegativeInt(encounterIndex) !== state.adventure.encounterIndex) return { state, events: [] };
  return startBattle(state, contentInput, now);
};

export const claimMapReward = (current: SPPetState, rewardIndex: number, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.adventure.activeBattle) return { state, events: [] };
  const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; const index = nonNegativeInt(rewardIndex);
  if (index >= chapter.enemies.length - 1 || index !== state.adventure.encounterIndex) return { state, events: [] };
  const rewardId = `${chapter.id}:${index}`; if (state.adventure.claimedMapRewards.includes(rewardId)) return { state, events: [] };
  const coins = 4 + index * 3; const heal = 6 + index * 2; const maxHp = getComputedStats(state, content).maxHp;
  state.coins += coins; state.pet.hp = Math.min(maxHp, state.pet.hp + heal); state.adventure.claimedMapRewards = [...state.adventure.claimedMapRewards, rewardId].slice(-200); state.adventure.encounterIndex += 1; touch(state, now);
  return { state, events: [event('MAP_REWARD_CLAIMED', { rewardId, chapter: chapter.id, index, coins, heal, hp: state.pet.hp }, now)] };
};

const finishEncounter = (state: SPPetState, content: GameContent, now: Date, events: SPPetEvent[]): void => {
  const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; state.adventure.encounterIndex += 1;
  if (state.adventure.encounterIndex >= chapter.enemies.length) { events.push(event('CHAPTER_COMPLETED', { chapter: chapter.name }, now)); state.adventure.claimedMapRewards = state.adventure.claimedMapRewards.filter((id) => !id.startsWith(`${chapter.id}:`)); state.adventure.encounterIndex = 0; state.adventure.chapterIndex = (state.adventure.chapterIndex + 1) % content.chapters.length; }
  state.adventure.activeBattle = null;
};

export const advanceBattleStory = (current: SPPetState, skip = false, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const battle = state.adventure.activeBattle; if (!battle || battle.phase === 'combat') return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const story = getBattleStory(state, content); const lines = battle.phase === 'story_before' ? story.before : story.after; const events: SPPetEvent[] = [];
  if (skip || battle.storyIndex + 1 >= lines.length) { if (battle.phase === 'story_before') { battle.phase = 'combat'; battle.storyIndex = 0; } else finishEncounter(state, content, now, events); } else battle.storyIndex += 1;
  touch(state, now); return { state, events };
};

const reduceByBlock = (damage: number, block: number): [number, number] => { const absorbed = Math.min(damage, block); return [damage - absorbed, block - absorbed]; };
const finalDamage = (raw: number, defense: number): number => Math.max(1, Math.round(raw) - Math.max(0, Math.floor(defense)));
const strongAgainst: Partial<Record<DamageType, DamageType>> = { fire: 'ice', ice: 'electric', electric: 'water', water: 'fire' };
const elementMultiplier = (attack: DamageType, target: DamageType | null, shield: boolean): number => {
  if (attack === 'physical' || target === null || target === 'physical') return 1;
  if (attack === target) return shield ? .5 : 1;
  if (strongAgainst[attack] === target) return 1.5;
  return 1;
};
const multiplierText = (multiplier: number): string => `属性 ×${multiplier}`;
const consumeBattleBuff = (state: SPPetState): void => { if (state.pet.buff.battlesRemaining > 0) state.pet.buff.battlesRemaining -= 1; if (!state.pet.buff.battlesRemaining) state.pet.buff = { xpBonus: 0, coinBonus: 0, attackBonus: 0, battlesRemaining: 0 }; };
const settleVictory = (state: SPPetState, battle: BattleState, enemy: EnemyDefinition, now: Date, events: SPPetEvent[]): void => {
  if (battle.rewardsClaimed) return; battle.rewardsClaimed = true; battle.phase = 'story_after'; battle.storyIndex = 0; const xp = Math.round(enemy.xp * (1 + state.pet.buff.xpBonus / 100)); const coins = Math.round(enemy.coins * (1 + state.pet.buff.coinBonus / 100)); state.coins += coins; state.totalBattlesWon += 1; consumeBattleBuff(state); events.push(event('BATTLE_WON', { enemy: enemy.name, xp, coins, boss: Boolean(enemy.isBoss) }, now), ...awardXp(state, xp, now));
};

export const useSkill = (current: SPPetState, skillId: string, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const battle = state.adventure.activeBattle; if (!battle || battle.phase !== 'combat') return { state, events: [] };
  const skill = content.skills.find((entry) => entry.id === skillId); if (!skill || !state.pet.equippedSkills.includes(skillId) || skill.cost > battle.resource) return { state, events: [] };
  const stats = getComputedStats(state, content); battle.resource -= skill.cost; battle.actionsThisTurn += 1; let dealt = 0;
  let playerMultiplier = 1, playerBlockAbsorbed = 0;
  if ((skill.power ?? 0) > 0) { const shielded = battle.enemyBlock > 0; const targetElement = shielded ? battle.enemyBlockType : enemyAt(state, content).element ?? 'physical'; playerMultiplier = elementMultiplier(skill.type, targetElement, shielded); const raw = stats.attack * (skill.power ?? 0) * (1 + (stats.damageBonus[skill.type] ?? 0) / 100) * playerMultiplier; dealt = finalDamage(raw, battle.enemyDefense); const beforeBlock = battle.enemyBlock; const reduced = reduceByBlock(dealt, battle.enemyBlock); dealt = reduced[0]; battle.enemyBlock = reduced[1]; playerBlockAbsorbed = beforeBlock - battle.enemyBlock; if (!battle.enemyBlock) battle.enemyBlockType = null; battle.enemyHp = Math.max(0, battle.enemyHp - dealt); }
  if (skill.block) { if (battle.playerBlock > 0 && battle.playerBlockType !== skill.type) battle.playerBlock = 0; battle.playerBlock += skill.block; battle.playerBlockType = skill.type; } if (skill.heal) state.pet.hp = Math.min(stats.maxHp, state.pet.hp + skill.heal); if (skill.burn) battle.enemyBurn += skill.burn; if (skill.weaken) battle.enemyWeaken = Math.max(battle.enemyWeaken, skill.weaken);
  battle.log = [`使用 ${skill.name}：${multiplierText(playerMultiplier)}，护盾吸收 ${playerBlockAbsorbed}，最终造成 ${dealt} 点 ${skill.type} 伤害。`, ...battle.log].slice(0, 6); const events: SPPetEvent[] = [event('SKILL_USED', { skill: skill.name, damage: dealt, type: skill.type, multiplier: playerMultiplier, blockAbsorbed: playerBlockAbsorbed, resource: battle.resource }, now)];
  const enemy = enemyAt(state, content); if (battle.enemyHp <= 0) settleVictory(state, battle, enemy, now, events); touch(state, now); return { state, events };
};

export const endTurn = (current: SPPetState, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const battle = state.adventure.activeBattle; if (!battle || battle.phase !== 'combat') return { state, events: [] }; const enemy = enemyAt(state, content); const stats = getComputedStats(state, content); const events: SPPetEvent[] = [];
  if (battle.enemyBurn > 0) { battle.enemyHp = Math.max(0, battle.enemyHp - battle.enemyBurn); battle.log.unshift(`回合结算：灼烧造成 ${battle.enemyBurn} 点火属性伤害。`); }
  if (battle.enemyHp <= 0) { settleVictory(state, battle, enemy, now, events); touch(state, now); return { state, events }; }
  const intent = enemy.intents[battle.intentIndex % enemy.intents.length];
  if (intent.kind === 'guard') { const type = intent.type ?? enemy.element ?? 'physical'; if (battle.enemyBlock > 0 && battle.enemyBlockType !== type) battle.enemyBlock = 0; battle.enemyBlock += intent.value; battle.enemyBlockType = type; battle.log.unshift(`${enemy.name} 获得 ${intent.value} 点 ${type} 护盾；同属性攻击伤害 ×0.5。`); events.push(event('ENEMY_ACTION', { enemy: enemy.name, action: 'guard', value: intent.value, type, sameTypeReduction: 50 }, now)); }
  else if (intent.kind === 'buff') { battle.enemyAttackBuff += intent.value; battle.log.unshift(`${enemy.name} 获得攻击 +${intent.value}。`); events.push(event('ENEMY_ACTION', { enemy: enemy.name, action: 'buff', value: intent.value }, now)); }
  else { const type = intent.type ?? 'physical'; const weaken = 1 - battle.enemyWeaken / 100; const shielded = battle.playerBlock > 0; const multiplier = elementMultiplier(type, shielded ? battle.playerBlockType : null, shielded); let damage = finalDamage((intent.value + battle.enemyAttackBuff) * weaken * multiplier, stats.defense); const beforeBlock = battle.playerBlock; const reduced = reduceByBlock(damage, battle.playerBlock); damage = reduced[0]; battle.playerBlock = reduced[1]; const absorbed = beforeBlock - battle.playerBlock; if (!battle.playerBlock) battle.playerBlockType = null; state.pet.hp = Math.max(0, state.pet.hp - damage); battle.log.unshift(`${enemy.name}：${multiplierText(multiplier)}，护盾吸收 ${absorbed}，最终造成 ${damage} 点 ${type} 伤害。`); events.push(event('ENEMY_ACTION', { enemy: enemy.name, action: 'attack', damage, type, multiplier, blockAbsorbed: absorbed }, now)); }
  battle.enemyWeaken = 0; battle.intentIndex = (battle.intentIndex + 1) % enemy.intents.length; battle.turn += 1; battle.resource = 5; battle.maxResource = 5; battle.actionsThisTurn = 0;
  if (state.pet.hp <= 0) { state.pet.condition = Math.max(0, state.pet.condition - 10); state.pet.hp = Math.max(1, Math.ceil(stats.maxHp * .3)); state.adventure.activeBattle = null; consumeBattleBuff(state); events.push(event('BATTLE_LOST', { enemy: enemy.name, condition: state.pet.condition, hp: state.pet.hp }, now)); }
  touch(state, now); return { state, events };
};

export const purchaseItem = (current: SPPetState, itemId: string, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const item = content.items.find((entry) => entry.id === itemId); if (!item || state.coins < item.price || (item.kind !== 'food' && (state.pet.inventory[item.id] ?? 0) > 0)) return { state, events: [] };
  state.coins -= item.price; state.pet.inventory[item.id] = (state.pet.inventory[item.id] ?? 0) + 1; if (item.grantsSkill && !state.pet.learnedSkills.includes(item.grantsSkill)) state.pet.learnedSkills.push(item.grantsSkill); touch(state, now); return { state, events: [event('ITEM_PURCHASED', { itemId: item.id, name: item.name, kind: item.kind, price: item.price }, now)] };
};
export const equipItem = (current: SPPetState, itemId: string | null, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); if (itemId === null) return { state, events: [] }; const item = content.items.find((entry) => entry.id === itemId); if (!item || !(state.pet.inventory[itemId] > 0)) return { state, events: [] };
  if (item.kind === 'skin') state.pet.skinPart = item.id; else if (item.slot) state.pet.equipped[item.slot] = item.id; else return { state, events: [] }; state.pet.hp = Math.min(state.pet.hp, getComputedStats(state, content).maxHp); touch(state, now); return { state, events: [event('ITEM_EQUIPPED', { itemId: item.id, name: item.name, slot: item.slot ?? 'skin' }, now)] };
};
export const useItem = (current: SPPetState, itemId: string, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const item = content.items.find((entry) => entry.id === itemId && entry.kind === 'food'); if (!item || !(state.pet.inventory[itemId] > 0)) return { state, events: [] }; const effects = item.effects ?? {}; const stats = getComputedStats(state, content); state.pet.inventory[itemId] -= 1; if (!state.pet.inventory[itemId]) delete state.pet.inventory[itemId]; state.pet.hp = Math.min(stats.maxHp, state.pet.hp + (effects.heal ?? 0)); state.pet.condition = clamp(state.pet.condition + (effects.condition ?? 0), 0, 100); if (effects.xpBonus || effects.coinBonus || effects.attack) state.pet.buff = { xpBonus: effects.xpBonus ?? 0, coinBonus: effects.coinBonus ?? 0, attackBonus: effects.attack ?? 0, battlesRemaining: 1 }; touch(state, now); return { state, events: [event('ITEM_USED', { itemId: item.id, name: item.name, hp: state.pet.hp, condition: state.pet.condition }, now)] };
};

export const onPetConnectionChecked = (current: SPPetState, connected: boolean, occurredAt?: Date | string | number, rulesInput?: GameRules): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now, rulesInput); const rules = rulesOf(rulesInput); const events: SPPetEvent[] = [];
  if (connected) { state.pet.lastConnectedAt = now.toISOString(); state.pet.lastConditionDecayAt = now.toISOString(); touch(state, now); return { state, events }; }
  const last = asDate(state.pet.lastConditionDecayAt); const intervals = Math.floor((now.getTime() - last.getTime()) / (rules.disconnectDecayMinutes * 60_000)); if (intervals > 0) { const before = state.pet.condition; state.pet.condition = Math.max(0, state.pet.condition - intervals * rules.disconnectDecayAmount); state.pet.lastConditionDecayAt = new Date(last.getTime() + intervals * rules.disconnectDecayMinutes * 60_000).toISOString(); if (state.pet.condition !== before) events.push(event('PET_CONDITION_CHANGED', { condition: state.pet.condition, lost: before - state.pet.condition }, now)); touch(state, now); }
  return { state, events };
};

export const updatePetName = (current: SPPetState, name: string, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const clean = name.trim().slice(0, 20); if (clean) state.pet.name = clean; touch(state, now); return { state, events: [] }; };
export const setEquippedSkills = (current: SPPetState, skillIds: string[], contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.adventure.activeBattle) return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const valid = new Set(content.skills.map((skill) => skill.id)); state.pet.equippedSkills = [...new Set(skillIds.filter((id) => typeof id === 'string' && valid.has(id) && state.pet.learnedSkills.includes(id)))].slice(0, 4); touch(state, now); return { state, events: [] }; };
export const addDebugXp = (current: SPPetState, amount = 10, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const xp = nonNegativeInt(amount); const events = [event('DEBUG_XP', { xp }, now), ...awardXp(state, xp, now)]; touch(state, now); return { state, events }; };
export const addDebugCoins = (current: SPPetState, amount = 25, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const coins = nonNegativeInt(amount); state.coins += coins; touch(state, now); return { state, events: [event('DEBUG_COINS', { coins }, now)] }; };
export const importState = (input: unknown, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(input, now); touch(state, now); return { state, events: [] }; };
export const resetState = (occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); return { state: createInitialState(now), events: [event('STATE_RESET', {}, now)] }; };
