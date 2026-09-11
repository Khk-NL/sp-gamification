# SPPet 美术资源边界

- `characters/`：每个角色一个目录和 `manifest.json`，业务层只接收 `AssetManager` 解析后的资源。
- `battle/`：按元素、命中、护盾、Buff、Debuff、胜利和失败拆分，供后续统一内容包加载。
- `ui/`：图标、好感、状态、货币、背包、战斗和对话 UI。
- `weather/`：天气覆盖层。
- `common/`：跨角色共享资源。

当前内置角色优先使用 emoji，不包含第三方游戏素材。Spine、Live2D 与 `.sppetpack` 仅保留扩展位。
