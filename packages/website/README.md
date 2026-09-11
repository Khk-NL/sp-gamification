# SPPet 网站

## Windows 本地启动

需要 Node.js 22.5 或更高版本。双击：

```text
start-local.bat
```

脚本会启用本地注册、启动 `127.0.0.1:47822`，并打开登录页面。首次注册的账号自动成为管理员。本地 SQLite 数据库位于：

```text
data\sppet.db
```

## 服务器启动

公网环境默认关闭任意注册。推荐通过运行环境的 Secret 配置预置管理员，值不要写进仓库：

```bash
cd /opt/sppet
export SPPET_ADMIN_USER='你的管理员用户名'
export SPPET_ADMIN_PASSWORD='你的高强度密码'
node server.mjs
```

也可以临时设置 `SPPET_ALLOW_REGISTER=1`，完成第一个管理员注册后移除该变量并重启。旧版 `SPPET_ADMIN_KEY` 仍可用于兼容发布接口。

服务只监听 `127.0.0.1:47822`，由 Nginx/1Panel 为 `sppet.scsldr.cn` 提供 HTTPS。HTTPS 反代时会自动给登录 Cookie 增加 `Secure`。

## 页面

- `/`：公开排行榜。
- `/login.html`：注册、登录、退出和当前会话。
- `/tools.html`：状态 JSON 本地导入/导出、战前/战后剧情编辑。
- `/developer.html`：道具、技能、敌人、Buff / Debuff、行动意图与奖励数值编辑。

剧情和数值保存需要管理员会话。插件读取 `/api/content` 不需要登录；排行榜同步仍默认关闭。

## 数据

- `data/sppet.db`：SQLite 用户与会话。
- `data/leaderboard.json`：排行榜。
- `data/content.json`：发布后的内容；不存在时使用 `default-content.json`。

`data/` 已加入 `.gitignore`，不会把本地账号、会话或榜单提交到 GitHub。
