# 自定义桌宠角色

右键桌宠打开“桌宠设置”，点击“导入文件夹”。程序会校验并复制角色目录到 `%APPDATA%\SPPet\characters`，因此更新或重装 SPPet 不会覆盖自定义资源。

## 推荐格式：manifest.json

```text
my-pet/
├─ manifest.json
├─ sprites/
│  ├─ idle.png
│  └─ happy.webp
└─ animations/
   └─ walk/
      ├─ 1.png
      └─ 2.png
```

```json
{
  "manifestVersion": 1,
  "id": "my_pet",
  "name": "我的伙伴",
  "type": "sprite",
  "author": "",
  "version": "1.0.0",
  "states": {
    "idle": "sprites/idle.png",
    "happy": "sprites/happy.webp"
  },
  "animations": {
    "walk": {
      "type": "frames",
      "frames": ["animations/walk/1.png", "animations/walk/2.png"],
      "fps": 8,
      "loop": true
    }
  },
  "outfits": [],
  "accessories": [],
  "effects": {},
  "sounds": { "happy": "sounds/happy.ogg" }
}
```

- `type` 可为 `emoji` 或 `sprite`。emoji 角色直接把 emoji 写进 `states`；sprite 角色支持 PNG、WebP、GIF、APNG，单文件上限 15MB。
- 必须提供 `idle`。其余状态缺失或可选动画损坏时自动回退到 `idle`，不会阻止桌宠启动。
- 已预留 `outfits`、`accessories`、`effects`、`sounds` 图层和资源接口；当前版本先切换完整角色资源组。
- 状态音效支持 MP3、Ogg、WAV，并与对应动作同时播放。
- 可在设置中预览动作、切换角色和删除用户角色。内置角色不能删除。
- `.sppetpack`、Spine、Live2D 是后续扩展格式，当前版本不处理。

## 兼容旧格式：pet.json

旧版 Codex 风格精灵表仍可通过“兼容旧皮肤”导入。该方式继续读取原目录，不会复制文件，建议新角色改用 `manifest.json`。
