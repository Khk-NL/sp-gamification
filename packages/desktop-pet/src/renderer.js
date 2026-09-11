const bubble = document.getElementById('bubble');
const petZone = document.getElementById('pet-zone');
const pet = document.getElementById('pet');
const customSprite = document.getElementById('custom-sprite');
const contextMenu = document.getElementById('context-menu');
const settingsPanel = document.getElementById('settings-panel');
const messageQueue = [];
let snapshot = null, showingMessage = false, messageTimer = null, activeSkinId = null, frame = 0, lastInteraction = Date.now();
let idleLines = ['休息一下也没关系。'], clickLines = ['收到！'];

const randomLine = (values, fallback) => values.length ? values[Math.floor(Math.random() * values.length)] : fallback;
const eventMessage = (entry) => { const p = entry.payload || {}; if (entry.type === 'COMMISSION_COMPLETED') return `委托完成，获得 ${p.xp} XP。`; if (entry.type === 'LEVEL_UP') return `升级至 Lv.${p.level}，新的能力已解锁。`; if (entry.type === 'CHECK_IN') return `签到补给已送达：${p.coins} 金币。`; if (entry.type === 'BATTLE_WON') return `目标已压制，获得 ${p.xp} XP 和 ${p.coins} 金币。`; if (entry.type === 'BATTLE_LOST') return `行动中止。状态下降至 ${p.condition}。`; if (entry.type === 'ITEM_USED') return `${p.name} 已使用。`; if (entry.type === 'PET_CONDITION_CHANGED') return `连接中断太久，状态下降了 ${p.lost}。`; return null; };
const react = (enabled) => { pet.classList.toggle('react', enabled); customSprite.style.animationDuration = enabled ? '.42s' : '1.8s'; };
const showBubble = (content, duration = 3000, html = false) => { clearTimeout(messageTimer); if (html) bubble.innerHTML = content; else bubble.textContent = content; bubble.classList.add('show'); react(true); showingMessage = true; messageTimer = setTimeout(() => { bubble.classList.remove('show'); react(false); showingMessage = false; playNext(); }, duration); };
const playNext = () => { if (showingMessage || !messageQueue.length || settingsPanel.classList.contains('open')) return; showBubble(messageQueue.shift()); };
const statsHtml = () => { const state = snapshot?.state; if (!state) return '<span>等待 Super Productivity…</span>'; const next = 100 + state.level * 25; return `<strong>Lv.${state.level}</strong><span>XP ${state.xp} / ${next}</span><br><em>◆ ${state.pet.condition}</em><span>🔥 ${state.streak} 天</span><span> ◈ ${state.coins}</span>`; };

function renderSkin(skin) { const id = skin?.meta?.id || null; if (id === activeSkinId) return; activeSkinId = id; petZone.classList.toggle('custom', Boolean(skin)); if (skin) { customSprite.style.backgroundImage = `url("${skin.imageDataUrl}")`; customSprite.style.backgroundSize = skin.meta.spriteVersionNumber >= 2 ? '800% 1100%' : 'contain'; customSprite.title = skin.meta.displayName; } else { customSprite.style.backgroundImage = ''; customSprite.title = ''; } }
function render(next) {
  snapshot = next; idleLines = next.petProfile?.idleLines?.filter(Boolean) || idleLines; clickLines = next.petProfile?.clickLines?.filter(Boolean) || clickLines; renderSkin(next.skin);
  pet.className = `pet ${next.state?.pet?.skinPart || ''}`; const connected = Boolean(next.bridge?.connected); document.getElementById('connection').className = `connection ${connected ? 'connected' : ''}`; document.getElementById('connection').textContent = connected ? `● CONNECTED // 127.0.0.1:${next.bridge.port}` : `● DISCONNECTED // 127.0.0.1:${next.bridge?.port || 47821}`; document.getElementById('data-dir').textContent = next.dataDirectory || '';
  const size = Number(next.petSettings?.size || 1); document.documentElement.style.setProperty('--scale', size); document.getElementById('size').value = String(Math.round(size * 100)); document.getElementById('size-label').textContent = `${Math.round(size * 100)}%`; document.getElementById('always-top').checked = next.petSettings?.alwaysOnTop !== false;
  for (const entry of next.events || []) { const message = eventMessage(entry); if (message) messageQueue.push(message); } playNext();
}

window.petApi.onSnapshot(render);
petZone.addEventListener('mouseenter', () => { lastInteraction = Date.now(); if (!showingMessage && !settingsPanel.classList.contains('open')) showBubble(statsHtml(), 60_000, true); });
petZone.addEventListener('mouseleave', () => { lastInteraction = Date.now(); if (!messageQueue.length) { clearTimeout(messageTimer); bubble.classList.remove('show'); react(false); showingMessage = false; } });
petZone.addEventListener('click', () => { lastInteraction = Date.now(); contextMenu.classList.remove('open'); showBubble(randomLine(clickLines, '收到！')); });
document.body.addEventListener('contextmenu', (event) => { event.preventDefault(); lastInteraction = Date.now(); contextMenu.classList.toggle('open'); });
document.body.addEventListener('click', (event) => { if (!event.target.closest('#context-menu') && !event.target.closest('#pet-zone')) contextMenu.classList.remove('open'); });
setInterval(() => { if (Date.now() - lastInteraction > 45_000 && !showingMessage && !settingsPanel.classList.contains('open') && Math.random() < .38) { showBubble(randomLine(idleLines, '我会在这里等你。')); lastInteraction = Date.now(); } }, 12_000);
setInterval(() => { if (!activeSkinId || customSprite.style.backgroundSize === 'contain') return; frame = (frame + 1) % 7; customSprite.style.backgroundPosition = `${(frame % 8) / 7 * 100}% 0%`; }, 220);

const openSettings = () => { contextMenu.classList.remove('open'); settingsPanel.classList.add('open'); window.petApi.setSettingsOpen(true); };
const closeSettings = () => { settingsPanel.classList.remove('open'); window.petApi.setSettingsOpen(false); };
document.getElementById('open-settings').addEventListener('click', openSettings); document.getElementById('settings-close').addEventListener('click', closeSettings); window.petApi.onOpenSettings(openSettings);
document.getElementById('hide').addEventListener('click', () => window.petApi.hide()); document.getElementById('close').addEventListener('click', () => window.petApi.close());
document.getElementById('skin').addEventListener('click', async () => { try { const skin = await window.petApi.selectSkin(); if (skin) { renderSkin(skin); showBubble(`已载入皮肤：${skin.meta.displayName}`); } } catch (error) { showBubble(error.message || String(error)); } });
document.getElementById('clear-skin').addEventListener('click', async () => { await window.petApi.clearSkin(); renderSkin(null); showBubble('已恢复默认外观。'); });
document.getElementById('always-top').addEventListener('change', (event) => window.petApi.setAlwaysOnTop(event.target.checked));
document.getElementById('size').addEventListener('input', (event) => { const size = Number(event.target.value) / 100; document.documentElement.style.setProperty('--scale', size); document.getElementById('size-label').textContent = `${event.target.value}%`; });
document.getElementById('size').addEventListener('change', (event) => window.petApi.setSize(Number(event.target.value) / 100));
window.petApi.onOpenSkinPicker(() => document.getElementById('skin').click());
