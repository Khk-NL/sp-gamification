# SPPet 阶段交接

## 当前阶段

Phase 7 已完成，当前版本 `0.11.0`；下一阶段为 Phase 8（统一在线 API）。

## 已完成

- 核心成长资源：XP、金币、状态、好感度、等级、streak。
- 四类每日委托、每日 XP 上限、专注分档奖励和防重复结算。
- 通用 Event Bus 以及 SP、桌宠现实事件接入。
- 陪伴/冒险模式切换，陪伴模式不加载战斗入口。
- SP 同步存储、桌宠本地桥接和旧 v3 存档迁移。
- 战斗规则已按路线图收口，状态值会以四档明确倍率影响战斗 XP 与金币。
- 背包、重复消耗品、商店轮换、技能强化和装备强化已形成完整金币消费路径。
- 桌宠具备可选重力、底部站立、屏幕边缘吸附、多显示器约束和默认关闭的间歇行走。
- AssetManager 统一加载内置/自定义角色，可切换、删除、预览和热重载 emoji、静态图、逐帧动画及状态音效。
- 独立 AI Service 提供可编辑角色 Prompt、御主档案、OpenAI-compatible 聊天和实际本地历史删除；AI 默认关闭且 API Key 不落盘。
- System Awareness 将当前窗口读取和主动 Vision 拆成两项默认关闭的权限；窗口信息不自动持久化，截图不落盘。
- 专注计时支持用户自定义窗口分类、本地偏离提醒、断线待结算、session 去重和每日 4 次奖励上限。
- 课程表、日记、长期目标、重要日子作为四个默认关闭的本地可选模块运行，并发送课程、目标和日期事件。

## 重要文件

- `packages/core/src/event-bus.ts`：统一异步事件总线。
- `packages/core/src/types.ts`：v4 状态、好感、模式与事件类型。
- `packages/core/src/engine.ts`：成长、奖励、状态迁移和当前战斗引擎。
- `packages/sp-plugin/src/plugin.ts`：SP hooks、事件适配、持久化与本地/在线通信。
- `packages/desktop-pet/src/main.cjs`：桌宠窗口、本地 WebSocket 与 IPC。
- `packages/desktop-pet/src/asset-manager.cjs`：角色 manifest、资源校验、缓存、导入与回退。
- `packages/desktop-pet/src/ai-service.cjs`：AI 配置、System Prompt、御主档案、短期上下文和本地历史。
- `packages/desktop-pet/src/system-awareness.cjs`：授权配置与 Windows 当前窗口单次探针。
- `packages/desktop-pet/src/focus-timer.cjs`：计时状态、用户分类规则和待确认奖励。
- `packages/desktop-pet/src/productivity-modules.cjs`：四类可选个人计划数据、授权和提醒事件。
- `DEVELOP_LOG.md`：阶段审计和完成记录。

## 当前数据结构

- `SPPetState.version = 6`。
- 根状态包含 `mode`、等级/XP/金币/streak、累计统计、当天统计、任务/专注 session 去重记录和委托。
- `today` 包含日期、任务数、当日 XP、已结算专注奖励档数。
- `commissions` 包含任务、专注、高优先级任务、每日复盘。
- `pet.affinity` 包含点数、阶段、当日抚摸日期与次数。
- `pet.skillLevels`、`pet.equipmentLevels` 保存三级强化进度；`shop` 保存当天刷新次数与轮换商品。
- 旧存档通过 `hydrateState()` 自动补全，不进行破坏性迁移。

## 已知问题

- 高优先级任务暂以 SP 标签 `high`、`high priority`、`高优先级` 或 `重要` 判断；官方 Plugin API 当前暴露的任务类型没有稳定优先级字段。
- Event Bus 已覆盖现实行为入口；战斗/商店 UI 命令仍由插件适配层调用 core，待对应模块拆分阶段继续迁移。
- 桌宠暂不识别其他应用窗口顶部；Spine/Live2D、多层实时换装、生产力模块、长期记忆、`/api/v1` 在线服务与更新器尚未完成。
- pnpm 当前运行时版本与已有 `node_modules` 元数据不一致，会尝试重装；本阶段使用仓库现有 `node_modules/.bin` 工具验证，没有重装依赖。

## 下一阶段

Phase 8 收敛在线 URL 和路径，建立统一 `/api/v1` Client、离线缓存与可选排行榜/内容服务。
