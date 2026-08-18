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
    var nextId = 1
    var presetListeners = new Set()

    function copySelection(value) {
      if (!value) return null
      var next = { provider: value.provider, model: value.model }
      if (value.reasoningEffort !== undefined) next.reasoningEffort = value.reasoningEffort
      return next
    }

    function validSelection(value) {
      return value && typeof value === 'object' &&
        typeof value.provider === 'string' && value.provider.length > 0 &&
        typeof value.model === 'string' && value.model.length > 0 &&
        (value.reasoningEffort === undefined || typeof value.reasoningEffort === 'string')
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
        for (var index = 0; index < documentValue.presets.length && items.length < 50; index += 1) {
          var item = documentValue.presets[index]
          if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !validSelection(item.selection)) continue
          items.push({
            id: item.id.slice(0, 80),
            name: item.name.trim().slice(0, 40) || item.selection.model,
            selection: copySelection(item.selection),
          })
        }
        return { initialized: true, items: items }
      } catch (_) {
        return { initialized: false, items: [] }
      }
    }

    var presetState = readPresetState()

    function persistPresets() {
      if (typeof localStorage === 'undefined') return
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: 1,
          presets: presetState.items,
        }))
      } catch (_) {
        // Browser storage can be unavailable in private or policy-restricted contexts.
      }
    }

    function commitPresets(items) {
      presetState = { initialized: true, items: items.slice(0, 50) }
      persistPresets()
      presetListeners.forEach(function (listener) { listener() })
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

    function selectionLabel(catalog, selection) {
      if (!selection) return { model: '模型', effort: '' }
      var found = findModel(catalog, selection)
      var effort = selection.reasoningEffort
      if (effort === undefined && found && found.model.reasoning) effort = found.model.reasoning.defaultEffort
      if (effort !== undefined && found && found.model.reasoning) {
        var matched = found.model.reasoning.efforts.find(function (item) { return item.id === effort })
        if (matched) effort = matched.name
      }
      return {
        model: found ? found.model.name : selection.model,
        effort: effort || '默认',
      }
    }

    function seedFirstPreset(catalog) {
      if (presetState.initialized || !catalog || !catalog.current) return
      var text = selectionLabel(catalog, catalog.current)
      commitPresets([{
        id: makePresetId(),
        name: text.model + ' · ' + text.effort,
        selection: copySelection(catalog.current),
      }])
    }

    function PresetBar(props) {
      var buttons = props.presets.map(function (preset) {
        return h('button', {
          type: 'button',
          key: preset.id,
          className: 'dmp-chip' + (sameSelection(props.current, preset.selection) ? ' is-active' : ''),
          disabled: props.busy,
          onClick: function () { props.apply(preset.selection, true) },
          title: preset.name,
        }, preset.name)
      })
      buttons.push(h('button', {
        type: 'button',
        key: 'add',
        className: 'dmp-icon',
        disabled: !props.current || props.busy,
        onClick: props.add,
        title: '保存当前组合',
        'aria-label': '保存当前组合',
      }, '+'))
      buttons.push(h('button', {
        type: 'button',
        key: 'manage',
        className: 'dmp-icon' + (props.manage ? ' is-active' : ''),
        onClick: props.toggleManage,
        title: '管理预设',
        'aria-label': '管理预设',
      }, '⋯'))
      return h('div', { className: 'dmp-presets' }, buttons)
    }

    function EffortChoices(props) {
      var choices = [{ id: '', name: '默认' }].concat(props.model.reasoning ? props.model.reasoning.efforts : [])
      return h('div', { className: 'dmp-efforts', role: 'group', 'aria-label': '选择推理等级' },
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
          },
          h('span', null, model.name),
          h('small', null, active ? selectionLabel(props.catalog, props.catalog.current).effort : model.reasoning ? '›' : ''),
          )]
          if (props.expanded === rowKey && model.reasoning) {
            children.push(h(EffortChoices, {
              key: 'efforts',
              group: group,
              model: model,
              current: props.catalog.current,
              busy: props.busy,
              pick: function (effort) { props.pickEffort(group, model, effort) },
            }))
          }
          rows.push(h('div', { className: 'dmp-model-wrap', key: rowKey }, children))
        })
        groups.push(h('div', { className: 'dmp-group', key: group.id }, rows))
      })
      return groups.length ? groups : h('div', { className: 'dmp-empty' }, '没有匹配模型')
    }

    function PresetManager(props) {
      if (!props.presets.length) return h('div', { className: 'dmp-empty' }, '暂无预设')
      return h('div', { className: 'dmp-manage' }, props.presets.map(function (preset, index) {
        var controls
        if (props.editId === preset.id) {
          controls = [
            h('button', { type: 'button', key: 'save', onClick: function () { props.rename(preset.id) } }, '✓'),
            h('button', { type: 'button', key: 'cancel', onClick: props.cancelEdit }, '×'),
          ]
        } else if (props.confirmId === preset.id) {
          controls = [
            h('button', { type: 'button', key: 'yes', className: 'is-danger', onClick: function () { props.remove(preset.id) } }, '确认'),
            h('button', { type: 'button', key: 'no', onClick: function () { props.setConfirmId(null) } }, '取消'),
          ]
        } else {
          controls = [
            h('button', { type: 'button', key: 'up', disabled: index === 0, onClick: function () { props.move(index, -1) } }, '↑'),
            h('button', { type: 'button', key: 'down', disabled: index === props.presets.length - 1, onClick: function () { props.move(index, 1) } }, '↓'),
            h('button', { type: 'button', key: 'edit', onClick: function () { props.startEdit(preset) } }, '✎'),
            h('button', { type: 'button', key: 'delete', onClick: function () { props.setConfirmId(preset.id) } }, '×'),
          ]
        }
        var name = props.editId === preset.id
          ? h('input', {
            value: props.editName,
            autoFocus: true,
            maxLength: 40,
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
            seedFirstPreset(next)
          }
          publish()
          stop = directory.store.subscribe(publish)
          directory.load().catch(function (error) {
            if (alive) setNotice({ error: true, text: String(error) })
          })
        } catch (error) {
          setNotice({ error: true, text: String(error) })
        }
        return function () {
          alive = false
          if (stop) stop()
        }
      }, [props.sessionId, props.directories])

      React.useEffect(function () {
        if (!visible || typeof document === 'undefined') return undefined
        var onKeyDown = function (event) {
          if (event.key === 'Escape') setPhase('closing')
        }
        document.addEventListener('keydown', onKeyDown)
        return function () { document.removeEventListener('keydown', onKeyDown) }
      }, [visible])

      var currentLabel = selectionLabel(catalog, catalog && catalog.current)

      function resetClosed() {
        setPhase('closed')
        setManage(false)
        setExpanded(null)
        setQuery('')
        setNotice(null)
        setEditId(null)
        setConfirmId(null)
      }

      function close() {
        if (phase === 'open') setPhase('closing')
      }

      function show() {
        if (props.locked || visible) return
        setPhase('open')
        setNotice(null)
        try {
          props.directories.directoryFor(props.sessionId).load().catch(function (error) {
            setNotice({ error: true, text: String(error) })
          })
        } catch (error) {
          setNotice({ error: true, text: String(error) })
        }
      }

      async function applySelection(selection, closeAfter) {
        setBusy(true)
        setNotice(null)
        try {
          await props.directories.directoryFor(props.sessionId).select(copySelection(selection))
          if (closeAfter) close()
          return true
        } catch (error) {
          setNotice({ error: true, text: '切换失败：' + String(error) })
          return false
        } finally {
          setBusy(false)
        }
      }

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

      function addCurrent() {
        if (!catalog || !catalog.current) return
        if (presetSnapshot.items.some(function (preset) { return sameSelection(preset.selection, catalog.current) })) {
          setNotice({ error: false, text: '当前组合已保存' })
          return
        }
        var text = selectionLabel(catalog, catalog.current)
        commitPresets(presetSnapshot.items.concat([{
          id: makePresetId(),
          name: text.model + ' · ' + text.effort,
          selection: copySelection(catalog.current),
        }]))
        setNotice({ error: false, text: '已保存' })
      }

      function move(index, direction) {
        var target = index + direction
        if (target < 0 || target >= presetSnapshot.items.length) return
        var next = presetSnapshot.items.slice()
        var item = next[index]
        next[index] = next[target]
        next[target] = item
        commitPresets(next)
      }

      function rename(id) {
        var name = editName.trim()
        if (!name) return
        commitPresets(presetSnapshot.items.map(function (preset) {
          return preset.id === id ? { id: preset.id, name: name.slice(0, 40), selection: preset.selection } : preset
        }))
        setEditId(null)
        setEditName('')
      }

      function remove(id) {
        commitPresets(presetSnapshot.items.filter(function (preset) { return preset.id !== id }))
        setConfirmId(null)
      }

      var trigger = h('button', {
        type: 'button',
        className: 'dmp-trigger' + (visible ? ' is-open' : ''),
        disabled: props.locked,
        onClick: visible ? close : show,
        title: currentLabel.model + ' · ' + currentLabel.effort,
        'aria-expanded': visible,
        'aria-haspopup': 'dialog',
      },
      h('span', null, currentLabel.model),
      catalog && catalog.current ? h('small', null, currentLabel.effort) : null,
      h('b', { 'aria-hidden': true }, '⌄'),
      )

      var popup = null
      if (visible) {
        var bar = h(PresetBar, {
          presets: presetSnapshot.items,
          current: catalog && catalog.current,
          busy: busy,
          manage: manage,
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
            placeholder: '搜索模型',
            onChange: function (event) { setQuery(event.target.value) },
          }),
        )
        var managerProps = {
          presets: presetSnapshot.items,
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
          ? h('div', { className: 'dmp-empty' }, '加载中…')
          : manage
            ? h(PresetManager, managerProps)
            : h(ModelList, {
              catalog: catalog,
              query: query,
              expanded: expanded,
              busy: busy,
              pickModel: pickModel,
              pickEffort: pickEffort,
            })
        var noticeView = notice
          ? h('div', { className: 'dmp-notice ' + (notice.error ? 'is-error' : '') }, notice.text)
          : null
        popup = h('div', {
          className: 'dmp-menu ' + (opened ? 'is-opening' : 'is-closing'),
          role: 'dialog',
          'aria-label': '选择模型',
          onAnimationEnd: function (event) {
            if (event.target === event.currentTarget && phase === 'closing') resetClosed()
          },
        }, h('div', { className: 'dmp-scroll' },
          h('div', { className: 'dmp-sticky' }, bar, search),
          noticeView,
          h('div', { className: 'dmp-content' }, body),
        ))
      }

      return h('div', { className: 'dmp-root' },
        trigger,
        visible ? h('div', {
          className: 'dmp-backdrop ' + (opened ? 'is-opening' : 'is-closing'),
          onClick: close,
          role: 'presentation',
        }) : null,
        popup,
      )
    }

    var CSS = `
.dmp-root{min-width:0;position:relative;z-index:20}.dmp-trigger{min-width:0;max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:24px;outline:0;display:flex;align-items:center;gap:4px;padding:0 4px 0 8px;font:inherit;font-size:13px;font-weight:500;line-height:20px}.dmp-trigger:hover:not(:disabled),.dmp-trigger.is-open{background:var(--dsw-alias-interactive-bg-hover)}.dmp-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}.dmp-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-trigger span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dmp-trigger small{color:var(--dsw-alias-label-caption);font-size:12px;flex:none}.dmp-trigger b{color:var(--dsw-alias-label-caption);font-size:10px;line-height:1;transition:transform .12s ease}.dmp-trigger.is-open b{transform:rotate(180deg)}
.dmp-backdrop{position:fixed;inset:0;z-index:98;background:transparent}.dmp-menu{z-index:99;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:min(300px,calc(100vw - 32px));max-height:min(380px,calc(100vh - 96px));box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;padding:4px;position:absolute;bottom:calc(100% + 8px);right:0;overflow:hidden;transform-origin:bottom right;will-change:transform,opacity}.dmp-menu.is-opening{animation:dmp-menu-in .16s cubic-bezier(.2,.8,.2,1) both}.dmp-menu.is-closing{animation:dmp-menu-out .12s ease-in both}.dmp-backdrop.is-opening{animation:dmp-fade-in .16s ease-out both}.dmp-backdrop.is-closing{animation:dmp-fade-out .12s ease-in both}.dmp-scroll{max-height:inherit;overflow:auto;overscroll-behavior:contain}.dmp-sticky{position:sticky;top:0;z-index:3;padding:2px 2px 4px;background:var(--dsw-specific-menu);border-bottom:1px solid var(--dsw-alias-border-l1)}
.dmp-presets{display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none}.dmp-presets::-webkit-scrollbar{display:none}.dmp-chip,.dmp-icon{height:28px;flex:none;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:8px;font:inherit;font-size:11px}.dmp-chip{max-width:126px;padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dmp-icon{width:28px;padding:0;font-size:15px}.dmp-chip:hover,.dmp-chip.is-active,.dmp-icon:hover,.dmp-icon.is-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dmp-chip.is-active{color:var(--dsw-alias-brand-primary)}.dmp-chip:disabled,.dmp-icon:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-search{height:30px;margin-top:3px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);display:flex;align-items:center;gap:6px;padding:0 8px;color:var(--dsw-alias-label-caption)}.dmp-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.dmp-notice{margin:4px 2px 0;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-success-primary);font-size:11px}.dmp-notice.is-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}.dmp-content{padding:2px}.dmp-group+.dmp-group{margin-top:4px}.dmp-group-name{padding:5px 8px 2px;color:var(--dsw-alias-label-caption);font-size:10px;font-weight:600}.dmp-model{width:100%;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;font:inherit;font-size:13px;text-align:left}.dmp-model:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dmp-model.is-current{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}.dmp-model:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-model small{color:var(--dsw-alias-label-caption);font-size:11px}.dmp-efforts{display:flex;flex-wrap:wrap;align-items:center;gap:4px;overflow:visible;max-height:180px;padding:3px 8px 7px;transform-origin:top;animation:dmp-efforts-in .18s cubic-bezier(.2,.8,.2,1) both}.dmp-efforts button{min-width:48px;height:28px;flex:0 1 auto;color:var(--dsw-alias-label-secondary);cursor:pointer;background:var(--dsw-alias-bg-module-platform);border:0;border-radius:6px;padding:0 9px;font:inherit;font-size:10px;animation:dmp-effort-item-in .16s ease-out both}.dmp-efforts button:nth-child(2){animation-delay:.02s}.dmp-efforts button:nth-child(3){animation-delay:.04s}.dmp-efforts button:nth-child(4){animation-delay:.06s}.dmp-efforts button:nth-child(5){animation-delay:.08s}.dmp-efforts button:hover,.dmp-efforts button.is-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}.dmp-empty{color:var(--dsw-alias-label-tertiary);padding:18px 10px;font-size:12px;text-align:center}.dmp-manage-row{height:36px;display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 4px}.dmp-manage-name{min-width:0;flex:1;color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dmp-manage-row input{min-width:0;flex:1;height:28px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:12px}.dmp-actions{display:flex}.dmp-actions button{min-width:28px;height:28px;color:var(--dsw-alias-label-caption);cursor:pointer;background:transparent;border:0;border-radius:8px;font:inherit;font-size:11px}.dmp-actions button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dmp-actions button:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dmp-actions button.is-danger{color:var(--dsw-alias-state-error-primary)}.dmp-root button:focus-visible,.dmp-root input:focus-visible{outline:0;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
@keyframes dmp-menu-in{from{opacity:0;transform:translateY(5px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes dmp-menu-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(4px) scale(.98)}}@keyframes dmp-fade-in{from{opacity:0}to{opacity:1}}@keyframes dmp-fade-out{from{opacity:1}to{opacity:0}}@keyframes dmp-sheet-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes dmp-sheet-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(18px)}}@keyframes dmp-efforts-in{from{opacity:0;max-height:0;padding-top:0;padding-bottom:0;transform:translateY(-4px) scaleY(.96)}to{opacity:1;max-height:180px;padding-top:3px;padding-bottom:7px;transform:translateY(0) scaleY(1)}}@keyframes dmp-effort-item-in{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:680px){.dmp-trigger small{display:none}.dmp-backdrop{background:color-mix(in srgb,#000 26%,transparent)}.dmp-menu{position:fixed;left:8px;right:8px;bottom:8px;width:auto;max-height:64dvh;border-radius:14px;transform-origin:bottom center}.dmp-menu.is-opening{animation-name:dmp-sheet-in}.dmp-menu.is-closing{animation-name:dmp-sheet-out}.dmp-chip,.dmp-icon{height:36px}.dmp-icon{width:36px}.dmp-search{height:36px}.dmp-model{height:44px}.dmp-efforts{gap:6px;padding-left:8px;padding-right:8px}.dmp-efforts button{min-width:58px;height:34px;font-size:11px}.dmp-manage-row{height:44px}.dmp-actions button{min-width:36px;height:36px}}
@media(prefers-reduced-motion:reduce){.dmp-menu.is-opening,.dmp-menu.is-closing,.dmp-backdrop.is-opening,.dmp-backdrop.is-closing,.dmp-efforts,.dmp-efforts button{animation-duration:1ms}.dmp-trigger b{transition-duration:1ms}}
`

    var inject = ['slots', 'modelDirectories']

    function apply(ctx) {
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
        return ctx.slots.register({ name: 'conversation.input.model', priority: -10 }, function (props) {
          return h(ModelPresetSelect, Object.assign({}, props, { directories: ctx.modelDirectories }))
        })
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
