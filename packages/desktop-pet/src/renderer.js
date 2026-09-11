const bubble = document.getElementById('bubble');
const petZone = document.getElementById('pet-zone');
const pet = document.getElementById('pet');
const customSprite = document.getElementById('custom-sprite');
const contextMenu = document.getElementById('context-menu');
const settingsPanel = document.getElementById('settings-panel');
const messageQueue = [];
let snapshot = null, showingMessage = false, messageTimer = null, activeSkinId = null, frame = 0, spriteState = 'idle', lastInteraction = Date.now();
let dragGesture = null, mouseInteractive = null, activeEventEffect = null, eventEffectTimer = null;
let idleLines = ['休息一下也没关系。'], clickLines = ['收到！'];

const randomLine = (values, fallback) => values.length ? values[Math.floor(Math.random() * values.length)] : fallback;
const eventFeedback = (entry) => { const p = entry.payload || {}; if (entry.type === 'COMMISSION_COMPLETED') return { message: `委托完成，获得 ${p.xp} XP。` }; if (entry.type === 'LEVEL_UP') return { message: `升级至 Lv.${p.level}，新的能力已解锁。`, effect: 'win' }; if (entry.type === 'CHECK_IN') return { message: `签到补给已送达：${p.coins} 金币。` }; if (entry.type === 'MAP_REWARD_CLAIMED') return { message: `发现补给：${p.coins} 金币，恢复 ${p.heal} HP。`, effect: 'reward' }; if (entry.type === 'BATTLE_STARTED') return { message: `战斗开始！目标：${p.enemy || '未知敌人'}。`, effect: 'start' }; if (entry.type === 'BATTLE_WON') return { message: `战斗胜利！获得 ${p.xp} XP 和 ${p.coins} 金币。`, effect: 'win' }; if (entry.type === 'BATTLE_LOST') return { message: `宠物倒下了。状态下降至 ${p.condition}，恢复至 ${p.hp} HP。`, effect: 'lose' }; if (entry.type === 'ITEM_USED') return { message: `${p.name} 已使用。` }; if (entry.type === 'PET_CONDITION_CHANGED' && p.reason === 'missed_login') return { message: `漏登 ${p.missedDays} 天：状态 -${p.lost}${p.hpLost ? `，HP -${p.hpLost}` : ''}。`, effect: p.hpLost ? 'lose' : undefined }; if (entry.type === 'PET_CONDITION_CHANGED') return { message: `连接中断太久，状态下降了 ${p.lost}。` }; return null; };
const react = (enabled) => { pet.classList.toggle('react', enabled); customSprite.style.animationDuration = enabled ? '.42s' : '1.8s'; };
const playPetEffect = (effect) => { clearTimeout(eventEffectTimer); if (activeEventEffect) document.getElementById('desktop').classList.remove(`event-${activeEventEffect}`); activeEventEffect = effect || null; if (!activeEventEffect) return; const desktop = document.getElementById('desktop'); void desktop.offsetWidth; desktop.classList.add(`event-${activeEventEffect}`); eventEffectTimer = setTimeout(() => { desktop.classList.remove(`event-${activeEventEffect}`); activeEventEffect = null; }, 1800); };
const showBubble = (content, duration = 3000, html = false) => { clearTimeout(messageTimer); if (html) bubble.innerHTML = content; else bubble.textContent = content; bubble.classList.add('show'); react(true); showingMessage = true; messageTimer = setTimeout(() => { bubble.classList.remove('show'); react(false); showingMessage = false; playNext(); }, duration); };
const playNext = () => { if (showingMessage || !messageQueue.length || settingsPanel.classList.contains('open')) return; const next = messageQueue.shift(); if (typeof next === 'string') showBubble(next); else { playPetEffect(next.effect); showBubble(next.message, next.effect ? 3600 : 3000); } };
const statsHtml = () => { const state = snapshot?.state; if (!state) return '<span>等待 Super Productivity…</span>'; const next = 100 + state.level * 25, stages = { stranger:'陌生', familiar:'熟悉', close:'亲近', trusted:'信赖', best_friend:'挚友' }; return `<strong>Lv.${state.level}</strong><span>XP ${state.xp} / ${next}</span><br><em>◆ ${state.pet.condition}</em><span> ♥ ${stages[state.pet.affinity?.stage] || '陌生'} ${state.pet.affinity?.points || 0}</span><br><span>🔥 ${state.streak} 天</span><span> ◈ ${state.coins}</span>`; };

function renderSkin(skin) { const id = skin?.meta?.id || null; if (id === activeSkinId) return; activeSkinId = id; frame = 0; spriteState = 'idle'; petZone.classList.toggle('custom', Boolean(skin)); if (skin) { customSprite.style.backgroundImage = `url("${skin.imageDataUrl}")`; customSprite.style.backgroundSize = skin.meta.spriteVersionNumber >= 2 ? '800% 1100%' : '800% 900%'; customSprite.style.backgroundPosition = '0% 0%'; customSprite.title = skin.meta.displayName; } else { customSprite.style.backgroundImage = ''; customSprite.title = ''; } }
function render(next) {
  snapshot = next; idleLines = next.petProfile?.idleLines?.filter(Boolean) || idleLines; clickLines = next.petProfile?.clickLines?.filter(Boolean) || clickLines; renderSkin(next.skin);
  pet.className = `pet ${next.state?.pet?.skinPart || ''}`; const connected = Boolean(next.bridge?.connected); document.getElementById('connection').className = `connection ${connected ? 'connected' : ''}`; document.getElementById('connection').textContent = connected ? `● CONNECTED // 127.0.0.1:${next.bridge.port}` : `● DISCONNECTED // 127.0.0.1:${next.bridge?.port || 47821}`; document.getElementById('data-dir').textContent = next.dataDirectory || '';
  const size = Number(next.petSettings?.size || 1); document.documentElement.style.setProperty('--scale', size); document.getElementById('size').value = String(Math.round(size * 100)); document.getElementById('size-label').textContent = `${Math.round(size * 100)}%`; document.getElementById('always-top').checked = next.petSettings?.alwaysOnTop !== false;
  for (const entry of next.events || []) { const feedback = eventFeedback(entry); if (feedback) messageQueue.push(feedback); } playNext();
}

window.petApi.onSnapshot(render);
const setMouseInteractive = (interactive) => { const next = Boolean(interactive); if (mouseInteractive === next) return; mouseInteractive = next; window.petApi.setInteractive(next); };
const syncMouseInteraction = (event) => { const target = document.elementFromPoint(event.clientX, event.clientY); const interactive = Boolean(dragGesture || settingsPanel.classList.contains('open') || contextMenu.classList.contains('open') || target?.closest('#pet-zone,#context-menu,#settings-panel,.drag-grip')); setMouseInteractive(interactive); };
window.addEventListener('mousemove', syncMouseInteraction, { passive: true });
window.addEventListener('blur', () => { if (dragGesture?.moved) window.petApi.dragEnd(); dragGesture = null; setDragVisual(false); setMouseInteractive(false); });
petZone.addEventListener('mouseenter', () => { setMouseInteractive(true); lastInteraction = Date.now(); if (!showingMessage && !settingsPanel.classList.contains('open')) showBubble(statsHtml(), 60_000, true); });
petZone.addEventListener('mouseleave', (event) => { lastInteraction = Date.now(); if (!dragGesture && !contextMenu.classList.contains('open')) syncMouseInteraction(event); if (!messageQueue.length) { clearTimeout(messageTimer); bubble.classList.remove('show'); react(false); showingMessage = false; } });
const showClickLine = () => { lastInteraction = Date.now(); contextMenu.classList.remove('open'); window.petApi.touched(); showBubble(randomLine(clickLines, '收到！')); };
const setDragVisual = (dragging, direction = null) => {
  petZone.classList.toggle('dragging', dragging);
  petZone.classList.toggle('drag-left', dragging && direction === 'left');
  petZone.classList.toggle('drag-right', dragging && direction === 'right');
  spriteState = dragging && direction ? `running-${direction}` : 'idle';
  frame = 0;
};
petZone.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || settingsPanel.classList.contains('open')) return;
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
  setTimeout(() => { if (!petZone.matches(':hover') && !contextMenu.classList.contains('open') && !settingsPanel.classList.contains('open')) setMouseInteractive(false); }, 0);
};
petZone.addEventListener('pointerup', (event) => finishPointerGesture(event));
petZone.addEventListener('pointercancel', (event) => finishPointerGesture(event, true));
petZone.addEventListener('lostpointercapture', (event) => finishPointerGesture(event, true));
window.addEventListener('pointerup', (event) => finishPointerGesture(event), true);
window.addEventListener('pointercancel', (event) => finishPointerGesture(event, true), true);
document.body.addEventListener('contextmenu', (event) => { event.preventDefault(); setMouseInteractive(true); lastInteraction = Date.now(); contextMenu.classList.toggle('open'); });
document.body.addEventListener('click', (event) => { if (!event.target.closest('#context-menu') && !event.target.closest('#pet-zone')) { contextMenu.classList.remove('open'); syncMouseInteraction(event); } });
setInterval(() => { if (Date.now() - lastInteraction > 45_000 && !showingMessage && !settingsPanel.classList.contains('open') && Math.random() < .38) { showBubble(randomLine(idleLines, '我会在这里等你。')); lastInteraction = Date.now(); } }, 12_000);
setInterval(() => {
  if (!activeSkinId) return;
  const isRunning = spriteState === 'running-left' || spriteState === 'running-right';
  const row = spriteState === 'running-right' ? 1 : spriteState === 'running-left' ? 2 : 0;
  const rowCount = Number(snapshot?.skin?.meta?.spriteVersionNumber || 1) >= 2 ? 11 : 9;
  const frameCount = isRunning ? 8 : 6;
  frame = (frame + 1) % frameCount;
  customSprite.style.backgroundPosition = `${frame / 7 * 100}% ${row / (rowCount - 1) * 100}%`;
}, 120);

const openSettings = () => { setMouseInteractive(true); contextMenu.classList.remove('open'); settingsPanel.classList.add('open'); window.petApi.setSettingsOpen(true); };
const closeSettings = () => { settingsPanel.classList.remove('open'); window.petApi.setSettingsOpen(false); setTimeout(() => { if (!petZone.matches(':hover')) setMouseInteractive(false); }, 0); };
document.getElementById('open-settings').addEventListener('click', openSettings); document.getElementById('settings-close').addEventListener('click', closeSettings); window.petApi.onOpenSettings(openSettings);
document.getElementById('hide').addEventListener('click', () => window.petApi.hide()); document.getElementById('close').addEventListener('click', () => window.petApi.close());
document.getElementById('skin').addEventListener('click', async () => { try { const skin = await window.petApi.selectSkin(); if (skin) { renderSkin(skin); showBubble(`已载入皮肤：${skin.meta.displayName}`); } } catch (error) { showBubble(error.message || String(error)); } });
document.getElementById('clear-skin').addEventListener('click', async () => { await window.petApi.clearSkin(); renderSkin(null); showBubble('已恢复默认外观。'); });
document.getElementById('always-top').addEventListener('change', (event) => window.petApi.setAlwaysOnTop(event.target.checked));
document.getElementById('size').addEventListener('input', (event) => { const size = Number(event.target.value) / 100; document.documentElement.style.setProperty('--scale', size); document.getElementById('size-label').textContent = `${event.target.value}%`; });
document.getElementById('size').addEventListener('change', (event) => window.petApi.setSize(Number(event.target.value) / 100));
window.petApi.onOpenSkinPicker(() => document.getElementById('skin').click());
setMouseInteractive(false);
