# SPPet 阶段交接

## 当前阶段

Phase 2 已完成，当前版本 `0.5.0`；下一阶段为 Phase 3（背包、食物、商店、装备、技能）。

## 已完成

- 核心成长资源：XP、金币、状态、好感度、等级、streak。
- 四类每日委托、每日 XP 上限、专注分档奖励和防重复结算。
- 通用 Event Bus 以及 SP、桌宠现实事件接入。
- 陪伴/冒险模式切换，陪伴模式不加载战斗入口。
- SP 同步存储、桌宠本地桥接和旧 v3 存档迁移。
- 战斗规则已按路线图收口，状态值会以四档明确倍率影响战斗 XP 与金币。

## 重要文件

- `packages/core/src/event-bus.ts`：统一异步事件总线。
- `packages/core/src/types.ts`：v4 状态、好感、模式与事件类型。
- `packages/core/src/engine.ts`：成长、奖励、状态迁移和当前战斗引擎。
- `packages/sp-plugin/src/plugin.ts`：SP hooks、事件适配、持久化与本地/在线通信。
- `packages/desktop-pet/src/main.cjs`：桌宠窗口、本地 WebSocket 与 IPC。
- `DEVELOP_LOG.md`：阶段审计和完成记录。

## 当前数据结构

- `SPPetState.version = 4`。
- 根状态包含 `mode`、等级/XP/金币/streak、累计统计、当天统计、去重记录和委托。
- `today` 包含日期、任务数、当日 XP、已结算专注奖励档数。
- `commissions` 包含任务、专注、高优先级任务、每日复盘。
- `pet.affinity` 包含点数、阶段、当日抚摸日期与次数。
- 旧存档通过 `hydrateState()` 自动补全，不进行破坏性迁移。

## 已知问题

- 高优先级任务暂以 SP 标签 `high`、`high priority`、`高优先级` 或 `重要` 判断；官方 Plugin API 当前暴露的任务类型没有稳定优先级字段。
- Event Bus 已覆盖现实行为入口；战斗/商店 UI 命令仍由插件适配层调用 core，待对应模块拆分阶段继续迁移。
- 桌宠高级物理、统一资源 manifest、AI、生产力模块、`/api/v1` 在线服务与更新器尚未完成。
- pnpm 当前运行时版本与已有 `node_modules` 元数据不一致，会尝试重装；本阶段使用仓库现有 `node_modules/.bin` 工具验证，没有重装依赖。

## 下一阶段

Phase 3 在现有 Catalog 与背包结构上增加可持续金币消耗、补给节点和强化入口，不改动简化伤害公式。
