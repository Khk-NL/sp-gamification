import type { DamageType, GameContent, Resistances } from './types.js';

export const ZERO_RESISTANCE: Resistances = { physical: 0, fire: 0, water: 0, ice: 0, electric: 0 };
const resist = (changes: Partial<Resistances> = {}): Resistances => ({ ...ZERO_RESISTANCE, ...changes });

export const DEFAULT_CONTENT: GameContent = {
  version: 1,
  skills: [
    { id: 'strike', name: '战术打击', nameEn: 'Tactical Strike', description: '可靠的物理攻击。', cost: 1, type: 'physical', power: 1 },
    { id: 'brace', name: '防御姿态', nameEn: 'Brace', description: '造成攻击 ×0.35 的物理伤害，获得 10 点物理护盾。', cost: 1, type: 'physical', power: 0.35, block: 10 },
    { id: 'ember-shot', name: '灼流弹', nameEn: 'Ember Shot', description: '造成攻击 ×0.9 的火伤，每回合追加 4 点灼烧。', cost: 2, type: 'fire', power: 0.9, burn: 4 },
    { id: 'tide-cut', name: '潮切', nameEn: 'Tide Cut', description: '造成攻击 ×1.25 的水属性伤害。', cost: 2, type: 'water', power: 1.25 },
    { id: 'frost-ward', name: '霜盾', nameEn: 'Frost Ward', description: '造成攻击 ×0.65 的冰伤，获得 8 点冰盾并降低敌方下次伤害 20%。', cost: 2, type: 'ice', power: 0.65, block: 8, weaken: 20 },
    { id: 'arc-burst', name: '弧光过载', nameEn: 'Arc Burst', description: '造成攻击 ×1.65 的电属性伤害。', cost: 3, type: 'electric', power: 1.65 },
  ],
  items: [
    { id: 'signal-visor', kind: 'skin', name: '信号目镜', nameEn: 'Signal Visor', description: '可替换的面部皮肤部件。', price: 24, icon: 'VIS' },
    { id: 'field-hood', kind: 'skin', name: '战地兜帽', nameEn: 'Field Hood', description: '低调的行动兜帽。', price: 32, icon: 'HD' },
    { id: 'ember-chip', kind: 'skill', name: '灼流芯片', nameEn: 'Ember Chip', description: '解锁技能“灼流弹”。', price: 45, icon: 'SK', grantsSkill: 'ember-shot' },
    { id: 'tide-chip', kind: 'skill', name: '潮汐芯片', nameEn: 'Tide Chip', description: '解锁技能“潮切”。', price: 52, icon: 'SK', grantsSkill: 'tide-cut' },
    { id: 'frost-chip', kind: 'skill', name: '霜盾芯片', nameEn: 'Frost Chip', description: '解锁技能“霜盾”。', price: 58, icon: 'SK', grantsSkill: 'frost-ward' },
    { id: 'arc-chip', kind: 'skill', name: '弧光芯片', nameEn: 'Arc Chip', description: '解锁技能“弧光过载”。', price: 72, icon: 'SK', grantsSkill: 'arc-burst' },
    { id: 'pioneer-blade', kind: 'weapon', name: '先遣短刃', nameEn: 'Pioneer Blade', description: '攻击 +4；先遣套装部件。', price: 65, icon: 'WPN', slot: 'weapon', setId: 'pioneer', effects: { attack: 4, damageBonus: { physical: 10 } } },
    { id: 'ember-lance', kind: 'weapon', name: '熔核长枪', nameEn: 'Ember Lance', description: '攻击 +6，火伤 +15%。', price: 105, icon: 'WPN', slot: 'weapon', effects: { attack: 6, damageBonus: { fire: 15 } } },
    { id: 'frost-cutter', kind: 'weapon', name: '霜线切割器', nameEn: 'Frostline Cutter', description: '攻击 +5，冰伤 +10%；霜线套装部件。', price: 98, icon: 'WPN', slot: 'weapon', setId: 'frostline', effects: { attack: 5, damageBonus: { ice: 10 } } },
    { id: 'pioneer-coat', kind: 'armor', name: '先遣外套', nameEn: 'Pioneer Coat', description: '防御 +3，生命 +15；先遣套装部件。', price: 75, icon: 'ARM', slot: 'armor', setId: 'pioneer', effects: { defense: 3, maxHp: 15 } },
    { id: 'frost-plate', kind: 'armor', name: '霜线护甲', nameEn: 'Frostline Plate', description: '防御 +5，生命 +20。', price: 112, icon: 'ARM', slot: 'armor', setId: 'frostline', effects: { defense: 5, maxHp: 20 } },
    { id: 'relay-module', kind: 'accessory', name: '中继模组', nameEn: 'Relay Module', description: '生命 +10，防御 +2。', price: 88, icon: 'ACC', slot: 'accessory', effects: { maxHp: 10, defense: 2 } },
    { id: 'field-ration', kind: 'food', name: '行动口粮', nameEn: 'Field Ration', description: '恢复 25 HP 和 10 状态。', price: 12, icon: 'FOOD', effects: { heal: 25, condition: 10 } },
    { id: 'comfort-tea', kind: 'food', name: '安神热饮', nameEn: 'Comfort Tea', description: '恢复 30 状态。', price: 18, icon: 'FOOD', effects: { condition: 30 } },
    { id: 'training-pack', kind: 'food', name: '训练补给', nameEn: 'Training Pack', description: '下一场战斗攻击 +3、经验 +20%。', price: 26, icon: 'BUFF', effects: { attack: 3, xpBonus: 20 } },
  ],
  chapters: [
    { id: 'waste-relay', name: '第一章：废墟中继站', nameEn: 'CH.1 Wasteland Relay', summary: '清理失控设施并夺回中继节点。', enemies: [
      { id: 'scrap-drone', name: '废件巡游机', nameEn: 'Scrap Drone', element: 'electric', maxHp: 52, attack: 9, defense: 1, resistances: resist({ electric: -15, physical: 10 }), intents: [{ kind: 'attack', value: 8, type: 'physical', label: '切割 8', labelEn: 'Slash 8' }, { kind: 'guard', value: 7, type: 'electric', label: '电盾 7', labelEn: 'Volt Guard 7' }, { kind: 'attack', value: 11, type: 'electric', label: '放电 11', labelEn: 'Shock 11' }], xp: 24, coins: 12 },
      { id: 'crystal-hound', name: '结晶猎犬', nameEn: 'Crystal Hound', element: 'ice', maxHp: 76, attack: 11, defense: 2, resistances: resist({ ice: 25, fire: -20 }), intents: [{ kind: 'buff', value: 2, label: '蓄势 +2 攻', labelEn: 'Sharpen +2 ATK' }, { kind: 'attack', value: 13, type: 'ice', label: '冰咬 13', labelEn: 'Frost Bite 13' }, { kind: 'attack', value: 8, type: 'physical', label: '连扑 8', labelEn: 'Pounce 8' }], xp: 34, coins: 18 },
      { id: 'relay-overseer', name: '中继监管者', nameEn: 'Relay Overseer', element: 'fire', maxHp: 128, attack: 14, defense: 4, resistances: resist({ physical: 15, water: -15 }), intents: [{ kind: 'guard', value: 12, type: 'fire', label: '火盾 12', labelEn: 'Flame Barrier 12' }, { kind: 'attack', value: 14, type: 'fire', label: '热线 14', labelEn: 'Heat Ray 14' }, { kind: 'buff', value: 3, label: '超频 +3 攻', labelEn: 'Overclock +3 ATK' }, { kind: 'attack', value: 20, type: 'electric', label: '过载 20', labelEn: 'Overload 20' }], xp: 62, coins: 38, isBoss: true },
    ] },
    { id: 'frozen-quarry', name: '第二章：冻结采掘区', nameEn: 'CH.2 Frozen Quarry', summary: '穿越低温矿坑，处理异常核心。', enemies: [
      { id: 'mist-caster', name: '雾流术体', nameEn: 'Mist Caster', element: 'water', maxHp: 92, attack: 14, defense: 3, resistances: resist({ water: 25, electric: -15 }), intents: [{ kind: 'attack', value: 12, type: 'water', label: '潮涌 12', labelEn: 'Surge 12' }, { kind: 'guard', value: 9, type: 'water', label: '水幕 9', labelEn: 'Water Veil 9' }, { kind: 'attack', value: 17, type: 'ice', label: '凝结 17', labelEn: 'Freeze 17' }], xp: 46, coins: 24 },
      { id: 'furnace-shell', name: '熔炉重壳', nameEn: 'Furnace Shell', element: 'fire', maxHp: 145, attack: 16, defense: 7, resistances: resist({ fire: 40, water: -25 }), intents: [{ kind: 'guard', value: 15, type: 'fire', label: '火壳 15', labelEn: 'Flame Shell 15' }, { kind: 'attack', value: 18, type: 'fire', label: '喷焰 18', labelEn: 'Flame 18' }, { kind: 'attack', value: 10, type: 'physical', label: '碾压 10', labelEn: 'Crush 10' }], xp: 58, coins: 31 },
      { id: 'quarry-heart', name: '采掘区心脏', nameEn: 'Quarry Heart', element: 'ice', maxHp: 210, attack: 19, defense: 6, resistances: resist({ ice: 30, fire: -10, electric: -10 }), intents: [{ kind: 'buff', value: 4, label: '升压 +4 攻', labelEn: 'Pressure +4 ATK' }, { kind: 'attack', value: 16, type: 'ice', label: '寒潮 16', labelEn: 'Cold Wave 16' }, { kind: 'guard', value: 18, type: 'ice', label: '冰壁 18', labelEn: 'Ice Wall 18' }, { kind: 'attack', value: 25, type: 'physical', label: '坍塌 25', labelEn: 'Collapse 25' }], xp: 92, coins: 55, isBoss: true },
    ] },
  ],
};

const damageTypes: DamageType[] = ['physical', 'fire', 'water', 'ice', 'electric'];
export const normalizeContent = (input: unknown): GameContent => {
  if (!input || typeof input !== 'object') return DEFAULT_CONTENT;
  const value = input as Partial<GameContent>;
  if (!Array.isArray(value.skills) || !Array.isArray(value.items) || !Array.isArray(value.chapters) || !value.chapters.length) return DEFAULT_CONTENT;
  const chapters = value.chapters.filter((chapter) => chapter && Array.isArray(chapter.enemies) && chapter.enemies.length).map((chapter) => ({ ...chapter, enemies: chapter.enemies.map((enemy) => ({ ...enemy, element: enemy.element && damageTypes.includes(enemy.element) ? enemy.element : 'physical', resistances: { ...ZERO_RESISTANCE, ...(enemy.resistances ?? {}) }, intents: Array.isArray(enemy.intents) && enemy.intents.length ? enemy.intents.filter((intent) => intent && ['attack', 'guard', 'buff'].includes(intent.kind) && (!intent.type || damageTypes.includes(intent.type))) : [{ kind: 'attack' as const, value: 5, type: 'physical' as const, label: '攻击 5', labelEn: 'Attack 5' }] })) }));
  return chapters.length ? { version: Number(value.version) || 1, skills: value.skills, items: value.items, chapters } : DEFAULT_CONTENT;
};
