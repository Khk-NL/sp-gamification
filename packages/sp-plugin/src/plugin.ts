import {
  DEFAULT_CONTENT,
  EventBus,
  addDebugCoins,
  addDebugXp,
  advanceBattleStory,
  checkIn,
  claimMapReward,
  endTurn,
  getBattleStory,
  getComputedStats,
  hydrateState,
  importState,
  normalizeContent,
  onDayChecked,
  onDailyReviewCompleted,
  onFocusTimeAdded,
  onFocusSessionCompleted,
  onPetConnectionChecked,
  onPetTouched,
  onTaskCompleted,
  purchaseItem,
  equipItem,
  resetState,
  seedFocusTime,
  setEquippedSkills,
  setPlayMode,
  startBattle,
  startBattleAt,
  updatePetName,
  upgradeEquipment,
  upgradeSkill,
  refreshShop,
  useItem,
  useSkill,
  xpRequiredForLevel,
  createInitialState,
  type EngineResult,
  type GameContent,
  type GameRules,
  type SPPetEvent,
  type SPPetState,
  type PlayMode,
} from '@sppet/core';

const STATE_KEY = 'gamification-state-v1'; // Legacy key retained so v0.1/v0.2 upgrades keep their data.
const SETTINGS_KEY = 'sppet-settings-v1';
const CONTENT_KEY = 'sppet-content-v1';
const PET_BRIDGE_URL = 'ws://127.0.0.1:47821';
const SITE_ORIGIN = 'https://sppet.scsldr.cn';

interface PluginSettings extends GameRules {
  language: 'zh' | 'en';
  notifications: boolean;
  leaderboardSync: boolean;
  leaderboardNickname: string;
  leaderboardDeviceId: string;
  remoteContent: boolean;
  petIdleLines: string[];
  petClickLines: string[];
}

const defaultSettings = (): PluginSettings => ({
  language: 'zh', notifications: true, leaderboardSync: false, leaderboardNickname: '无名干员', leaderboardDeviceId: crypto.randomUUID(), remoteContent: false,
  commissionTaskTarget: 3, commissionTaskXp: 30, commissionFocusTarget: 60, commissionFocusXp: 30, commissionPriorityXp: 20, commissionReviewXp: 20, dailyXpCap: 100, disconnectDecayMinutes: 60, disconnectDecayAmount: 2,
  petIdleLines: ['休息一下也没关系。', '下一项行动，准备好了吗？', '我会在这里等你。'],
  petClickLines: ['收到！', '今天也要稳步推进。', '别忘了领取签到补给。'],
});

let state: SPPetState | null = null;
let settings: PluginSettings | null = null;
let content: GameContent | null = null;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let bridgeStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
let bridgeLastAck: string | null = null;
let pendingEvents: SPPetEvent[] = [];
let operationQueue: Promise<unknown> = Promise.resolve();
let lastLeaderboardSubmit = 0;

interface CoreEvents {
  TASK_COMPLETED: { taskId: string; highPriority: boolean; occurredAt?: Date | string | number };
  FOCUS_SESSION_FINISHED: { sourceId: string; sourceTotalMinutes: number };
  DESKTOP_FOCUS_COMPLETED: { sessionId: string; minutes: number; occurredAt?: string };
  DAILY_REVIEW_COMPLETED: { occurredAt?: Date | string | number };
  DAILY_CHECK_IN: Record<string, never>;
  PET_CONNECTION_CHANGED: { connected: boolean };
  PET_TOUCHED: Record<string, never>;
  PLAY_MODE_CHANGED: { mode: PlayMode };
  BATTLE_STARTED: { encounterIndex?: number };
  MAP_REWARD_CLAIMED: { rewardIndex: number };
  BATTLE_STORY_ADVANCED: { skip: boolean };
  SKILL_USED: { skillId: string };
  BATTLE_TURN_ENDED: Record<string, never>;
  SKILL_UPGRADED: { skillId: string };
  EQUIPMENT_UPGRADED: { itemId: string };
  SHOP_REFRESHED: Record<string, never>;
}
const coreEvents = new EventBus<CoreEvents>();

const queue = <T>(operation: () => Promise<T>): Promise<T> => { const next = operationQueue.then(operation, operation); operationQueue = next.catch((error) => console.error('[sppet] operation failed', error)); return next; };
const asInt = (value: unknown, fallback: number, min: number, max: number): number => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback; };
const lines = (value: unknown, fallback: string[]): string[] => Array.isArray(value) ? value.map(String).map((line) => line.trim()).filter(Boolean).slice(0, 20).map((line) => line.slice(0, 80)) : fallback;
const hydrateSettings = (input: unknown): PluginSettings => {
  const fallback = defaultSettings(); if (!input || typeof input !== 'object') return fallback; const value = input as Partial<PluginSettings>;
  return { language: value.language === 'en' ? 'en' : 'zh', notifications: value.notifications !== false, leaderboardSync: value.leaderboardSync === true, leaderboardNickname: typeof value.leaderboardNickname === 'string' && value.leaderboardNickname.trim() ? value.leaderboardNickname.trim().slice(0, 20) : fallback.leaderboardNickname, leaderboardDeviceId: typeof value.leaderboardDeviceId === 'string' && value.leaderboardDeviceId ? value.leaderboardDeviceId : fallback.leaderboardDeviceId, remoteContent: value.remoteContent === true,
    commissionTaskTarget: asInt(value.commissionTaskTarget, 3, 1, 20), commissionTaskXp: asInt(value.commissionTaskXp, 30, 1, 500), commissionFocusTarget: asInt(value.commissionFocusTarget, 60, 5, 600), commissionFocusXp: asInt(value.commissionFocusXp, 30, 1, 500), commissionPriorityXp: asInt(value.commissionPriorityXp, 20, 1, 500), commissionReviewXp: asInt(value.commissionReviewXp, 20, 1, 500), dailyXpCap: asInt(value.dailyXpCap, 100, 20, 500), disconnectDecayMinutes: asInt(value.disconnectDecayMinutes, 60, 15, 1440), disconnectDecayAmount: asInt(value.disconnectDecayAmount, 2, 1, 20), petIdleLines: lines(value.petIdleLines, fallback.petIdleLines), petClickLines: lines(value.petClickLines, fallback.petClickLines) };
};

const loadSettings = async (): Promise<PluginSettings> => { if (settings) return settings; const raw = await PluginAPI.loadSyncedData(SETTINGS_KEY); try { settings = hydrateSettings(raw ? JSON.parse(raw) : null); } catch { settings = defaultSettings(); } return settings; };
const loadContent = async (): Promise<GameContent> => { if (content) return content; const raw = await PluginAPI.loadSyncedData(CONTENT_KEY); try { content = raw ? normalizeContent(JSON.parse(raw)) : DEFAULT_CONTENT; } catch { content = DEFAULT_CONTENT; } return content; };
const loadState = async (): Promise<SPPetState> => { if (state) return state; const raw = await PluginAPI.loadSyncedData(STATE_KEY); try { state = raw ? hydrateState(JSON.parse(raw), undefined, await loadSettings()) : createInitialState(); } catch { state = createInitialState(); } return state; };

const scheduleReconnect = (): void => { if (reconnectTimer) return; reconnectTimer = setTimeout(() => { reconnectTimer = null; connectBridge(); }, 2000); };
const sendBridgeSnapshot = (): boolean => { if (!state || socket?.readyState !== WebSocket.OPEN) return false; socket.send(JSON.stringify({ type: 'SYNC', state, events: pendingEvents, petSettings: settings ? { idleLines: settings.petIdleLines, clickLines: settings.petClickLines } : undefined, sentAt: new Date().toISOString() })); return true; };
const registerConnection = (connected: boolean): void => { void coreEvents.emit('PET_CONNECTION_CHANGED', { connected }); };
const connectBridge = (): void => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return; bridgeStatus = 'connecting';
  try {
    socket = new WebSocket(PET_BRIDGE_URL);
    socket.addEventListener('open', () => { bridgeStatus = 'connected'; registerConnection(true); sendBridgeSnapshot(); });
    socket.addEventListener('message', (message) => { void (async () => { try { const payload = JSON.parse(String(message.data)); if (payload.type === 'ACK') { bridgeLastAck = typeof payload.receivedAt === 'string' ? payload.receivedAt : new Date().toISOString(); const received = new Set(Array.isArray(payload.eventIds) ? payload.eventIds : []); pendingEvents = pendingEvents.filter((entry) => !received.has(entry.id)); } else if (payload.type === 'PET_TOUCHED') await coreEvents.emit('PET_TOUCHED', {}); else if (payload.type === 'FOCUS_TIMER_COMPLETED') { const sessionId = String(payload.sessionId || ''); await coreEvents.emit('DESKTOP_FOCUS_COMPLETED', { sessionId, minutes: Number(payload.minutes), occurredAt: typeof payload.occurredAt === 'string' ? payload.occurredAt : undefined }); if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'DESKTOP_EVENT_ACK', eventType: payload.type, sessionId })); } } catch { /* Local malformed frames are ignored. */ } })(); });
    socket.addEventListener('close', () => { const wasConnected = bridgeStatus === 'connected'; bridgeStatus = 'disconnected'; socket = null; if (wasConnected) registerConnection(false); scheduleReconnect(); });
    socket.addEventListener('error', () => { bridgeStatus = 'disconnected'; });
  } catch { bridgeStatus = 'disconnected'; scheduleReconnect(); }
};
const bridgePublish = (events: SPPetEvent[]): void => { const byId = new Map(pendingEvents.map((entry) => [entry.id, entry])); for (const entry of events) byId.set(entry.id, entry); pendingEvents = [...byId.values()].slice(-100); if (!sendBridgeSnapshot()) connectBridge(); };

const notificationText = (entry: SPPetEvent, language: 'zh' | 'en'): string | null => {
  const p = entry.payload; if (language === 'en') { if (entry.type === 'COMMISSION_COMPLETED') return `Commission complete: +${p.xp} XP`; if (entry.type === 'LEVEL_UP') return `Level up! Lv.${p.level}, +${p.coins} coins`; if (entry.type === 'BATTLE_WON') return `Victory! +${p.xp} XP +${p.coins} coins`; if (entry.type === 'CHECK_IN') return `Check-in streak ${p.streak}: +${p.coins} coins`; }
  else { if (entry.type === 'COMMISSION_COMPLETED') return `委托完成，获得 ${p.xp} XP`; if (entry.type === 'LEVEL_UP') return `升级至 Lv.${p.level}，获得 ${p.coins} 金币`; if (entry.type === 'BATTLE_WON') return `战斗胜利！+${p.xp} XP +${p.coins} 金币`; if (entry.type === 'CHECK_IN') return `连续签到 ${p.streak} 天，获得 ${p.coins} 金币`; }
  return null;
};
const notifyEvents = async (events: SPPetEvent[]): Promise<void> => { const cfg = await loadSettings(); if (!cfg.notifications) return; for (const entry of events) { const body = notificationText(entry, cfg.language); if (body) await PluginAPI.notify({ title: 'SPPet', body }).catch(() => undefined); } };
const submitLeaderboard = async (snapshot: SPPetState, force = false): Promise<{ ok: boolean; error?: string }> => { const cfg = await loadSettings(); if (!cfg.leaderboardSync) return { ok: false, error: '排行榜同步未启用' }; if (!force && Date.now() - lastLeaderboardSubmit < 60_000) return { ok: true }; lastLeaderboardSubmit = Date.now(); try { await PluginAPI.request(`${SITE_ORIGIN}/api/leaderboard/submit`, { method: 'POST', timeout: 5000, body: { deviceId: cfg.leaderboardDeviceId, nickname: cfg.leaderboardNickname, level: snapshot.level, xp: snapshot.xp, streak: snapshot.streak, totalTasksCompleted: snapshot.totalTasksCompleted, totalFocusMinutes: snapshot.totalFocusMinutes, totalBattlesWon: snapshot.totalBattlesWon, updatedAt: snapshot.updatedAt } }); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; } };

const persist = async (result: EngineResult): Promise<SPPetState> => { state = result.state; await PluginAPI.persistDataSynced(JSON.stringify(state), STATE_KEY); bridgePublish(result.events); void notifyEvents(result.events); if (result.events.length) void submitLeaderboard(state); return state; };
const runEngine = (action: (current: SPPetState, cfg: PluginSettings, gameContent: GameContent) => EngineResult): Promise<SPPetState> => queue(async () => persist(action(await loadState(), await loadSettings(), await loadContent())));
const seedTask = (task: SpTask | null | undefined): Promise<SPPetState> => !task?.id ? loadState() : runEngine((current) => seedFocusTime(current, task.id, task.timeSpent / 60_000));

coreEvents.on('TASK_COMPLETED', async (payload) => { await runEngine((current, cfg) => onTaskCompleted(current, { ...payload, rules: cfg })); });
coreEvents.on('FOCUS_SESSION_FINISHED', async (payload) => { await runEngine((current, cfg) => onFocusTimeAdded(current, { ...payload, rules: cfg })); });
coreEvents.on('DESKTOP_FOCUS_COMPLETED', async (payload) => { await runEngine((current, cfg) => onFocusSessionCompleted(current, { ...payload, rules: cfg })); });
coreEvents.on('DAILY_REVIEW_COMPLETED', async (payload) => { await runEngine((current, cfg) => onDailyReviewCompleted(current, payload.occurredAt, cfg)); });
coreEvents.on('DAILY_CHECK_IN', async () => { await runEngine((current) => checkIn(current)); });
coreEvents.on('PET_CONNECTION_CHANGED', async (payload) => { await runEngine((current, cfg) => onPetConnectionChecked(current, payload.connected, undefined, cfg)); });
coreEvents.on('PET_TOUCHED', async () => { await runEngine((current) => onPetTouched(current)); });
coreEvents.on('PLAY_MODE_CHANGED', async (payload) => { await runEngine((current) => setPlayMode(current, payload.mode)); });
coreEvents.on('BATTLE_STARTED', async (payload) => { await runEngine((current, _cfg, gameContent) => payload.encounterIndex === undefined ? startBattle(current, gameContent) : startBattleAt(current, payload.encounterIndex, gameContent)); });
coreEvents.on('MAP_REWARD_CLAIMED', async (payload) => { await runEngine((current, _cfg, gameContent) => claimMapReward(current, payload.rewardIndex, gameContent)); });
coreEvents.on('BATTLE_STORY_ADVANCED', async (payload) => { await runEngine((current, _cfg, gameContent) => advanceBattleStory(current, payload.skip, gameContent)); });
coreEvents.on('SKILL_USED', async (payload) => { await runEngine((current, _cfg, gameContent) => useSkill(current, payload.skillId, gameContent)); });
coreEvents.on('BATTLE_TURN_ENDED', async () => { await runEngine((current, _cfg, gameContent) => endTurn(current, gameContent)); });
coreEvents.on('SKILL_UPGRADED', async (payload) => { await runEngine((current, _cfg, gameContent) => upgradeSkill(current, payload.skillId, gameContent)); });
coreEvents.on('EQUIPMENT_UPGRADED', async (payload) => { await runEngine((current, _cfg, gameContent) => upgradeEquipment(current, payload.itemId, gameContent)); });
coreEvents.on('SHOP_REFRESHED', async () => { await runEngine((current, _cfg, gameContent) => refreshShop(current, gameContent)); });

PluginAPI.registerHook(PluginAPI.Hooks.TASK_COMPLETE, async (payload) => { const task = payload?.task as SpTask | undefined; const tags = task?.resolvedTagNames ?? []; await coreEvents.emit('TASK_COMPLETED', { taskId: payload?.taskId ?? task?.id ?? '', highPriority: tags.some((tag) => /^(high|high priority|高优先级|重要)$/i.test(tag.trim())), occurredAt: payload?.task?.doneOn ?? Date.now() }); });
PluginAPI.registerHook(PluginAPI.Hooks.TASK_UPDATE, async (payload) => { const task = payload?.task as SpTask | undefined; if (!task?.id || !Object.prototype.hasOwnProperty.call(payload?.changes ?? {}, 'timeSpent')) return; await coreEvents.emit('FOCUS_SESSION_FINISHED', { sourceId: task.id, sourceTotalMinutes: task.timeSpent / 60_000 }); });
PluginAPI.registerHook(PluginAPI.Hooks.TASK_CREATED, async (payload) => { await seedTask(payload?.task); });
PluginAPI.registerHook(PluginAPI.Hooks.CURRENT_TASK_CHANGE, async (payload) => { await seedTask(payload?.previous); await seedTask(payload?.current); });
PluginAPI.registerHook(PluginAPI.Hooks.FINISH_DAY, async (payload) => { await coreEvents.emit('DAILY_REVIEW_COMPLETED', { occurredAt: payload?.date ?? Date.now() }); });
PluginAPI.registerHook(PluginAPI.Hooks.PERSISTED_DATA_CHANGED, async () => { const raw = await PluginAPI.loadSyncedData(STATE_KEY); if (!raw) return; try { const incoming = hydrateState(JSON.parse(raw), undefined, await loadSettings()); if (!state || incoming.updatedAt > state.updatedAt) { state = incoming; bridgePublish([]); } } catch { /* Keep last valid state. */ } });
PluginAPI.registerHook(PluginAPI.Hooks.LANGUAGE_CHANGE, () => undefined);

const responseState = async () => { const cfg = await loadSettings(); const gameContent = await loadContent(); const dayResult = onDayChecked(await loadState(), undefined, cfg); const connectionResult = onPetConnectionChecked(dayResult.state, bridgeStatus === 'connected', undefined, cfg); const events = [...dayResult.events, ...connectionResult.events]; if (events.length) await persist({ state: connectionResult.state, events }); else state = connectionResult.state; const snapshot = state!; return { ok: true, state: snapshot, settings: cfg, content: gameContent, computedStats: getComputedStats(snapshot, gameContent), nextLevelXp: xpRequiredForLevel(snapshot.level), battleStory: snapshot.adventure.activeBattle ? getBattleStory(snapshot, gameContent) : null, bridge: { status: bridgeStatus, url: PET_BRIDGE_URL, lastAck: bridgeLastAck, pendingEvents: pendingEvents.length }, site: { home: SITE_ORIGIN, leaderboard: `${SITE_ORIGIN}/`, tools: `${SITE_ORIGIN}/tools.html`, developer: `${SITE_ORIGIN}/developer.html` } }; };
const refreshRemoteContent = async (): Promise<{ ok: boolean; error?: string }> => { try { const incoming = await PluginAPI.request(`${SITE_ORIGIN}/api/content`, { timeout: 5000 }); content = normalizeContent(incoming); await PluginAPI.persistDataSynced(JSON.stringify(content), CONTENT_KEY); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; } };

PluginAPI.onMessage?.(async (message: unknown) => {
  if (!message || typeof message !== 'object') return { ok: false, error: '消息格式无效' }; const data = message as Record<string, unknown>;
  try {
    switch (data.type) {
      case 'getState': return queue(responseState);
      case 'checkIn': await coreEvents.emit('DAILY_CHECK_IN', {}); break;
      case 'touchPet': await coreEvents.emit('PET_TOUCHED', {}); break;
      case 'setPlayMode': await coreEvents.emit('PLAY_MODE_CHANGED', { mode: data.mode === 'companion' ? 'companion' : 'adventure' }); break;
      case 'startBattle': await coreEvents.emit('BATTLE_STARTED', {}); break;
      case 'startBattleAt': await coreEvents.emit('BATTLE_STARTED', { encounterIndex: Number(data.encounterIndex) }); break;
      case 'claimMapReward': await coreEvents.emit('MAP_REWARD_CLAIMED', { rewardIndex: Number(data.rewardIndex) }); break;
      case 'advanceStory': await coreEvents.emit('BATTLE_STORY_ADVANCED', { skip: Boolean(data.skip) }); break;
      case 'useSkill': await coreEvents.emit('SKILL_USED', { skillId: String(data.skillId ?? '') }); break;
      case 'endTurn': await coreEvents.emit('BATTLE_TURN_ENDED', {}); break;
      case 'upgradeSkill': await coreEvents.emit('SKILL_UPGRADED', { skillId: String(data.skillId ?? '') }); break;
      case 'upgradeEquipment': await coreEvents.emit('EQUIPMENT_UPGRADED', { itemId: String(data.itemId ?? '') }); break;
      case 'refreshShop': await coreEvents.emit('SHOP_REFRESHED', {}); break;
      case 'setEquippedSkills': await runEngine((current, _cfg, gameContent) => setEquippedSkills(current, Array.isArray(data.skillIds) ? data.skillIds.map(String) : [], gameContent)); break;
      case 'purchaseItem': await runEngine((current, _cfg, gameContent) => purchaseItem(current, String(data.itemId ?? ''), gameContent)); break;
      case 'equipItem': await runEngine((current, _cfg, gameContent) => equipItem(current, String(data.itemId ?? ''), gameContent)); break;
      case 'useItem': await runEngine((current, _cfg, gameContent) => useItem(current, String(data.itemId ?? ''), gameContent)); break;
      case 'savePetSettings': {
        const cfg = await loadSettings(); settings = hydrateSettings({ ...cfg, petIdleLines: String(data.idleLines ?? '').split('\n'), petClickLines: String(data.clickLines ?? '').split('\n') }); await PluginAPI.persistDataSynced(JSON.stringify(settings), SETTINGS_KEY); await runEngine((current) => updatePetName(current, String(data.petName ?? ''))); break;
      }
      case 'saveSettings': settings = hydrateSettings({ ...(await loadSettings()), ...(data.settings as object ?? {}) }); await PluginAPI.persistDataSynced(JSON.stringify(settings), SETTINGS_KEY); bridgePublish([]); break;
      case 'testBridge': bridgePublish([]); await new Promise((resolve) => setTimeout(resolve, 300)); break;
      case 'exportState': return { ok: true, state: await loadState() };
      case 'importState': await queue(async () => persist(importState(data.state))); break;
      case 'refreshContent': { const refreshed = await refreshRemoteContent(); if (!refreshed.ok) return refreshed; break; }
      case 'submitLeaderboard': { const submitted = await submitLeaderboard(await loadState(), true); if (!submitted.ok) return submitted; break; }
      case 'debugAddXp': await runEngine((current) => addDebugXp(current)); break;
      case 'debugAddCoins': await runEngine((current) => addDebugCoins(current)); break;
      case 'resetState': await queue(async () => persist(resetState())); break;
      default: return { ok: false, error: '未知操作' };
    }
    return responseState();
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
});

const initialize = async (): Promise<void> => { await queue(async () => { await loadSettings(); await loadContent(); const dayResult = onDayChecked(await loadState(), undefined, settings!); let current = dayResult.state; for (const task of await PluginAPI.getTasks()) current = seedFocusTime(current, task.id, task.timeSpent / 60_000).state; await persist({ state: current, events: dayResult.events }); }); connectBridge(); if ((await loadSettings()).remoteContent) void refreshRemoteContent(); };
PluginAPI.onUnload?.(() => { if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = null; socket?.close(); socket = null; });
if (PluginAPI.onReady) PluginAPI.onReady(initialize); else void initialize();
