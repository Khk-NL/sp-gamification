# 自定义桌宠皮肤

右键桌宠，选择“宠物设置”，再导入一个 `pet.json`。皮肤目录至少包含：

```text
my-pet/
├─ pet.json
└─ spritesheet.webp
```

`pet.json` 示例：

```json
{
  "id": "my-pet",
  "displayName": "我的桌宠",
  "description": "本地自定义皮肤",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

- `spriteVersionNumber: 2`：按 Codex Pet 常用的 8 列 × 11 行精灵表读取，当前 MVP 播放第一行前 7 帧作为待机动作。
- `spriteVersionNumber: 1`：把 PNG、WebP 或 GIF 当作单张图片完整显示。
- 图片上限 15MB。路径按 `pet.json` 所在目录解析，不复制原文件。
- 皮肤只保存在本机，不随 SP 同步，也不会上传到排行榜。
