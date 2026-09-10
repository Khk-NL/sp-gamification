const bubble = document.getElementById('bubble');
const pet = document.getElementById('pet');
const stage = document.querySelector('.stage');
const customSprite = document.getElementById('custom-sprite');
const accessory = document.getElementById('accessory');
const messageQueue = [];
let showingMessage = false;
let activeSkinId = null;
let frame = 0;

const eventMessage = (event) => {
  const p = event.payload || {};
  if (event.type === 'TASK_COMPLETED') return `任务完成！+${p.xp} XP +${p.coins} 金币`;
  if (event.type === 'LEVEL_UP') return `升级啦！当前等级 Lv.${p.level}`;
  if (event.type === 'STREAK_UPDATED') return `已经连续完成 ${p.streak} 天了！`;
  if (event.type === 'FOCUS_REWARD') return `专注 ${p.focusMinutes} 分钟，获得 +${p.xp} XP`;
  if (event.type === 'BOSS_HIT') return `命中 ${p.boss}，造成 ${p.damage} 点伤害！`;
  if (event.type === 'BOSS_DEFEATED') return `击败 ${p.boss}！远征继续！`;
  if (event.type === 'QUEST_REWARD') return `今日委托完成，获得 ${p.coins} 金币！`;
  if (event.type === 'ITEM_PURCHASED') return `${p.name} 已加入背包！`;
  return null;
};

const setReacting = (enabled) => {
  pet.classList.toggle('react', enabled);
  customSprite.style.animationDuration = enabled ? '.45s' : '1.7s';
};

const playNextMessage = () => {
  if (showingMessage || !messageQueue.length) return;
  showingMessage = true; bubble.textContent = messageQueue.shift(); setReacting(true);
  setTimeout(() => { setReacting(false); showingMessage = false; playNextMessage(); }, 2600);
};

const renderSkin = (skin) => {
  const id = skin?.meta?.id || null;
  if (id === activeSkinId) return;
  activeSkinId = id;
  stage.classList.toggle('custom', Boolean(skin));
  if (skin) {
    customSprite.style.backgroundImage = `url("${skin.imageDataUrl}")`;
    customSprite.style.backgroundSize = skin.meta.spriteVersionNumber >= 2 ? '800% 1100%' : 'contain';
    customSprite.title = skin.meta.displayName;
  } else { customSprite.style.backgroundImage = ''; customSprite.title = ''; }
};

const renderState = (state) => {
  if (!state) return;
  const required = 100 + state.level * 25;
  document.getElementById('level').textContent = `Lv.${state.level}`;
  document.getElementById('xp').textContent = `XP ${state.xp} / ${required}`;
  document.getElementById('streak').textContent = `🔥 ${state.streak} 天`;
  document.getElementById('coins').textContent = `🪙 ${state.coins}`;
  accessory.className = `accessory ${state.equippedAccessory || ''}`;
};

window.petApi.onSnapshot((snapshot) => {
  renderState(snapshot.state); renderSkin(snapshot.skin);
  document.querySelector('.shell').classList.toggle('connected', Boolean(snapshot.bridge?.connected));
  document.getElementById('connection').textContent = snapshot.bridge?.connected
    ? `实时连接正常 · localhost:${snapshot.bridge.port}`
    : snapshot.state ? `已读取本地状态，等待 SP 实时连接 · localhost:${snapshot.bridge?.port || 47821}` : `等待 SP 插件 · localhost:${snapshot.bridge?.port || 47821}`;
  for (const event of snapshot.events || []) { const message = eventMessage(event); if (message) messageQueue.push(message); }
  if (snapshot.state && !showingMessage && !messageQueue.length) bubble.textContent = snapshot.bridge?.connected ? '连接成功，今天也一起出发吧！' : '已有成长记录，等待 SP 连接。';
  playNextMessage();
});

setInterval(() => {
  if (!activeSkinId || customSprite.style.backgroundSize === 'contain') return;
  frame = (frame + 1) % 7;
  customSprite.style.backgroundPosition = `${(frame % 8) / 7 * 100}% 0%`;
}, 220);

const drawer = document.getElementById('drawer');
document.getElementById('settings').addEventListener('click', () => drawer.classList.toggle('open'));
document.getElementById('hide').addEventListener('click', () => window.petApi.hide());
document.getElementById('close').addEventListener('click', () => window.petApi.close());
document.getElementById('skin').addEventListener('click', async () => { try { const skin = await window.petApi.selectSkin(); if (skin) { renderSkin(skin); bubble.textContent = `已换上 ${skin.meta.displayName}`; drawer.classList.remove('open'); } } catch (error) { bubble.textContent = error.message || String(error); } });
document.getElementById('clear-skin').addEventListener('click', async () => { await window.petApi.clearSkin(); renderSkin(null); bubble.textContent = '已恢复默认像素伙伴'; drawer.classList.remove('open'); });
document.getElementById('always-top').addEventListener('change', (event) => window.petApi.setAlwaysOnTop(event.target.checked));
window.petApi.onOpenSkinPicker(() => document.getElementById('skin').click());
