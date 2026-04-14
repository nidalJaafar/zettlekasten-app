import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResizablePane } from './useResizablePane'

interface HarnessProps {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  direction?: 'left' | 'right'
}

function Harness({ storageKey, defaultWidth, minWidth, maxWidth, direction = 'left' }: HarnessProps) {
  const pane = useResizablePane({
    storageKey,
    defaultWidth,
    minWidth,
    maxWidth,
    direction,
  })

  return React.createElement(
    'div',
    null,
    React.createElement('div', { 'data-testid': 'width' }, pane.width),
    React.createElement('div', { 'data-testid': 'handle', ...pane.handleProps })
  )
}

function createStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    },
  }
}

describe('useResizablePane', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
  })

  it('restores a persisted width and clamps it into bounds', async () => {
    localStorage.setItem('layout.test.left', '999')

    await act(async () => {
      root.render(
        React.createElement(Harness, {
          storageKey: 'layout.test.left',
          defaultWidth: 200,
          minWidth: 160,
          maxWidth: 320,
        })
      )
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('320')
  })

  it('updates width live while dragging and persists the clamped result', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          storageKey: 'layout.test.drag',
          defaultWidth: 200,
          minWidth: 160,
          maxWidth: 320,
        })
      )
    })

    const handle = container.querySelector('[data-testid="handle"]')
    if (!(handle instanceof HTMLDivElement)) {
      throw new Error('Missing resize handle')
    }

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 290 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('290')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 600 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('320')
    expect(localStorage.getItem('layout.test.drag')).toBe('320')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  })

  it('supports right-anchored panes by inverting the drag direction', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          storageKey: 'layout.test.right',
          defaultWidth: 240,
          minWidth: 180,
          maxWidth: 360,
          direction: 'right',
        })
      )
    })

    const handle = container.querySelector('[data-testid="handle"]')
    if (!(handle instanceof HTMLDivElement)) {
      throw new Error('Missing resize handle')
    }

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 800 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 740 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('300')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 980 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('180')
    expect(localStorage.getItem('layout.test.right')).toBe('180')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  })

  it('cleans up dragging on release and ignores later move events', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          storageKey: 'layout.test.release',
          defaultWidth: 220,
          minWidth: 180,
          maxWidth: 360,
        })
      )
    })

    const handle = container.querySelector('[data-testid="handle"]')
    if (!(handle instanceof HTMLDivElement)) {
      throw new Error('Missing resize handle')
    }

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 220 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('300')
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 340 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('300')
  })

  it('ends dragging on window blur and ignores later move events without mouseup', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          storageKey: 'layout.test.blur',
          defaultWidth: 220,
          minWidth: 180,
          maxWidth: 360,
        })
      )
    })

    const handle = container.querySelector('[data-testid="handle"]')
    if (!(handle instanceof HTMLDivElement)) {
      throw new Error('Missing resize handle')
    }

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 220 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('300')
    expect(document.body.style.cursor).toBe('col-resize')

    await act(async () => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 340 }))
    })

    expect(container.querySelector('[data-testid="width"]')?.textContent).toBe('300')
  })
})
