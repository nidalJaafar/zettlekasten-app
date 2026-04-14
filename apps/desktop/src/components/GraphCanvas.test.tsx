import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as d3 from 'd3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from './GraphCanvas'

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
      const datum = nodeGroup.__data__ as { x?: number; y?: number }
      return { x: datum.x, y: datum.y }
    })
  }

  function setZoomTransform(svg: SVGSVGElement | null, zoomGroup: SVGGElement | null, value: string) {
    if (!svg || !zoomGroup) return

    zoomGroup.setAttribute('transform', value)
    ;(svg as SVGSVGElement & { __zoom?: d3.ZoomTransform }).__zoom = d3.zoomIdentity.translate(120, 80).scale(1.75)
  }

  it('preserves the zoom group and node layout when only selection changes', async () => {
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

    const { svg, zoomGroup, nodeGroups } = getGraphElements()
    expect(svg).toBeTruthy()

    expect(zoomGroup).toBeTruthy()
    expect(nodeGroups).toHaveLength(2)

    setZoomTransform(svg, zoomGroup, 'translate(120,80) scale(1.75)')
    nodeGroups[0]?.setAttribute('transform', 'translate(10,20)')
    nodeGroups[1]?.setAttribute('transform', 'translate(30,40)')

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
    expect(nextZoomGroup?.getAttribute('transform')).toBe('translate(120,80) scale(1.75)')
    expect(nodeGroupsAfter).toHaveLength(2)
    expect(nodeGroupsAfter[0]).toBe(nodeGroups[0])
    expect(nodeGroupsAfter[1]).toBe(nodeGroups[1])
    expect(nodeGroupsAfter[0]?.getAttribute('transform')).toBe('translate(10,20)')
    expect(nodeGroupsAfter[1]?.getAttribute('transform')).toBe('translate(30,40)')
    expect(circles[0]?.getAttribute('fill')).toBe('#1d2128')
    expect(circles[1]?.getAttribute('fill')).toBe('#222730')
  })

  it('preserves zoom and saved node positions when rebuilt from fresh graph arrays', async () => {
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

    const { zoomGroup, nodeGroups } = getGraphElements()
    expect(zoomGroup).toBeTruthy()
    expect(nodeGroups).toHaveLength(2)

    setZoomTransform(getGraphElements().svg, zoomGroup, 'translate(120,80) scale(1.75)')

    await act(async () => {
      await waitForSimulationTick()
    })

    const transformsBefore = nodeGroups.map((nodeGroup) => nodeGroup.getAttribute('transform'))
    expect(transformsBefore[0]).toMatch(/^translate\(/)
    expect(transformsBefore[1]).toMatch(/^translate\(/)

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

    const { zoomGroup: rebuiltZoomGroup, nodeGroups: rebuiltNodeGroups } = getGraphElements()

    expect(rebuiltZoomGroup).not.toBe(zoomGroup)
    expect(rebuiltZoomGroup?.getAttribute('transform')).toBe('translate(120,80) scale(1.75)')
    expect(rebuiltNodeGroups).toHaveLength(2)
    expect(rebuiltNodeGroups[0]?.getAttribute('transform')).toBe(transformsBefore[0])
    expect(rebuiltNodeGroups[1]?.getAttribute('transform')).toBe(transformsBefore[1])
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

    const beforeRebuildTransforms = getGraphElements().nodeGroups.map((nodeGroup) => nodeGroup.getAttribute('transform'))

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

    expect(rebuiltTransforms).toEqual(beforeRebuildTransforms)

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
