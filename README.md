# DSH Model Presets

[English](README.en.md) | 中文

![DSH Model Presets 界面预览](assets/preview.png)

一个永久安装的 DeepSeek Harness Web 插件，把常用的 **模型 + 推理等级** 组合固定在编辑器模型菜单顶部。

## 功能

- 保存常用的模型与推理等级组合。
- 在模型列表顶部一键切换预设。
- 支持添加、重命名、排序和删除预设。
- 支持搜索模型。
- 预设保存在浏览器本地，重启 Harness 后仍然存在。

## 安装

```sh
dsh plugin --profile web add https://github.com/Zding89/dsh-model-presets
```

安装后重启 DSH Web。插件以普通 bundle 方式挂载，不会创建动态 Cordis 插件运行记录。

仓库带有 GitHub `dsh-plugin` topic，并将提交到 `awesome-dsh-plugin` 精选目录；收录后可在 DSH 的 **Plugin Market** 中搜索 **DSH Model Presets** 并安装。

## 使用

1. 打开编辑器底部的模型选择器。
2. 选择模型和推理等级。
3. 点击顶部的 `+` 保存当前组合。
4. 点击预设名称即可立即切换。
5. 点击 `⋯` 可重命名、排序或删除预设。

首次运行且还没有保存记录时，插件会把当前模型组合建立为第一个预设。用户删除全部预设后不会再次自动创建。

## 数据与隐私

预设仅保存在当前浏览器的 `localStorage` 中，键名为 `dsh-model-presets:v1`。插件不发送遥测，也不访问外部网络。

浏览器配置、设备或域名不同，预设不会自动同步。最多读取和保存 50 个预设。

## 兼容性

- DeepSeek Harness `0.1.0-rc.7` 或更新的兼容版本。
- 依赖 DSH 自带的 `modelDirectories` 服务和 `conversation.input.model` Slot。
- 当前版本面向 Web profile。

## 开发

仓库提交预构建的浏览器 bundle，GitHub 安装时不需要执行构建脚本。

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
