# FEATURE_ROADMAP 完成状态

核对基准：`D:\Code\sppet\FEATURE_ROADMAP.md`。本文区分“已实现”和路线图本身标为“未来/后续/逐步”的扩展，避免把预留接口写成已完成功能。

## Phase 0–10

| 阶段 | 状态 | 主要证据 |
|---|---|---|
| 0 现状审计 | 完成 | `DEVELOP_LOG.md`、`HANDOFF.md` |
| 1 核心稳定 | 完成 | `core/event-bus.ts`、`core/engine.ts`、SP hooks、桌宠桥接 |
| 2 战斗 | 完成 | 分叉地图、Boss、4 技能、5 RP、意图、元素、剧情、Buff/Debuff |
| 3 背包养成 | 完成 | 商店、背包、食物/药品、技能/装备强化和持续金币出口 |
| 4 桌宠行为 | 完成 | 透明置顶、拖拽/重力/边缘/多屏、托盘、动作状态机、AssetManager |
| 5 AI | 完成 | 独立 AI Service、可编辑 Prompt、御主档案、真实历史删除 |
| 6 系统感知/专注 | 完成 | 权限默认关闭；主动 Vision；本地窗口分类；计时、提醒、封顶奖励 |
| 7 生产力模块 | 完成 | 课程、日记、长期目标、重要日子均独立且默认关闭 |
| 8 在线服务 | 完成 | 统一 `/api/v1`、Catalog、可选排行榜、更新清单、活动 |
| 9 高级 AI | 完成 | SQLite 长期记忆、主动观察日记、TTS Provider 和两态口型 |
| 10 多角色扩展 | 完成 | 独立角色档案、昼夜/情绪/主动行为、分层资源、`.sppetpack`、非付费招募 |

## 明确约束核对

- 不修改 Super Productivity Core；插件只使用官方 Plugin API/hook 和 iframe 消息。
- 战斗、AI、排行榜及四个生产力模块均可关闭；桌宠可在没有 SP、AI、网站时独立运行。
- 任务本身不直接无限发 XP；每日委托与专注奖励有每日上限，task/session/source 均去重。
- 战斗公式保持“技能伤害 × 属性倍率 − 防御，护盾优先”；抗性字段不参与计算；百分比只落入 10/20/50 档。
- 招募没有付费入口，不以纯数值装备为主要奖励；周委托、streak、Boss、长期目标来源去重并有十抽保底。
- 自定义角色资源保存在 `%APPDATA%\SPPet\characters`；缺失状态回退 idle，导入校验路径和大小，不把磁盘访问散落到业务层。
- 战斗元素颜色、命中和护盾特效由 `GameContent.battleVisuals` 配置选择。
- AI Key/TTS Key 只在当前进程内存；排行榜 Token 服务端只保存哈希；截图不落盘；日记只在独立授权并主动点击后读取。
- 窗口、Vision、剪贴板、文件整理、遥测分别授权且默认关闭；当前版本后三项明确不读取、不操作、不采集。
- 更新包必须 HTTPS、用户确认、SHA-256 校验；SP 官方没有插件自安装 API，因此仍由用户选择 ZIP 安装。

## 路线图明确保留的扩展

以下项目在原路线图中写为“未来”“后续”“逐步”或能力池，不属于 Phase 0–10 的当前强制完成面：

- Spine/Live2D 解析、复杂 Lip Sync、实时 STT。
- OCR、低频自动 Vision、联网天气、剪贴板互动、快速启动器、书签和小游戏。
- 用户确认型文件整理器；当前只有独立关闭的权限占位，不执行文件操作。
- 多角色同屏及角色间 Event Bus 对话；当前只有可切换的多角色独立数据，禁止 AI-to-AI 无限对话。
- 复杂资源商店、云同步、付费抽取和强制昼夜锁定均不实现。

## 集中验证入口

- core：TypeScript build + `node --test test/*.test.mjs`
- sp-plugin：build + TypeScript noEmit + iframe smoke
- desktop-pet：主进程/preload/renderer syntax + `node --test test/*.test.cjs`
- website：`node --test test/*.test.mjs`

