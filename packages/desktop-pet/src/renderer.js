const bubble = document.getElementById('bubble');
const petZone = document.getElementById('pet-zone');
const pet = document.getElementById('pet');
const customSprite = document.getElementById('custom-sprite');
const characterElement = document.getElementById('character');
const contextMenu = document.getElementById('context-menu');
const settingsPanel = document.getElementById('settings-panel');
const chatPanel = document.getElementById('chat-panel');
const historyPanel = document.getElementById('history-panel');
const focusPanel = document.getElementById('focus-panel');
const overlayPanels = [settingsPanel, chatPanel, historyPanel, focusPanel];
const messageQueue = [];
let snapshot = null, showingMessage = false, messageTimer = null, activeSkinId = null, frame = 0, spriteState = 'idle', lastInteraction = Date.now();
let dragGesture = null, mouseInteractive = null, activeEventEffect = null, eventEffectTimer = null;
let idleLines = ['休息一下也没关系。'], clickLines = ['收到！'];
let activeCharacter = null, characterState = 'idle', characterStateTimer = null, characterAnimationTimer = null;
let characterAudio = null;
let aiFormDirty = false;
let focusSettingsDirty = false;
const CHARACTER_STATES = ['idle', 'walk', 'sleep', 'happy', 'sad', 'angry', 'tired', 'eat', 'touch', 'drag', 'fall', 'edge', 'battle', 'victory', 'defeat', 'talk'];
const anyPanelOpen = () => overlayPanels.some((panel) => panel.classList.contains('open'));

const randomLine = (values, fallback) => values.length ? values[Math.floor(Math.random() * values.length)] : fallback;
const eventFeedback = (entry) => { const p = entry.payload || {}; if (entry.type === 'FOCUS_TIMER_COMPLETED') return { message: p.capped ? `专注 ${p.minutes} 分钟完成；今日 ${p.dailyCap} 次奖励已领满。` : `专注完成！+${p.xp} XP +${p.coins} 金币，状态 +${p.condition}。`, state: 'happy' }; if (entry.type === 'COMMISSION_COMPLETED') return { message: `委托完成，获得 ${p.xp} XP。`, state: 'happy' }; if (entry.type === 'LEVEL_UP') return { message: `升级至 Lv.${p.level}，新的能力已解锁。`, effect: 'win', state: 'victory' }; if (entry.type === 'CHECK_IN') return { message: `签到补给已送达：${p.coins} 金币。`, state: 'happy' }; if (entry.type === 'MAP_REWARD_CLAIMED') return { message: `发现补给：${p.coins} 金币，恢复 ${p.heal} HP。`, effect: 'reward', state: 'happy' }; if (entry.type === 'BATTLE_STARTED') return { message: `战斗开始！目标：${p.enemy || '未知敌人'}。`, effect: 'start', state: 'battle' }; if (entry.type === 'BATTLE_WON') return { message: `战斗胜利！获得 ${p.xp} XP 和 ${p.coins} 金币。`, effect: 'win', state: 'victory' }; if (entry.type === 'BATTLE_LOST') return { message: `宠物倒下了。状态下降至 ${p.condition}，恢复至 ${p.hp} HP。`, effect: 'lose', state: 'defeat' }; if (entry.type === 'SKILL_UPGRADED') return { message: `技能强化至 Lv.${p.level}，消耗 ${p.cost} 金币。`, effect: 'reward', state: 'happy' }; if (entry.type === 'EQUIPMENT_UPGRADED') return { message: `${p.name} 强化至 +${p.level}。`, effect: 'reward', state: 'happy' }; if (entry.type === 'ITEM_USED') return { message: `${p.name} 已使用。`, state: 'eat' }; if (entry.type === 'PET_CONDITION_CHANGED' && p.reason === 'missed_login') return { message: `漏登 ${p.missedDays} 天：状态 -${p.lost}${p.hpLost ? `，HP -${p.hpLost}` : ''}。`, effect: p.hpLost ? 'lose' : undefined, state: p.hpLost ? 'sad' : 'tired' }; if (entry.type === 'PET_CONDITION_CHANGED') return { message: `连接中断太久，状态下降了 ${p.lost}。`, state: 'tired' }; return null; };
const react = (enabled) => { pet.classList.toggle('react', enabled); customSprite.style.animationDuration = enabled ? '.42s' : '1.8s'; };
const playPetEffect = (effect) => { clearTimeout(eventEffectTimer); if (activeEventEffect) document.getElementById('desktop').classList.remove(`event-${activeEventEffect}`); activeEventEffect = effect || null; if (!activeEventEffect) return; const desktop = document.getElementById('desktop'); void desktop.offsetWidth; desktop.classList.add(`event-${activeEventEffect}`); eventEffectTimer = setTimeout(() => { desktop.classList.remove(`event-${activeEventEffect}`); activeEventEffect = null; }, 1800); };
const drawCharacterResource = (resource) => { if (resource?.kind === 'emoji') { characterElement.textContent = resource.value; characterElement.style.backgroundImage = ''; } else if (resource?.kind === 'image') { characterElement.textContent = ''; characterElement.style.backgroundImage = `url("${resource.value}")`; } };
const setCharacterState = (state, duration = 0) => {
  clearTimeout(characterStateTimer); clearInterval(characterAnimationTimer);
  characterState = activeCharacter?.states?.[state] ? state : 'idle';
  petZone.classList.remove(...CHARACTER_STATES.map((value) => `state-${value}`)); petZone.classList.add(`state-${characterState}`);
  const animation = activeCharacter?.animations?.[characterState];
  if (activeCharacter?.sounds?.[characterState]) { characterAudio?.pause(); characterAudio = new Audio(activeCharacter.sounds[characterState]); characterAudio.volume = .55; characterAudio.play().catch(() => {}); }
  if (animation?.frames?.length) {
    let animationFrame = 0; drawCharacterResource(animation.frames[0]);
    characterAnimationTimer = setInterval(() => { animationFrame += 1; if (!animation.loop && animationFrame >= animation.frames.length) { clearInterval(characterAnimationTimer); return; } drawCharacterResource(animation.frames[animationFrame % animation.frames.length]); }, Math.round(1000 / animation.fps));
  } else drawCharacterResource(activeCharacter?.states?.[characterState] || activeCharacter?.states?.idle);
  if (duration) characterStateTimer = setTimeout(() => setCharacterState('idle'), duration);
};
const showBubble = (content, duration = 3000, html = false) => { clearTimeout(messageTimer); if (html) bubble.innerHTML = content; else bubble.textContent = content; bubble.classList.add('show'); react(true); if (characterState === 'idle') setCharacterState('talk'); showingMessage = true; messageTimer = setTimeout(() => { bubble.classList.remove('show'); react(false); if (characterState === 'talk') setCharacterState('idle'); showingMessage = false; playNext(); }, duration); };
const playNext = () => { if (showingMessage || !messageQueue.length || anyPanelOpen()) return; const next = messageQueue.shift(); if (typeof next === 'string') showBubble(next); else { playPetEffect(next.effect); if (next.state) setCharacterState(next.state, next.effect ? 3800 : 3200); showBubble(next.message, next.effect ? 3600 : 3000); } };
const statsHtml = () => { const state = snapshot?.state; if (!state) return '<span>等待 Super Productivity…</span>'; const next = 100 + state.level * 25, stages = { stranger:'陌生', familiar:'熟悉', close:'亲近', trusted:'信赖', best_friend:'挚友' }; return `<strong>Lv.${state.level}</strong><span>XP ${state.xp} / ${next}</span><br><em>◆ ${state.pet.condition}</em><span> ♥ ${stages[state.pet.affinity?.stage] || '陌生'} ${state.pet.affinity?.points || 0}</span><br><span>🔥 ${state.streak} 天</span><span> ◈ ${state.coins}</span>`; };

function renderSkin(skin) { const id = skin?.meta?.id || null; if (id === activeSkinId) return; activeSkinId = id; frame = 0; spriteState = 'idle'; petZone.classList.toggle('custom', Boolean(skin)); if (skin) { customSprite.style.backgroundImage = `url("${skin.imageDataUrl}")`; customSprite.style.backgroundSize = skin.meta.spriteVersionNumber >= 2 ? '800% 1100%' : '800% 900%'; customSprite.style.backgroundPosition = '0% 0%'; customSprite.title = skin.meta.displayName; } else { customSprite.style.backgroundImage = ''; customSprite.title = ''; } }
function renderCharacter(character, legacySkin) { activeCharacter = legacySkin ? null : character; petZone.classList.toggle('manifest', Boolean(activeCharacter)); if (activeCharacter) { characterElement.title = activeCharacter.manifest.name; setCharacterState(characterState); } else { characterElement.textContent = ''; characterElement.style.backgroundImage = ''; } }
function renderAi(ai) {
  if (!ai) return;
  if (!aiFormDirty) {
    const settings = ai.settings || {}, profile = ai.profile || {};
    document.getElementById('ai-enabled').checked = settings.enabled === true; document.getElementById('ai-endpoint').value = settings.endpoint || ''; document.getElementById('ai-model').value = settings.model || ''; document.getElementById('ai-personality').value = settings.personality || ''; document.getElementById('ai-speaking-style').value = settings.speakingStyle || ''; document.getElementById('ai-worldview').value = settings.worldview || ''; document.getElementById('ai-relationship').value = settings.relationship || '';
    document.getElementById('profile-nickname').value = profile.nickname || ''; document.getElementById('profile-birthday').value = profile.birthday || ''; document.getElementById('profile-pet-name').value = profile.petName || ''; document.getElementById('profile-user-call-pet').value = profile.userCallPet || ''; document.getElementById('profile-pet-call-user').value = profile.petCallUser || ''; document.getElementById('profile-relationship').value = profile.relationship || ''; document.getElementById('profile-custom-fields').value = JSON.stringify(profile.customFields || {}, null, 2); document.getElementById('current-system-prompt').textContent = ai.systemPrompt || '';
  }
  const history = ai.history || [], log = document.getElementById('chat-log'), historyList = document.getElementById('history-list');
  log.replaceChildren(...history.slice(-12).flatMap((entry) => [['user', entry.user], ['assistant', entry.assistant]].map(([role, value]) => { const item = document.createElement('div'); item.className = `chat-entry ${role}`; item.textContent = `${role === 'user' ? '你' : 'SPPet'}：${value}`; return item; })));
  historyList.replaceChildren(...history.slice().reverse().map((entry) => { const item = document.createElement('article'); item.className = 'history-entry'; const time = document.createElement('time'); time.textContent = new Date(entry.timestamp).toLocaleString(); const body = document.createElement('div'); body.textContent = `${entry.user}\n${entry.assistant}`; const button = document.createElement('button'); button.textContent = '删除'; button.dataset.historyId = entry.id; item.append(time, body, button); return item; }));
}
function renderAwareness(awareness) { if (!awareness) return; document.getElementById('current-window-enabled').checked = awareness.settings?.currentWindowEnabled === true; document.getElementById('vision-enabled').checked = awareness.settings?.visionEnabled === true; const current = awareness.currentWindow; document.getElementById('current-window-result').textContent = current ? `${current.process || '未知进程'}\n${current.title || '无标题'}\n${new Date(current.capturedAt).toLocaleString()}` : '尚未读取'; }
function renderFocus(focus) { if (!focus) return; const session = focus.session, seconds = session?.status === 'running' ? session.remainingSeconds : (focus.settings?.durationMinutes || 25) * 60; document.getElementById('focus-clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; document.getElementById('focus-status').textContent = session?.status === 'running' ? '专注进行中' : session?.status === 'completed' ? (session.pendingReward ? '已完成，等待连接 SP 结算' : '已完成并结算') : session?.status === 'cancelled' ? '已取消' : '尚未开始'; document.getElementById('start-focus').disabled = session?.status === 'running' || session?.pendingReward; document.getElementById('cancel-focus').disabled = session?.status !== 'running'; if (!focusSettingsDirty) { document.getElementById('focus-duration').value = focus.settings?.durationMinutes || 25; document.getElementById('focus-work-apps').value = (focus.settings?.workApps || []).join('\n'); document.getElementById('focus-entertainment-apps').value = (focus.settings?.entertainmentApps || []).join('\n'); document.getElementById('focus-game-apps').value = (focus.settings?.gameApps || []).join('\n'); } }
function render(next) {
  snapshot = next; idleLines = next.petProfile?.idleLines?.filter(Boolean) || idleLines; clickLines = next.petProfile?.clickLines?.filter(Boolean) || clickLines; renderSkin(next.skin); renderCharacter(next.character, next.skin);
  pet.className = `pet ${next.state?.pet?.skinPart || ''}`; const connected = Boolean(next.bridge?.connected); document.getElementById('connection').className = `connection ${connected ? 'connected' : ''}`; document.getElementById('connection').textContent = connected ? `● CONNECTED // 127.0.0.1:${next.bridge.port}` : `● DISCONNECTED // 127.0.0.1:${next.bridge?.port || 47821}`; document.getElementById('data-dir').textContent = next.dataDirectory || '';
  const size = Number(next.petSettings?.size || 1); document.documentElement.style.setProperty('--scale', size); document.getElementById('size').value = String(Math.round(size * 100)); document.getElementById('size-label').textContent = `${Math.round(size * 100)}%`; document.getElementById('always-top').checked = next.petSettings?.alwaysOnTop !== false;
  document.getElementById('gravity').checked = next.petSettings?.gravityEnabled !== false; document.getElementById('auto-walk').checked = next.petSettings?.autoWalk === true; const list = document.getElementById('character-list'); list.replaceChildren(...(next.characters || []).map((entry) => { const option = document.createElement('option'); option.value = entry.id; option.textContent = `${entry.name}${entry.custom ? ' · 自定义' : ''}`; return option; })); list.value = next.character?.manifest?.id || 'default_pet'; document.getElementById('delete-character').disabled = !next.character?.custom;
  renderAi(next.ai);
  renderAwareness(next.awareness);
  renderFocus(next.focus);
  for (const entry of next.events || []) { const feedback = eventFeedback(entry); if (feedback) messageQueue.push(feedback); } playNext();
}

window.petApi.onSnapshot(render);
const setMouseInteractive = (interactive) => { const next = Boolean(interactive); if (mouseInteractive === next) return; mouseInteractive = next; window.petApi.setInteractive(next); };
const syncMouseInteraction = (event) => { const target = document.elementFromPoint(event.clientX, event.clientY); const interactive = Boolean(dragGesture || anyPanelOpen() || contextMenu.classList.contains('open') || target?.closest('#pet-zone,#context-menu,.overlay-panel,.drag-grip')); setMouseInteractive(interactive); };
window.addEventListener('mousemove', syncMouseInteraction, { passive: true });
window.addEventListener('blur', () => { if (dragGesture?.moved) window.petApi.dragEnd(); dragGesture = null; setDragVisual(false); setMouseInteractive(false); });
petZone.addEventListener('mouseenter', () => { setMouseInteractive(true); lastInteraction = Date.now(); if (!showingMessage && !anyPanelOpen()) showBubble(statsHtml(), 60_000, true); });
petZone.addEventListener('mouseleave', (event) => { lastInteraction = Date.now(); if (!dragGesture && !contextMenu.classList.contains('open')) syncMouseInteraction(event); if (!messageQueue.length) { clearTimeout(messageTimer); bubble.classList.remove('show'); react(false); showingMessage = false; } });
const showClickLine = () => { lastInteraction = Date.now(); contextMenu.classList.remove('open'); window.petApi.touched(); setCharacterState('touch', 2200); showBubble(randomLine(clickLines, '收到！')); };
const setDragVisual = (dragging, direction = null) => {
  petZone.classList.toggle('dragging', dragging);
  petZone.classList.toggle('drag-left', dragging && direction === 'left');
  petZone.classList.toggle('drag-right', dragging && direction === 'right');
  spriteState = dragging && direction ? `running-${direction}` : 'idle';
  frame = 0;
  if (activeCharacter) setCharacterState(dragging ? 'drag' : 'idle');
};
petZone.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || anyPanelOpen()) return;
  setMouseInteractive(true);
  event.preventDefault();
  petZone.setPointerCapture?.(event.pointerId);
  dragGesture = { pointerId: event.pointerId, startX: event.screenX, startY: event.screenY, lastX: event.screenX, moved: false };
});
petZone.addEventListener('pointermove', (event) => {
  if (!dragGesture || dragGesture.pointerId !== event.pointerId) return;
  const dx = event.screenX - dragGesture.startX, dy = event.screenY - dragGesture.startY;
  if (!dragGesture.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
  if (!dragGesture.moved) {
    dragGesture.moved = true;
    clearTimeout(messageTimer); bubble.classList.remove('show'); showingMessage = false; react(false);
    window.petApi.dragStart();
    setDragVisual(true);
  }
  const direction = event.screenX < dragGesture.lastX ? 'left' : event.screenX > dragGesture.lastX ? 'right' : null;
  if (direction) setDragVisual(true, direction);
  dragGesture.lastX = event.screenX;
  window.petApi.dragMove();
});
const finishPointerGesture = (event, cancelled = false) => {
  if (!dragGesture || dragGesture.pointerId !== event.pointerId) return;
  const moved = dragGesture.moved;
  dragGesture = null;
  if (petZone.hasPointerCapture?.(event.pointerId)) petZone.releasePointerCapture(event.pointerId);
  if (moved) window.petApi.dragEnd();
  setDragVisual(false);
  lastInteraction = Date.now();
  if (!moved && !cancelled) showClickLine();
  setTimeout(() => { if (!petZone.matches(':hover') && !contextMenu.classList.contains('open') && !anyPanelOpen()) setMouseInteractive(false); }, 0);
};
petZone.addEventListener('pointerup', (event) => finishPointerGesture(event));
petZone.addEventListener('pointercancel', (event) => finishPointerGesture(event, true));
petZone.addEventListener('lostpointercapture', (event) => finishPointerGesture(event, true));
window.addEventListener('pointerup', (event) => finishPointerGesture(event), true);
window.addEventListener('pointercancel', (event) => finishPointerGesture(event, true), true);
document.body.addEventListener('contextmenu', (event) => { event.preventDefault(); setMouseInteractive(true); lastInteraction = Date.now(); if (!event.target.closest('.overlay-panel')) contextMenu.classList.toggle('open'); });
document.body.addEventListener('click', (event) => { if (!event.target.closest('#context-menu') && !event.target.closest('#pet-zone')) { contextMenu.classList.remove('open'); syncMouseInteraction(event); } });
setInterval(() => { if (Date.now() - lastInteraction > 45_000 && !showingMessage && !anyPanelOpen() && Math.random() < .38) { showBubble(randomLine(idleLines, '我会在这里等你。')); lastInteraction = Date.now(); } }, 12_000);
setInterval(() => {
  if (!activeSkinId) return;
  const isRunning = spriteState === 'running-left' || spriteState === 'running-right';
  const row = spriteState === 'running-right' ? 1 : spriteState === 'running-left' ? 2 : 0;
  const rowCount = Number(snapshot?.skin?.meta?.spriteVersionNumber || 1) >= 2 ? 11 : 9;
  const frameCount = isRunning ? 8 : 6;
  frame = (frame + 1) % frameCount;
  customSprite.style.backgroundPosition = `${frame / 7 * 100}% ${row / (rowCount - 1) * 100}%`;
}, 120);

const openPanel = (panel) => { setMouseInteractive(true); contextMenu.classList.remove('open'); overlayPanels.forEach((entry) => entry.classList.toggle('open', entry === panel)); window.petApi.setSettingsOpen(true); };
const closePanels = () => { overlayPanels.forEach((panel) => panel.classList.remove('open')); window.petApi.setSettingsOpen(false); playNext(); setTimeout(() => { if (!petZone.matches(':hover')) setMouseInteractive(false); }, 0); };
const openSettings = () => openPanel(settingsPanel);
document.getElementById('open-settings').addEventListener('click', openSettings); document.getElementById('open-chat').addEventListener('click', () => openPanel(chatPanel)); document.getElementById('open-history').addEventListener('click', () => openPanel(historyPanel)); document.getElementById('open-focus').addEventListener('click', () => openPanel(focusPanel)); document.querySelectorAll('.panel-close').forEach((button) => button.addEventListener('click', closePanels)); window.petApi.onOpenSettings(openSettings);
document.getElementById('hide').addEventListener('click', () => window.petApi.hide()); document.getElementById('close').addEventListener('click', () => window.petApi.close());
document.getElementById('skin').addEventListener('click', async () => { try { const skin = await window.petApi.selectSkin(); if (skin) { renderSkin(skin); showBubble(`已载入皮肤：${skin.meta.displayName}`); } } catch (error) { showBubble(error.message || String(error)); } });
document.getElementById('clear-skin').addEventListener('click', async () => { await window.petApi.clearSkin(); renderSkin(null); showBubble('已恢复默认外观。'); });
document.getElementById('always-top').addEventListener('change', (event) => window.petApi.setAlwaysOnTop(event.target.checked));
document.getElementById('size').addEventListener('input', (event) => { const size = Number(event.target.value) / 100; document.documentElement.style.setProperty('--scale', size); document.getElementById('size-label').textContent = `${event.target.value}%`; });
document.getElementById('size').addEventListener('change', (event) => window.petApi.setSize(Number(event.target.value) / 100));
window.petApi.onOpenSkinPicker(() => document.getElementById('skin').click());
window.petApi.onMotionState((state) => { if (activeCharacter) setCharacterState(state); });
document.getElementById('character-list').addEventListener('change', (event) => window.petApi.selectCharacter(event.target.value));
document.getElementById('import-character').addEventListener('click', async () => { try { const character = await window.petApi.importCharacter(); if (character) showBubble(`已导入角色：${character.manifest.name}`); } catch (error) { showBubble(error.message || String(error)); } });
document.getElementById('delete-character').addEventListener('click', async () => { const id = document.getElementById('character-list').value; if (!snapshot?.character?.custom || !confirm('删除这个自定义角色资源？')) return; try { await window.petApi.deleteCharacter(id); showBubble('自定义角色已删除。'); } catch (error) { showBubble(error.message || String(error)); } });
const saveBehavior = () => window.petApi.setBehavior({ gravityEnabled: document.getElementById('gravity').checked, autoWalk: document.getElementById('auto-walk').checked });
document.getElementById('gravity').addEventListener('change', saveBehavior); document.getElementById('auto-walk').addEventListener('change', saveBehavior);
document.getElementById('preview-character').addEventListener('click', () => setCharacterState(document.getElementById('preview-state').value, 4000));
document.querySelectorAll('#settings-panel details input,#settings-panel details textarea').forEach((element) => element.addEventListener('input', () => { aiFormDirty = true; }));
const refreshAiForm = async () => { aiFormDirty = false; renderAi(await window.petApi.getAiSnapshot()); };
document.getElementById('save-ai').addEventListener('click', async () => { const message = document.getElementById('settings-message'); try { const apiKey = document.getElementById('ai-key').value; if (apiKey) await window.petApi.setAiKey(apiKey); await window.petApi.updateAiSettings({ enabled: document.getElementById('ai-enabled').checked, endpoint: document.getElementById('ai-endpoint').value, model: document.getElementById('ai-model').value, personality: document.getElementById('ai-personality').value, speakingStyle: document.getElementById('ai-speaking-style').value, worldview: document.getElementById('ai-worldview').value, relationship: document.getElementById('ai-relationship').value }); document.getElementById('ai-key').value = ''; await refreshAiForm(); message.textContent = 'AI 设置已保存；Prompt 变更已重置短期上下文。'; } catch (error) { message.textContent = error.message || String(error); } });
document.getElementById('save-profile').addEventListener('click', async () => { const message = document.getElementById('settings-message'); try { await window.petApi.updateProfile({ nickname: document.getElementById('profile-nickname').value, birthday: document.getElementById('profile-birthday').value, petName: document.getElementById('profile-pet-name').value, userCallPet: document.getElementById('profile-user-call-pet').value, petCallUser: document.getElementById('profile-pet-call-user').value, relationship: document.getElementById('profile-relationship').value, customFields: document.getElementById('profile-custom-fields').value }); await refreshAiForm(); message.textContent = '御主档案已保存。'; } catch (error) { message.textContent = `保存失败：${error.message || String(error)}`; } });
document.getElementById('send-chat').addEventListener('click', async () => { const input = document.getElementById('chat-input'), message = document.getElementById('chat-message'), value = input.value.trim(); if (!value) return; message.textContent = '正在请求…'; document.getElementById('send-chat').disabled = true; try { await window.petApi.chat(value); input.value = ''; message.textContent = ''; setCharacterState('talk', 3000); } catch (error) { message.textContent = error.message || String(error); } finally { document.getElementById('send-chat').disabled = false; } });
document.getElementById('history-list').addEventListener('click', async (event) => { const button = event.target.closest('[data-history-id]'); if (!button) return; await window.petApi.deleteHistory(button.dataset.historyId); document.getElementById('history-message').textContent = '该条历史已从本地存储删除。'; });
document.getElementById('clear-history').addEventListener('click', async () => { if (!confirm('从本地存储清空全部对话历史？')) return; await window.petApi.clearHistory(); document.getElementById('history-message').textContent = '全部历史已清空。'; });
document.getElementById('save-awareness').addEventListener('click', async () => { try { await window.petApi.updateAwarenessSettings({ currentWindowEnabled: document.getElementById('current-window-enabled').checked, visionEnabled: document.getElementById('vision-enabled').checked }); document.getElementById('settings-message').textContent = '系统感知授权已保存。'; } catch (error) { document.getElementById('settings-message').textContent = error.message || String(error); } });
document.getElementById('read-current-window').addEventListener('click', async () => { try { const value = await window.petApi.readCurrentWindow(); document.getElementById('current-window-result').textContent = `${value.process || '未知进程'}\n${value.title || '无标题'}\n${new Date(value.capturedAt).toLocaleString()}`; } catch (error) { document.getElementById('settings-message').textContent = error.message || String(error); } });
document.getElementById('analyze-screen').addEventListener('click', async () => { const message = document.getElementById('chat-message'), button = document.getElementById('analyze-screen'); message.textContent = '正在截取并分析当前屏幕…'; button.disabled = true; try { await window.petApi.analyzeScreen(); message.textContent = '本次屏幕分析完成，截图未保存。'; setCharacterState('talk', 3000); } catch (error) { message.textContent = error.message || String(error); } finally { button.disabled = false; } });
document.querySelectorAll('#focus-duration,#focus-work-apps,#focus-entertainment-apps,#focus-game-apps').forEach((element) => element.addEventListener('input', () => { focusSettingsDirty = true; }));
document.getElementById('save-focus').addEventListener('click', async () => { try { await window.petApi.updateFocusSettings({ durationMinutes: Number(document.getElementById('focus-duration').value), workApps: document.getElementById('focus-work-apps').value, entertainmentApps: document.getElementById('focus-entertainment-apps').value, gameApps: document.getElementById('focus-game-apps').value }); focusSettingsDirty = false; document.getElementById('focus-message').textContent = '专注设置已保存。'; } catch (error) { document.getElementById('focus-message').textContent = error.message || String(error); } });
document.getElementById('start-focus').addEventListener('click', async () => { await window.petApi.startFocus(); document.getElementById('focus-message').textContent = '专注开始。'; closePanels(); showBubble('专注开始，我会陪你到计时结束。'); });
document.getElementById('cancel-focus').addEventListener('click', async () => { await window.petApi.cancelFocus(); document.getElementById('focus-message').textContent = '本次专注已取消，不发放奖励。'; });
window.petApi.onFocusSnapshot(renderFocus);
window.petApi.onFocusCompleted(() => { messageQueue.push({ message: '专注计时完成！正在等待 Super Productivity 确认奖励。', state: 'happy' }); playNext(); });
window.petApi.onFocusWindowCategory(({ category }) => { if (category === 'entertainment' || category === 'game') { messageQueue.push({ message: `检测到你配置的${category === 'game' ? '游戏' : '娱乐'}应用，是否回到专注目标？`, state: 'talk' }); playNext(); } });
setMouseInteractive(false);
