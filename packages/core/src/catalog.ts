import type { DamageType, GameContent, ScaledEnemyDefinition } from './types.js';

export const DEFAULT_CONTENT: GameContent = {
  version: 2,
  battleVisuals: {
    physical: { color: '#a69a8c', hitEffect: 'physical' },
    fire: { color: '#bd7865', hitEffect: 'fire' },
    water: { color: '#6f94aa', hitEffect: 'water' },
    ice: { color: '#9bb5b8', hitEffect: 'ice' },
    electric: { color: '#b6a46d', hitEffect: 'electric' },
  },
  skills: [
    { id: 'strike', name: '战术打击', nameEn: 'Tactical Strike', description: '14 点物理伤害。', type: 'physical', cost: 1, baseDamage: 14 },
    { id: 'ember-shot', name: '灼流弹', nameEn: 'Ember Shot', description: '13 点火属性伤害。', type: 'fire', cost: 2, baseDamage: 13 },
    { id: 'tide-cut', name: '潮切', nameEn: 'Tide Cut', description: '14 点水属性伤害。', type: 'water', cost: 2, baseDamage: 14 },
    { id: 'frost-ward', name: '霜息', nameEn: 'Frost Breath', description: '12 点冰属性伤害，并恢复 4 HP。', type: 'ice', cost: 2, baseDamage: 12, effect: { type: 'heal', value: 4 } },
    { id: 'arc-burst', name: '弧光过载', nameEn: 'Arc Burst', description: '15 点电属性伤害。', type: 'electric', cost: 3, baseDamage: 15 },
  ],
  items: [
    { id: 'signal-visor', kind: 'skin', shop: 'map', name: '信号目镜', nameEn: 'Signal Visor', description: '可替换的面部皮肤部件。', price: 24, icon: 'VIS' },
    { id: 'field-hood', kind: 'skin', shop: 'map', name: '旅行兜帽', nameEn: 'Travel Hood', description: '低调的旅行兜帽。', price: 32, icon: 'HD' },
    { id: 'ember-chip', kind: 'skill', shop: 'map', name: '灼流芯片', nameEn: 'Ember Chip', description: '解锁技能“灼流弹”。', price: 45, icon: 'SK', grantsSkill: 'ember-shot' },
    { id: 'tide-chip', kind: 'skill', shop: 'map', name: '潮汐芯片', nameEn: 'Tide Chip', description: '解锁技能“潮切”。', price: 52, icon: 'SK', grantsSkill: 'tide-cut' },
    { id: 'frost-chip', kind: 'skill', shop: 'map', name: '霜息芯片', nameEn: 'Frost Chip', description: '解锁技能“霜息”。', price: 58, icon: 'SK', grantsSkill: 'frost-ward' },
    { id: 'arc-chip', kind: 'skill', shop: 'map', name: '弧光芯片', nameEn: 'Arc Chip', description: '解锁技能“弧光过载”。', price: 72, icon: 'SK', grantsSkill: 'arc-burst' },
    { id: 'ember-lance', kind: 'weapon', shop: 'map', name: '熔核长枪', nameEn: 'Ember Lance', description: '火属性伤害 +20%。', price: 90, icon: 'WPN', slot: 'weapon', combatEffect: { type: 'element_damage', element: 'fire', percent: 20 } },
    { id: 'boss-breaker', kind: 'weapon', shop: 'map', name: '破阵短刃', nameEn: 'Boss Breaker', description: '对 Boss 伤害 +20%。', price: 105, icon: 'WPN', slot: 'weapon', combatEffect: { type: 'boss_damage', percent: 20 } },
    { id: 'study-charm', kind: 'accessory', shop: 'map', name: '求知书签', nameEn: 'Study Bookmark', description: '战斗 XP +10%。', price: 80, icon: 'ACC', slot: 'accessory', growthEffect: { type: 'xp', percent: 10 } },
    { id: 'coin-pouch', kind: 'accessory', shop: 'map', name: '零钱袋', nameEn: 'Coin Pouch', description: '战斗金币 +10%。', price: 80, icon: 'ACC', slot: 'accessory', growthEffect: { type: 'coins', percent: 10 } },
    { id: 'frost-badge', kind: 'accessory', shop: 'map', name: '霜纹徽记', nameEn: 'Frost Badge', description: '将防御属性设为冰。', price: 70, icon: 'ICE', slot: 'accessory', combatEffect: { type: 'guard_element', element: 'ice' } },
    { id: 'tide-badge', kind: 'accessory', shop: 'map', name: '潮纹徽记', nameEn: 'Tide Badge', description: '将防御属性设为水。', price: 70, icon: 'WTR', slot: 'accessory', combatEffect: { type: 'guard_element', element: 'water' } },
    { id: 'field-ration', kind: 'food', shop: 'supply', name: '行动口粮', nameEn: 'Field Ration', description: '恢复 25 HP 和 10 状态。', price: 12, icon: 'FOOD', restore: { hp: 25, condition: 10 } },
    { id: 'comfort-tea', kind: 'food', shop: 'supply', name: '安神热饮', nameEn: 'Comfort Tea', description: '恢复 30 状态。', price: 18, icon: 'FOOD', restore: { condition: 30 } },
    { id: 'repair-spray', kind: 'medicine', shop: 'supply', name: '修复喷剂', nameEn: 'Repair Spray', description: '恢复 40 HP。', price: 20, icon: 'MED', restore: { hp: 40 } },
  ],
  chapters: [
    { id: 'waste-relay', name: '第一章：废墟中继站', nameEn: 'CH.1 Wasteland Relay', summary: '清理失控设施并夺回中继节点。', enemies: [
      { id: 'scrap-drone', name: '废件巡游机', nameEn: 'Scrap Drone', attackElement: 'electric', defenseElement: 'electric', hpMultiplier: .9, attackMultiplier: .9, defenseMultiplier: .8, rewardMultiplier: .9 },
      { id: 'crystal-hound', name: '结晶猎犬', nameEn: 'Crystal Hound', attackElement: 'physical', defenseElement: 'ice', hpMultiplier: 1.1, attackMultiplier: 1, defenseMultiplier: 1, rewardMultiplier: 1 },
      { id: 'relay-overseer', name: '中继监管者', nameEn: 'Relay Overseer', attackElement: 'electric', defenseElement: 'fire', hpMultiplier: 1.05, attackMultiplier: 1, defenseMultiplier: 1, rewardMultiplier: 1, isBoss: true },
    ] },
    { id: 'frozen-quarry', name: '第二章：冻结采掘区', nameEn: 'CH.2 Frozen Quarry', summary: '穿越低温矿坑，处理异常核心。', enemies: [
      { id: 'mist-caster', name: '雾流术体', nameEn: 'Mist Caster', attackElement: 'water', defenseElement: 'electric', hpMultiplier: .95, attackMultiplier: 1.05, defenseMultiplier: .9, rewardMultiplier: 1 },
      { id: 'furnace-shell', name: '熔炉重壳', nameEn: 'Furnace Shell', attackElement: 'fire', defenseElement: 'fire', hpMultiplier: 1.2, attackMultiplier: .9, defenseMultiplier: 1.2, rewardMultiplier: 1.1 },
      { id: 'quarry-heart', name: '采掘区心脏', nameEn: 'Quarry Heart', attackElement: 'ice', defenseElement: 'water', hpMultiplier: 1.1, attackMultiplier: 1.05, defenseMultiplier: 1.1, rewardMultiplier: 1.1, isBoss: true, specialEffect: { type: 'opening_damage', value: 5 } },
    ] },
  ],
};

const damageTypes: DamageType[] = ['physical', 'fire', 'water', 'ice', 'electric'];
const safeMultiplier = (value: unknown): number => Math.min(2, Math.max(.5, Number(value) || 1));
const safeToken = (candidate: unknown, fallback: string): string => typeof candidate === 'string' && /^[a-z0-9-]{1,32}$/i.test(candidate) ? candidate : fallback;
const safeColor = (candidate: unknown, fallback: string): string => typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;

export const scaleEnemy = (contentInput: GameContent, chapterIndex: number, encounterIndex: number): ScaledEnemyDefinition => {
  const content = normalizeContent(contentInput); const chapter = content.chapters[Math.max(0, chapterIndex) % content.chapters.length]; const enemy = chapter.enemies[Math.max(0, encounterIndex) % chapter.enemies.length];
  const chapterLevel = Math.max(0, chapterIndex), stageLevel = Math.max(0, encounterIndex), bossHp = enemy.isBoss ? 1.8 : 1, bossAttack = enemy.isBoss ? 1.2 : 1, bossDefense = enemy.isBoss ? 1.25 : 1, bossReward = enemy.isBoss ? 2 : 1;
  const maxHp = Math.round((42 + chapterLevel * 28 + stageLevel * 14) * enemy.hpMultiplier * bossHp);
  const attack = Math.round((8 + chapterLevel * 3 + stageLevel * 2) * enemy.attackMultiplier * bossAttack);
  const defense = Math.max(0, Math.round((1 + chapterLevel * 2 + Math.floor(stageLevel / 2)) * enemy.defenseMultiplier * bossDefense));
  const xp = Math.round((18 + chapterLevel * 10 + stageLevel * 5) * enemy.rewardMultiplier * bossReward);
  const coins = Math.round((8 + chapterLevel * 5 + stageLevel * 3) * enemy.rewardMultiplier * bossReward);
  return { ...enemy, maxHp, attack, defense, xp, coins };
};

export const normalizeContent = (input: unknown): GameContent => {
  if (!input || typeof input !== 'object') return DEFAULT_CONTENT;
  const value = input as Partial<GameContent>; if (!Array.isArray(value.skills) || !Array.isArray(value.items) || !Array.isArray(value.chapters) || !value.chapters.length) return DEFAULT_CONTENT;
  const skills = value.skills.filter(Boolean).map((skill) => { const legacy = skill as typeof skill & { power?: number; heal?: number; cost?: number }; const baseDamage = Math.max(1, Math.round(Number(skill.baseDamage) || 12 * (Number(legacy.power) || 1))); return { id: String(skill.id), name: String(skill.name), nameEn: String(skill.nameEn), description: String(skill.description || ''), type: damageTypes.includes(skill.type) ? skill.type : 'physical' as const, cost: Math.min(5, Math.max(1, Math.round(Number(legacy.cost) || 1))), baseDamage, effect: skill.effect?.type === 'heal' ? { type: 'heal' as const, value: Math.max(1, Math.round(skill.effect.value)) } : legacy.heal ? { type: 'heal' as const, value: Math.max(1, Math.round(legacy.heal)) } : undefined }; });
  const items = value.items.filter((item) => item && ['skin', 'skill', 'weapon', 'accessory', 'food', 'medicine'].includes(item.kind)).map((item) => { const effect = item.combatEffect; const combatEffect = effect?.type === 'guard_element' && damageTypes.includes(effect.element) ? effect : effect && (effect.type === 'boss_damage' || effect.type === 'element_damage') && effect.percent === 20 && (effect.type === 'boss_damage' || damageTypes.includes(effect.element as DamageType)) ? effect : undefined; return { ...item, shop: item.shop === 'supply' || item.shop === 'map' ? item.shop : ['food', 'medicine'].includes(item.kind) ? 'supply' as const : 'map' as const, slot: item.slot === 'weapon' || item.slot === 'accessory' ? item.slot : undefined, combatEffect, growthEffect: item.growthEffect?.percent === 10 && ['xp', 'coins'].includes(item.growthEffect.type) ? item.growthEffect : undefined }; });
  const chapters = value.chapters.filter((chapter) => chapter && Array.isArray(chapter.enemies) && chapter.enemies.length).map((chapter) => ({ ...chapter, enemies: chapter.enemies.map((enemy) => { const legacy = enemy as typeof enemy & { element?: DamageType }; const fallbackElement = damageTypes.includes(legacy.element as DamageType) ? legacy.element as DamageType : 'physical'; return { id: String(enemy.id), name: String(enemy.name), nameEn: String(enemy.nameEn), attackElement: damageTypes.includes(enemy.attackElement) ? enemy.attackElement : fallbackElement, defenseElement: damageTypes.includes(enemy.defenseElement) ? enemy.defenseElement : fallbackElement, hpMultiplier: safeMultiplier(enemy.hpMultiplier), attackMultiplier: safeMultiplier(enemy.attackMultiplier), defenseMultiplier: safeMultiplier(enemy.defenseMultiplier), rewardMultiplier: safeMultiplier(enemy.rewardMultiplier), isBoss: Boolean(enemy.isBoss) || undefined, specialEffect: enemy.specialEffect?.type === 'opening_damage' ? { type: 'opening_damage' as const, value: Math.max(1, Math.round(enemy.specialEffect.value)) } : undefined, storyBefore: enemy.storyBefore, storyAfter: enemy.storyAfter }; }) }));
  const battleVisuals = Object.fromEntries(damageTypes.map((type) => { const fallback = DEFAULT_CONTENT.battleVisuals[type], visual = value.battleVisuals?.[type]; return [type, { color: safeColor(visual?.color, fallback.color), hitEffect: safeToken(visual?.hitEffect, fallback.hitEffect) }]; })) as GameContent['battleVisuals'];
  return chapters.length && skills.length ? { version: Number(value.version) || 2, skills, items, chapters, battleVisuals } : DEFAULT_CONTENT;
};
