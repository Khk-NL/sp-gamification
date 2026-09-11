const $ = (id) => document.getElementById(id);
let model = null;
let activeFilter = 'all';
let formsInitialized = false;

const copy = {
  zh: { overview:'概览',growth:'养成',adventure:'冒险',settings:'设置',coins:'金币',streak:'连续行动',tasks:'完成任务',focus:'专注分钟',commission:'今日委托',taskCommission:'完成任务',focusCommission:'专注行动',checkIn:'领取签到补给',attributes:'战斗属性',shop:'物资商店',petSettings:'宠物设置',petName:'宠物名称',idleLines:'闲置台词（每行一句）',clickLines:'左键台词（每行一句）',savePet:'保存宠物设置',deploy:'开始行动',skip:'跳过',next:'下一句',general:'插件设置',language:'语言',notify:'奖励提醒',taskTarget:'任务委托目标',taskXp:'任务委托 XP',focusTarget:'专注委托分钟',focusXp:'专注委托 XP',decayTime:'断连衰减间隔（分钟）',decayValue:'每次衰减状态',save:'保存设置',connection:'桌宠连接',testConnection:'测试连接状态',dataTools:'数据工具',export:'导出状态',import:'导入状态',refreshContent:'更新剧情与数值',online:'在线功能',rankSync:'启用排行榜数据同步',nickname:'公开昵称',remoteContent:'从网站获取剧情与数值',openRank:'打开排行榜网站 ↗',openTools:'打开状态工具 ↗',openDev:'打开开发者网站 ↗',debug:'开发调试区',reset:'重置状态' },
  en: { overview:'Overview',growth:'Growth',adventure:'Adventure',settings:'Settings',coins:'Coins',streak:'Streak',tasks:'Tasks',focus:'Focus minutes',commission:'Daily commissions',taskCommission:'Complete tasks',focusCommission:'Focus operation',checkIn:'Claim check-in supply',attributes:'Combat data',shop:'Supply store',petSettings:'Pet settings',petName:'Pet name',idleLines:'Idle lines (one per line)',clickLines:'Left-click lines (one per line)',savePet:'Save pet settings',deploy:'Start operation',skip:'Skip',next:'Next',general:'Plugin settings',language:'Language',notify:'Reward notifications',taskTarget:'Task target',taskXp:'Task commission XP',focusTarget:'Focus target (minutes)',focusXp:'Focus commission XP',decayTime:'Disconnect decay interval',decayValue:'Condition lost per interval',save:'Save settings',connection:'Pet connection',testConnection:'Test connection',dataTools:'Data tools',export:'Export state',import:'Import state',refreshContent:'Refresh story & balance',online:'Online services',rankSync:'Enable leaderboard sync',nickname:'Public nickname',remoteContent:'Load story and balance from site',openRank:'Open leaderboard ↗',openTools:'Open state tools ↗',openDev:'Open developer site ↗',debug:'Developer tools',reset:'Reset state' },
};
Object.assign(copy.zh, { battle: '战斗', mapHint: '点击可用节点继续探索；宝箱奖励每轮只能领取一次。', elementRules: '属性规则' });
Object.assign(copy.en, { battle: 'Battle', mapHint: 'Select an available node. Each supply chest can be claimed once per route.', elementRules: 'Element rules' });

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const messageId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('插件响应超时 / Plugin timeout')); }, 8000);
    const handler = (event) => { if (event.data?.type !== 'PLUGIN_MESSAGE_RESPONSE' || event.data?.messageId !== messageId) return; clearTimeout(timeout); window.removeEventListener('message', handler); resolve(event.data.result); };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'PLUGIN_MESSAGE', message: { type, ...payload }, messageId }, '*');
  });
}

const percent = (value, max) => `${Math.min(100, Math.max(0, max ? value / max * 100 : 0))}%`;
const language = () => model?.settings?.language === 'en' ? 'en' : 'zh';
const applyLanguage = () => { const lang = language(); document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; document.querySelectorAll('[data-t]').forEach((element) => { const value = copy[lang][element.dataset.t]; if (value) element.textContent = value; }); };
const itemName = (item) => language() === 'en' ? item.nameEn : item.name;
const enemyName = (enemy) => language() === 'en' ? enemy.nameEn : enemy.name;
const chapterName = (chapter) => language() === 'en' ? chapter.nameEn : chapter.name;

function renderOverview() {
  const state = model.state;
  $('level').textContent = String(state.level).padStart(2, '0'); $('pet-name').textContent = state.pet.name; $('coins').textContent = state.coins; $('streak').textContent = `${state.streak} DAY`; $('tasks').textContent = state.totalTasksCompleted; $('focus').textContent = state.totalFocusMinutes;
  $('xp-label').textContent = `${state.xp} / ${model.nextLevelXp} XP`; $('xp-bar').style.width = percent(state.xp, model.nextLevelXp);
  $('task-progress').textContent = `${state.commissions.tasks.progress} / ${state.commissions.tasks.target}`; $('task-bar').style.width = percent(state.commissions.tasks.progress, state.commissions.tasks.target);
  $('focus-progress').textContent = `${state.commissions.focus.progress} / ${state.commissions.focus.target} MIN`; $('focus-bar').style.width = percent(state.commissions.focus.progress, state.commissions.focus.target);
  $('check-in').disabled = state.checkIn.lastDate === state.today.date; $('check-in').querySelector('span').textContent = state.checkIn.lastDate === state.today.date ? (language() === 'en' ? 'Claimed today' : '今日已签到') : copy[language()].checkIn;
}

function renderGrowth() {
  const state = model.state, stats = model.computedStats;
  $('operator').className = `operator ${state.pet.skinPart || ''}`; $('condition').textContent = `CONDITION ${state.pet.condition}`; $('condition-bar').style.width = `${state.pet.condition}%`;
  $('hp').textContent = `${state.pet.hp} / ${stats.maxHp}`; $('attack').textContent = stats.attack; $('defense').textContent = stats.defense;
  const labels = { physical:'PHY',fire:'FIRE',water:'WATER',ice:'ICE',electric:'ELEC' }; $('resistances').replaceChildren(...Object.entries(stats.resistances).map(([type, value]) => { const span = document.createElement('span'); span.textContent = `${labels[type]} ${value >= 0 ? '+' : ''}${value}%`; return span; }));
  const equipment = state.pet.equipped; $('equipment').textContent = `WPN ${equipment.weapon || '--'} // ARM ${equipment.armor || '--'} // ACC ${equipment.accessory || '--'}`;
  renderShop();
}

function itemAction(item) {
  const state = model.state, count = state.pet.inventory[item.id] || 0;
  if (!count) return { label: language() === 'en' ? 'BUY' : '购买', action: 'purchaseItem' };
  if (item.kind === 'food') return { label: language() === 'en' ? `USE ×${count}` : `使用 ×${count}`, action: 'useItem' };
  if (item.kind === 'skill') return { label: language() === 'en' ? 'LEARNED' : '已学习', disabled: true };
  const equipped = item.kind === 'skin' ? state.pet.skinPart === item.id : item.slot && state.pet.equipped[item.slot] === item.id;
  return { label: equipped ? (language() === 'en' ? 'EQUIPPED' : '已装备') : (language() === 'en' ? 'EQUIP' : '装备'), action: 'equipItem', disabled: equipped };
}

function renderShop() {
  const root = $('shop'); root.replaceChildren();
  model.content.items.filter((item) => activeFilter === 'all' || item.kind === activeFilter).forEach((item) => {
    const card = document.createElement('article'); card.className = 'item'; const icon = document.createElement('div'); icon.className = 'item-icon'; icon.textContent = item.icon; const name = document.createElement('b'); name.textContent = itemName(item); const description = document.createElement('small'); description.textContent = item.description; const footer = document.createElement('footer'); const price = document.createElement('span'); price.textContent = `◈ ${item.price}`; const button = document.createElement('button'); const action = itemAction(item); button.textContent = action.label; button.disabled = Boolean(action.disabled) || (action.action === 'purchaseItem' && model.state.coins < item.price); if (action.action) button.addEventListener('click', () => act(action.action, { itemId: item.id })); footer.append(price, button); card.append(icon, name, description, footer); root.append(card);
  });
}

function currentEnemyDefinition() { const battle = model.state.adventure.activeBattle; if (!battle) return null; for (const chapter of model.content.chapters) { const found = chapter.enemies.find((enemy) => enemy.id === battle.enemyId); if (found) return found; } return null; }

const elementClasses = ['physical', 'fire', 'water', 'ice', 'electric'];
function setElementClass(element, prefix, type) { element.classList.remove(...elementClasses.map((entry) => `${prefix}-${entry}`)); if (type) element.classList.add(`${prefix}-${type}`); }
function playCombatEffect(target, type) { const className = `hit-${type || 'physical'}`; target.classList.remove(...elementClasses.map((entry) => `hit-${entry}`)); void target.offsetWidth; target.classList.add(className); setTimeout(() => target.classList.remove(className), 520); }
function playBattleCue(kind, text) { const cue = $('battle-cue'); cue.className = 'battle-cue'; cue.textContent = text; void cue.offsetWidth; cue.classList.add('show', `cue-${kind}`); setTimeout(() => cue.classList.remove('show', `cue-${kind}`), 1800); }

function renderMap() {
  const state = model.state, chapter = model.content.chapters[state.adventure.chapterIndex % model.content.chapters.length];
  $('map-chapter').textContent = chapterName(chapter); $('map-progress').textContent = `${state.adventure.encounterIndex} / ${chapter.enemies.length}`;
  const root = $('world-map'); root.replaceChildren();
  chapter.enemies.forEach((enemy, index) => {
    const rewardId = `${chapter.id}:${index}`, claimed = state.adventure.claimedMapRewards.includes(rewardId), rewardUnlocked = index <= state.adventure.encounterIndex;
    const reward = document.createElement('button'); reward.className = `map-node reward ${claimed ? 'cleared' : rewardUnlocked ? 'available' : 'locked'}`; reward.dataset.node = 'reward'; reward.dataset.index = String(index); reward.disabled = claimed || !rewardUnlocked; reward.innerHTML = `<i>▣</i><b>${claimed ? (language() === 'en' ? 'CLAIMED' : '已领取') : (language() === 'en' ? 'SUPPLY' : '补给')}</b><small>◈ ${4 + index * 3} · HP +${6 + index * 2}</small>`; root.append(reward);
    const battle = document.createElement('button'), cleared = index < state.adventure.encounterIndex, available = index === state.adventure.encounterIndex;
    battle.className = `map-node battle ${enemy.isBoss ? 'boss' : ''} ${cleared ? 'cleared' : available ? 'available' : 'locked'}`; battle.dataset.node = 'battle'; battle.dataset.index = String(index); battle.disabled = cleared || !available; battle.innerHTML = `<i>${enemy.isBoss ? '♛' : '⚔'}</i><b>${enemyName(enemy)}</b><small>${String(enemy.element || 'physical').toUpperCase()} · HP ${enemy.maxHp} · XP ${enemy.xp} · ◈ ${enemy.coins}</small>`; root.append(battle);
  });
}

function renderBattle() {
  const state = model.state, battle = state.adventure.activeBattle, chapter = model.content.chapters[state.adventure.chapterIndex % model.content.chapters.length]; $('chapter-name').textContent = chapterName(chapter); $('encounter-label').textContent = `${String(state.adventure.encounterIndex + 1).padStart(2, '0')} / ${String(chapter.enemies.length).padStart(2, '0')}`;
  renderMap(); $('map-panel').hidden = Boolean(battle); $('battle-shell').classList.toggle('active', Boolean(battle)); $('enemy').classList.toggle('visible', Boolean(battle)); document.querySelector('.enemy-data').classList.toggle('visible', Boolean(battle)); $('player-hp').textContent = `${state.pet.hp} HP`;
  if (!battle) { $('skills').replaceChildren(); $('battle-log').textContent = language() === 'en' ? 'Select a battle node on the map.' : '点击小地图上的战斗节点开始行动。'; $('turn').textContent = '--'; $('resource').textContent = '--'; $('story').classList.remove('open'); return; }
  const enemy = currentEnemyDefinition(); setElementClass($('enemy'), 'element', enemy?.element || 'physical'); setElementClass($('enemy'), 'shield', battle.enemyBlock > 0 ? battle.enemyBlockType : null); setElementClass(document.querySelector('.pet-fighter'), 'shield', battle.playerBlock > 0 ? battle.playerBlockType : null); $('enemy-name').textContent = enemy ? enemyName(enemy) : battle.enemyName; $('boss-tag').textContent = enemy?.isBoss ? 'MINI BOSS' : 'TARGET'; $('enemy-hp').textContent = `${battle.enemyHp} / ${battle.enemyMaxHp} HP · SHIELD ${battle.enemyBlock} ${String(battle.enemyBlockType || '').toUpperCase()}`; $('enemy-hp-bar').style.width = percent(battle.enemyHp, battle.enemyMaxHp); $('player-hp').textContent = `${state.pet.hp} HP · SHIELD ${battle.playerBlock}`; $('turn').textContent = battle.turn; $('resource').textContent = `${battle.resource} / ${battle.maxResource}`;
  const intent = enemy?.intents[battle.intentIndex % enemy.intents.length]; $('intent').textContent = intent ? `INTENT // ${language() === 'en' ? intent.labelEn : intent.label}` : 'INTENT // --';
  const skills = model.content.skills.filter((skill) => state.pet.learnedSkills.includes(skill.id)); $('skills').replaceChildren(...skills.map((skill) => { const button = document.createElement('button'); button.className = `skill skill-${skill.type}`; const title = document.createElement('b'); title.textContent = `${itemName(skill)} [${skill.cost}]`; const description = document.createElement('small'); description.textContent = skill.description; button.append(title, description); button.disabled = battle.phase !== 'combat' || skill.cost > battle.resource; button.addEventListener('click', async () => { const beforeHp = model.state.pet.hp, beforeBattle = model.state.adventure.activeBattle, nextIntent = enemy?.intents[battle.intentIndex % enemy.intents.length]; playCombatEffect($('enemy'), skill.type); if (skill.block) setElementClass(document.querySelector('.pet-fighter'), 'shield', skill.type); await act('useSkill', { skillId: skill.id }); if (model.state.pet.hp < beforeHp && nextIntent?.kind === 'attack') playCombatEffect(document.querySelector('.pet-fighter'), nextIntent.type || 'physical'); const afterBattle = model.state.adventure.activeBattle; if (beforeBattle && afterBattle?.phase === 'story_after' && beforeBattle.phase !== 'story_after') playBattleCue('win', language() === 'en' ? 'VICTORY // Rewards secured' : '战斗胜利 // 奖励已结算'); else if (beforeBattle && !afterBattle) playBattleCue('lose', language() === 'en' ? 'DEFEAT // Pet recovered to 30% HP' : '战斗失败 // 宠物恢复至 30% HP'); }); return button; }));
  $('battle-log').replaceChildren(...battle.log.map((entry) => { const p = document.createElement('p'); p.textContent = entry; return p; })); renderStory(battle);
}

function renderStory(battle) {
  const active = battle.phase === 'story_before' || battle.phase === 'story_after'; $('story').classList.toggle('open', active); if (!active) return;
  const story = battle.phase === 'story_before' ? model.battleStory.before : model.battleStory.after; $('story-type').textContent = battle.phase === 'story_before' ? 'BEFORE OPERATION' : 'AFTER OPERATION'; $('story-speaker').textContent = battle.phase === 'story_before' ? 'SPPET // 作战记录' : 'SPPET // 行动结算'; $('story-line').textContent = story[Math.min(battle.storyIndex, story.length - 1)] || '...';
}

function renderForms() {
  if (formsInitialized) return; formsInitialized = true; const settings = model.settings, state = model.state;
  ['language','commissionTaskTarget','commissionTaskXp','commissionFocusTarget','commissionFocusXp','disconnectDecayMinutes','disconnectDecayAmount'].forEach((id) => { $(id).value = settings[id]; }); $('notifications').value = String(settings.notifications); $('leaderboardSync').checked = settings.leaderboardSync; $('nickname').value = settings.leaderboardNickname; $('remoteContent').checked = settings.remoteContent; $('pet-name-input').value = state.pet.name; $('idle-lines').value = settings.petIdleLines.join('\n'); $('click-lines').value = settings.petClickLines.join('\n');
  $('rank-link').href = model.site.leaderboard; $('tools-link').href = model.site.tools; $('dev-link').href = model.site.developer;
}

function renderConnection() { const connected = model.bridge.status === 'connected'; $('bridge').className = `connection ${connected ? 'connected' : ''}`; $('bridge').textContent = connected ? `● CONNECTED // ${model.bridge.url} // ACK ${model.bridge.lastAck || '--'}` : `● DISCONNECTED // ${model.bridge.url}`; }
function render(response) { if (!response?.state) return; model = response; applyLanguage(); renderOverview(); renderGrowth(); renderBattle(); renderConnection(); renderForms(); }
async function refresh() { try { const response = await sendMessage('getState'); if (!response?.ok) throw new Error(response?.error || '读取失败'); render(response); } catch (error) { $('bridge').textContent = `● UI ERROR // ${error.message || String(error)}`; } }
async function act(type, payload = {}) { const response = await sendMessage(type, payload); if (!response?.ok) throw new Error(response?.error || '操作失败'); render(response); return response; }

document.querySelector('.bottom-nav').addEventListener('click', (event) => { const button = event.target.closest('[data-tab]'); if (!button) return; document.querySelectorAll('.bottom-nav button').forEach((entry) => entry.classList.toggle('active', entry === button)); document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.dataset.page === button.dataset.tab)); });
document.querySelector('.adventure-tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-adventure-tab]'); if (!button) return; document.querySelectorAll('.adventure-tabs button').forEach((entry) => entry.classList.toggle('active', entry === button)); document.querySelectorAll('.adventure-view').forEach((view) => view.classList.toggle('active', view.dataset.adventureView === button.dataset.adventureTab)); });
document.querySelector('#world-map').addEventListener('click', async (event) => { const node = event.target.closest('[data-node]'); if (!node || node.disabled) return; if (node.dataset.node === 'reward') { await act('claimMapReward', { rewardIndex: Number(node.dataset.index) }); $('map-status').textContent = language() === 'en' ? 'Supply claimed.' : '补给已领取。'; } else { const target = node.querySelector('b')?.textContent || ''; await act('startBattleAt', { encounterIndex: Number(node.dataset.index) }); playBattleCue('start', language() === 'en' ? `BATTLE START // ${target}` : `战斗开始 // ${target}`); } });
document.querySelector('.filters').addEventListener('click', (event) => { const button = event.target.closest('[data-filter]'); if (!button) return; activeFilter = button.dataset.filter; document.querySelectorAll('.filters button').forEach((entry) => entry.classList.toggle('active', entry === button)); renderShop(); });
$('check-in').addEventListener('click', () => act('checkIn'));
$('story-next').addEventListener('click', () => act('advanceStory', { skip: false }));
$('story-skip').addEventListener('click', () => act('advanceStory', { skip: true }));
$('save-pet').addEventListener('click', async () => { try { await act('savePetSettings', { petName: $('pet-name-input').value, idleLines: $('idle-lines').value, clickLines: $('click-lines').value }); $('pet-status').textContent = language() === 'en' ? 'Saved.' : '宠物设置已保存。'; } catch (error) { $('pet-status').textContent = error.message; } });
$('save-settings').addEventListener('click', async () => { const settings = { language: $('language').value, notifications: $('notifications').value === 'true', commissionTaskTarget: Number($('commissionTaskTarget').value), commissionTaskXp: Number($('commissionTaskXp').value), commissionFocusTarget: Number($('commissionFocusTarget').value), commissionFocusXp: Number($('commissionFocusXp').value), disconnectDecayMinutes: Number($('disconnectDecayMinutes').value), disconnectDecayAmount: Number($('disconnectDecayAmount').value), leaderboardSync: $('leaderboardSync').checked, leaderboardNickname: $('nickname').value, remoteContent: $('remoteContent').checked }; try { await act('saveSettings', { settings }); formsInitialized = false; renderForms(); $('settings-status').textContent = language() === 'en' ? 'Saved.' : '设置已保存。'; if (settings.leaderboardSync) await sendMessage('submitLeaderboard'); } catch (error) { $('settings-status').textContent = error.message; } });
$('test-bridge').addEventListener('click', () => act('testBridge'));
$('export-state').addEventListener('click', async () => {
  const response = await act('exportState');
  if (!response?.state) return;
  const blob = new Blob([JSON.stringify(response.state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sppet-state-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});
$('import-state').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const state = JSON.parse(await file.text()); if (!confirm('导入会覆盖当前 SPPet 成长状态，是否继续？')) return; await act('importState', { state }); $('settings-status').textContent = '状态导入完成。'; } catch (error) { $('settings-status').textContent = `导入失败：${error.message}`; } finally { event.target.value = ''; } });
$('refresh-content').addEventListener('click', async () => { try { await act('refreshContent'); $('settings-status').textContent = '剧情与数值已更新。'; } catch (error) { $('settings-status').textContent = `更新失败：${error.message}`; } });
document.querySelector('.debug .action-row').addEventListener('click', async (event) => { const button = event.target.closest('[data-action]'); if (!button) return; if (button.dataset.action === 'resetState' && !confirm('确定重置全部状态吗？')) return; await act(button.dataset.action); });
setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString(language() === 'en' ? 'en-GB' : 'zh-CN', { hour12: false }); }, 1000);
refresh(); setInterval(refresh, 10000);
