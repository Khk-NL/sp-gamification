export type DamageType = 'physical' | 'fire' | 'water' | 'ice' | 'electric';
export type ItemKind = 'skin' | 'skill' | 'weapon' | 'accessory' | 'food' | 'medicine';
export type EquipmentSlot = 'weapon' | 'accessory';
export type PlayMode = 'companion' | 'adventure';
export type AffinityStage = 'stranger' | 'familiar' | 'close' | 'trusted' | 'best_friend';

export interface CombatStats { maxHp: number; attack: number; defense: number; }
export interface SkillDefinition { id: string; name: string; nameEn: string; description: string; type: DamageType; cost: number; baseDamage: number; effect?: { type: 'heal'; value: number }; }
export interface ItemDefinition {
  id: string; kind: ItemKind; name: string; nameEn: string; description: string; price: number; icon: string;
  shop: 'supply' | 'map'; slot?: EquipmentSlot; grantsSkill?: string;
  combatEffect?: { type: 'element_damage' | 'boss_damage'; percent: 20; element?: DamageType } | { type: 'guard_element'; element: DamageType };
  growthEffect?: { type: 'xp' | 'coins'; percent: 10 };
  restore?: { hp?: number; condition?: number };
}
export interface EnemyDefinition { id: string; name: string; nameEn: string; attackElement: DamageType; defenseElement: DamageType; hpMultiplier: number; attackMultiplier: number; defenseMultiplier: number; rewardMultiplier: number; isBoss?: boolean; specialEffect?: { type: 'opening_damage'; value: number }; storyBefore?: string[]; storyAfter?: string[]; }
export interface ScaledEnemyDefinition extends EnemyDefinition { maxHp: number; attack: number; defense: number; xp: number; coins: number; }
export interface ChapterDefinition { id: string; name: string; nameEn: string; summary: string; enemies: EnemyDefinition[]; }
export interface BattleVisualDefinition { color: string; hitEffect: string; }
export interface GameContent { version: number; skills: SkillDefinition[]; items: ItemDefinition[]; chapters: ChapterDefinition[]; battleVisuals: Record<DamageType, BattleVisualDefinition>; }
export type RecruitmentRewardType = 'skill' | 'action' | 'expression' | 'bubble' | 'background' | 'effect' | 'story' | 'personality' | 'decoration';
export interface RecruitmentReward { id: string; name: string; type: RecruitmentRewardType; rarity: 'common' | 'rare'; skillId?: string; }

export type SPPetEventType = 'TASK_COMPLETED' | 'FOCUS_SESSION_FINISHED' | 'FOCUS_TIMER_COMPLETED' | 'DAILY_COMMISSION_COMPLETED' | 'COMMISSION_COMPLETED' | 'DAILY_CHECK_IN' | 'CHECK_IN' | 'COURSE_STARTING' | 'GOAL_PROGRESS_UPDATED' | 'IMPORTANT_DATE_APPROACHING' | 'JOURNAL_CREATED' | 'ITEM_USED' | 'PET_FED' | 'PET_TOUCHED' | 'BATTLE_STARTED' | 'BATTLE_WON' | 'BATTLE_LOST' | 'BATTLE_ADVANCED' | 'ENEMY_ACTION' | 'AFFINITY_CHANGED' | 'STATUS_CHANGED' | 'LEVEL_UP' | 'ACTIVE_WINDOW_CHANGED' | 'SYSTEM_LOAD_HIGH' | 'NETWORK_CHANGED' | 'STREAK_UPDATED' | 'MAP_REWARD_CLAIMED' | 'MAP_SHOP_OPENED' | 'MAP_SHOP_LEFT' | 'SKILL_USED' | 'CHAPTER_COMPLETED' | 'ITEM_PURCHASED' | 'ITEM_EQUIPPED' | 'SHOP_REFRESHED' | 'PET_CONDITION_CHANGED' | 'PLAY_MODE_CHANGED' | 'RECRUIT_TICKET_EARNED' | 'RECRUITMENT_RESULT' | 'DEBUG_XP' | 'DEBUG_COINS' | 'STATE_RESET';
export interface SPPetEvent { id: string; type: SPPetEventType; timestamp: string; payload: Record<string, string | number | boolean | null>; }
export interface BattleState {
  enemyId: string; enemyName: string; enemyAttackElement: DamageType; enemyDefenseElement: DamageType; enemyHp: number; enemyMaxHp: number; enemyDefense: number; enemyAttack: number; enemyXp: number; enemyCoins: number; isBoss: boolean;
  turn: number; resource: number; maxResource: number; lastSkillId: string | null; log: string[];
  phase: 'story_before' | 'combat' | 'story_after'; storyIndex: number; rewardsClaimed: boolean;
}
export interface SPPetState {
  version: 9; mode: PlayMode; level: number; xp: number; coins: number; streak: number; lastActiveDate: string | null; lastLoginDate: string | null;
  totalTasksCompleted: number; totalFocusMinutes: number; totalBattlesWon: number; today: { date: string; tasksCompleted: number; xpEarned: number; focusRewardSteps: number; focusTimerRewards: number };
  processedTaskIds: string[]; processedFocusSessionIds: string[]; observedFocusMinutesByTask: Record<string, number>;
  commissions: { date: string; tasks: { progress: number; target: number; claimed: boolean }; focus: { progress: number; target: number; claimed: boolean }; priority: { progress: number; target: number; claimed: boolean }; review: { progress: number; target: number; claimed: boolean } };
  checkIn: { lastDate: string | null; streak: number };
  pet: {
    name: string; condition: number; hp: number; baseStats: CombatStats; learnedSkills: string[]; equippedSkills: string[];
    affinity: { points: number; stage: AffinityStage; touchDate: string | null; touchesToday: number };
    inventory: Record<string, number>; equipped: Record<EquipmentSlot, string | null>; skinPart: string | null;
    lastConnectedAt: string; lastConditionDecayAt: string;
  };
  shop: { date: string; refreshCount: number; rotation: string[] };
  adventure: { chapterIndex: number; encounterIndex: number; claimedMapRewards: string[]; visitedMapShops: string[]; activeMapShopIndex: number | null; activeBattle: BattleState | null };
  recruitment: { tickets: number; pity: number; owned: string[]; ticketSources: string[]; weekly: { weekKey: string; completedDays: string[] } };
  updatedAt: string;
}
export interface EngineResult { state: SPPetState; events: SPPetEvent[]; }
export interface GameRules { commissionTaskTarget?: number; commissionTaskXp?: number; commissionFocusTarget?: number; commissionFocusXp?: number; commissionPriorityXp?: number; commissionReviewXp?: number; dailyXpCap?: number; disconnectDecayMinutes?: number; disconnectDecayAmount?: number; focusTimerDailyCap?: number; focusTimerXp?: number; focusTimerCoins?: number; focusTimerCondition?: number; }
export interface TaskCompletedInput { taskId: string; highPriority?: boolean; occurredAt?: Date | string | number; rules?: GameRules; }
export interface FocusTimeInput { minutes?: number; sourceId?: string; sourceTotalMinutes?: number; occurredAt?: Date | string | number; rules?: GameRules; }
export interface FocusSessionCompletedInput { sessionId: string; minutes: number; occurredAt?: Date | string | number; rules?: GameRules; }
