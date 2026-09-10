import {
  ADVENTURE_ZONES,
  SHOP_ITEMS,
  addDebugCoins,
  addDebugXp,
  createInitialState,
  equipItem,
  hydrateState,
  onDayChecked,
  onFocusTimeAdded,
  onTaskCompleted,
  purchaseItem,
  resetState,
  seedFocusTime,
  xpRequiredForLevel,
  type EngineResult,
  type GamificationEvent,
  type GamificationState,
  type RewardRules,
} from '@sp-gamification/core';

const STATE_KEY = 'gamification-state-v1';
const SETTINGS_KEY = 'gamification-settings-v1';
const PET_BRIDGE_URL = 'ws://127.0.0.1:47821';
const LEADERBOARD_ORIGIN = 'https://sppet.scsldr.cn';

interface PluginSettings extends RewardRules {
  language: 'zh' | 'en';
  notifications: boolean;
  leaderboardEnabled: boolean;
  leaderboardNickname: string;
  leaderboardDeviceId: string;
}

const defaultSettings = (): PluginSettings => ({
  language: 'zh',
  notifications: true,
  leaderboardEnabled: false,
  leaderboardNickname: '无名冒险者',
  leaderboardDeviceId: crypto.randomUUID(),
  taskXp: 10,
  taskCoins: 5,
  focusBlockMinutes: 25,
  focusBlockXp: 5,
  tagDamage: { hard: 20, 'deep-work': 15, 困难: 20, 深度工作: 15 },
});

let state: GamificationState | null = null;
let settings: PluginSettings | null = null;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let bridgeStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
let bridgeLastAck: string | null = null;
let pendingEvents: GamificationEvent[] = [];
let operationQueue: Promise<unknown> = Promise.resolve();
let lastLeaderboardSubmit = 0;

const queue = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = operationQueue.then(operation, operation);
  operationQueue = next.catch((error) => console.error('[sp-gamification] operation failed', error));
  return next;
};

const asInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};

const hydrateSettings = (value: unknown): PluginSettings => {
  const defaults = defaultSettings();
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Partial<PluginSettings>;
  return {
    language: raw.language === 'en' ? 'en' : 'zh',
    notifications: raw.notifications !== false,
    leaderboardEnabled: raw.leaderboardEnabled === true,
    leaderboardNickname: typeof raw.leaderboardNickname === 'string' && raw.leaderboardNickname.trim() ? raw.leaderboardNickname.trim().slice(0, 20) : defaults.leaderboardNickname,
    leaderboardDeviceId: typeof raw.leaderboardDeviceId === 'string' && raw.leaderboardDeviceId ? raw.leaderboardDeviceId : defaults.leaderboardDeviceId,
    taskXp: asInt(raw.taskXp, 10, 1, 100),
    taskCoins: asInt(raw.taskCoins, 5, 1, 100),
    focusBlockMinutes: asInt(raw.focusBlockMinutes, 25, 5, 120),
    focusBlockXp: asInt(raw.focusBlockXp, 5, 1, 100),
    tagDamage: raw.tagDamage && typeof raw.tagDamage === 'object' ? raw.tagDamage : defaults.tagDamage,
  };
};

const loadState = async (): Promise<GamificationState> => {
  if (state) return state;
  const raw = await PluginAPI.loadSyncedData(STATE_KEY);
  try { state = raw ? hydrateState(JSON.parse(raw)) : createInitialState(); }
  catch { state = createInitialState(); }
  return state;
};

const loadSettings = async (): Promise<PluginSettings> => {
  if (settings) return settings;
  const raw = await PluginAPI.loadSyncedData(SETTINGS_KEY);
  try { settings = hydrateSettings(raw ? JSON.parse(raw) : null); }
  catch { settings = defaultSettings(); }
  return settings;
};

const scheduleReconnect = (): void => {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connectBridge(); }, 2000);
};

const sendBridgeSnapshot = (): boolean => {
  if (!state || socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify({ type: 'SYNC', state, events: pendingEvents, sentAt: new Date().toISOString() }));
  return true;
};

const connectBridge = (): void => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  bridgeStatus = 'connecting';
  try {
    socket = new WebSocket(PET_BRIDGE_URL);
    socket.addEventListener('open', () => { bridgeStatus = 'connected'; sendBridgeSnapshot(); });
    socket.addEventListener('message', (message) => {
      try {
        const payload = JSON.parse(String(message.data));
        if (payload.type === 'ACK') {
          bridgeLastAck = typeof payload.receivedAt === 'string' ? payload.receivedAt : new Date().toISOString();
          const received = new Set(Array.isArray(payload.eventIds) ? payload.eventIds : []);
          pendingEvents = pendingEvents.filter((entry) => !received.has(entry.id));
        }
      } catch { /* Ignore malformed local bridge frames. */ }
    });
    socket.addEventListener('close', () => { bridgeStatus = 'disconnected'; socket = null; scheduleReconnect(); });
    socket.addEventListener('error', () => { bridgeStatus = 'disconnected'; });
  } catch {
    bridgeStatus = 'disconnected';
    scheduleReconnect();
  }
};

const bridgePublish = (events: GamificationEvent[]): void => {
  const byId = new Map(pendingEvents.map((entry) => [entry.id, entry]));
  for (const entry of events) byId.set(entry.id, entry);
  pendingEvents = [...byId.values()].slice(-100);
  if (!sendBridgeSnapshot()) connectBridge();
};

const notificationText = (entry: GamificationEvent, language: 'zh' | 'en'): string | null => {
  const p = entry.payload;
  if (language === 'en') {
    if (entry.type === 'TASK_COMPLETED') return `Task complete! +${p.xp} XP +${p.coins} coins`;
    if (entry.type === 'LEVEL_UP') return `Level up! You are now Lv.${p.level}`;
    if (entry.type === 'FOCUS_REWARD') return `${p.focusMinutes} focused minutes: +${p.xp} XP`;
    if (entry.type === 'BOSS_DEFEATED') return `${p.boss} defeated! +25 XP +${p.coins} coins`;
  } else {
    if (entry.type === 'TASK_COMPLETED') return `任务完成！+${p.xp} XP +${p.coins} 金币`;
    if (entry.type === 'LEVEL_UP') return `升级啦！当前等级 Lv.${p.level}`;
    if (entry.type === 'FOCUS_REWARD') return `专注 ${p.focusMinutes} 分钟，获得 +${p.xp} XP`;
    if (entry.type === 'BOSS_DEFEATED') return `击败 ${p.boss}！+25 XP +${p.coins} 金币`;
  }
  return null;
};

const notifyEvents = async (events: GamificationEvent[]): Promise<void> => {
  const cfg = await loadSettings();
  if (!cfg.notifications) return;
  for (const entry of events) {
    const body = notificationText(entry, cfg.language);
    if (body) await PluginAPI.notify({ title: cfg.language === 'en' ? 'Pixel Quest' : '像素远征', body }).catch(() => undefined);
  }
};

const submitLeaderboard = async (snapshot: GamificationState, force = false): Promise<{ ok: boolean; error?: string }> => {
  const cfg = await loadSettings();
  if (!cfg.leaderboardEnabled) return { ok: false, error: cfg.language === 'en' ? 'Leaderboard is disabled' : '排行榜未启用' };
  if (!force && Date.now() - lastLeaderboardSubmit < 30_000) return { ok: true };
  lastLeaderboardSubmit = Date.now();
  try {
    await PluginAPI.request(`${LEADERBOARD_ORIGIN}/api/leaderboard/submit`, {
      method: 'POST', timeout: 5000,
      body: { deviceId: cfg.leaderboardDeviceId, nickname: cfg.leaderboardNickname, level: snapshot.level, xp: snapshot.xp, streak: snapshot.streak, totalTasksCompleted: snapshot.totalTasksCompleted, totalFocusMinutes: snapshot.totalFocusMinutes, updatedAt: snapshot.updatedAt },
    });
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
};

const persist = async (result: EngineResult): Promise<GamificationState> => {
  state = result.state;
  await PluginAPI.persistDataSynced(JSON.stringify(state), STATE_KEY);
  bridgePublish(result.events);
  void notifyEvents(result.events);
  if (result.events.length) void submitLeaderboard(state);
  return state;
};

const runEngine = (action: (current: GamificationState, rules: PluginSettings) => EngineResult): Promise<GamificationState> => queue(async () => persist(action(await loadState(), await loadSettings())));
const seedTask = (task: SpTask | null | undefined): Promise<GamificationState> => !task?.id ? loadState() : runEngine((current) => seedFocusTime(current, task.id, task.timeSpent / 60_000));

PluginAPI.registerHook(PluginAPI.Hooks.TASK_COMPLETE, async (payload) => {
  const task = payload?.task as SpTask | undefined;
  await runEngine((current, rules) => onTaskCompleted(current, { taskId: payload?.taskId ?? task?.id ?? '', title: task?.title, tags: task?.resolvedTagNames, occurredAt: payload?.task?.doneOn ?? Date.now(), rules }));
});
PluginAPI.registerHook(PluginAPI.Hooks.TASK_UPDATE, async (payload) => {
  const task = payload?.task as SpTask | undefined;
  if (!task?.id || !Object.prototype.hasOwnProperty.call(payload?.changes ?? {}, 'timeSpent')) return;
  await runEngine((current, rules) => onFocusTimeAdded(current, { sourceId: task.id, sourceTotalMinutes: task.timeSpent / 60_000, rules }));
});
PluginAPI.registerHook(PluginAPI.Hooks.TASK_CREATED, async (payload) => { await seedTask(payload?.task); });
PluginAPI.registerHook(PluginAPI.Hooks.CURRENT_TASK_CHANGE, async (payload) => { await seedTask(payload?.previous); await seedTask(payload?.current); });
PluginAPI.registerHook(PluginAPI.Hooks.FINISH_DAY, async (payload) => { await runEngine((current) => onDayChecked(current, payload?.date ?? Date.now())); });
PluginAPI.registerHook(PluginAPI.Hooks.PERSISTED_DATA_CHANGED, async () => {
  const raw = await PluginAPI.loadSyncedData(STATE_KEY); if (!raw) return;
  try { const incoming = hydrateState(JSON.parse(raw)); if (!state || incoming.updatedAt > state.updatedAt) { state = incoming; bridgePublish([]); } } catch { /* Keep valid state. */ }
});
PluginAPI.registerHook(PluginAPI.Hooks.LANGUAGE_CHANGE, () => undefined);

const responseState = async () => {
  const snapshot = onDayChecked(await loadState()).state; state = snapshot;
  return { ok: true, state: snapshot, settings: await loadSettings(), nextLevelXp: xpRequiredForLevel(snapshot.level), shopItems: SHOP_ITEMS, zones: ADVENTURE_ZONES, bridge: { status: bridgeStatus, url: PET_BRIDGE_URL, lastAck: bridgeLastAck, pendingEvents: pendingEvents.length }, leaderboardOrigin: LEADERBOARD_ORIGIN };
};

PluginAPI.onMessage?.(async (message: unknown) => {
  if (!message || typeof message !== 'object') return { ok: false, error: '消息格式无效' };
  const data = message as Record<string, unknown>;
  switch (data.type) {
    case 'getState': return queue(responseState);
    case 'debugAddXp': await runEngine((current) => addDebugXp(current)); return responseState();
    case 'debugAddCoins': await runEngine((current) => addDebugCoins(current)); return responseState();
    case 'debugCompleteTask': await runEngine((current, rules) => onTaskCompleted(current, { taskId: `debug-${crypto.randomUUID()}`, title: 'Debug Quest', rules })); return responseState();
    case 'resetState': await queue(async () => persist(resetState())); return responseState();
    case 'purchaseItem': await runEngine((current) => purchaseItem(current, String(data.itemId ?? ''))); return responseState();
    case 'equipItem': await runEngine((current) => equipItem(current, data.itemId === null ? null : String(data.itemId ?? ''))); return responseState();
    case 'saveSettings': {
      settings = hydrateSettings({ ...(await loadSettings()), ...(data.settings as object ?? {}) });
      await PluginAPI.persistDataSynced(JSON.stringify(settings), SETTINGS_KEY);
      return responseState();
    }
    case 'testBridge': bridgePublish([]); await new Promise((resolve) => setTimeout(resolve, 250)); return responseState();
    case 'submitLeaderboard': {
      const submitted = await submitLeaderboard(await loadState(), true);
      const response = await responseState();
      return { ...response, ...submitted };
    }
    case 'getLeaderboard': {
      try { const leaderboard = await PluginAPI.request(`${LEADERBOARD_ORIGIN}/api/leaderboard`, { timeout: 5000 }); return { ok: true, leaderboard }; }
      catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
    }
    default: return { ok: false, error: '未知操作' };
  }
});

const initialize = async (): Promise<void> => {
  await queue(async () => {
    await loadSettings(); let current = onDayChecked(await loadState()).state;
    for (const task of await PluginAPI.getTasks()) current = seedFocusTime(current, task.id, task.timeSpent / 60_000).state;
    await persist({ state: current, events: [] });
  });
  connectBridge();
};

PluginAPI.onUnload?.(() => { if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = null; socket?.close(); socket = null; });
if (PluginAPI.onReady) PluginAPI.onReady(initialize); else void initialize();
