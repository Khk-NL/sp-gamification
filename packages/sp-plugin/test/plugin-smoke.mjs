import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pluginPath = new URL('../dist/plugin.js', import.meta.url);
const uiHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const uiScript = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
assert.match(uiHtml, /<style data-sppet-style="base">/);
assert.match(uiHtml, /<style data-sppet-style="theme">/);
assert.match(uiHtml, /<script data-sppet-script="ui">/);
assert.doesNotMatch(uiHtml, /(?:href|src)="\.\/(?:index|archive-theme)/);
assert.ok(Buffer.byteLength(uiHtml, 'utf8') <= 100 * 1024);
assert.doesNotMatch(uiScript, /PluginAPI\./);
assert.match(uiHtml, /Arial Black/);
assert.match(uiHtml, /#63b84c/i);
assert.match(uiHtml, /data:image\/png;base64/);
assert.match(uiHtml, /id="world-map"/);
assert.equal((uiHtml.match(/data-tab=/g) || []).length, 3);
const hooks = new Map();
const persisted = new Map();
let readyHandler;
let messageHandler;

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  constructor() { this.readyState = MockWebSocket.OPEN; this.listeners = new Map(); setTimeout(() => this.listeners.get('open')?.(), 0); }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  send(raw) { const message = JSON.parse(raw); if (message.type === 'SYNC') setTimeout(() => this.listeners.get('message')?.({ data: JSON.stringify({ type: 'ACK', eventIds: message.events.map((entry) => entry.id), receivedAt: new Date().toISOString() }) }), 0); }
  close() { this.readyState = 3; }
}

const PluginAPI = {
  Hooks: { TASK_COMPLETE: 'taskComplete', TASK_UPDATE: 'taskUpdate', TASK_CREATED: 'taskCreated', CURRENT_TASK_CHANGE: 'currentTaskChange', FINISH_DAY: 'finishDay', PERSISTED_DATA_CHANGED: 'persistedDataChanged', LANGUAGE_CHANGE: 'languageChange' },
  registerHook: (name, handler) => hooks.set(name, handler),
  loadSyncedData: async (key) => persisted.get(key) ?? null,
  persistDataSynced: async (data, key) => persisted.set(key, data),
  getTasks: async () => [{ id: 'existing', title: 'Existing', timeSpent: 0, isDone: false }],
  showSnack: () => {}, notify: async () => {}, request: async () => ({ entries: [] }), downloadFile: async () => {},
  onReady: (handler) => { readyHandler = handler; }, onMessage: (handler) => { messageHandler = handler; }, onUnload: () => {},
};

const source = await readFile(pluginPath, 'utf8');
vm.runInNewContext(source, { PluginAPI, WebSocket: MockWebSocket, console, crypto: globalThis.crypto, setTimeout, clearTimeout });
assert.equal(typeof readyHandler, 'function'); assert.equal(typeof messageHandler, 'function'); await readyHandler();
const completed = (id) => ({ taskId: id, task: { id, title: 'Smoke task', timeSpent: 0, isDone: true, doneOn: Date.now() } });
await hooks.get('taskComplete')(completed('task-1')); await hooks.get('taskComplete')(completed('task-1')); await hooks.get('taskComplete')(completed('task-2')); await hooks.get('taskComplete')(completed('task-3'));
await hooks.get('taskUpdate')({ taskId: 'existing', task: { id: 'existing', title: 'Existing', timeSpent: 50 * 60_000, isDone: false }, changes: { timeSpent: 50 * 60_000 } });
const response = await messageHandler({ type: 'getState' }); const state = response.state;
assert.equal(state.totalTasksCompleted, 3); assert.equal(state.coins, 9); assert.equal(state.totalFocusMinutes, 50); assert.equal(state.xp, 30); assert.equal(state.adventure.activeBattle, null);
const reward = await messageHandler({ type: 'claimMapReward', rewardIndex: 0 }); assert.equal(reward.state.coins, 13);
const loadout = await messageHandler({ type: 'setEquippedSkills', skillIds: ['strike'] }); assert.equal(loadout.state.pet.equippedSkills.join(','), 'strike');
const battle = await messageHandler({ type: 'startBattleAt', encounterIndex: 1 }); assert.equal(battle.state.adventure.activeBattle.phase, 'story_before'); assert.equal(battle.state.adventure.activeBattle.resource, 5);
await messageHandler({ type: 'advanceStory', skip: true }); const skill = await messageHandler({ type: 'useSkill', skillId: 'strike' }); assert.equal(skill.state.adventure.activeBattle.turn, 1); assert.equal(skill.state.adventure.activeBattle.resource, 4); const ended = await messageHandler({ type: 'endTurn' }); assert.equal(ended.state.adventure.activeBattle.turn, 2); assert.equal(ended.state.adventure.activeBattle.resource, 5);
assert.equal(JSON.parse(persisted.get('gamification-state-v1')).version, 6);
console.log('SP plugin smoke test passed');
