# 像素远征：Super Productivity 任务养成 + 独立桌宠

不修改 Super Productivity Core。SP 插件通过官方 hooks 把任务与专注记录交给独立 `core`，再用 localhost WebSocket 与 Electron 桌宠实时通信。桌宠同时把状态落盘为 JSON，重启后可以恢复。

## 目录结构与职责

```text
sp-gamification/
├─ packages/
│  ├─ core/          # 奖励、等级、streak、Boss、委托、商店；无 SP/Electron 依赖
│  ├─ sp-plugin/     # SP hooks、同步存储、像素面板、设置、排行榜客户端
│  └─ desktop-pet/   # 透明置顶桌宠、本地桥接、JSON 落盘、自定义皮肤
└─ README.md
```

## 修改插件在 SP 中显示的名称

修改 `packages/sp-plugin/static/manifest.json` 的 `name`。为了让不同语言下也一致，再同步修改：

- `packages/sp-plugin/static/i18n/zh.json` 的 `PLUGIN.NAME`
- `packages/sp-plugin/static/i18n/en.json` 的 `PLUGIN.NAME`

然后重新执行 `pnpm package:plugin`，在 SP 中卸载/更新旧插件并导入新 ZIP。不要修改 `id: "sp-gamification"`，否则 SP 会把它当成另一个插件，旧成长数据也不会自动关联。

## 构建与安装 SP 插件

```powershell
pnpm install
pnpm package:plugin
```

生成 `packages/sp-plugin/release/sp-gamification-v0.2.0.zip`。在 Super Productivity 中进入“设置 → 插件 → 选择插件文件”，导入 ZIP 并启用。最低支持 SP 18.21.2。

新版不再依赖上传插件不可用的 `nodeExecution`。桌宠启动后监听 `ws://127.0.0.1:47821`；插件面板的“桌宠连接”会明确显示连接结果。

## 启动桌宠

开发启动：

```powershell
pnpm dev:pet
```

打包便携版：

```powershell
pnpm package:pet
```

解压 `packages/desktop-pet/release/sp-gamification-pet-v0.2.0-win-x64.zip`，运行 `SP Gamification Pet.exe`。窗口支持拖动、隐藏、托盘恢复、退出与始终置顶。皮肤导入格式见 `packages/desktop-pet/CUSTOM_SKINS.md`。

## 数据与通信

长期主状态保存在 SP 插件同步存储。桌宠收到实时消息后，原子写入：

```text
%APPDATA%\sp-gamification\state.json
%APPDATA%\sp-gamification\events.json
%APPDATA%\sp-gamification\pet-cursor.json
%APPDATA%\sp-gamification\pet-settings.json
```

- 插件 → `ws://127.0.0.1:47821` → 桌宠，是当前实时通道。
- 桌宠保存最近 100 个事件和消费游标，重启不会重新播放旧奖励。
- `processedTaskIds` 防止同一任务完成事件重复结算；按任务保存已观察专注分钟数，防止专注重复结算。

## 当前已实现

- 任务 XP/金币、自定义奖励数值、等级、自然日 streak、今日/总任务数。
- 按累计专注分钟结算，避免重复奖励。
- 三个原创冒险区域、Boss 血量与推进；普通任务 10 伤害，`#deep-work` 15，`#hard` 20，标题 `[dmg:N]` 可指定伤害。
- 每日“完成 3 个任务”和“专注 50 分钟”委托及金币奖励。
- 三件饰品的购买、背包与装备，装备同步显示到插件角色和桌宠。
- 高饱和原创 2D 像素冒险面板：冒险、委托、商店、排行榜、设置五页。
- 中英文切换、系统奖励提醒、奖励参数、排行榜开关与昵称设置。
- Electron 透明置顶桌宠、事件动作、多类气泡反馈、自定义 `pet.json + spritesheet` 皮肤。
- 排行榜客户端仅上传昵称和汇总统计，不上传任务标题；默认关闭。

## 集中验证

```powershell
pnpm test
pnpm build
pnpm package:all
```

真实验收建议只走一次核心路径：启动桌宠 → 导入插件 → 面板确认“已连接” → 模拟完成任务 → 查看 Boss 扣血、JSON 更新和桌宠气泡。
