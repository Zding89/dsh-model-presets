/**
 * dsh-model-presets — permanent web client plugin.
 *
 * Replaces the composer model seat with a compact model selector that keeps
 * named provider/model/reasoning combinations at the top of the native-style
 * menu. Presets are browser-local and survive Harness restarts.
 */
window.__ModuleLoader__.load({
  id: 'dsh-model-presets',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    var STORAGE_KEY = 'dsh-model-presets:v1'
    var MAX_PRESETS = 50
    var MAX_ID_LENGTH = 80
    var MAX_NAME_LENGTH = 40
    var MAX_PROVIDER_LENGTH = 160
    var MAX_MODEL_LENGTH = 240
    var MAX_EFFORT_LENGTH = 120
    var LOCALE_NS = 'modelPresets'
    var nextId = 1
    var presetListeners = new Set()

    var DICTIONARIES = {
      zh: {
        'trigger.fallback': '模型',
        'trigger.aria': '选择模型，当前为 {model} · {effort}',
        'effort.default': '默认',
        'effort.groupLabel': '选择推理等级',
        'preset.save': '保存当前组合',
        'preset.manage': '管理预设',
        'preset.saved': '已保存',
        'preset.exists': '当前组合已保存',
        'preset.empty': '暂无预设',
        'preset.name': '{model} · {effort}',
        'preset.unavailable': '对应的 API 站点或模型当前不可用',
        'preset.shortcut': '{name}，快捷键 {shortcut}',
        'shortcut.hint': '快捷键：{shortcut} 切换前 9 个预设；输入时不会触发',
        'manage.save': '保存名称',
        'manage.cancel': '取消编辑',
        'manage.confirmDelete': '确认删除',
        'manage.cancelDelete': '取消删除',
        'manage.moveUp': '上移 {name}',
        'manage.moveDown': '下移 {name}',
        'manage.edit': '重命名 {name}',
        'manage.remove': '删除 {name}',
        'manage.renameLabel': '预设名称：{name}',
        'search.label': '搜索模型',
        'search.placeholder': '搜索模型',
        'search.empty': '没有匹配模型',
        'status.loading': '加载中…',
        'status.loadError': '模型目录加载失败：{message}',
        'status.storageError': '无法保存到浏览器：{message}',
        'status.switchError': '切换失败：{message}',
        'status.imageIncompatible': '当前会话里有图片，DSH 将这个模型标记为仅支持文字。请新建纯文字会话，或选择支持图片的模型。',
        'catalog.unroutable': '当前模型路由不可用，请选择其他模型。',
        'catalog.groupFailure': '{name} 的模型目录加载失败：{message}',
        'dialog.label': '选择模型',
      },
      en: {
        'trigger.fallback': 'Model',
        'trigger.aria': 'Choose model, currently {model} · {effort}',
        'effort.default': 'Default',
        'effort.groupLabel': 'Choose reasoning effort',
        'preset.save': 'Save current combination',
        'preset.manage': 'Manage presets',
        'preset.saved': 'Saved',
        'preset.exists': 'Current combination is already saved',
        'preset.empty': 'No presets yet',
        'preset.name': '{model} · {effort}',
        'preset.unavailable': 'The saved API provider or model is currently unavailable',
        'preset.shortcut': '{name}, shortcut {shortcut}',
        'shortcut.hint': 'Shortcut: {shortcut} switches the first nine presets; disabled while typing',
        'manage.save': 'Save name',
        'manage.cancel': 'Cancel editing',
        'manage.confirmDelete': 'Confirm deletion',
        'manage.cancelDelete': 'Cancel deletion',
        'manage.moveUp': 'Move {name} up',
        'manage.moveDown': 'Move {name} down',
        'manage.edit': 'Rename {name}',
        'manage.remove': 'Delete {name}',
        'manage.renameLabel': 'Preset name: {name}',
        'search.label': 'Search models',
        'search.placeholder': 'Search models',
        'search.empty': 'No matching models',
        'status.loading': 'Loading…',
        'status.loadError': 'Could not load the model catalog: {message}',
        'status.storageError': 'Could not save in this browser: {message}',
        'status.switchError': 'Switch failed: {message}',
        'status.imageIncompatible': 'This conversation contains images, and DSH marks this model as text-only. Start a text-only conversation or choose an image-capable model.',
        'catalog.unroutable': 'The current model route is unavailable. Choose another model.',
        'catalog.groupFailure': 'Could not load the model catalog for {name}: {message}',
        'dialog.label': 'Choose model',
      },
    }

    function copySelection(value) {
      if (!value) return null
      var next = { provider: value.provider, model: value.model }
      if (value.reasoningEffort !== undefined) next.reasoningEffort = value.reasoningEffort
      return next
    }

    function validBoundedString(value, maximum) {
      return typeof value === 'string' && value.length > 0 && value.length <= maximum
    }

    function validSelection(value) {
      return value && typeof value === 'object' &&
        validBoundedString(value.provider, MAX_PROVIDER_LENGTH) &&
        validBoundedString(value.model, MAX_MODEL_LENGTH) &&
        (value.reasoningEffort === undefined || validBoundedString(value.reasoningEffort, MAX_EFFORT_LENGTH))
    }

    function readPresetState() {
      if (typeof localStorage === 'undefined') return { initialized: false, items: [] }
      try {
        var raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { initialized: false, items: [] }
        var documentValue = JSON.parse(raw)
        if (!documentValue || documentValue.version !== 1 || !Array.isArray(documentValue.presets)) {
          return { initialized: false, items: [] }
        }
        var items = []
        var ids = new Set()
        for (var index = 0; index < documentValue.presets.length && items.length < MAX_PRESETS; index += 1) {
          var item = documentValue.presets[index]
          if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !validSelection(item.selection)) continue
          var id = item.id.trim().slice(0, MAX_ID_LENGTH)
          if (!id || ids.has(id)) continue
          ids.add(id)
          items.push({
            id: id,
            name: item.name.trim().slice(0, MAX_NAME_LENGTH) || item.selection.model.slice(0, MAX_NAME_LENGTH),
            selection: copySelection(item.selection),
          })
        }
        return { initialized: true, items: items }
      } catch (_) {
        return { initialized: false, items: [] }
      }
    }

    var presetState = readPresetState()

    function notifyPresetListeners() {
      presetListeners.forEach(function (listener) { listener() })
    }

    function persistPresets(nextState) {
      if (typeof localStorage === 'undefined') return { ok: false, error: 'localStorage is unavailable' }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: 1,
          presets: nextState.items,
        }))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }

    function commitPresets(items) {
      var nextState = { initialized: true, items: items.slice(0, MAX_PRESETS) }
      var result = persistPresets(nextState)
      if (!result.ok) return result
      presetState = nextState
      notifyPresetListeners()
      return result
    }

    function reconcilePresetStorage(event) {
      if (event && event.key !== null && event.key !== STORAGE_KEY) return
      presetState = readPresetState()
      notifyPresetListeners()
    }

    function subscribePresets(listener) {
      presetListeners.add(listener)
      return function () { presetListeners.delete(listener) }
    }

    function usePresets() {
      return React.useSyncExternalStore(
        subscribePresets,
        function () { return presetState },
        function () { return presetState },
      )
    }

    function makePresetId() {
      var id = 'p-' + Date.now().toString(36) + '-' + String(nextId)
      nextId += 1
      return id
    }

    function sameSelection(left, right) {
      return Boolean(left && right) && left.provider === right.provider && left.model === right.model &&
        left.reasoningEffort === right.reasoningEffort
    }

    function ownSnapshot(snapshot) {
      return {
        current: copySelection(snapshot.current),
        status: snapshot.status,
        error: snapshot.error,
        routable: snapshot.routable,
        failures: (snapshot.failures || []).map(function (failure) {
          return { id: failure.id, name: failure.name, message: failure.message }
        }),
        groups: (snapshot.groups || []).map(function (group) {
          return {
            id: group.id,
            name: group.name,
            models: (group.models || []).map(function (model) {
              var item = { id: model.id, name: model.name }
              if (model.reasoning) {
                item.reasoning = {
                  efforts: (model.reasoning.efforts || []).map(function (effort) {
                    return { id: effort.id, name: effort.name }
                  }),
                }
                if (model.reasoning.defaultEffort !== undefined) {
                  item.reasoning.defaultEffort = model.reasoning.defaultEffort
                }
              }
              return item
            }),
          }
        }),
      }
    }

    function findModel(catalog, selection) {
      if (!catalog || !selection) return null
      for (var groupIndex = 0; groupIndex < catalog.groups.length; groupIndex += 1) {
        var group = catalog.groups[groupIndex]
        if (group.id !== selection.provider) continue
        for (var modelIndex = 0; modelIndex < group.models.length; modelIndex += 1) {
          var model = group.models[modelIndex]
          if (model.id === selection.model) return { group: group, model: model }
        }
      }
      return null
    }

    function selectionLabel(catalog, selection, t) {
      if (!selection) return { model: t('trigger.fallback'), effort: '' }
      var found = findModel(catalog, selection)
      var effort = selection.reasoningEffort
      if (effort === undefined && found && found.model.reasoning) effort = found.model.reasoning.defaultEffort
      if (effort !== undefined && found && found.model.reasoning) {
        var matched = found.model.reasoning.efforts.find(function (item) { return item.id === effort })
        if (matched) effort = matched.name
      }
      return {
        model: found ? found.model.name : selection.model,
        effort: effort || t('effort.default'),
      }
    }

    function seedFirstPreset(catalog, t) {
      if (presetState.initialized || !catalog || !catalog.current) return null
      var text = selectionLabel(catalog, catalog.current, t)
      return commitPresets([{
        id: makePresetId(),
        name: t('preset.name', { model: text.model, effort: text.effort }),
        selection: copySelection(catalog.current),
      }])
    }

    function isApplePlatform() {
      return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
    }

    function shortcutLabel(index) {
      return (isApplePlatform() ? '⌥' : 'Alt+') + String(index + 1)
    }

    function shortcutRangeLabel() {
      return isApplePlatform() ? '⌥1–9' : 'Alt+1–9'
    }

    function acceptsTextInput(target) {
      return Boolean(target && typeof target.matches === 'function' &&
        target.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))
    }

    function selectionErrorMessage(error, t) {
      var message = String(error)
      if (message.includes('does not accept image input') && message.includes('session already contains images')) {
        return t('status.imageIncompatible')
      }
      return t('status.switchError', { message: message })
    }

    function PresetBar(props) {
      var chips = props.presets.map(function (preset, index) {
        var active = sameSelection(props.current, preset.selection)
        var unavailable = Boolean(props.catalog && !findModel(props.catalog, preset.selection))
        var shortcut = index < 9 ? shortcutLabel(index) : ''
        var title = unavailable
          ? props.t('preset.unavailable')
          : shortcut
            ? props.t('preset.shortcut', { name: preset.name, shortcut: shortcut })
            : preset.name
        return h('button', {
          type: 'button',
          key: preset.id,
          className: 'dmp-chip' + (active ? ' is-active' : '') + (unavailable ? ' is-unavailable' : ''),
          disabled: props.busy,
          onClick: function () { if (!unavailable) props.apply(preset.selection, true) },
          title: title,
          'aria-label': title,
          'aria-disabled': unavailable,
          'aria-pressed': active,
        },
        h('span', { className: 'dmp-chip-name' }, preset.name),
        shortcut ? h('kbd', { 'aria-hidden': true }, shortcut) : null,
        )
      })
      var actions = h('div', { className: 'dmp-preset-actions' },
        h('button', {
          type: 'button',
          className: 'dmp-icon',
          disabled: !props.current || props.busy,
          onClick: props.add,
          title: props.t('preset.save'),
          'aria-label': props.t('preset.save'),
        }, '+'),
        h('button', {
          type: 'button',
          className: 'dmp-icon' + (props.manage ? ' is-active' : ''),
          onClick: props.toggleManage,
          title: props.t('preset.manage'),
          'aria-label': props.t('preset.manage'),
          'aria-pressed': props.manage,
        }, '⋯'),
      )
      return h('div', { className: 'dmp-preset-block' },
        h('div', { className: 'dmp-preset-row' },
          h('div', { className: 'dmp-preset-list' }, chips),
          actions,
        ),
        props.presets.length
          ? h('div', { className: 'dmp-shortcut-hint' }, props.t('shortcut.hint', { shortcut: shortcutRangeLabel() }))
          : null,
      )
    }

    function EffortChoices(props) {
      var choices = [{ id: '', name: props.t('effort.default') }].concat(props.model.reasoning ? props.model.reasoning.efforts : [])
      return h('div', { className: 'dmp-efforts', role: 'group', 'aria-label': props.t('effort.groupLabel') },
        choices.map(function (effort) {
          var current = props.current
          var active = current && current.provider === props.group.id && current.model === props.model.id &&
            (effort.id ? current.reasoningEffort === effort.id : current.reasoningEffort === undefined)
          return h('button', {
            type: 'button',
            key: effort.id || 'default',
            className: active ? 'is-active' : '',
            disabled: props.busy,
            onClick: function () { props.pick(effort.id) },
            'aria-pressed': Boolean(active),
          }, effort.name)
        }),
      )
    }

    function ModelList(props) {
      var query = props.query.trim().toLowerCase()
      var groups = []
      props.catalog.groups.forEach(function (group) {
        var models = group.models.filter(function (model) {
          return !query || model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query)
        })
        if (!models.length) return
        var rows = [h('div', { className: 'dmp-group-name', key: 'name' }, group.name)]
        models.forEach(function (model) {
          var rowKey = group.id + '::' + model.id
          var active = props.catalog.current && props.catalog.current.provider === group.id && props.catalog.current.model === model.id
          var children = [h('button', {
            type: 'button',
            key: 'model',
            className: 'dmp-model' + (active ? ' is-current' : ''),
            disabled: props.busy,
            onClick: function () { props.pickModel(group, model, rowKey) },
            'aria-pressed': Boolean(active),
            'aria-expanded': model.reasoning ? props.expanded === rowKey : undefined,
          },
          h('span', null, model.name),
          h('small', null, active ? selectionLabel(props.catalog, props.catalog.current, props.t).effort : model.reasoning ? '›' : ''),
          )]
          if (props.expanded === rowKey && model.reasoning) {
            children.push(h(EffortChoices, {
              key: 'efforts',
              group: group,
              model: model,
              current: props.catalog.current,
              busy: props.busy,
              t: props.t,
              pick: function (effort) { props.pickEffort(group, model, effort) },
            }))
          }
          rows.push(h('div', { className: 'dmp-model-wrap', key: rowKey }, children))
        })
        groups.push(h('div', { className: 'dmp-group', key: group.id }, rows))
      })
      return groups.length ? groups : h('div', { className: 'dmp-empty' }, props.t('search.empty'))
    }

    function namedButton(label, text, options) {
      return h('button', Object.assign({ type: 'button', title: label, 'aria-label': label }, options), text)
    }

    function PresetManager(props) {
      if (!props.presets.length) return h('div', { className: 'dmp-empty' }, props.t('preset.empty'))
      return h('div', { className: 'dmp-manage' }, props.presets.map(function (preset, index) {
        var controls
        if (props.editId === preset.id) {
          controls = [
            namedButton(props.t('manage.save'), '✓', { key: 'save', onClick: function () { props.rename(preset.id) } }),
            namedButton(props.t('manage.cancel'), '×', { key: 'cancel', onClick: props.cancelEdit }),
          ]
        } else if (props.confirmId === preset.id) {
          controls = [
            namedButton(props.t('manage.confirmDelete'), props.t('manage.confirmDelete'), { key: 'yes', className: 'is-danger', onClick: function () { props.remove(preset.id) } }),
            namedButton(props.t('manage.cancelDelete'), props.t('manage.cancelDelete'), { key: 'no', onClick: function () { props.setConfirmId(null) } }),
          ]
        } else {
          controls = [
            namedButton(props.t('manage.moveUp', { name: preset.name }), '↑', { key: 'up', disabled: index === 0, onClick: function () { props.move(index, -1) } }),
            namedButton(props.t('manage.moveDown', { name: preset.name }), '↓', { key: 'down', disabled: index === props.presets.length - 1, onClick: function () { props.move(index, 1) } }),
            namedButton(props.t('manage.edit', { name: preset.name }), '✎', { key: 'edit', onClick: function () { props.startEdit(preset) } }),
            namedButton(props.t('manage.remove', { name: preset.name }), '×', { key: 'delete', onClick: function () { props.setConfirmId(preset.id) } }),
          ]
        }
        var name = props.editId === preset.id
          ? h('input', {
            value: props.editName,
            autoFocus: true,
            maxLength: MAX_NAME_LENGTH,
            'aria-label': props.t('manage.renameLabel', { name: preset.name }),
            onChange: function (event) { props.setEditName(event.target.value) },
            onKeyDown: function (event) { if (event.key === 'Enter') props.rename(preset.id) },
          })
          : h('span', { className: 'dmp-manage-name' }, preset.name)
        return h('div', { className: 'dmp-manage-row', key: preset.id },
          name,
          h('span', { className: 'dmp-actions' }, controls),
        )
      }))
    }

    function ModelPresetSelect(props) {
      var phasePair = React.useState('closed'); var phase = phasePair[0]; var setPhase = phasePair[1]
      var catalogPair = React.useState(null); var catalog = catalogPair[0]; var setCatalog = catalogPair[1]
      var queryPair = React.useState(''); var query = queryPair[0]; var setQuery = queryPair[1]
      var busyPair = React.useState(false); var busy = busyPair[0]; var setBusy = busyPair[1]
      var managePair = React.useState(false); var manage = managePair[0]; var setManage = managePair[1]
      var expandedPair = React.useState(null); var expanded = expandedPair[0]; var setExpanded = expandedPair[1]
      var noticePair = React.useState(null); var notice = noticePair[0]; var setNotice = noticePair[1]
      var editPair = React.useState(null); var editId = editPair[0]; var setEditId = editPair[1]
      var editNamePair = React.useState(''); var editName = editNamePair[0]; var setEditName = editNamePair[1]
      var confirmPair = React.useState(null); var confirmId = confirmPair[0]; var setConfirmId = confirmPair[1]
      var triggerRef = React.useRef(null)
      var dialogRef = React.useRef(null)
      var restoreFocusRef = React.useRef(false)
      var dialogId = React.useId()
      var presetSnapshot = usePresets()
      var visible = phase !== 'closed'
      var opened = phase === 'open'

      React.useEffect(function () {
        var alive = true
        var stop = null
        setCatalog(null)
        try {
          var directory = props.directories.directoryFor(props.sessionId)
          var publish = function () {
            if (!alive) return
            var next = ownSnapshot(directory.store.getSnapshot())
            setCatalog(next)
            var seedResult = seedFirstPreset(next, props.t)
            if (seedResult && !seedResult.ok) {
              setNotice({ error: true, text: props.t('status.storageError', { message: seedResult.error }) })
            }
          }
          publish()
          stop = directory.store.subscribe(publish)
          directory.load().catch(function (error) {
            if (alive) setNotice({ error: true, text: props.t('status.loadError', { message: String(error) }) })
          })
        } catch (error) {
          setNotice({ error: true, text: props.t('status.loadError', { message: String(error) }) })
        }
        return function () {
          alive = false
          if (stop) stop()
        }
      }, [props.sessionId, props.directories, props.t])

      React.useEffect(function () {
        if (!opened || typeof document === 'undefined') return undefined
        var dialog = dialogRef.current
        if (dialog) {
          var first = dialog.querySelector('input,button:not([disabled]),[tabindex]:not([tabindex="-1"])')
          if (first) first.focus()
        }
        var onKeyDown = function (event) {
          if (event.key === 'Escape') {
            event.preventDefault()
            restoreFocusRef.current = true
            setPhase('closing')
            return
          }
          if (event.key !== 'Tab' || !dialogRef.current) return
          var focusable = Array.prototype.slice.call(dialogRef.current.querySelectorAll('input,button:not([disabled]),[tabindex]:not([tabindex="-1"])'))
          if (!focusable.length) {
            event.preventDefault()
            dialogRef.current.focus()
            return
          }
          var firstItem = focusable[0]
          var lastItem = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === firstItem) {
            event.preventDefault()
            lastItem.focus()
          } else if (!event.shiftKey && document.activeElement === lastItem) {
            event.preventDefault()
            firstItem.focus()
          }
        }
        document.addEventListener('keydown', onKeyDown)
        return function () { document.removeEventListener('keydown', onKeyDown) }
      }, [opened])

      var currentLabel = selectionLabel(catalog, catalog && catalog.current, props.t)

      function resetClosed() {
        setPhase('closed')
        setManage(false)
        setExpanded(null)
        setQuery('')
        setNotice(null)
        setEditId(null)
        setConfirmId(null)
        if (restoreFocusRef.current) {
          restoreFocusRef.current = false
          if (triggerRef.current) triggerRef.current.focus()
        }
      }

      function close(restoreFocus) {
        if (restoreFocus) restoreFocusRef.current = true
        if (phase === 'open') setPhase('closing')
      }

      function show() {
        if (props.locked || visible) return
        setPhase('open')
        setNotice(null)
        try {
          props.directories.directoryFor(props.sessionId).load().catch(function (error) {
            setNotice({ error: true, text: props.t('status.loadError', { message: String(error) }) })
          })
        } catch (error) {
          setNotice({ error: true, text: props.t('status.loadError', { message: String(error) }) })
        }
      }

      async function applySelection(selection, closeAfter) {
        setBusy(true)
        setNotice(null)
        try {
          await props.directories.directoryFor(props.sessionId).select(copySelection(selection))
          if (closeAfter) close(true)
          return true
        } catch (error) {
          setNotice({ error: true, text: selectionErrorMessage(error, props.t) })
          return false
        } finally {
          setBusy(false)
        }
      }

      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        var onPresetShortcut = function (event) {
          if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return
          if (!/^Digit[1-9]$/.test(event.code) || acceptsTextInput(event.target)) return
          var index = Number(event.code.slice(-1)) - 1
          var preset = presetSnapshot.items[index]
          if (!preset || !catalog || busy || props.locked || !findModel(catalog, preset.selection)) return
          event.preventDefault()
          void applySelection(preset.selection, true)
        }
        document.addEventListener('keydown', onPresetShortcut)
        return function () { document.removeEventListener('keydown', onPresetShortcut) }
      }, [catalog, busy, presetSnapshot, props.locked, props.sessionId])

      async function pickModel(group, model, rowKey) {
        var selection = { provider: group.id, model: model.id }
        if (model.reasoning && model.reasoning.defaultEffort !== undefined) {
          selection.reasoningEffort = model.reasoning.defaultEffort
        }
        var hasEfforts = Boolean(model.reasoning && model.reasoning.efforts.length)
        var ok = await applySelection(selection, !hasEfforts)
        if (ok && hasEfforts) setExpanded(expanded === rowKey ? null : rowKey)
      }

      async function pickEffort(group, model, effort) {
        var selection = { provider: group.id, model: model.id }
        if (effort) selection.reasoningEffort = effort
        await applySelection(selection, true)
      }

      function storePresets(items, successText) {
        var result = commitPresets(items)
        if (!result.ok) {
          setNotice({ error: true, text: props.t('status.storageError', { message: result.error }) })
          return false
        }
        setNotice(successText ? { error: false, text: successText } : null)
        return true
      }

      function addCurrent() {
        if (!catalog || !catalog.current) return
        if (presetSnapshot.items.some(function (preset) { return sameSelection(preset.selection, catalog.current) })) {
          setNotice({ error: false, text: props.t('preset.exists') })
          return
        }
        var text = selectionLabel(catalog, catalog.current, props.t)
        storePresets(presetSnapshot.items.concat([{
          id: makePresetId(),
          name: props.t('preset.name', { model: text.model, effort: text.effort }),
          selection: copySelection(catalog.current),
        }]), props.t('preset.saved'))
      }

      function move(index, direction) {
        var target = index + direction
        if (target < 0 || target >= presetSnapshot.items.length) return
        var next = presetSnapshot.items.slice()
        var item = next[index]
        next[index] = next[target]
        next[target] = item
        storePresets(next)
      }

      function rename(id) {
        var name = editName.trim()
        if (!name) return
        storePresets(presetSnapshot.items.map(function (preset) {
          return preset.id === id ? { id: preset.id, name: name.slice(0, MAX_NAME_LENGTH), selection: preset.selection } : preset
        }))
        setEditId(null)
        setEditName('')
      }

      function remove(id) {
        storePresets(presetSnapshot.items.filter(function (preset) { return preset.id !== id }))
        setConfirmId(null)
      }

      var triggerLabel = props.t('trigger.aria', { model: currentLabel.model, effort: currentLabel.effort || props.t('effort.default') })
      var trigger = h('button', {
        ref: triggerRef,
        type: 'button',
        className: 'dmp-trigger' + (visible ? ' is-open' : ''),
        disabled: props.locked,
        onClick: visible ? function () { close(true) } : show,
        title: currentLabel.model + ' · ' + currentLabel.effort,
        'aria-label': triggerLabel,
        'aria-expanded': visible,
        'aria-haspopup': 'dialog',
        'aria-controls': visible ? dialogId : undefined,
      },
      h('span', { className: 'dmp-trigger-copy' },
        h('span', { className: 'dmp-trigger-model' }, currentLabel.model),
        catalog && catalog.current ? h('small', null, currentLabel.effort) : null,
      ),
      h('b', { 'aria-hidden': true }, '⌄'),
      )

      var popup = null
      if (visible) {
        var bar = h(PresetBar, {
          presets: presetSnapshot.items,
          catalog: catalog,
          current: catalog && catalog.current,
          busy: busy,
          manage: manage,
          t: props.t,
          apply: applySelection,
          add: addCurrent,
          toggleManage: function () {
            setManage(!manage)
            setExpanded(null)
            setNotice(null)
          },
        })
        var search = manage ? null : h('label', { className: 'dmp-search' },
          h('span', { 'aria-hidden': true }, '⌕'),
          h('input', {
            value: query,
            placeholder: props.t('search.placeholder'),
            'aria-label': props.t('search.label'),
            onChange: function (event) { setQuery(event.target.value) },
          }),
        )
        var managerProps = {
          presets: presetSnapshot.items,
          t: props.t,
          editId: editId,
          editName: editName,
          setEditName: setEditName,
          confirmId: confirmId,
          setConfirmId: setConfirmId,
          rename: rename,
          move: move,
          remove: remove,
          startEdit: function (preset) { setEditId(preset.id); setEditName(preset.name) },
          cancelEdit: function () { setEditId(null); setEditName('') },
        }
        var body = !catalog
          ? h('div', { className: 'dmp-empty' }, props.t('status.loading'))
          : manage
            ? h(PresetManager, managerProps)
            : h(ModelList, {
              catalog: catalog,
              query: query,
              expanded: expanded,
              busy: busy,
              t: props.t,
              pickModel: pickModel,
              pickEffort: pickEffort,
            })
        var catalogWarnings = []
        if (catalog && catalog.routable === false) {
          catalogWarnings.push(h('div', { className: 'dmp-warning', key: 'routable', role: 'alert' }, props.t('catalog.unroutable')))
        }
        if (catalog) catalog.failures.forEach(function (failure) {
          catalogWarnings.push(h('div', { className: 'dmp-warning', key: failure.id, role: 'status' },
            props.t('catalog.groupFailure', { name: failure.name, message: failure.message })))
        })
        var noticeView = notice
          ? h('div', {
            className: 'dmp-notice ' + (notice.error ? 'is-error' : ''),
            role: notice.error ? 'alert' : 'status',
            'aria-live': notice.error ? 'assertive' : 'polite',
          }, notice.text)
          : null
        var finishClosing = function (event) {
          if (event.target === event.currentTarget && phase === 'closing') resetClosed()
        }
        popup = h('div', {
          ref: dialogRef,
          id: dialogId,
          className: 'dmp-menu ' + (opened ? 'is-opening' : 'is-closing'),
          role: 'dialog',
          tabIndex: -1,
          'aria-label': props.t('dialog.label'),
          'aria-modal': true,
          'aria-busy': busy || Boolean(catalog && catalog.status === 'loading'),
          onAnimationEnd: finishClosing,
          onAnimationCancel: finishClosing,
        }, h('div', { className: 'dmp-scroll' },
          h('div', { className: 'dmp-sticky' }, bar, search),
          noticeView,
          catalogWarnings,
          h('div', { className: 'dmp-content' }, body),
        ))
      }

      return h('div', { className: 'dmp-root' },
        trigger,
        visible ? h('div', {
          className: 'dmp-backdrop ' + (opened ? 'is-opening' : 'is-closing'),
          onClick: function () { close(true) },
          role: 'presentation',
        }) : null,
        popup,
      )
    }

    function ModelPresetSeat(props) {
      if (!props.available) return null
      return h(ModelPresetSelect, props)
    }

    var CSS = `
.dmp-root{min-width:0;position:relative;z-index:20}.dmp-trigger{min-width:0;max-width:min(320px,60vw);min-height:28px;height:auto;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:14px;outline:0;display:flex;align-items:center;gap:4px;padding:4px 4px 4px 8px;font:inherit;font-size:13px;font-weight:500;line-height:17px;text-align:left}.dmp-trigger:hover:not(:disabled),.dmp-trigger.is-open{background:var(--dsw-alias-interactive-bg-hover)}.dmp-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}.dmp-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-trigger-copy{min-width:0;display:flex;flex:1 1 auto;flex-wrap:wrap;align-items:baseline;column-gap:4px}.dmp-trigger-model{min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere}.dmp-trigger small{max-width:100%;color:var(--dsw-alias-label-caption);font-size:12px;white-space:normal;overflow-wrap:anywhere}.dmp-trigger b{color:var(--dsw-alias-label-caption);font-size:10px;line-height:1;flex:none;transition:transform .12s ease}.dmp-trigger.is-open b{transform:rotate(180deg)}
.dmp-backdrop{position:fixed;inset:0;z-index:98;background:transparent}.dmp-menu{z-index:99;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:min(340px,calc(100vw - 32px));max-height:min(380px,calc(100vh - 96px));box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;padding:4px;position:absolute;bottom:calc(100% + 8px);right:0;overflow:hidden;transform-origin:bottom right;will-change:transform,opacity}.dmp-menu.is-opening{animation:dmp-menu-in .16s cubic-bezier(.2,.8,.2,1) both}.dmp-menu.is-closing{animation:dmp-menu-out .12s ease-in both}.dmp-backdrop.is-opening{animation:dmp-fade-in .16s ease-out both}.dmp-backdrop.is-closing{animation:dmp-fade-out .12s ease-in both}.dmp-scroll{max-height:inherit;overflow:auto;overscroll-behavior:contain}.dmp-sticky{position:sticky;top:0;z-index:3;padding:2px 2px 4px;background:var(--dsw-specific-menu);border-bottom:1px solid var(--dsw-alias-border-l1)}
.dmp-preset-block{min-width:0}.dmp-preset-row{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:4px}.dmp-preset-list{min-width:0;max-height:96px;display:flex;flex-wrap:wrap;align-content:flex-start;align-items:flex-start;gap:2px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.dmp-preset-actions{display:flex;align-items:flex-start;gap:2px}.dmp-chip,.dmp-icon{flex:none;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:8px;font:inherit;font-size:11px}.dmp-chip{max-width:100%;min-height:28px;height:auto;padding:4px 8px;display:inline-flex;align-items:center;gap:5px;line-height:15px;text-align:left;white-space:normal}.dmp-chip-name{min-width:0;overflow-wrap:anywhere}.dmp-chip kbd{flex:none;padding:1px 4px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;color:var(--dsw-alias-label-caption);background:var(--dsw-alias-bg-module-platform);font:inherit;font-size:9px;line-height:13px;white-space:nowrap}.dmp-icon{width:28px;height:28px;padding:0;font-size:15px}.dmp-chip:hover,.dmp-chip.is-active,.dmp-icon:hover,.dmp-icon.is-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dmp-chip.is-active{color:var(--dsw-alias-brand-primary)}.dmp-chip.is-unavailable,.dmp-chip.is-unavailable:hover{background:transparent;color:var(--dsw-alias-label-dimmed);opacity:.42;filter:saturate(.2);cursor:not-allowed}.dmp-chip:disabled,.dmp-icon:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-shortcut-hint{padding:3px 4px 0;color:var(--dsw-alias-label-caption);font-size:9px;line-height:13px}.dmp-search{height:30px;margin-top:3px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);display:flex;align-items:center;gap:6px;padding:0 8px;color:var(--dsw-alias-label-caption)}.dmp-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.dmp-notice{margin:4px 2px 0;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-success-primary);font-size:11px}.dmp-notice.is-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}.dmp-warning{margin:4px 2px 0;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label);font-size:11px;line-height:16px}.dmp-content{padding:2px}.dmp-group+.dmp-group{margin-top:4px}.dmp-group-name{padding:5px 8px 2px;color:var(--dsw-alias-label-caption);font-size:10px;font-weight:600}.dmp-model{width:100%;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;font:inherit;font-size:13px;text-align:left}.dmp-model:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dmp-model.is-current{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}.dmp-model:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-model small{color:var(--dsw-alias-label-caption);font-size:11px}.dmp-efforts{display:flex;flex-wrap:wrap;align-items:center;gap:4px;overflow:visible;max-height:180px;padding:3px 8px 7px;transform-origin:top;animation:dmp-efforts-in .18s cubic-bezier(.2,.8,.2,1) both}.dmp-efforts button{min-width:48px;height:28px;flex:0 1 auto;color:var(--dsw-alias-label-secondary);cursor:pointer;background:var(--dsw-alias-bg-module-platform);border:0;border-radius:6px;padding:0 9px;font:inherit;font-size:10px;animation:dmp-effort-item-in .16s ease-out both}.dmp-efforts button:nth-child(2){animation-delay:.02s}.dmp-efforts button:nth-child(3){animation-delay:.04s}.dmp-efforts button:nth-child(4){animation-delay:.06s}.dmp-efforts button:nth-child(5){animation-delay:.08s}.dmp-efforts button:hover,.dmp-efforts button.is-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}.dmp-empty{color:var(--dsw-alias-label-tertiary);padding:18px 10px;font-size:12px;text-align:center}.dmp-manage-row{height:36px;display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 4px}.dmp-manage-name{min-width:0;flex:1;color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dmp-manage-row input{min-width:0;flex:1;height:28px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:12px}.dmp-actions{display:flex}.dmp-actions button{min-width:28px;height:28px;color:var(--dsw-alias-label-caption);cursor:pointer;background:transparent;border:0;border-radius:8px;font:inherit;font-size:11px}.dmp-actions button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dmp-actions button:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-actions button.is-danger{color:var(--dsw-alias-state-error-primary)}.dmp-root button:focus-visible,.dmp-root input:focus-visible{outline:0;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
@keyframes dmp-menu-in{from{opacity:0;transform:translateY(5px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes dmp-menu-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(4px) scale(.98)}}@keyframes dmp-fade-in{from{opacity:0}to{opacity:1}}@keyframes dmp-fade-out{from{opacity:1}to{opacity:0}}@keyframes dmp-sheet-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes dmp-sheet-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(18px)}}@keyframes dmp-efforts-in{from{opacity:0;max-height:0;padding-top:0;padding-bottom:0;transform:translateY(-4px) scaleY(.96)}to{opacity:1;max-height:180px;padding-top:3px;padding-bottom:7px;transform:translateY(0) scaleY(1)}}@keyframes dmp-effort-item-in{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:680px){.dmp-trigger{max-width:65vw}.dmp-backdrop{background:color-mix(in srgb,#000 26%,transparent)}.dmp-menu{position:fixed;left:8px;right:8px;bottom:8px;width:auto;max-height:64dvh;border-radius:14px;transform-origin:bottom center}.dmp-menu.is-opening{animation-name:dmp-sheet-in}.dmp-menu.is-closing{animation-name:dmp-sheet-out}.dmp-preset-list{max-height:112px}.dmp-chip{min-height:36px}.dmp-icon{width:36px;height:36px}.dmp-chip kbd,.dmp-shortcut-hint{display:none}.dmp-search{height:36px}.dmp-model{height:44px}.dmp-efforts{gap:6px;padding-left:8px;padding-right:8px}.dmp-efforts button{min-width:58px;height:34px;font-size:11px}.dmp-manage-row{height:44px}.dmp-actions button{min-width:36px;height:36px}}
@media(prefers-reduced-motion:reduce){.dmp-menu.is-opening,.dmp-menu.is-closing,.dmp-backdrop.is-opening,.dmp-backdrop.is-closing,.dmp-efforts,.dmp-efforts button{animation-duration:1ms}.dmp-trigger b{transition-duration:1ms}}
`

    var inject = ['slots', 'modelDirectories', 'sessions', 'locale']

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(LOCALE_NS, DICTIONARIES)
      }, 'dsh-model-presets: dictionaries')
      ctx.effect(function () {
        if (typeof window === 'undefined' || !window.addEventListener) return function () {}
        window.addEventListener('storage', reconcilePresetStorage)
        return function () { window.removeEventListener('storage', reconcilePresetStorage) }
      }, 'dsh-model-presets: storage reconciliation')

      ctx.effect(function () {
        if (typeof document === 'undefined') return function () {}
        var tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-model-presets'
        tag.dataset.pluginCss = 'dsh-model-presets/model-presets.css'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-model-presets: styles')

      ctx.slots.inject('conversation.input.model', function () {
        return ctx.slots.register({
          name: 'conversation.input.model',
          priority: -10,
          locale: LOCALE_NS,
          inject: function (sessionId) {
            return {
              available: ctx.sessions.subagentAddress(sessionId) === undefined,
              directories: ctx.modelDirectories,
            }
          },
        }, ModelPresetSeat)
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
