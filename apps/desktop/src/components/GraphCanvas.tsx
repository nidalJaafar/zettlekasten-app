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

interface Props {
  notes: Note[]
  links: NoteLink[]
  onNodeClick: (note: Note) => void
}

export default function GraphCanvas({ notes, links, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || notes.length === 0) return

    const svg = d3.select(svgRef.current)
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
    }))

    const edges: GraphEdge[] = links.map((l) => ({
      source: l.from_note_id,
      target: l.to_note_id,
    }))

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, (n) => n.linkCount) ?? 1])
      .range([6, 20])

    const g = svg.append('g')

    // Zoom/pan
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => radiusScale(d.linkCount) + 4))

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#6c63ff')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    node.append('circle')
      .attr('r', (d) => radiusScale(d.linkCount))
      .attr('fill', '#6c63ff')
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#a29bfe')
      .attr('stroke-width', 1.5)

    node.append('text')
      .attr('dy', (d) => radiusScale(d.linkCount) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#b0b0cc')
      .text((d) => d.title.length > 24 ? d.title.slice(0, 24) + '…' : d.title)

    node.on('click', (_, d) => {
      const note = notes.find((n) => n.id === d.id)
      if (note) onNodeClick(note)
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
        return connected.has(s) && connected.has(t) ? 0.8 : 0.05
      })
    })

    node.on('mouseout', () => {
      node.attr('opacity', 1)
      link.attr('stroke-opacity', 0.4)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop() }
  }, [notes, links])

  return <svg ref={svgRef} width="100%" height="100%" style={{ background: '#0a0a18' }} />
}
