import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { Note, NoteLink } from '@zettelkasten/core'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  linkCount: number
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

interface StoredNodePosition {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface Props {
  notes: Note[]
  links: NoteLink[]
  onNodeClick: (note: Note) => void
  focusNoteId?: string
  selectedNoteId?: string
  mode?: 'context' | 'full'
}

const CONTEXT_GRAPH_LINK_DISTANCE = 96
const FULL_GRAPH_LINK_DISTANCE = 170
const CONTEXT_GRAPH_CHARGE = -220
const FULL_GRAPH_CHARGE = -145
const GRAPH_COLLISION_PADDING = 16

function applySelectedNodeStyles(
  circles: d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>,
  selectedNoteId?: string,
) {
  circles
    .attr('fill', (d) => d.id === selectedNoteId ? '#222730' : '#1d2128')
    .attr('stroke', (d) => d.id === selectedNoteId ? '#b4ab99' : '#6d8394')
    .attr('stroke-opacity', (d) => d.id === selectedNoteId ? 0.9 : 0.55)
    .attr('stroke-width', (d) => d.id === selectedNoteId ? 1.4 : 1)
}

export default function GraphCanvas({ notes, links, onNodeClick, focusNoteId, selectedNoteId, mode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const circlesRef = useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const zoomTransformRef = useRef(d3.zoomIdentity)
  const nodePositionsRef = useRef(new Map<string, StoredNodePosition>())

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    if (circlesRef.current) {
      applySelectedNodeStyles(circlesRef.current, selectedNoteId)
    }
  }, [selectedNoteId])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    zoomTransformRef.current = d3.zoomTransform(svgRef.current)

    if (notes.length === 0) {
      svg.selectAll('*').remove()
      circlesRef.current = null
      return
    }

    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    const linkCountMap = new Map<string, number>()
    links.forEach((l) => {
      const from = l.from_note_id
      const to = l.to_note_id
      linkCountMap.set(from, (linkCountMap.get(from) ?? 0) + 1)
      linkCountMap.set(to, (linkCountMap.get(to) ?? 0) + 1)
    })

    const nodes: GraphNode[] = notes.map((n) => ({
      id: n.id,
      title: n.title,
      linkCount: linkCountMap.get(n.id) ?? 0,
      ...nodePositionsRef.current.get(n.id),
      ...(focusNoteId === n.id ? { x: width / 2, y: height / 2, fx: width / 2, fy: height / 2 } : {}),
    }))

    const edges: GraphEdge[] = links.map((l) => ({
      source: l.from_note_id,
      target: l.to_note_id,
    }))

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, (n) => n.linkCount) ?? 1])
      .range([4, 10])

    const g = svg.append('g')

    // Zoom/pan
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform
        g.attr('transform', event.transform)
      })

    svg.on('.zoom', null)
    svg.call(zoomBehavior)
    svg.call(zoomBehavior.transform, zoomTransformRef.current)

    const linkDistance = mode === 'context' ? CONTEXT_GRAPH_LINK_DISTANCE : FULL_GRAPH_LINK_DISTANCE
    const chargeStrength = mode === 'context' ? CONTEXT_GRAPH_CHARGE : FULL_GRAPH_CHARGE

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => radiusScale(d.linkCount) + GRAPH_COLLISION_PADDING))
      .alphaDecay(0.04)
      .velocityDecay(0.5)

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#38414c')
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1)

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.1).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            if (d.id !== focusNoteId) { d.fx = null; d.fy = null }
          })
      )

    const circles = node.append('circle')
      .attr('r', (d) => radiusScale(d.linkCount))

    circlesRef.current = circles
    applySelectedNodeStyles(circles, selectedNoteId)

    node.append('text')
      .attr('dy', (d) => radiusScale(d.linkCount) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'Poppins, sans-serif')
      .attr('letter-spacing', '0.04em')
      .attr('fill', '#7f7a70')
      .text((d) => d.title.length > 24 ? d.title.slice(0, 24) + '…' : d.title)

    node.on('click', (_, d) => {
      const note = notes.find((n) => n.id === d.id)
      if (note) onNodeClickRef.current(note)
    })

    node.on('mouseover', (_, d) => {
      const connected = new Set([d.id])
      edges.forEach((e) => {
        const s = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
        const t = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
        if (s === d.id) connected.add(t)
        if (t === d.id) connected.add(s)
      })
      node.attr('opacity', (n) => connected.has(n.id) ? 1 : 0.15)
      link.attr('stroke-opacity', (e) => {
        const s = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
        const t = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
        return connected.has(s) && connected.has(t) ? 0.9 : 0.04
      })
    })

    node.on('mouseout', () => {
      node.attr('opacity', 1)
      link.attr('stroke-opacity', 0.45)
    })

    const renderPositions = () => {
      nodes.forEach((graphNode) => {
        nodePositionsRef.current.set(graphNode.id, {
          x: graphNode.x,
          y: graphNode.y,
          fx: graphNode.fx,
          fy: graphNode.fy,
        })
      })

      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    renderPositions()
    simulation.on('tick', renderPositions)

    return () => {
      simulation.stop()
      circlesRef.current = null
    }
  }, [notes, links, focusNoteId, mode])

  return <svg ref={svgRef} width="100%" height="100%" style={{ background: '#0d0f13' }} />
}
