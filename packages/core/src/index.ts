export const DEFAULT_RULES = { taskXp: 10, taskCoins: 5, focusBlockMinutes: 25, focusBlockXp: 5 };

export interface RewardRules {
  taskXp?: number;
  taskCoins?: number;
  focusBlockMinutes?: number;
  focusBlockXp?: number;
  tagDamage?: Record<string, number>;
}

export type GamificationEventType = 'TASK_COMPLETED' | 'LEVEL_UP' | 'STREAK_UPDATED' | 'FOCUS_REWARD' | 'BOSS_HIT' | 'BOSS_DEFEATED' | 'QUEST_REWARD' | 'ITEM_PURCHASED' | 'ITEM_EQUIPPED' | 'DEBUG_XP' | 'DEBUG_COINS' | 'STATE_RESET';
export interface GamificationEvent { id: string; type: GamificationEventType; timestamp: string; payload: Record<string, string | number | boolean | null>; }
export interface BossState { id: string; name: string; hp: number; maxHp: number; }
export interface DailyQuestState {
  date: string;
  tasks: { progress: number; target: number; claimed: boolean };
  focus: { progress: number; target: number; claimed: boolean };
}
export interface GamificationState {
  version: 2;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  lastActiveDate: string | null;
  totalTasksCompleted: number;
  totalFocusMinutes: number;
  today: { date: string; tasksCompleted: number };
  processedTaskIds: string[];
  observedFocusMinutesByTask: Record<string, number>;
  focusRewardRemainderMinutes: number;
  adventure: { zoneIndex: number; stage: number; boss: BossState };
  dailyQuests: DailyQuestState;
  inventory: string[];
  equippedAccessory: string | null;
  updatedAt: string;
}
export interface EngineResult { state: GamificationState; events: GamificationEvent[]; }
export interface TaskCompletedInput { taskId: string; title?: string; tags?: string[]; occurredAt?: Date | string | number; rules?: RewardRules; }
export interface FocusTimeInput { minutes?: number; sourceId?: string; sourceTotalMinutes?: number; occurredAt?: Date | string | number; rules?: RewardRules; }
export interface ShopItem { id: string; name: string; nameEn: string; price: number; icon: string; color: string; }

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'sun-band', name: '日光头带', nameEn: 'Sun Band', price: 30, icon: '▰', color: '#ffdf3d' },
  { id: 'sky-goggles', name: '晴空护目镜', nameEn: 'Sky Goggles', price: 50, icon: '∞', color: '#27e4ff' },
  { id: 'berry-cape', name: '莓红斗篷', nameEn: 'Berry Cape', price: 80, icon: '◆', color: '#ff3f77' },
];

export const ADVENTURE_ZONES = [
  { id: 'prism-field', name: '棱彩原野', nameEn: 'Prism Field', boss: '苔甲兽', bossEn: 'Mossback', hp: 80 },
  { id: 'ember-cavern', name: '炽晶洞窟', nameEn: 'Ember Cavern', boss: '熔核守卫', bossEn: 'Core Warden', hp: 130 },
  { id: 'sky-ruins', name: '晴空遗迹', nameEn: 'Sky Ruins', boss: '风暴巨像', bossEn: 'Storm Colossus', hp: 190 },
] as const;

const asDate = (value?: Date | string | number): Date => {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
export const localDateKey = (value?: Date | string | number): string => {
  const date = asDate(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const dateDistance = (from: string, to: string): number => {
  const parse = (value: string): number => { const [year, month, day] = value.split('-').map(Number); return Date.UTC(year, month - 1, day); };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
};
const nonNegativeInt = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
const positiveInt = (value: unknown, fallback: number): number => Math.max(1, nonNegativeInt(value, fallback));
export const xpRequiredForLevel = (level: number): number => 100 + Math.max(1, Math.floor(level)) * 25;
const makeBoss = (zoneIndex: number): BossState => { const zone = ADVENTURE_ZONES[zoneIndex % ADVENTURE_ZONES.length]; return { id: zone.id, name: zone.boss, hp: zone.hp, maxHp: zone.hp }; };
const makeDailyQuests = (date: string): DailyQuestState => ({ date, tasks: { progress: 0, target: 3, claimed: false }, focus: { progress: 0, target: 50, claimed: false } });

export const createInitialState = (now?: Date | string | number): GamificationState => {
  const date = asDate(now); const day = localDateKey(date);
  return { version: 2, level: 1, xp: 0, coins: 0, streak: 0, lastActiveDate: null, totalTasksCompleted: 0, totalFocusMinutes: 0, today: { date: day, tasksCompleted: 0 }, processedTaskIds: [], observedFocusMinutesByTask: {}, focusRewardRemainderMinutes: 0, adventure: { zoneIndex: 0, stage: 1, boss: makeBoss(0) }, dailyQuests: makeDailyQuests(day), inventory: [], equippedAccessory: null, updatedAt: date.toISOString() };
};

export const hydrateState = (input: unknown, now?: Date | string | number): GamificationState => {
  const initial = createInitialState(now);
  if (!input || typeof input !== 'object') return initial;
  const value = input as Partial<GamificationState>;
  const today = value.today && typeof value.today === 'object' ? value.today : initial.today;
  const observed = value.observedFocusMinutesByTask && typeof value.observedFocusMinutesByTask === 'object' ? Object.fromEntries(Object.entries(value.observedFocusMinutesByTask).filter(([key]) => Boolean(key)).map(([key, minutes]) => [key, nonNegativeInt(minutes)])) : {};
  const zoneIndex = nonNegativeInt(value.adventure?.zoneIndex); const defaultBoss = makeBoss(zoneIndex); const bossValue = value.adventure?.boss;
  const day = typeof today.date === 'string' ? today.date : initial.today.date;
  const quest = value.dailyQuests?.date === day ? value.dailyQuests : makeDailyQuests(day);
  const inventory = Array.isArray(value.inventory) ? [...new Set(value.inventory.filter((id): id is string => SHOP_ITEMS.some((item) => item.id === id)))] : [];
  const equipped = typeof value.equippedAccessory === 'string' && inventory.includes(value.equippedAccessory) ? value.equippedAccessory : null;
  return {
    version: 2, level: Math.max(1, nonNegativeInt(value.level, 1)), xp: nonNegativeInt(value.xp), coins: nonNegativeInt(value.coins), streak: nonNegativeInt(value.streak), lastActiveDate: typeof value.lastActiveDate === 'string' ? value.lastActiveDate : null, totalTasksCompleted: nonNegativeInt(value.totalTasksCompleted), totalFocusMinutes: nonNegativeInt(value.totalFocusMinutes), today: { date: day, tasksCompleted: nonNegativeInt(today.tasksCompleted) },
    processedTaskIds: Array.isArray(value.processedTaskIds) ? [...new Set(value.processedTaskIds.filter((id): id is string => typeof id === 'string'))].slice(-5000) : [],
    observedFocusMinutesByTask: observed, focusRewardRemainderMinutes: nonNegativeInt(value.focusRewardRemainderMinutes),
    adventure: { zoneIndex, stage: Math.max(1, nonNegativeInt(value.adventure?.stage, 1)), boss: { id: typeof bossValue?.id === 'string' ? bossValue.id : defaultBoss.id, name: typeof bossValue?.name === 'string' ? bossValue.name : defaultBoss.name, hp: nonNegativeInt(bossValue?.hp, defaultBoss.hp), maxHp: positiveInt(bossValue?.maxHp, defaultBoss.maxHp) } },
    dailyQuests: { date: quest.date, tasks: { progress: nonNegativeInt(quest.tasks?.progress), target: positiveInt(quest.tasks?.target, 3), claimed: Boolean(quest.tasks?.claimed) }, focus: { progress: nonNegativeInt(quest.focus?.progress), target: positiveInt(quest.focus?.target, 50), claimed: Boolean(quest.focus?.claimed) } },
    inventory, equippedAccessory: equipped, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : initial.updatedAt,
  };
};

const event = (type: GamificationEventType, payload: GamificationEvent['payload'], now: Date): GamificationEvent => ({ id: globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${type}-${Math.random().toString(36).slice(2, 10)}`, type, timestamp: now.toISOString(), payload });
const awardXp = (state: GamificationState, amount: number, now: Date): GamificationEvent[] => {
  const events: GamificationEvent[] = []; state.xp += amount; let levelsGained = 0;
  while (state.xp >= xpRequiredForLevel(state.level)) { state.xp -= xpRequiredForLevel(state.level); state.level += 1; levelsGained += 1; }
  if (levelsGained > 0) events.push(event('LEVEL_UP', { level: state.level, levelsGained }, now));
  return events;
};
const touch = (state: GamificationState, now: Date): void => { state.updatedAt = now.toISOString(); };
const claimDailyRewards = (state: GamificationState, now: Date): GamificationEvent[] => {
  const events: GamificationEvent[] = [];
  if (!state.dailyQuests.tasks.claimed && state.dailyQuests.tasks.progress >= state.dailyQuests.tasks.target) { state.dailyQuests.tasks.claimed = true; state.coins += 15; events.push(event('QUEST_REWARD', { quest: 'tasks', coins: 15 }, now)); }
  if (!state.dailyQuests.focus.claimed && state.dailyQuests.focus.progress >= state.dailyQuests.focus.target) { state.dailyQuests.focus.claimed = true; state.coins += 10; events.push(event('QUEST_REWARD', { quest: 'focus', coins: 10 }, now)); }
  return events;
};

export const onDayChecked = (current: GamificationState, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const date = localDateKey(now); let changed = false;
  if (state.today.date !== date) { state.today = { date, tasksCompleted: 0 }; state.dailyQuests = makeDailyQuests(date); changed = true; }
  if (state.lastActiveDate && dateDistance(state.lastActiveDate, date) > 1 && state.streak !== 0) { state.streak = 0; changed = true; }
  if (changed) touch(state, now); return { state, events: [] };
};

const taskDamage = (input: TaskCompletedInput): number => {
  const explicit = input.title?.match(/\[dmg:(\d{1,3})\]/i); if (explicit) return Math.max(1, Number(explicit[1]));
  const configured = input.rules?.tagDamage ?? {}; const tags = (input.tags ?? []).map((tag) => tag.replace(/^#/, '').toLowerCase()); let damage = 10;
  for (const [tag, amount] of Object.entries(configured)) if (tags.includes(tag.replace(/^#/, '').toLowerCase())) damage = Math.max(damage, positiveInt(amount, 10));
  if (tags.includes('hard') || tags.includes('困难')) damage = Math.max(damage, 20);
  if (tags.includes('deep-work') || tags.includes('深度工作')) damage = Math.max(damage, 15);
  return damage;
};

export const onTaskCompleted = (current: GamificationState, input: TaskCompletedInput): EngineResult => {
  const now = asDate(input.occurredAt); const state = onDayChecked(current, now).state;
  if (!input.taskId || state.processedTaskIds.includes(input.taskId)) return { state, events: [] };
  const rules = { ...DEFAULT_RULES, ...input.rules }; const today = localDateKey(now); const firstTaskToday = state.lastActiveDate !== today;
  if (firstTaskToday) { const distance = state.lastActiveDate ? dateDistance(state.lastActiveDate, today) : null; state.streak = distance === 1 ? state.streak + 1 : 1; state.lastActiveDate = today; }
  state.processedTaskIds.push(input.taskId); state.processedTaskIds = state.processedTaskIds.slice(-5000); state.totalTasksCompleted += 1; state.today.tasksCompleted += 1; state.dailyQuests.tasks.progress += 1;
  const xp = positiveInt(rules.taskXp, DEFAULT_RULES.taskXp); const coins = positiveInt(rules.taskCoins, DEFAULT_RULES.taskCoins); state.coins += coins;
  const events = [event('TASK_COMPLETED', { taskId: input.taskId, xp, coins }, now)]; if (firstTaskToday) events.push(event('STREAK_UPDATED', { streak: state.streak }, now)); events.push(...awardXp(state, xp, now));
  const damage = taskDamage(input); const defeatedName = state.adventure.boss.name; state.adventure.boss.hp = Math.max(0, state.adventure.boss.hp - damage); events.push(event('BOSS_HIT', { damage, hp: state.adventure.boss.hp, boss: defeatedName }, now));
  if (state.adventure.boss.hp === 0) { state.coins += 25; events.push(event('BOSS_DEFEATED', { boss: defeatedName, coins: 25, stage: state.adventure.stage }, now)); events.push(...awardXp(state, 25, now)); state.adventure.stage += 1; state.adventure.zoneIndex = (state.adventure.zoneIndex + 1) % ADVENTURE_ZONES.length; state.adventure.boss = makeBoss(state.adventure.zoneIndex); }
  events.push(...claimDailyRewards(state, now)); touch(state, now); return { state, events };
};

export const seedFocusTime = (current: GamificationState, sourceId: string, totalMinutes: number, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (!sourceId) return { state, events: [] }; const normalized = nonNegativeInt(totalMinutes); const previous = state.observedFocusMinutesByTask[sourceId];
  if (previous === undefined || normalized > previous) { state.observedFocusMinutesByTask[sourceId] = normalized; touch(state, now); }
  return { state, events: [] };
};

export const onFocusTimeAdded = (current: GamificationState, input: FocusTimeInput): EngineResult => {
  const now = asDate(input.occurredAt); const state = onDayChecked(current, now).state; let addedMinutes = nonNegativeInt(input.minutes);
  if (input.sourceId && input.sourceTotalMinutes !== undefined) { const total = nonNegativeInt(input.sourceTotalMinutes); const previous = state.observedFocusMinutesByTask[input.sourceId] ?? total; addedMinutes = Math.max(0, total - previous); state.observedFocusMinutesByTask[input.sourceId] = Math.max(previous, total); }
  if (addedMinutes <= 0) return { state, events: [] };
  const rules = { ...DEFAULT_RULES, ...input.rules }; const blockMinutes = positiveInt(rules.focusBlockMinutes, DEFAULT_RULES.focusBlockMinutes); const blockXp = positiveInt(rules.focusBlockXp, DEFAULT_RULES.focusBlockXp);
  state.totalFocusMinutes += addedMinutes; state.dailyQuests.focus.progress += addedMinutes; const accumulated = state.focusRewardRemainderMinutes + addedMinutes; const blocks = Math.floor(accumulated / blockMinutes); state.focusRewardRemainderMinutes = accumulated % blockMinutes;
  const events: GamificationEvent[] = []; if (blocks > 0) { const xp = blocks * blockXp; events.push(event('FOCUS_REWARD', { focusMinutes: blocks * blockMinutes, xp, blocks }, now)); events.push(...awardXp(state, xp, now)); }
  events.push(...claimDailyRewards(state, now)); touch(state, now); return { state, events };
};

export const purchaseItem = (current: GamificationState, itemId: string, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item || state.inventory.includes(itemId) || state.coins < item.price) return { state, events: [] };
  state.coins -= item.price; state.inventory.push(itemId); touch(state, now); return { state, events: [event('ITEM_PURCHASED', { itemId, price: item.price, name: item.name }, now)] };
};
export const equipItem = (current: GamificationState, itemId: string | null, occurredAt?: Date | string | number): EngineResult => {
  const now = asDate(occurredAt); const state = hydrateState(current, now); if (itemId !== null && !state.inventory.includes(itemId)) return { state, events: [] };
  state.equippedAccessory = itemId; touch(state, now); return { state, events: [event('ITEM_EQUIPPED', { itemId }, now)] };
};
export const addDebugXp = (current: GamificationState, amount = 10, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const xp = nonNegativeInt(amount); const events = [event('DEBUG_XP', { xp }, now), ...awardXp(state, xp, now)]; touch(state, now); return { state, events }; };
export const addDebugCoins = (current: GamificationState, amount = 5, occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); const state = hydrateState(current, now); const coins = nonNegativeInt(amount); state.coins += coins; touch(state, now); return { state, events: [event('DEBUG_COINS', { coins }, now)] }; };
export const resetState = (occurredAt?: Date | string | number): EngineResult => { const now = asDate(occurredAt); return { state: createInitialState(now), events: [event('STATE_RESET', {}, now)] }; };
