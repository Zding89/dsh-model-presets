# DSH Model Presets

[English](README.md) | 中文

![DSH Model Presets 界面预览](assets/preview.png)

在 DeepSeek Harness 的模型菜单里保存常用的 **模型 + 推理等级** 组合，点一下就能切换。

## 功能

- 保存常用的模型与推理等级组合。
- 在模型列表顶部一键切换预设。
- 支持添加、重命名、排序和删除预设。
- 支持搜索模型。
- 按 `Alt/Option + 1–9` 切换前 9 个预设；在输入框内不会触发。
- 预设保存在浏览器本地，重启 Harness 后仍然存在。

每个预设都会记录保存时使用的 API 服务商、模型和推理等级。同名模型如果来自不同服务商，会被视为不同组合。服务商或模型暂时不可用时，预设会变淡并停止响应；恢复后会自动恢复正常。

## 安装

```sh
dsh plugin --profile web add https://github.com/Zding89/dsh-model-presets
```

安装后重启 DSH Web。收录后也可以直接在 DSH 的 **Plugin Market** 中搜索安装。

## 使用

1. 打开编辑器底部的模型选择器。
2. 选择模型和推理等级。
3. 点击顶部的 `+` 保存当前组合。
4. 点击预设名称即可立即切换。
5. 点击 `⋯` 可重命名、排序或删除预设。

第一次使用时，当前组合会自动保存为第一个预设。删除全部预设后不会再次自动添加。

## 数据与隐私

预设只保存在当前浏览器中，不会上传。不同浏览器、设备或访问地址之间不会自动同步，最多保存 50 个。

## 兼容性

- DeepSeek Harness `0.1.0-rc.7` 或更新的兼容版本。
- 依赖 DSH 自带的 `modelDirectories` 服务和 `conversation.input.model` Slot。
- 当前版本面向 Web profile。

## 开发

仓库已包含浏览器 bundle，安装时无需本地构建。

```sh
npm run check
```

## 卸载

```sh
dsh plugin --profile web remove dsh-model-presets
```

重启 DSH Web 后生效。卸载不会自动删除浏览器中保存的预设。

## License

MIT
