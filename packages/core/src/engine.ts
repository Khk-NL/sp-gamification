import { DEFAULT_CONTENT, normalizeContent, scaleEnemy } from './catalog.js';
import type { AffinityStage, BattleState, CombatStats, DamageType, EngineResult, FocusSessionCompletedInput, FocusTimeInput, GameContent, GameRules, ItemDefinition, PlayMode, RecruitmentReward, ScaledEnemyDefinition, SPPetEvent, SPPetEventType, SPPetState, TaskCompletedInput } from './types.js';

export const DEFAULT_RULES: Required<GameRules> = { commissionTaskTarget: 3, commissionTaskXp: 30, commissionFocusTarget: 60, commissionFocusXp: 30, commissionPriorityXp: 20, commissionReviewXp: 20, dailyXpCap: 100, disconnectDecayMinutes: 60, disconnectDecayAmount: 2, focusTimerDailyCap: 4, focusTimerXp: 10, focusTimerCoins: 2, focusTimerCondition: 5 };
const asDate = (value?: Date | string | number): Date => { const date = value instanceof Date ? value : new Date(value ?? Date.now()); return Number.isNaN(date.getTime()) ? new Date() : date; };
export const localDateKey = (value?: Date | string | number): string => { const date = asDate(value); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); };
const nonNegativeInt = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
const positiveInt = (value: unknown, fallback: number): number => Math.max(1, nonNegativeInt(value, fallback));
const stringArray = (value: unknown, max: number): string[] => Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry)))].slice(-max) : [];
const damageTypes: DamageType[] = ['physical', 'fire', 'water', 'ice', 'electric'];
const STARTER_SKILLS = ['strike', 'ember-shot', 'tide-cut'];
export const BATTLE_CONDITION_COST = 10;
export const BATTLE_RESOURCE_PER_TURN = 5;
export const RECRUITMENT_POOL: RecruitmentReward[] = [
  { id: 'skill-frost-ward', name: '技能：霜盾', type: 'skill', rarity: 'rare', skillId: 'frost-ward' },
  { id: 'action-wave', name: '动作：挥手', type: 'action', rarity: 'common' },
  { id: 'expression-sparkle', name: '表情：闪亮', type: 'expression', rarity: 'common' },
  { id: 'bubble-leaf', name: '气泡：叶片', type: 'bubble', rarity: 'common' },
  { id: 'background-rain', name: '背景：像素雨', type: 'background', rarity: 'rare' },
  { id: 'effect-stars', name: '特效：星屑', type: 'effect', rarity: 'common' },
  { id: 'story-night-walk', name: '剧情：夜间散步', type: 'story', rarity: 'rare' },
  { id: 'personality-calm', name: '人格扩展：沉静', type: 'personality', rarity: 'rare' },
  { id: 'decoration-sprout', name: '装饰：嫩芽', type: 'decoration', rarity: 'common' },
];
const damageType = (value: unknown): DamageType | null => typeof value === 'string' && damageTypes.includes(value as DamageType) ? value as DamageType : null;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const dateDistance = (from: string, to: string): number => { const parse = (value: string) => { const [y, m, d] = value.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((parse(to) - parse(from)) / 86_400_000); };
const weekKey = (value: Date): string => { const date = new Date(value.getFullYear(), value.getMonth(), value.getDate()), weekday = (date.getDay() + 6) % 7; date.setDate(date.getDate() - weekday); return localDateKey(date); };
const event = (type: SPPetEventType, payload: SPPetEvent['payload'], now: Date): SPPetEvent => ({ id: globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${type}-${Math.random().toString(36).slice(2, 9)}`, type, timestamp: now.toISOString(), payload });
const touch = (state: SPPetState, now: Date): void => { state.updatedAt = now.toISOString(); };
export const xpRequiredForLevel = (level: number): number => 100 + Math.max(1, Math.floor(level)) * 25;
export const affinityStageFor = (points: number): AffinityStage => points >= 500 ? 'best_friend' : points >= 300 ? 'trusted' : points >= 150 ? 'close' : points >= 50 ? 'familiar' : 'stranger';
export const conditionRewardMultiplier = (condition: number): number => condition >= 80 ? 1.2 : condition >= 50 ? 1 : condition >= 20 ? .9 : .8;
const rulesOf = (rules?: GameRules): Required<GameRules> => ({ commissionTaskTarget: positiveInt(rules?.commissionTaskTarget, 3), commissionTaskXp: positiveInt(rules?.commissionTaskXp, 30), commissionFocusTarget: positiveInt(rules?.commissionFocusTarget, 60), commissionFocusXp: positiveInt(rules?.commissionFocusXp, 30), commissionPriorityXp: positiveInt(rules?.commissionPriorityXp, 20), commissionReviewXp: positiveInt(rules?.commissionReviewXp, 20), dailyXpCap: positiveInt(rules?.dailyXpCap, 100), disconnectDecayMinutes: positiveInt(rules?.disconnectDecayMinutes, 60), disconnectDecayAmount: positiveInt(rules?.disconnectDecayAmount, 2), focusTimerDailyCap: positiveInt(rules?.focusTimerDailyCap, 4), focusTimerXp: positiveInt(rules?.focusTimerXp, 10), focusTimerCoins: positiveInt(rules?.focusTimerCoins, 2), focusTimerCondition: positiveInt(rules?.focusTimerCondition, 5) });
const commissionsFor = (date: string, rules: Required<GameRules>) => ({ date, tasks: { progress: 0, target: rules.commissionTaskTarget, claimed: false }, focus: { progress: 0, target: rules.commissionFocusTarget, claimed: false }, priority: { progress: 0, target: 1, claimed: false }, review: { progress: 0, target: 1, claimed: false } });

export const createInitialState = (now?: Date | string | number): SPPetState => {
  const date = asDate(now); const day = localDateKey(date); const rules = DEFAULT_RULES;
  return { version: 9, mode: 'adventure', level: 1, xp: 0, coins: 0, streak: 0, lastActiveDate: null, lastLoginDate: day, totalTasksCompleted: 0, totalFocusMinutes: 0, totalBattlesWon: 0, today: { date: day, tasksCompleted: 0, xpEarned: 0, focusRewardSteps: 0, focusTimerRewards: 0 }, processedTaskIds: [], processedFocusSessionIds: [], observedFocusMinutesByTask: {}, commissions: commissionsFor(day, rules), checkIn: { lastDate: null, streak: 0 }, pet: { name: 'PRTS-β', condition: 100, hp: 100, baseStats: { maxHp: 100, attack: 12, defense: 5 }, learnedSkills: [...STARTER_SKILLS], equippedSkills: [...STARTER_SKILLS], affinity: { points: 0, stage: 'stranger', touchDate: null, touchesToday: 0 }, inventory: {}, equipped: { weapon: null, accessory: null }, skinPart: null, lastConnectedAt: date.toISOString(), lastConditionDecayAt: date.toISOString() }, shop: { date: day, refreshCount: 0, rotation: [] }, adventure: { chapterIndex: 0, encounterIndex: 0, claimedMapRewards: [], visitedMapShops: [], activeMapShopIndex: null, activeBattle: null }, recruitment: { tickets: 0, pity: 0, owned: [], ticketSources: [], weekly: { weekKey: weekKey(date), completedDays: [] } }, updatedAt: date.toISOString() };
};

export const hydrateState = (input: unknown, now?: Date | string | number, rulesInput?: GameRules): SPPetState => {
  const initial = createInitialState(now); if (!input || typeof input !== 'object') return initial;
  const value = input as Partial<SPPetState> & { dailyQuests?: SPPetState['commissions']; inventory?: string[]; equippedAccessory?: string | null };
  const rules = rulesOf(rulesInput); const todayValue = value.today && typeof value.today === 'object' ? value.today : initial.today; const day = typeof todayValue.date === 'string' ? todayValue.date : initial.today.date;
  const oldQuest = value.commissions ?? value.dailyQuests; const commissions = oldQuest?.date === day ? oldQuest : commissionsFor(day, rules);
  const oldInventory = Array.isArray(value.inventory) ? Object.fromEntries(value.inventory.map((id) => [id, 1])) : {};
  const pet = value.pet && typeof value.pet === 'object' ? value.pet : initial.pet; const inventory = pet.inventory && typeof pet.inventory === 'object' ? Object.fromEntries(Object.entries(pet.inventory).filter(([id]) => Boolean(id)).map(([id, count]) => [id, positiveInt(count, 1)])) : oldInventory;
  const nowIso = asDate(now).toISOString();
  const activeBattle = value.adventure?.activeBattle as (Partial<BattleState> & { enemyElement?: DamageType }) | null | undefined;
  return {
    version: 9, mode: value.mode === 'companion' ? 'companion' : 'adventure', level: Math.max(1, nonNegativeInt(value.level, 1)), xp: nonNegativeInt(value.xp), coins: nonNegativeInt(value.coins), streak: nonNegativeInt(value.streak), lastActiveDate: typeof value.lastActiveDate === 'string' ? value.lastActiveDate : null, lastLoginDate: typeof value.lastLoginDate === 'string' ? value.lastLoginDate : day,
    totalTasksCompleted: nonNegativeInt(value.totalTasksCompleted), totalFocusMinutes: nonNegativeInt(value.totalFocusMinutes), totalBattlesWon: nonNegativeInt(value.totalBattlesWon), today: { date: day, tasksCompleted: nonNegativeInt(todayValue.tasksCompleted), xpEarned: nonNegativeInt(todayValue.xpEarned), focusRewardSteps: nonNegativeInt(todayValue.focusRewardSteps), focusTimerRewards: nonNegativeInt(todayValue.focusTimerRewards) },
    processedTaskIds: Array.isArray(value.processedTaskIds) ? [...new Set(value.processedTaskIds.filter((id): id is string => typeof id === 'string'))].slice(-5000) : [], processedFocusSessionIds: Array.isArray(value.processedFocusSessionIds) ? [...new Set(value.processedFocusSessionIds.filter((id): id is string => typeof id === 'string'))].slice(-2000) : [], observedFocusMinutesByTask: value.observedFocusMinutesByTask && typeof value.observedFocusMinutesByTask === 'object' ? Object.fromEntries(Object.entries(value.observedFocusMinutesByTask).map(([id, minutes]) => [id, nonNegativeInt(minutes)])) : {},
    commissions: { date: commissions.date, tasks: { progress: nonNegativeInt(commissions.tasks?.progress), target: positiveInt(commissions.tasks?.target, rules.commissionTaskTarget), claimed: Boolean(commissions.tasks?.claimed) }, focus: { progress: nonNegativeInt(commissions.focus?.progress), target: positiveInt(commissions.focus?.target, rules.commissionFocusTarget), claimed: Boolean(commissions.focus?.claimed) }, priority: { progress: nonNegativeInt(commissions.priority?.progress), target: 1, claimed: Boolean(commissions.priority?.claimed) }, review: { progress: nonNegativeInt(commissions.review?.progress), target: 1, claimed: Boolean(commissions.review?.claimed) } },
    checkIn: { lastDate: typeof value.checkIn?.lastDate === 'string' ? value.checkIn.lastDate : null, streak: nonNegativeInt(value.checkIn?.streak) },
    pet: { name: typeof pet.name === 'string' && pet.name.trim() ? pet.name.slice(0, 20) : initial.pet.name, condition: clamp(nonNegativeInt(pet.condition, 100), 0, 100), hp: nonNegativeInt(pet.hp, 100), baseStats: { maxHp: positiveInt(pet.baseStats?.maxHp, 100), attack: positiveInt(pet.baseStats?.attack, 12), defense: nonNegativeInt(pet.baseStats?.defense, 5) }, learnedSkills: Array.isArray(pet.learnedSkills) ? [...new Set([...STARTER_SKILLS, ...pet.learnedSkills.filter((id): id is string => typeof id === 'string')])] : [...STARTER_SKILLS], equippedSkills: Array.isArray(pet.equippedSkills) ? stringArray(pet.equippedSkills, 4) : [...STARTER_SKILLS], affinity: { points: clamp(nonNegativeInt(pet.affinity?.points), 0, 500), stage: affinityStageFor(clamp(nonNegativeInt(pet.affinity?.points), 0, 500)), touchDate: typeof pet.affinity?.touchDate === 'string' ? pet.affinity.touchDate : null, touchesToday: nonNegativeInt(pet.affinity?.touchesToday) }, inventory, equipped: { weapon: typeof pet.equipped?.weapon === 'string' ? pet.equipped.weapon : null, accessory: typeof pet.equipped?.accessory === 'string' ? pet.equipped.accessory : value.equippedAccessory ?? null }, skinPart: typeof pet.skinPart === 'string' ? pet.skinPart : null, lastConnectedAt: typeof pet.lastConnectedAt === 'string' ? pet.lastConnectedAt : nowIso, lastConditionDecayAt: typeof pet.lastConditionDecayAt === 'string' ? pet.lastConditionDecayAt : nowIso },
    shop: value.shop?.date === day ? { date: day, refreshCount: nonNegativeInt(value.shop.refreshCount), rotation: stringArray(value.shop.rotation, 20) } : { date: day, refreshCount: 0, rotation: [] },
    adventure: { chapterIndex: nonNegativeInt(value.adventure?.chapterIndex), encounterIndex: nonNegativeInt(value.adventure?.encounterIndex), claimedMapRewards: stringArray(value.adventure?.claimedMapRewards, 200), visitedMapShops: stringArray(value.adventure?.visitedMapShops, 200), activeMapShopIndex: typeof value.adventure?.activeMapShopIndex === 'number' ? nonNegativeInt(value.adventure.activeMapShopIndex) : null, activeBattle: activeBattle && typeof activeBattle === 'object' ? { enemyId: String(activeBattle.enemyId || ''), enemyName: String(activeBattle.enemyName || ''), enemyAttackElement: damageType(activeBattle.enemyAttackElement) ?? damageType(activeBattle.enemyElement) ?? 'physical', enemyDefenseElement: damageType(activeBattle.enemyDefenseElement) ?? damageType(activeBattle.enemyElement) ?? 'physical', enemyHp: nonNegativeInt(activeBattle.enemyHp), enemyMaxHp: positiveInt(activeBattle.enemyMaxHp, 1), enemyDefense: nonNegativeInt(activeBattle.enemyDefense), enemyAttack: positiveInt(activeBattle.enemyAttack, 1), enemyXp: nonNegativeInt(activeBattle.enemyXp), enemyCoins: nonNegativeInt(activeBattle.enemyCoins), isBoss: Boolean(activeBattle.isBoss), turn: positiveInt(activeBattle.turn, 1), resource: nonNegativeInt(activeBattle.resource, BATTLE_RESOURCE_PER_TURN), maxResource: positiveInt(activeBattle.maxResource, BATTLE_RESOURCE_PER_TURN), lastSkillId: typeof activeBattle.lastSkillId === 'string' ? activeBattle.lastSkillId : null, log: stringArray(activeBattle.log, 20), phase: activeBattle.phase ?? 'combat', storyIndex: nonNegativeInt(activeBattle.storyIndex), rewardsClaimed: Boolean(activeBattle.rewardsClaimed) } : null }, recruitment: { tickets: nonNegativeInt(value.recruitment?.tickets), pity: clamp(nonNegativeInt(value.recruitment?.pity), 0, 9), owned: stringArray(value.recruitment?.owned, 500), ticketSources: stringArray(value.recruitment?.ticketSources, 1000), weekly: { weekKey: typeof value.recruitment?.weekly?.weekKey === 'string' ? value.recruitment.weekly.weekKey : weekKey(asDate(now)), completedDays: stringArray(value.recruitment?.weekly?.completedDays, 7) } }, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso,
  };
};

const awardXp = (state: SPPetState, amount: number, now: Date, rulesInput?: GameRules): { awarded: number; events: SPPetEvent[] } => {
  const rules = rulesOf(rulesInput); const awarded = Math.min(nonNegativeInt(amount), Math.max(0, rules.dailyXpCap - state.today.xpEarned)); const events: SPPetEvent[] = []; state.xp += awarded; state.today.xpEarned += awarded; let gained = 0; let levelCoins = 0;
  while (state.xp >= xpRequiredForLevel(state.level)) { state.xp -= xpRequiredForLevel(state.level); state.level += 1; gained += 1; const coins = 10 + state.level * 2; levelCoins += coins; state.coins += coins; state.pet.baseStats.maxHp += 8; state.pet.baseStats.attack += 2; state.pet.baseStats.defense += 1; state.pet.hp += 8; }
  if (gained) events.push(event('LEVEL_UP', { level: state.level, levelsGained: gained, coins: levelCoins, maxHp: state.pet.baseStats.maxHp, attack: state.pet.baseStats.attack, defense: state.pet.baseStats.defense }, now));
  return { awarded, events };
};

const changeAffinity = (state: SPPetState, amount: number, reason: string, now: Date): SPPetEvent[] => {
  const before = state.pet.affinity.points; const previousStage = state.pet.affinity.stage; state.pet.affinity.points = clamp(before + nonNegativeInt(amount), 0, 500); state.pet.affinity.stage = affinityStageFor(state.pet.affinity.points); const gained = state.pet.affinity.points - before;
  return gained ? [event('AFFINITY_CHANGED', { reason, gained, points: state.pet.affinity.points, stage: state.pet.affinity.stage, stageChanged: previousStage !== state.pet.affinity.stage }, now)] : [];
};

const restoreCondition = (state: SPPetState, amount: number, reason: string, now: Date): SPPetEvent[] => {
  const before = state.pet.condition; state.pet.condition = clamp(before + nonNegativeInt(amount), 0, 100); const gained = state.pet.condition - before;
  return gained ? [event('STATUS_CHANGED', { reason, gained, condition: state.pet.condition }, now)] : [];
};
const awardRecruitTicket = (state: SPPetState, source: string, now: Date): SPPetEvent[] => { if (state.recruitment.ticketSources.includes(source)) return []; state.recruitment.tickets += 1; state.recruitment.ticketSources = [...state.recruitment.ticketSources, source].slice(-1000); return [event('RECRUIT_TICKET_EARNED', { source, tickets: state.recruitment.tickets }, now)]; };

export const onDayChecked = (current: SPPetState, occurredAt?: Date | string | number, rulesInput?: GameRules): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now, rulesInput); const day = localDateKey(now); const rules = rulesOf(rulesInput); const events: SPPetEvent[] = []; let changed = false;
  if (state.lastLoginDate !== day) { const missedDays = state.lastLoginDate ? Math.max(0, dateDistance(state.lastLoginDate, day) - 1) : 0; if (missedDays > 0) { const penalty = missedDays * 10; const conditionLost = Math.min(state.pet.condition, penalty); const hpLost = Math.min(state.pet.hp, penalty - conditionLost); state.pet.condition -= conditionLost; state.pet.hp -= hpLost; events.push(event('PET_CONDITION_CHANGED', { reason: 'missed_login', missedDays, condition: state.pet.condition, lost: conditionLost, hp: state.pet.hp, hpLost }, now)); } state.lastLoginDate = day; changed = true; }
  if (state.today.date !== day) { state.today = { date: day, tasksCompleted: 0, xpEarned: 0, focusRewardSteps: 0, focusTimerRewards: 0 }; state.commissions = commissionsFor(day, rules); state.shop = { date: day, refreshCount: 0, rotation: [] }; changed = true; }
  const currentWeek = weekKey(now); if (state.recruitment.weekly.weekKey !== currentWeek) { state.recruitment.weekly = { weekKey: currentWeek, completedDays: [] }; changed = true; }
  if (state.lastActiveDate && dateDistance(state.lastActiveDate, day) > 1 && state.streak) { state.streak = 0; changed = true; }
  if (changed) touch(state, now); return { state, events };
};

const claimCommissions = (state: SPPetState, rules: Required<GameRules>, now: Date): SPPetEvent[] => {
  const events: SPPetEvent[] = [];
  const claim = (key: 'tasks' | 'focus' | 'priority' | 'review', requestedXp: number, coins: number): void => {
    const commission = state.commissions[key]; if (commission.claimed || commission.progress < commission.target) return; commission.claimed = true; const xp = awardXp(state, requestedXp, now, rules); state.coins += coins; events.push(event('DAILY_COMMISSION_COMPLETED', { commission: key, xp: xp.awarded, coins }, now), event('COMMISSION_COMPLETED', { commission: key, xp: xp.awarded, coins }, now), ...xp.events, ...restoreCondition(state, 5, `commission_${key}`, now), ...changeAffinity(state, 2, `commission_${key}`, now));
  };
  claim('tasks', rules.commissionTaskXp, 5); claim('focus', rules.commissionFocusXp, 5); claim('priority', rules.commissionPriorityXp, 3); claim('review', rules.commissionReviewXp, 3);
  if ((['tasks', 'focus', 'priority', 'review'] as const).every((key) => state.commissions[key].claimed) && !state.recruitment.weekly.completedDays.includes(state.today.date)) { state.recruitment.weekly.completedDays.push(state.today.date); if (state.recruitment.weekly.completedDays.length >= 5) events.push(...awardRecruitTicket(state, `weekly:${state.recruitment.weekly.weekKey}`, now)); }
  return events;
};

export const onTaskCompleted = (current: SPPetState, input: TaskCompletedInput, _contentInput?: GameContent): EngineResult => {
  const now = asDate(input.occurredAt); const rules = rulesOf(input.rules); const dayResult = onDayChecked(current, now, rules); const state = dayResult.state;
  if (!input.taskId || state.processedTaskIds.includes(input.taskId)) return { state, events: dayResult.events };
  const day = localDateKey(now); const first = state.lastActiveDate !== day; if (first) { const distance = state.lastActiveDate ? dateDistance(state.lastActiveDate, day) : null; state.streak = distance === 1 ? state.streak + 1 : 1; state.lastActiveDate = day; }
  state.processedTaskIds = [...state.processedTaskIds, input.taskId].slice(-5000); state.totalTasksCompleted += 1; state.today.tasksCompleted += 1; state.commissions.tasks.progress += 1; if (input.highPriority) state.commissions.priority.progress += 1;
  const events = [...dayResult.events, event('TASK_COMPLETED', { taskId: input.taskId, progress: state.commissions.tasks.progress, target: state.commissions.tasks.target }, now), ...restoreCondition(state, 2, 'task_completed', now)]; if (first) events.push(event('STREAK_UPDATED', { streak: state.streak }, now)); events.push(...claimCommissions(state, rules, now)); touch(state, now); return { state, events };
};

export const seedFocusTime = (current: SPPetState, sourceId: string, totalMinutes: number, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); if (!sourceId) return { state, events: [] }; const total = nonNegativeInt(totalMinutes); const previous = state.observedFocusMinutesByTask[sourceId]; if (previous === undefined || total > previous) { state.observedFocusMinutesByTask[sourceId] = total; touch(state, now); } return { state, events: [] }; };
export const onFocusTimeAdded = (current: SPPetState, input: FocusTimeInput, _contentInput?: GameContent): EngineResult => {
  const now = asDate(input.occurredAt); const rules = rulesOf(input.rules); const dayResult = onDayChecked(current, now, rules); const state = dayResult.state; let added = nonNegativeInt(input.minutes);
  if (input.sourceId && input.sourceTotalMinutes !== undefined) { const total = nonNegativeInt(input.sourceTotalMinutes); const previous = state.observedFocusMinutesByTask[input.sourceId] ?? total; added = Math.max(0, total - previous); state.observedFocusMinutesByTask[input.sourceId] = Math.max(previous, total); }
  if (!added) return { state, events: dayResult.events }; state.totalFocusMinutes += added; state.commissions.focus.progress += added; const rewardSteps = Math.min(4, Math.floor(state.commissions.focus.progress / 25)); const newSteps = Math.max(0, rewardSteps - state.today.focusRewardSteps); state.today.focusRewardSteps = Math.max(state.today.focusRewardSteps, rewardSteps); const focusCoins = newSteps * 2; state.coins += focusCoins; const events = [...dayResult.events]; if (newSteps) events.push(event('FOCUS_SESSION_FINISHED', { minutes: added, rewardMinutes: newSteps * 25, coins: focusCoins, condition: newSteps * 2 }, now), ...restoreCondition(state, newSteps * 2, 'focus', now)); events.push(...claimCommissions(state, rules, now)); touch(state, now); return { state, events };
};

export const onFocusSessionCompleted = (current: SPPetState, input: FocusSessionCompletedInput, contentInput?: GameContent): EngineResult => {
  const now = asDate(input.occurredAt); const rules = rulesOf(input.rules); const dayResult = onDayChecked(current, now, rules); const state = dayResult.state;
  if (!input.sessionId || state.processedFocusSessionIds.includes(input.sessionId)) return { state, events: dayResult.events };
  state.processedFocusSessionIds = [...state.processedFocusSessionIds, input.sessionId].slice(-2000);
  const focusResult = onFocusTimeAdded(state, { minutes: clamp(nonNegativeInt(input.minutes), 1, 180), occurredAt: now, rules }, contentInput); const next = focusResult.state;
  const capped = next.today.focusTimerRewards >= rules.focusTimerDailyCap; const events = [...dayResult.events, ...focusResult.events];
  if (!capped) { next.today.focusTimerRewards += 1; const xp = awardXp(next, rules.focusTimerXp, now, rules); next.coins += rules.focusTimerCoins; events.push(event('FOCUS_TIMER_COMPLETED', { sessionId: input.sessionId, minutes: clamp(nonNegativeInt(input.minutes), 1, 180), xp: xp.awarded, coins: rules.focusTimerCoins, condition: rules.focusTimerCondition, rewardCount: next.today.focusTimerRewards, dailyCap: rules.focusTimerDailyCap }, now), ...xp.events, ...restoreCondition(next, rules.focusTimerCondition, 'focus_timer', now)); }
  else events.push(event('FOCUS_TIMER_COMPLETED', { sessionId: input.sessionId, minutes: clamp(nonNegativeInt(input.minutes), 1, 180), xp: 0, coins: 0, condition: 0, rewardCount: next.today.focusTimerRewards, dailyCap: rules.focusTimerDailyCap, capped: true }, now));
  touch(next, now); return { state: next, events };
};

export const checkIn = (current: SPPetState, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const dayResult = onDayChecked(current, now); const state = dayResult.state; const day = localDateKey(now); if (state.checkIn.lastDate === day) return { state, events: dayResult.events };
  const distance = state.checkIn.lastDate ? dateDistance(state.checkIn.lastDate, day) : null; state.checkIn.streak = distance === 1 ? state.checkIn.streak + 1 : 1; state.checkIn.lastDate = day; const coins = 5 + Math.min(7, state.checkIn.streak) * 2; state.coins += coins; const tickets = state.checkIn.streak % 7 === 0 ? awardRecruitTicket(state, `streak:${day}`, now) : []; touch(state, now); return { state, events: [...dayResult.events, event('DAILY_CHECK_IN', { streak: state.checkIn.streak, coins }, now), event('CHECK_IN', { streak: state.checkIn.streak, coins }, now), ...tickets, ...changeAffinity(state, 2, 'check_in', now)] };
};

export const onDailyReviewCompleted = (current: SPPetState, occurredAt?: Date | string | number, rulesInput?: GameRules): EngineResult => { const now = asDate(occurredAt); const rules = rulesOf(rulesInput); const dayResult = onDayChecked(current, now, rules); const state = dayResult.state; state.commissions.review.progress = 1; const events = [...dayResult.events, ...claimCommissions(state, rules, now)]; touch(state, now); return { state, events }; };

export const getComputedStats = (stateInput: SPPetState): CombatStats => {
  const state = hydrateState(stateInput); return { ...state.pet.baseStats };
};

const enemyAt = (state: SPPetState, content: GameContent): ScaledEnemyDefinition => scaleEnemy(content, state.adventure.chapterIndex, state.adventure.encounterIndex);
export const getBattleStory = (stateInput: SPPetState, contentInput?: GameContent): { before: string[]; after: string[] } => {
  const state = hydrateState(stateInput); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; const enemy = enemyAt(state, content);
  return { before: enemy.storyBefore?.length ? enemy.storyBefore : [`行动记录 // ${chapter.name}`, `${enemy.name} 出现在前方。确认出击后将自动完成整场战斗。`], after: enemy.storyAfter?.length ? enemy.storyAfter : [`${enemy.name} 已被压制。`, enemy.isBoss ? `本章行动完成：${chapter.summary}` : '路线暂时安全，队伍继续向核心区域推进。'] };
};

export const startBattle = (current: SPPetState, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.mode !== 'adventure' || state.adventure.activeBattle || state.adventure.activeMapShopIndex !== null || state.pet.condition < BATTLE_CONDITION_COST) return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const enemy = enemyAt(state, content); const stats = getComputedStats(state); state.pet.hp = clamp(state.pet.hp || Math.ceil(stats.maxHp * .35), 1, stats.maxHp); state.pet.condition -= BATTLE_CONDITION_COST;
  const openingDamage = enemy.specialEffect?.type === 'opening_damage' ? enemy.specialEffect.value : 0; if (openingDamage) state.pet.hp = Math.max(1, state.pet.hp - openingDamage);
  state.adventure.activeBattle = { enemyId: enemy.id, enemyName: enemy.name, enemyAttackElement: enemy.attackElement, enemyDefenseElement: enemy.defenseElement, enemyHp: enemy.maxHp, enemyMaxHp: enemy.maxHp, enemyDefense: enemy.defense, enemyAttack: enemy.attack, enemyXp: enemy.xp, enemyCoins: enemy.coins, isBoss: Boolean(enemy.isBoss), turn: 1, resource: BATTLE_RESOURCE_PER_TURN, maxResource: BATTLE_RESOURCE_PER_TURN, lastSkillId: null, log: [openingDamage ? `${enemy.name} 的开场效果造成 ${openingDamage} 点伤害。` : `侦测到目标：攻 ${enemy.attackElement} / 防 ${enemy.defenseElement}`], phase: 'story_before', storyIndex: 0, rewardsClaimed: false };
  touch(state, now); return { state, events: [event('BATTLE_STARTED', { enemy: enemy.name, attackElement: enemy.attackElement, defenseElement: enemy.defenseElement, boss: Boolean(enemy.isBoss), conditionCost: BATTLE_CONDITION_COST }, now)] };
};

export const startBattleAt = (current: SPPetState, encounterIndex: number, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (nonNegativeInt(encounterIndex) !== state.adventure.encounterIndex) return { state, events: [] };
  return startBattle(state, contentInput, now);
};

export const claimMapReward = (current: SPPetState, rewardIndex: number, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.adventure.activeBattle || state.adventure.activeMapShopIndex !== null) return { state, events: [] };
  const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; const index = nonNegativeInt(rewardIndex);
  if (index >= chapter.enemies.length - 1 || index !== state.adventure.encounterIndex) return { state, events: [] };
  const rewardId = `${chapter.id}:${index}`; if (state.adventure.claimedMapRewards.includes(rewardId)) return { state, events: [] };
  const coins = 4 + index * 3; const heal = 6 + index * 2; const maxHp = getComputedStats(state).maxHp;
  state.coins += coins; state.pet.hp = Math.min(maxHp, state.pet.hp + heal); state.adventure.claimedMapRewards = [...state.adventure.claimedMapRewards, rewardId].slice(-200); state.adventure.encounterIndex += 1; touch(state, now);
  return { state, events: [event('MAP_REWARD_CLAIMED', { rewardId, chapter: chapter.id, index, coins, heal, hp: state.pet.hp }, now)] };
};

export const openMapShop = (current: SPPetState, shopIndex: number, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; const index = nonNegativeInt(shopIndex); const shopId = `${chapter.id}:${index}`;
  if (state.mode !== 'adventure' || state.adventure.activeBattle || state.adventure.activeMapShopIndex !== null || index !== state.adventure.encounterIndex || index >= chapter.enemies.length - 1 || state.adventure.visitedMapShops.includes(shopId)) return { state, events: [] };
  state.adventure.activeMapShopIndex = index; touch(state, now); return { state, events: [event('MAP_SHOP_OPENED', { shopId, chapter: chapter.id, index }, now)] };
};

export const leaveMapShop = (current: SPPetState, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; const index = state.adventure.activeMapShopIndex;
  if (index === null || index !== state.adventure.encounterIndex) return { state, events: [] }; const shopId = `${chapter.id}:${index}`; state.adventure.visitedMapShops = [...state.adventure.visitedMapShops, shopId].slice(-200); state.adventure.activeMapShopIndex = null; state.adventure.encounterIndex += 1; touch(state, now); return { state, events: [event('MAP_SHOP_LEFT', { shopId, chapter: chapter.id, index }, now)] };
};

const finishEncounter = (state: SPPetState, content: GameContent, now: Date, events: SPPetEvent[]): void => {
  const chapter = content.chapters[state.adventure.chapterIndex % content.chapters.length]; state.adventure.encounterIndex += 1;
  if (state.adventure.encounterIndex >= chapter.enemies.length) { events.push(event('CHAPTER_COMPLETED', { chapter: chapter.name }, now)); state.adventure.claimedMapRewards = state.adventure.claimedMapRewards.filter((id) => !id.startsWith(`${chapter.id}:`)); state.adventure.visitedMapShops = state.adventure.visitedMapShops.filter((id) => !id.startsWith(`${chapter.id}:`)); state.adventure.encounterIndex = 0; state.adventure.chapterIndex = (state.adventure.chapterIndex + 1) % content.chapters.length; }
  state.adventure.activeBattle = null;
};

export const advanceBattleStory = (current: SPPetState, skip = false, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const battle = state.adventure.activeBattle; if (!battle || battle.phase === 'combat') return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const story = getBattleStory(state, content); const lines = battle.phase === 'story_before' ? story.before : story.after; const events: SPPetEvent[] = [];
  if (skip || battle.storyIndex + 1 >= lines.length) { if (battle.phase === 'story_before') { battle.phase = 'combat'; battle.storyIndex = 0; touch(state, now); const resolved = advanceAutoBattle(state, content, now); return { state: resolved.state, events: [...events, ...resolved.events] }; } finishEncounter(state, content, now, events); } else battle.storyIndex += 1;
  touch(state, now); return { state, events };
};

const finalDamage = (raw: number, defense: number): number => Math.max(1, Math.round(raw) - Math.max(0, Math.floor(defense)));
const strongAgainst: Partial<Record<DamageType, DamageType>> = { fire: 'ice', ice: 'electric', electric: 'water', water: 'fire' };
export const elementMultiplier = (attack: DamageType, target: DamageType): number => {
  if (attack === 'physical' || target === null || target === 'physical') return 1;
  if (strongAgainst[attack] === target) return 1.5;
  if (strongAgainst[target] === attack) return .75;
  return 1;
};
const multiplierText = (multiplier: number): string => `属性 ×${multiplier}`;
const equippedItem = (state: SPPetState, content: GameContent, slot: 'weapon' | 'accessory'): ItemDefinition | undefined => content.items.find((item) => item.id === state.pet.equipped[slot]);
const weaponMultiplier = (state: SPPetState, content: GameContent, type: DamageType, boss: boolean): number => { const effect = equippedItem(state, content, 'weapon')?.combatEffect; if (!effect) return 1; if (effect.type === 'boss_damage' && boss) return 1.2; if (effect.type === 'element_damage' && effect.element === type) return 1.2; return 1; };
const growthMultiplier = (state: SPPetState, content: GameContent, type: 'xp' | 'coins'): number => equippedItem(state, content, 'accessory')?.growthEffect?.type === type ? 1.1 : 1;
const defenseElement = (state: SPPetState, content: GameContent): DamageType => { const effect = equippedItem(state, content, 'accessory')?.combatEffect; return effect?.type === 'guard_element' ? effect.element : 'physical'; };
const predictedDamage = (state: SPPetState, content: GameContent, skill: GameContent['skills'][number], battle: BattleState, stats: CombatStats): number => finalDamage((stats.attack + skill.baseDamage) * elementMultiplier(skill.type, battle.enemyDefenseElement) * weaponMultiplier(state, content, skill.type, battle.isBoss), battle.enemyDefense);
const settleVictory = (state: SPPetState, battle: BattleState, enemy: ScaledEnemyDefinition, content: GameContent, now: Date, events: SPPetEvent[]): void => {
  if (battle.rewardsClaimed) return; battle.rewardsClaimed = true; battle.phase = 'story_after'; battle.storyIndex = 0; const statusMultiplier = conditionRewardMultiplier(state.pet.condition); const requestedXp = Math.round(battle.enemyXp * growthMultiplier(state, content, 'xp') * statusMultiplier); const xp = awardXp(state, requestedXp, now); const coins = Math.round(battle.enemyCoins * growthMultiplier(state, content, 'coins') * statusMultiplier); state.coins += coins; state.totalBattlesWon += 1; events.push(event('BATTLE_WON', { enemy: enemy.name, xp: xp.awarded, coins, boss: battle.isBoss, statusMultiplier }, now), ...xp.events); if (battle.isBoss) events.push(...awardRecruitTicket(state, `boss:${state.totalBattlesWon}`, now));
};

export const advanceAutoBattle = (current: SPPetState, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const battle = state.adventure.activeBattle; if (!battle || battle.phase !== 'combat') return { state, events: [] };
  const enemy = enemyAt(state, content), stats = getComputedStats(state); const skills = content.skills.filter((skill) => state.pet.equippedSkills.includes(skill.id)).slice(0, 4); if (!skills.length) return { state, events: [] }; const events: SPPetEvent[] = [];
  while (battle.phase === 'combat' && state.pet.hp > 0 && battle.turn <= 100) {
    battle.resource = battle.maxResource; const remaining = [...skills];
    while (remaining.length) { const affordable = remaining.filter((skill) => skill.cost <= battle.resource); if (!affordable.length) break; const skill = affordable.reduce((best, candidate) => predictedDamage(state, content, candidate, battle, stats) > predictedDamage(state, content, best, battle, stats) ? candidate : best); remaining.splice(remaining.indexOf(skill), 1); battle.resource -= skill.cost; const multiplier = elementMultiplier(skill.type, battle.enemyDefenseElement), weapon = weaponMultiplier(state, content, skill.type, battle.isBoss), damage = predictedDamage(state, content, skill, battle, stats); battle.enemyHp = Math.max(0, battle.enemyHp - damage); battle.lastSkillId = skill.id; if (skill.effect?.type === 'heal') state.pet.hp = Math.min(stats.maxHp, state.pet.hp + skill.effect.value); events.push(event('SKILL_USED', { skill: skill.name, damage, type: skill.type, cost: skill.cost, multiplier, weaponMultiplier: weapon, turn: battle.turn }, now)); battle.log.unshift(`回合 ${battle.turn}｜${skill.name} -${skill.cost} RP｜${multiplierText(multiplier)}｜${damage} 伤害`); if (battle.enemyHp <= 0) break; }
    if (battle.enemyHp <= 0) { settleVictory(state, battle, enemy, content, now, events); break; }
    const guard = defenseElement(state, content), counterMultiplier = elementMultiplier(battle.enemyAttackElement, guard), counterDamage = finalDamage(battle.enemyAttack * counterMultiplier, stats.defense); state.pet.hp = Math.max(0, state.pet.hp - counterDamage); battle.log.unshift(`回合 ${battle.turn}｜${enemy.name} 反击｜${multiplierText(counterMultiplier)}｜${counterDamage} 伤害`); events.push(event('ENEMY_ACTION', { enemy: enemy.name, action: 'counter', damage: counterDamage, type: battle.enemyAttackElement, multiplier: counterMultiplier, turn: battle.turn }, now)); battle.turn += 1;
  }
  if (state.pet.hp <= 0 || battle.turn > 100) { state.pet.hp = Math.max(1, Math.ceil(stats.maxHp * .3)); state.adventure.activeBattle = null; events.push(event('BATTLE_LOST', { enemy: enemy.name, condition: state.pet.condition, hp: state.pet.hp }, now)); }
  else if (battle.phase === 'combat') events.push(event('BATTLE_ADVANCED', { enemy: enemy.name, enemyHp: battle.enemyHp, playerHp: state.pet.hp, skill: battle.lastSkillId ?? '', turn: battle.turn }, now));
  battle.log = battle.log.slice(0, 20);
  touch(state, now); return { state, events };
};

export const purchaseItem = (current: SPPetState, itemId: string, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const item = content.items.find((entry) => entry.id === itemId && entry.shop === 'supply'); if (!item || state.coins < item.price || (item.kind !== 'food' && (state.pet.inventory[item.id] ?? 0) > 0)) return { state, events: [] };
  state.coins -= item.price; state.pet.inventory[item.id] = (state.pet.inventory[item.id] ?? 0) + 1; if (item.grantsSkill && !state.pet.learnedSkills.includes(item.grantsSkill)) state.pet.learnedSkills.push(item.grantsSkill); touch(state, now); return { state, events: [event('ITEM_PURCHASED', { itemId: item.id, name: item.name, kind: item.kind, price: item.price }, now)] };
};
export const purchaseMapItem = (current: SPPetState, itemId: string, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.adventure.activeMapShopIndex === null) return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const item = content.items.find((entry) => entry.id === itemId && entry.shop === 'map'); if (!item || state.coins < item.price || (state.pet.inventory[item.id] ?? 0) > 0) return { state, events: [] };
  state.coins -= item.price; state.pet.inventory[item.id] = 1; if (item.grantsSkill && !state.pet.learnedSkills.includes(item.grantsSkill)) state.pet.learnedSkills.push(item.grantsSkill); touch(state, now); return { state, events: [event('ITEM_PURCHASED', { itemId: item.id, name: item.name, kind: item.kind, price: item.price, source: 'map' }, now)] };
};
export const equipItem = (current: SPPetState, itemId: string | null, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); if (itemId === null || state.adventure.activeBattle) return { state, events: [] }; const item = content.items.find((entry) => entry.id === itemId); if (!item || !(state.pet.inventory[itemId] > 0)) return { state, events: [] };
  if (item.kind === 'skin') state.pet.skinPart = item.id; else if (item.slot) state.pet.equipped[item.slot] = item.id; else return { state, events: [] }; state.pet.hp = Math.min(state.pet.hp, getComputedStats(state).maxHp); touch(state, now); return { state, events: [event('ITEM_EQUIPPED', { itemId: item.id, name: item.name, slot: item.slot ?? 'skin' }, now)] };
};
export const useItem = (current: SPPetState, itemId: string, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const item = content.items.find((entry) => entry.id === itemId && ['food', 'medicine'].includes(entry.kind)); if (!item || !(state.pet.inventory[itemId] > 0)) return { state, events: [] }; const restore = item.restore ?? {}; const stats = getComputedStats(state); state.pet.inventory[itemId] -= 1; if (!state.pet.inventory[itemId]) delete state.pet.inventory[itemId]; state.pet.hp = Math.min(stats.maxHp, state.pet.hp + (restore.hp ?? 0)); state.pet.condition = clamp(state.pet.condition + (restore.condition ?? 0), 0, 100); touch(state, now); const fed = item.kind === 'food' ? [event('PET_FED', { itemId: item.id, name: item.name }, now), ...changeAffinity(state, 1, 'feeding', now)] : []; return { state, events: [event('ITEM_USED', { itemId: item.id, name: item.name, kind: item.kind, hp: state.pet.hp, condition: state.pet.condition }, now), ...fed] };
};
export const refreshShop = (current: SPPetState, contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); if (state.coins < 10) return { state, events: [] }; state.coins -= 10; state.shop.refreshCount += 1; const ids = content.items.filter((item) => item.shop === 'supply').map((item) => item.id); const offset = ids.length ? state.shop.refreshCount % ids.length : 0; state.shop.rotation = [...ids.slice(offset), ...ids.slice(0, offset)]; touch(state, now); return { state, events: [event('SHOP_REFRESHED', { cost: 10, refreshCount: state.shop.refreshCount }, now)] }; };

export const onPetConnectionChecked = (current: SPPetState, connected: boolean, occurredAt?: Date | string | number, rulesInput?: GameRules): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now, rulesInput); const rules = rulesOf(rulesInput); const events: SPPetEvent[] = [];
  if (connected) { state.pet.lastConnectedAt = now.toISOString(); state.pet.lastConditionDecayAt = now.toISOString(); touch(state, now); return { state, events }; }
  const last = asDate(state.pet.lastConditionDecayAt); const intervals = Math.floor((now.getTime() - last.getTime()) / (rules.disconnectDecayMinutes * 60_000)); if (intervals > 0) { const before = state.pet.condition; state.pet.condition = Math.max(0, state.pet.condition - intervals * rules.disconnectDecayAmount); state.pet.lastConditionDecayAt = new Date(last.getTime() + intervals * rules.disconnectDecayMinutes * 60_000).toISOString(); if (state.pet.condition !== before) events.push(event('PET_CONDITION_CHANGED', { condition: state.pet.condition, lost: before - state.pet.condition }, now)); touch(state, now); }
  return { state, events };
};

export const updatePetName = (current: SPPetState, name: string, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const clean = name.trim().slice(0, 20); if (clean) state.pet.name = clean; touch(state, now); return { state, events: [] }; };
export const setPlayMode = (current: SPPetState, mode: PlayMode, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); if (mode !== 'companion' && mode !== 'adventure') return { state, events: [] }; if (state.mode === mode) return { state, events: [] }; state.mode = mode; if (mode === 'companion') { state.adventure.activeBattle = null; state.adventure.activeMapShopIndex = null; } touch(state, now); return { state, events: [event('PLAY_MODE_CHANGED', { mode }, now)] }; };
export const onPetTouched = (current: SPPetState, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const day = localDateKey(now); if (state.pet.affinity.touchDate !== day) { state.pet.affinity.touchDate = day; state.pet.affinity.touchesToday = 0; } if (state.pet.affinity.touchesToday >= 3) return { state, events: [] }; state.pet.affinity.touchesToday += 1; touch(state, now); return { state, events: [event('PET_TOUCHED', { touchesToday: state.pet.affinity.touchesToday }, now), ...changeAffinity(state, 1, 'touch', now)] }; };
export const setEquippedSkills = (current: SPPetState, skillIds: string[], contentInput?: GameContent, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.adventure.activeBattle) return { state, events: [] }; const content = normalizeContent(contentInput ?? DEFAULT_CONTENT); const valid = new Set(content.skills.map((skill) => skill.id)); state.pet.equippedSkills = [...new Set(skillIds.filter((id) => typeof id === 'string' && valid.has(id) && state.pet.learnedSkills.includes(id)))].slice(0, 4); touch(state, now); return { state, events: [] }; };
export const onGoalProgressUpdated = (current: SPPetState, goalId: string, progress: number, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const events = progress >= 100 && goalId ? awardRecruitTicket(state, `goal:${goalId}`, now) : []; if (events.length) touch(state, now); return { state, events }; };
export const recruit = (current: SPPetState, seed = '', occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); if (state.recruitment.tickets < 1) return { state, events: [] }; state.recruitment.tickets -= 1; const guaranteedRare = state.recruitment.pity >= 9; let hash = 2166136261; for (const char of `${seed}:${now.toISOString()}:${state.recruitment.owned.length}`) { hash ^= char.codePointAt(0) || 0; hash = Math.imul(hash, 16777619); } const rare = guaranteedRare || Math.abs(hash) % 5 === 0, preferred = RECRUITMENT_POOL.filter((entry) => entry.rarity === (rare ? 'rare' : 'common') && !state.recruitment.owned.includes(entry.id)), fallback = RECRUITMENT_POOL.filter((entry) => !state.recruitment.owned.includes(entry.id)), pool = preferred.length ? preferred : fallback.length ? fallback : RECRUITMENT_POOL, reward = pool[Math.abs(hash) % pool.length]; state.recruitment.pity = reward.rarity === 'rare' ? 0 : Math.min(9, state.recruitment.pity + 1); state.recruitment.owned = [...new Set([...state.recruitment.owned, reward.id])]; if (reward.skillId && !state.pet.learnedSkills.includes(reward.skillId)) state.pet.learnedSkills.push(reward.skillId); touch(state, now); return { state, events: [event('RECRUITMENT_RESULT', { rewardId: reward.id, name: reward.name, type: reward.type, rarity: reward.rarity, pity: state.recruitment.pity, tickets: state.recruitment.tickets }, now)] }; };
export const addDebugXp = (current: SPPetState, amount = 10, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const reward = awardXp(state, amount, now); const events = [event('DEBUG_XP', { xp: reward.awarded }, now), ...reward.events]; touch(state, now); return { state, events }; };
export const addDebugCoins = (current: SPPetState, amount = 25, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const coins = nonNegativeInt(amount); state.coins += coins; touch(state, now); return { state, events: [event('DEBUG_COINS', { coins }, now)] }; };
export const importState = (input: unknown, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(input, now); touch(state, now); return { state, events: [] }; };
export const resetState = (occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); return { state: createInitialState(now), events: [event('STATE_RESET', {}, now)] }; };
