# DSH Model Presets

English | [中文](README.md)

![DSH Model Presets interface preview](assets/preview.png)

A permanently installed DeepSeek Harness web plugin that pins frequently used **model + reasoning effort** combinations to the top of the composer model menu.

## Features

- Saves frequently used model and reasoning-effort combinations.
- Switches presets from the top of the model list with one click.
- Adds, renames, reorders, and deletes presets.
- Searches available models.
- Keeps presets after Harness restarts with browser-local persistence.

## Install

```sh
dsh plugin --profile web add https://github.com/Zding89/dsh-model-presets
```

Restart DSH Web after installation. This is a normal profile bundle and does not create a dynamic Cordis plugin run record.

The repository carries the GitHub `dsh-plugin` topic and will be submitted to the curated `awesome-dsh-plugin` registry. Once listed, search for **DSH Model Presets** in DSH's **Plugin Market**.

## Use

1. Open the model selector at the bottom of the composer.
2. Pick a model and reasoning effort.
3. Select `+` at the top to save the current combination.
4. Select a preset name to switch immediately.
5. Select `⋯` to rename, reorder, or delete presets.

On first use, the current selection becomes the initial preset. Deleting every preset does not seed it again.

## Data and privacy

Presets stay in the current browser's `localStorage` under `dsh-model-presets:v1`. The plugin sends no telemetry and makes no external network requests.

Presets do not sync across browser profiles, devices, or origins. The plugin reads and stores at most 50 presets.

## Compatibility

- DeepSeek Harness `0.1.0-rc.7` or a compatible newer release.
- Uses DSH's built-in `modelDirectories` service and `conversation.input.model` Slot.
- The current release targets the Web profile.

## Development

The repository commits the prebuilt browser bundle, so GitHub installation runs no build script.

```sh
npm run check
```

## Uninstall

```sh
dsh plugin --profile web remove dsh-model-presets
```

Restart DSH Web afterward. Uninstalling does not clear presets already stored by the browser.

## License

MIT
