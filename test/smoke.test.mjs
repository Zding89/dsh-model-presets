import assert from 'node:assert/strict'
import test from 'node:test'

let moduleSequence = 0

function createStorage() {
  const values = new Map()
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
  }
}

async function loadBundle() {
  let definition
  const listeners = new Map()
  globalThis.localStorage = createStorage()
  globalThis.window = {
    __ModuleLoader__: {
      load(value) { definition = value },
    },
    addEventListener(name, listener) { listeners.set(name, listener) },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name)
    },
  }
  moduleSequence += 1
  await import(`../lib/client.js?test=${moduleSequence}`)
  return { definition, listeners }
}

function ReactStub() {
  return {
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useEffect() {},
    useId() { return 'dialog-id' },
    useRef(value) { return { current: value } },
    useState(value) { return [value, () => {}] },
    useSyncExternalStore(_subscribe, snapshot) { return snapshot() },
  }
}

test('client bundle exports the complete permanent plugin dependencies', async () => {
  const { definition } = await loadBundle()
  assert.equal(definition.id, 'dsh-model-presets')

  const plugin = definition.factory((id) => {
    assert.equal(id, 'react')
    return ReactStub()
  })

  assert.deepEqual(plugin.inject, ['slots', 'modelDirectories', 'sessions', 'locale'])
  assert.equal(typeof plugin.apply, 'function')
})

test('shortcut captures before UI handlers without opening a closed menu', async () => {
  const { definition } = await loadBundle()
  localStorage.setItem('dsh-model-presets:v1', JSON.stringify({
    version: 1,
    initialized: true,
    presets: [{ id: 'one', name: 'First', selection: { provider: 'provider', model: 'model' } }],
  }))

  const catalog = {
    status: 'ready',
    error: null,
    routable: true,
    failures: [],
    current: { provider: 'provider', model: 'model' },
    groups: [{ id: 'provider', name: 'Provider', models: [{ id: 'model', name: 'Model' }] }],
  }
  const states = ['closed', catalog, '', false, false, null, null, null, '', null]
  const stateWrites = []
  const effects = []
  let stateIndex = 0
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useEffect(effect) { effects.push(effect) },
    useId() { return 'shortcut-dialog' },
    useRef(value) { return { current: value } },
    useState(value) {
      const index = stateIndex++
      return [index < states.length ? states[index] : value, () => { stateWrites.push(index) }]
    },
    useSyncExternalStore(_subscribe, snapshot) { return snapshot() },
  }

  const added = []
  const removed = []
  globalThis.window = {
    addEventListener(name, listener, capture) { added.push({ name, listener, capture }) },
    removeEventListener(name, listener, capture) { removed.push({ name, listener, capture }) },
  }
  globalThis.document = {
    createElement() { return { dataset: {}, textContent: '', remove() {} } },
    head: { appendChild() {} },
  }

  const plugin = definition.factory(() => React)
  let seat
  let selectCount = 0
  const directories = {
    directoryFor() {
      return { select() { selectCount += 1; return Promise.resolve() } }
    },
  }
  plugin.apply({
    modelDirectories: directories,
    sessions: { subagentAddress() { return undefined } },
    locale: { register() { return () => {} } },
    effect(install) { install() },
    slots: {
      inject(_name, install) { install(); return () => {} },
      register(_options, component) { seat = component; return () => {} },
    },
  })

  const t = (key) => key
  const outer = seat({ available: true, directories, sessionId: 'session', locked: false, t })
  outer.type(outer.props)
  const disposeShortcut = effects[2]()
  const capture = added.find((entry) => entry.name === 'keydown')
  assert.equal(capture.capture, true)

  let prevented = false
  let stopped = false
  capture.listener({
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    code: 'Digit1',
    target: { matches() { return false } },
    preventDefault() { prevented = true },
    stopPropagation() { stopped = true },
  })
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(prevented, true)
  assert.equal(stopped, true)
  assert.equal(selectCount, 1)
  assert.equal(stateWrites.includes(0), false)
  disposeShortcut()
  assert.equal(removed.some((entry) => entry.name === 'keydown' && entry.capture === true), true)
})

test('apply localizes, shadows one model seat, guards subagents, and disposes effects', async () => {
  const { definition, listeners } = await loadBundle()
  const plugin = definition.factory(() => ReactStub())

  let style
  let styleRemoved = false
  let localeDisposed = false
  let localeRegistration
  let registration
  let slotDisposed = false
  globalThis.document = {
    createElement(type) {
      assert.equal(type, 'style')
      return {
        dataset: {},
        textContent: '',
        remove() { styleRemoved = true },
      }
    },
    head: {
      appendChild(value) { style = value },
    },
  }

  const effectDisposers = []
  const ctx = {
    modelDirectories: { directoryFor() {} },
    sessions: {
      subagentAddress(sessionId) { return sessionId === 'subagent' ? { id: 'child' } : undefined },
    },
    locale: {
      register(namespace, dictionaries) {
        localeRegistration = { namespace, dictionaries }
        return () => { localeDisposed = true }
      },
    },
    effect(install) { effectDisposers.push(install()) },
    slots: {
      inject(name, install) {
        assert.equal(name, 'conversation.input.model')
        const dispose = install()
        return () => {
          slotDisposed = true
          dispose()
        }
      },
      register(options, component) {
        registration = { options, component }
        return () => {}
      },
    },
  }

  plugin.apply(ctx)

  assert.equal(localeRegistration.namespace, 'modelPresets')
  assert.equal(localeRegistration.dictionaries.zh['search.placeholder'], '搜索模型')
  assert.equal(localeRegistration.dictionaries.en['search.placeholder'], 'Search models')
  assert.equal(localeRegistration.dictionaries.zh['shortcut.hint'], '快捷键 {shortcut}')
  assert.equal(localeRegistration.dictionaries.en['shortcut.hint'], 'Shortcut {shortcut}')
  assert.equal(style.dataset.plugin, 'dsh-model-presets')
  assert.match(style.textContent, /\.dmp-preset-row\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/)
  assert.match(style.textContent, /\.dmp-preset-list\{[^}]*flex-wrap:wrap[^}]*overflow-x:hidden[^}]*overflow-y:auto/)
  assert.match(style.textContent, /\.dmp-trigger-model\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/)
  assert.match(style.textContent, /\.dmp-chip-name\{[^}]*overflow-wrap:anywhere/)
  assert.doesNotMatch(style.textContent, /\.dmp-chip kbd/)
  assert.match(style.textContent, /\.dmp-shortcut-hint/)
  assert.match(style.textContent, /@media\(max-width:680px\)[^{]*\{[^}]*\.dmp-trigger\{max-width:65vw\}/)
  assert.equal(listeners.has('storage'), true)
  assert.equal(registration.options.name, 'conversation.input.model')
  assert.equal(registration.options.priority, -10)
  assert.equal(registration.options.locale, 'modelPresets')
  assert.equal(typeof registration.options.inject, 'function')

  const direct = registration.options.inject('direct')
  const addressed = registration.options.inject('subagent')
  assert.equal(direct.available, true)
  assert.equal(addressed.available, false)
  assert.equal(direct.directories, ctx.modelDirectories)
  assert.equal(registration.component({ ...addressed, t() {} }), null)
  assert.notEqual(registration.component({ ...direct, t() {} }), null)

  effectDisposers.forEach((dispose) => dispose())
  assert.equal(styleRemoved, true)
  assert.equal(localeDisposed, true)
  assert.equal(listeners.has('storage'), false)

  // The returned Slot disposer remains independently reversible in the real Slot fiber.
  const disposeSlot = ctx.slots.inject('conversation.input.model', () => () => {})
  disposeSlot()
  assert.equal(slotDisposed, true)
})
