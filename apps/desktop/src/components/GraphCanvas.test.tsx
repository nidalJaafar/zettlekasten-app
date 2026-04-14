import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as d3 from 'd3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from './GraphCanvas'

const { forceConfigurationCapture, resetForceConfigurationCapture } = vi.hoisted(() => {
  const capture = {
    linkDistances: [] as number[],
    chargeStrengths: [] as number[],
    collisionRadiusFns: [] as Array<(node: { linkCount: number }) => number>,
  }

  return {
    forceConfigurationCapture: capture,
    resetForceConfigurationCapture() {
      capture.linkDistances = []
      capture.chargeStrengths = []
      capture.collisionRadiusFns = []
    },
  }
})

vi.mock('d3', async () => {
  const actual = await vi.importActual<typeof import('d3')>('d3')

  return {
    ...actual,
    forceLink: ((...args: Parameters<typeof actual.forceLink>) => {
      const force = actual.forceLink(...args)
      const originalDistance = force.distance
      force.distance = function (value) {
        if (typeof value === 'number') forceConfigurationCapture.linkDistances.push(value)
        return originalDistance.call(this, value)
      }
      return force
    }) as typeof actual.forceLink,
    forceManyBody: (() => {
      const force = actual.forceManyBody()
      const originalStrength = force.strength
      force.strength = function (value) {
        if (typeof value === 'number') forceConfigurationCapture.chargeStrengths.push(value)
        return originalStrength.call(this, value)
      }
      return force
    }) as typeof actual.forceManyBody,
    forceCollide: (() => {
      const force = actual.forceCollide()
      const originalRadius = force.radius
      force.radius = function (value) {
        if (typeof value === 'function') {
          forceConfigurationCapture.collisionRadiusFns.push(value as (node: { linkCount: number }) => number)
        }
        return originalRadius.call(this, value)
      }
      return force
    }) as typeof actual.forceCollide,
  }
})

async function flushEffects() {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitForSimulationTick() {
  await new Promise((resolve) => window.setTimeout(resolve, 30))
}

function makeNote(id: string, title: string): Note {
  const now = Date.now()
  return {
    id,
    title,
    content: '',
    type: 'permanent',
    created_at: now,
    updated_at: now,
    source_id: null,
    own_words_confirmed: 1,
    processed_at: now,
    deleted_at: null,
  }
}

const threeNodeNotes = [
  makeNote('note-1', 'Alpha'),
  makeNote('note-2', 'Beta'),
  makeNote('note-3', 'Gamma'),
]

const threeNodeLinks: NoteLink[] = [
  { from_note_id: 'note-1', to_note_id: 'note-2' } as NoteLink,
  { from_note_id: 'note-2', to_note_id: 'note-3' } as NoteLink,
]

describe('GraphCanvas', () => {
  let container: HTMLDivElement
  let root: Root

  const notes = [
    makeNote('note-1', 'Alpha'),
    makeNote('note-2', 'Beta'),
  ]

  const links: NoteLink[] = [{ from_note_id: 'note-1', to_note_id: 'note-2' } as NoteLink]

  beforeEach(() => {
    resetForceConfigurationCapture()
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  function getGraphElements() {
    const svg = container.querySelector('svg')
    const zoomGroup = svg?.firstElementChild as SVGGElement | null
    const nodeLayer = zoomGroup?.children.item(1) as SVGGElement | null
    const nodeGroups = Array.from(nodeLayer?.children ?? []) as SVGGElement[]
    const circles = Array.from(nodeLayer?.querySelectorAll('circle') ?? []) as SVGCircleElement[]

    return { svg, zoomGroup, nodeLayer, nodeGroups, circles }
  }

  function getNodePositions() {
    return getGraphElements().nodeGroups.map((nodeGroup) => {
      const datum = nodeGroup.__data__ as { id: string; x?: number; y?: number }
      return { id: datum.id, x: datum.x, y: datum.y }
    })
  }

  function setStoredZoomTransform(svg: SVGSVGElement | null, transform: d3.ZoomTransform) {
    if (!svg) return

    ;(svg as SVGSVGElement & { __zoom?: d3.ZoomTransform }).__zoom = transform
  }

  function getZoomState(svg: SVGSVGElement | null) {
    if (!svg) return null

    const transform = d3.zoomTransform(svg)
    return { x: transform.x, y: transform.y, k: transform.k }
  }

  it('preserves the zoom group and node layout when only selection changes', async () => {
    const onNodeClick = vi.fn()
    const zoomTransform = d3.zoomIdentity.translate(120, 80).scale(1.75)

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={onNodeClick}
          selectedNoteId="note-1"
        />
      )
      await flushEffects()
    })

    const { svg, zoomGroup, nodeGroups } = getGraphElements()
    expect(svg).toBeTruthy()

    expect(zoomGroup).toBeTruthy()
    expect(nodeGroups).toHaveLength(2)

    setStoredZoomTransform(svg, zoomTransform)
    const zoomStateBefore = getZoomState(svg)

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={onNodeClick}
          selectedNoteId="note-2"
        />
      )
      await flushEffects()
    })

    const { zoomGroup: nextZoomGroup, nodeGroups: nodeGroupsAfter, circles } = getGraphElements()

    expect(nextZoomGroup).toBe(zoomGroup)
    expect(getZoomState(svg)).toEqual(zoomStateBefore)
    expect(nodeGroupsAfter).toHaveLength(2)
    expect(nodeGroupsAfter[0]).toBe(nodeGroups[0])
    expect(nodeGroupsAfter[1]).toBe(nodeGroups[1])
    expect(circles[0]?.getAttribute('fill')).toBe('#1d2128')
    expect(circles[1]?.getAttribute('fill')).toBe('#222730')
    expect(circles[0]?.getAttribute('stroke')).toBe('#6d8394')
    expect(circles[1]?.getAttribute('stroke')).toBe('#b4ab99')
  })

  it('preserves zoom and saved node positions when rebuilt from fresh graph arrays', async () => {
    const onNodeClick = vi.fn()
    const zoomTransform = d3.zoomIdentity.translate(120, 80).scale(1.75)

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={onNodeClick}
          selectedNoteId="note-1"
        />
      )
      await flushEffects()
    })

    const { zoomGroup, nodeGroups } = getGraphElements()
    expect(zoomGroup).toBeTruthy()
    expect(nodeGroups).toHaveLength(2)

    setStoredZoomTransform(getGraphElements().svg, zoomTransform)

    await act(async () => {
      await waitForSimulationTick()
    })

    const positionsBefore = getNodePositions()
    expect(positionsBefore[0]?.x).toBeTypeOf('number')
    expect(positionsBefore[0]?.y).toBeTypeOf('number')
    expect(positionsBefore[1]?.x).toBeTypeOf('number')
    expect(positionsBefore[1]?.y).toBeTypeOf('number')

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes.map((note) => ({ ...note }))}
          links={links.map((link) => ({ ...link }))}
          onNodeClick={onNodeClick}
          selectedNoteId="note-1"
        />
      )
      await flushEffects()
    })

    const { svg, zoomGroup: rebuiltZoomGroup, nodeGroups: rebuiltNodeGroups } = getGraphElements()
    const positionsAfter = getNodePositions()

    expect(rebuiltZoomGroup).not.toBe(zoomGroup)
    expect(getZoomState(svg)).toEqual({ x: 120, y: 80, k: 1.75 })
    expect(rebuiltNodeGroups).toHaveLength(2)
    expect(positionsAfter[0]?.id).toBe(positionsBefore[0]?.id)
    expect(positionsAfter[1]?.id).toBe(positionsBefore[1]?.id)
    expect(Math.abs((positionsAfter[0]?.x ?? 0) - (positionsBefore[0]?.x ?? 0))).toBeLessThan(12)
    expect(Math.abs((positionsAfter[0]?.y ?? 0) - (positionsBefore[0]?.y ?? 0))).toBeLessThan(12)
    expect(Math.abs((positionsAfter[1]?.x ?? 0) - (positionsBefore[1]?.x ?? 0))).toBeLessThan(12)
    expect(Math.abs((positionsAfter[1]?.y ?? 0) - (positionsBefore[1]?.y ?? 0))).toBeLessThan(12)
  })

  it('lets the simulation continue when structure-affecting inputs change', async () => {
    const onNodeClick = vi.fn()

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={threeNodeNotes}
          links={threeNodeLinks}
          onNodeClick={onNodeClick}
          mode="context"
        />
      )
      await flushEffects()
      await waitForSimulationTick()
    })

    const beforeRebuildPositions = getNodePositions()

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={threeNodeNotes.map((note) => ({ ...note }))}
          links={[]}
          onNodeClick={onNodeClick}
          mode="full"
        />
      )
      await flushEffects()
    })

    const rebuiltTransforms = getGraphElements().nodeGroups.map((nodeGroup) => nodeGroup.getAttribute('transform'))
    const rebuiltPositions = getNodePositions()

    expect(rebuiltPositions).toHaveLength(beforeRebuildPositions.length)
    rebuiltPositions.forEach((position, index) => {
      const previous = beforeRebuildPositions[index]

      expect(position?.id).toBe(previous?.id)
      expect(Math.abs((position?.x ?? 0) - (previous?.x ?? 0))).toBeLessThan(14)
      expect(Math.abs((position?.y ?? 0) - (previous?.y ?? 0))).toBeLessThan(14)
    })

    await act(async () => {
      await waitForSimulationTick()
    })

    const afterFirstTickTransforms = getGraphElements().nodeGroups.map((nodeGroup) => nodeGroup.getAttribute('transform'))
    const afterFirstTickPositions = getNodePositions()

    await act(async () => {
      await waitForSimulationTick()
    })

    const afterSecondTickTransforms = getGraphElements().nodeGroups.map((nodeGroup) => nodeGroup.getAttribute('transform'))
    const afterSecondTickPositions = getNodePositions()

    expect(afterFirstTickTransforms).not.toEqual(rebuiltTransforms)
    expect(afterSecondTickTransforms).not.toEqual(afterFirstTickTransforms)
    expect(afterFirstTickPositions).not.toEqual(rebuiltPositions)
    expect(afterSecondTickPositions).not.toEqual(afterFirstTickPositions)
  })

  it('configures roomier forces in full mode than context mode', async () => {
    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={vi.fn()}
          selectedNoteId="note-1"
          mode="full"
        />
      )
      await flushEffects()
    })

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={vi.fn()}
          selectedNoteId="note-1"
          mode="context"
        />
      )
      await flushEffects()
    })

    expect(forceConfigurationCapture.linkDistances).toEqual([170, 96])
    expect(forceConfigurationCapture.chargeStrengths).toEqual([-145, -220])
    expect(forceConfigurationCapture.collisionRadiusFns).toHaveLength(2)
    expect(forceConfigurationCapture.collisionRadiusFns[0]?.({ linkCount: 0 })).toBe(20)
    expect(forceConfigurationCapture.collisionRadiusFns[1]?.({ linkCount: 0 })).toBe(20)
  })

  it('keeps click-to-inspect working after a selection update', async () => {
    const onNodeClick = vi.fn()

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={onNodeClick}
          selectedNoteId="note-1"
        />
      )
      await flushEffects()
    })

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={onNodeClick}
          selectedNoteId="note-2"
        />
      )
      await flushEffects()
    })

    const { nodeGroups } = getGraphElements()
    expect(nodeGroups).toHaveLength(2)

    await act(async () => {
      nodeGroups[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-2' }))
  })

  it('keeps click-to-inspect working after a full rebuild with fresh arrays', async () => {
    const onNodeClick = vi.fn()

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes}
          links={links}
          onNodeClick={onNodeClick}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      root.render(
        <GraphCanvas
          notes={notes.map((note) => ({ ...note }))}
          links={links.map((link) => ({ ...link }))}
          onNodeClick={onNodeClick}
          mode="full"
        />
      )
      await flushEffects()
    })

    const { nodeGroups } = getGraphElements()
    expect(nodeGroups).toHaveLength(2)

    await act(async () => {
      nodeGroups[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1' }))
  })
})
