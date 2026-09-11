const $ = (id) => document.getElementById(id);
let mode = 'login';
let registrationOpen = false;

const setMode = (nextMode) => {
  mode = nextMode;
  const registering = mode === 'register';
  $('auth-title').textContent = registering ? '创建本地账号' : '登录终端';
  $('auth-mode').textContent = registering ? 'REGISTER // LOCAL DATABASE' : 'LOGIN // SESSION 7 DAYS';
  $('submit').textContent = registering ? '创建并登录' : '登录';
  $('switch-copy').textContent = registering ? '已有账号？' : '还没有账号？';
  $('switch-mode').textContent = registering ? '返回登录' : '创建账号';
};

const refreshSession = async () => {
  const response = await fetch('./api/auth/me');
  const result = await response.json();
  registrationOpen = result.registrationOpen;
  if (result.authenticated) {
    $('current-user').hidden = false;
    $('current-user').textContent = `AUTHORIZED // ${result.user.username} // ${result.user.role.toUpperCase()}`;
    $('auth-form').hidden = true;
    $('logout').hidden = false;
    $('switch-copy').parentElement.hidden = true;
  } else {
    $('current-user').hidden = true;
    $('auth-form').hidden = false;
    $('logout').hidden = true;
    $('switch-copy').parentElement.hidden = !registrationOpen;
  }
};

$('switch-mode').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch(`./api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: $('username').value, password: $('password').value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || response.statusText);
    $('auth-message').textContent = `${mode === 'register' ? '账号已创建' : '登录成功'} // ${result.user.username}`;
    $('password').value = '';
    await refreshSession();
  } catch (error) { $('auth-message').textContent = `验证失败：${error.message}`; }
});
$('logout').addEventListener('click', async () => { await fetch('./api/auth/logout', { method: 'POST' }); $('auth-message').textContent = '已退出登录。'; setMode('login'); await refreshSession(); });

refreshSession().catch((error) => { $('auth-message').textContent = `服务连接失败：${error.message}`; });
