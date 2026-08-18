import assert from 'node:assert/strict'
import test from 'node:test'

async function loadBundle() {
  let definition
  globalThis.window = {
    __ModuleLoader__: {
      load(value) { definition = value },
    },
  }
  await import(`../lib/client.js?test=${Date.now()}`)
  return definition
}

test('client bundle exports a mountable permanent plugin', async () => {
  const definition = await loadBundle()
  assert.equal(definition.id, 'dsh-model-presets')

  const React = {
    createElement() {},
    useEffect() {},
    useState() {},
    useSyncExternalStore() {},
  }
  const plugin = definition.factory((id) => {
    assert.equal(id, 'react')
    return React
  })

  assert.deepEqual(plugin.inject, ['slots', 'modelDirectories'])
  assert.equal(typeof plugin.apply, 'function')
})

test('apply shadows only the composer model seat and disposes styles', async () => {
  const definition = await loadBundle()
  const plugin = definition.factory(() => ({
    createElement() {},
    useEffect() {},
    useState() {},
    useSyncExternalStore() {},
  }))

  let style
  let removed = false
  let registration
  globalThis.document = {
    createElement(type) {
      assert.equal(type, 'style')
      return {
        dataset: {},
        textContent: '',
        remove() { removed = true },
      }
    },
    head: {
      appendChild(value) { style = value },
    },
  }

  const disposers = []
  const ctx = {
    modelDirectories: {},
    effect(install) { disposers.push(install()) },
    slots: {
      inject(name, install) {
        assert.equal(name, 'conversation.input.model')
        return install()
      },
      register(options, component) {
        registration = { options, component }
        return () => {}
      },
    },
  }

  plugin.apply(ctx)
  assert.equal(style.dataset.plugin, 'dsh-model-presets')
  assert.deepEqual(registration.options, {
    name: 'conversation.input.model',
    priority: -10,
  })
  assert.equal(typeof registration.component, 'function')

  disposers.forEach((dispose) => dispose())
  assert.equal(removed, true)
})
