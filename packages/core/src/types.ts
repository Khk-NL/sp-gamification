export type DamageType = 'physical' | 'fire' | 'water' | 'ice' | 'electric';
export type ItemKind = 'skin' | 'skill' | 'weapon' | 'armor' | 'accessory' | 'food';
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface Resistances { physical: number; fire: number; water: number; ice: number; electric: number; }
export interface CombatStats { maxHp: number; attack: number; defense: number; resistances: Resistances; damageBonus: Partial<Record<DamageType, number>>; }
export interface SkillDefinition { id: string; name: string; nameEn: string; description: string; cost: number; type: DamageType; power?: number; block?: number; heal?: number; burn?: number; weaken?: number; }
export interface ItemDefinition {
  id: string; kind: ItemKind; name: string; nameEn: string; description: string; price: number; icon: string;
  slot?: EquipmentSlot; setId?: string; grantsSkill?: string;
  effects?: { maxHp?: number; attack?: number; defense?: number; resistance?: Partial<Resistances>; damageBonus?: Partial<Record<DamageType, number>>; heal?: number; condition?: number; xpBonus?: number; coinBonus?: number; };
}
export interface EnemyIntent { kind: 'attack' | 'guard' | 'buff'; value: number; type?: DamageType; label: string; labelEn: string; }
export interface EnemyDefinition { id: string; name: string; nameEn: string; element?: DamageType; maxHp: number; attack: number; defense: number; resistances: Resistances; intents: EnemyIntent[]; xp: number; coins: number; isBoss?: boolean; storyBefore?: string[]; storyAfter?: string[]; }
export interface ChapterDefinition { id: string; name: string; nameEn: string; summary: string; enemies: EnemyDefinition[]; }
export interface GameContent { version: number; skills: SkillDefinition[]; items: ItemDefinition[]; chapters: ChapterDefinition[]; }

export type SPPetEventType = 'TASK_COMPLETED' | 'COMMISSION_COMPLETED' | 'LEVEL_UP' | 'STREAK_UPDATED' | 'CHECK_IN' | 'MAP_REWARD_CLAIMED' | 'BATTLE_STARTED' | 'SKILL_USED' | 'ENEMY_ACTION' | 'BATTLE_WON' | 'BATTLE_LOST' | 'CHAPTER_COMPLETED' | 'ITEM_PURCHASED' | 'ITEM_EQUIPPED' | 'ITEM_USED' | 'PET_CONDITION_CHANGED' | 'DEBUG_XP' | 'DEBUG_COINS' | 'STATE_RESET';
export interface SPPetEvent { id: string; type: SPPetEventType; timestamp: string; payload: Record<string, string | number | boolean | null>; }
export interface BattleState {
  enemyId: string; enemyName: string; enemyHp: number; enemyMaxHp: number; enemyDefense: number; enemyResistances: Resistances;
  enemyAttack: number; enemyBlock: number; enemyBlockType: DamageType | null; enemyAttackBuff: number; playerBlock: number; playerBlockType: DamageType | null; enemyBurn: number; enemyWeaken: number;
  turn: number; resource: number; maxResource: number; intentIndex: number; log: string[];
  actionsThisTurn: number;
  phase: 'story_before' | 'combat' | 'story_after'; storyIndex: number; rewardsClaimed: boolean;
}
export interface SPPetState {
  version: 3; level: number; xp: number; coins: number; streak: number; lastActiveDate: string | null; lastLoginDate: string | null;
  totalTasksCompleted: number; totalFocusMinutes: number; totalBattlesWon: number; today: { date: string; tasksCompleted: number };
  processedTaskIds: string[]; observedFocusMinutesByTask: Record<string, number>;
  commissions: { date: string; tasks: { progress: number; target: number; claimed: boolean }; focus: { progress: number; target: number; claimed: boolean } };
  checkIn: { lastDate: string | null; streak: number };
  pet: {
    name: string; condition: number; hp: number; baseStats: Omit<CombatStats, 'damageBonus'>; learnedSkills: string[]; equippedSkills: string[];
    inventory: Record<string, number>; equipped: Record<EquipmentSlot, string | null>; skinPart: string | null;
    buff: { xpBonus: number; coinBonus: number; attackBonus: number; battlesRemaining: number };
    lastConnectedAt: string; lastConditionDecayAt: string;
  };
  adventure: { chapterIndex: number; encounterIndex: number; claimedMapRewards: string[]; activeBattle: BattleState | null };
  updatedAt: string;
}
export interface EngineResult { state: SPPetState; events: SPPetEvent[]; }
export interface GameRules { commissionTaskTarget?: number; commissionTaskXp?: number; commissionFocusTarget?: number; commissionFocusXp?: number; disconnectDecayMinutes?: number; disconnectDecayAmount?: number; }
export interface TaskCompletedInput { taskId: string; occurredAt?: Date | string | number; rules?: GameRules; }
export interface FocusTimeInput { minutes?: number; sourceId?: string; sourceTotalMinutes?: number; occurredAt?: Date | string | number; rules?: GameRules; }
