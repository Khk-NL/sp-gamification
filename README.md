# SPPet

SPPet 是一个由 Super Productivity 驱动的学习养成与桌宠系统。它不修改 SP Core，通过官方 Plugin API 读取任务和专注变化，再把委托、成长、回合制冒险和桌宠状态交给独立游戏引擎处理。

界面采用深色档案区与浅色展示区的斜向分割、编号轨道、超大档案编号、网格/准星、斜切卡片和蓝色信号线；只参考同类战术终端的信息层级，不包含《明日方舟》官方角色、Logo、字体或美术资源。

## 项目结构

```text
sppet/
├─ packages/
│  ├─ core/
│  │  └─ src/
│  │     ├─ types.ts      # 状态、战斗、道具和内容结构
│  │     ├─ catalog.ts    # 内置技能、装备、敌人和章节
│  │     ├─ engine.ts     # 委托、签到、养成与回合制规则
│  │     └─ index.ts      # 公共导出
│  ├─ sp-plugin/
│  │  ├─ src/             # SP hooks、存储、桌宠桥接、网站连接
│  │  └─ static/          # 独立 HTML / CSS / JS 面板
│  ├─ desktop-pet/        # Electron 透明桌宠与 localhost 服务
│  └─ website/            # 排行榜、编辑器、SQLite 登录与本地启动脚本
├─ CHANGELOG.md
└─ README.md
```

网站与 Nginx 配置从 v0.3.1 起纳入仓库，同时同步交付到 `D:\temp\SPPet\deploy\website`。

## 安装插件

```powershell
pnpm install
pnpm package:plugin
```

生成：

```text
packages\sp-plugin\release\SPPet-SP-v0.3.1.zip
```

在 Super Productivity“设置 → 插件 → 选择插件文件”中导入。最低支持 SP 18.21.2。

插件内部仍使用旧 ID `sp-gamification` 和旧状态键，这是升级兼容措施，不是当前产品名称。修改它们会让 SP 将插件识别成全新插件，并失去对旧同步状态的直接访问。

## 启动桌宠

开发启动：

```powershell
pnpm dev:pet
```

便携版：

```powershell
pnpm package:pet
```

解压 `SPPet-v0.3.1-win-x64.zip`，运行 `SPPet.exe`。桌宠默认只显示角色：

- 悬停：显示 Lv、XP、状态值、streak、金币。
- 左键：播放用户设置的互动台词。
- 长时间未互动：间歇播放闲置台词。
- 右键：显示菜单，再进入连接、皮肤、大小和置顶设置。
- 顶部半透明小点区域：拖动桌宠。

自定义皮肤格式见 `packages/desktop-pet/CUSTOM_SKINS.md`。

## 游戏规则

- SP 任务和专注只推进每日委托；完成委托获得经验。
- 签到、升级和战斗获得金币；连续签到奖励逐日提高，7 天封顶。
- 升级提高最大 HP、攻击和防御。
- 桌宠每连续断连一段可配置时间会降低状态值；食物可以恢复 HP/状态或提供下一场战斗 Buff。
- 冒险采用回合制。资源点从 1 开始，每回合回满且上限 +1，最高 5，战斗后重置。
- 技能包含物理、火、水、冰、电伤害，并可提供护盾、治疗、灼烧和削弱。
- 武器、护甲、饰品提供属性与元素加成；同套装备可触发额外效果。
- 每章有普通敌人和小 Boss，敌方下一行动以“意图”显示。
- 每场战斗包含可跳过的战前/战后剧情；战后奖励只结算一次，剧情结束才推进关卡。

## 插件导航

底栏固定为四项：

1. 概览：等级、委托、签到和汇总状态。
2. 养成：宠物属性、抗性、装备、商店、食物和宠物台词。
3. 冒险：剧情、敌人意图、技能与回合制战斗。
4. 设置：语言、提醒、委托数值、断连衰减、连接测试、导入导出和网站链接。

排行榜不在插件中渲染；同步默认关闭，用户可在设置中主动启用，再通过超链接打开网站。

## 本地通信和数据

```text
SP Plugin → ws://127.0.0.1:47821 → SPPet → JSON
```

数据位置：

```text
%APPDATA%\SPPet\state.json
%APPDATA%\SPPet\events.json
%APPDATA%\SPPet\pet-cursor.json
%APPDATA%\SPPet\pet-settings.json
%APPDATA%\SPPet\pet-profile.json
```

首次启动会从旧 `%APPDATA%\sp-gamification` 复制尚未存在的兼容文件。任务 ID、专注累计值和桌宠事件游标继续防止重复奖励/重复播报。

## 网站部署

源码位于 `packages\website`，可双击 `start-local.bat` 启动；同步部署包位于 `D:\temp\SPPet\deploy\website`，包括：

- `/`：公开排行榜。
- `/tools.html`：状态 JSON 本地导入/导出、战前/战后剧情编辑。
- `/developer.html`：道具、技能、怪物、抗性、行动意图和奖励数值编辑。
- `/login.html`：SQLite 本地账号注册、登录和会话管理。
- `server.mjs`：无第三方依赖的 Node 服务；需要 Node.js 22.5 或更高版本。
- `start-local.bat`：配置本地注册环境并打开登录页。
- `nginx-sppet.conf` / `nginx-location-snippet.conf`：反向代理配置。

本地首次注册的账号自动成为管理员；公网部署也可以用 `SPPET_ADMIN_USER`、`SPPET_ADMIN_PASSWORD` 预置管理员。账号和会话存入 `data\sppet.db`。旧的 `SPPET_ADMIN_KEY` 发布方式仍兼容。插件从 `https://sppet.scsldr.cn/api/content` 获取内容，离线时继续使用内置目录。

## 集中验证

```powershell
pnpm test
pnpm build
pnpm package:all
```

完整版本变化见 [CHANGELOG.md](CHANGELOG.md)。
