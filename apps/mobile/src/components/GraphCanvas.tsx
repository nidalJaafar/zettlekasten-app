import { useMemo, useRef, useState, useCallback } from 'react'
import { View, PanResponder, Dimensions } from 'react-native'
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg'
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force'
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force'
import { typeColor, BG } from '../theme'

interface Props {
  nodes: Array<{ id: string; title: string; type: string }>
  edges: Array<{ source: string; target: string }>
  onNodePress: (id: string) => void
}

interface SimNode extends SimulationNodeDatum {
  id: string
  title: string
  type: string
}

interface SimLink extends SimulationLinkDatum<SimNode> {}

export default function GraphCanvas({ nodes, edges, onNodePress }: Props) {
  const screen = Dimensions.get('window')
  const width = screen.width
  const height = screen.height

  const transformRef = useRef({ x: 0, y: 0, s: 1 })
  const [transform, setTransform] = useState({ x: 0, y: 0, s: 1 })
  const grantRef = useRef({ x: 0, y: 0, s: 1 })
  const pinchStartDist = useRef<number | null>(null)
  const pinchStartScale = useRef(1)

  const updateTransform = useCallback((next: { x: number; y: number; s: number }) => {
    transformRef.current = next
    setTransform(next)
  }, [])

  const { simNodes, simLinks } = useMemo(() => {
    const sn: SimNode[] = nodes.map((n) => ({ ...n }))
    const sl: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }))

    if (sn.length === 0) return { simNodes: sn, simLinks: sl }

    const sim = forceSimulation<SimNode>(sn)
      .force(
        'link',
        forceLink<SimNode, SimLink>(sl)
          .id((d: SimNode) => d.id)
          .distance(80)
      )
      .force('charge', forceManyBody<SimNode>().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .stop()

    for (let i = 0; i < 120; i++) {
      sim.tick()
    }

    return { simNodes: sn, simLinks: sl }
  }, [nodes, edges, width, height])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          grantRef.current = { ...transformRef.current }
          pinchStartDist.current = null
        },
        onPanResponderMove: (e, gs) => {
          if (e.nativeEvent.touches.length >= 2 && pinchStartDist.current === null) {
            const t1 = e.nativeEvent.touches[0]
            const t2 = e.nativeEvent.touches[1]
            const dx = t1.pageX - t2.pageX
            const dy = t1.pageY - t2.pageY
            pinchStartDist.current = Math.sqrt(dx * dx + dy * dy)
            pinchStartScale.current = grantRef.current.s
          }

          if (e.nativeEvent.touches.length >= 2 && pinchStartDist.current !== null && pinchStartDist.current > 0) {
            const t1 = e.nativeEvent.touches[0]
            const t2 = e.nativeEvent.touches[1]
            const dx = t1.pageX - t2.pageX
            const dy = t1.pageY - t2.pageY
            const dist = Math.sqrt(dx * dx + dy * dy)
            const newScale = Math.max(0.3, Math.min(3, pinchStartScale.current * (dist / pinchStartDist.current)))
            updateTransform({
              x: grantRef.current.x + gs.dx,
              y: grantRef.current.y + gs.dy,
              s: newScale,
            })
          } else {
            updateTransform({
              x: grantRef.current.x + gs.dx,
              y: grantRef.current.y + gs.dy,
              s: grantRef.current.s,
            })
          }
        },
        onPanResponderRelease: (e, gs) => {
          pinchStartDist.current = null
          if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5 && gs.numberActiveTouches === 1) {
            const locationX = e.nativeEvent.locationX
            const locationY = e.nativeEvent.locationY
            if (locationX == null || locationY == null) return
            const t = transformRef.current
            const gx = (locationX - t.x) / t.s
            const gy = (locationY - t.y) / t.s
            for (let i = simNodes.length - 1; i >= 0; i--) {
              const node = simNodes[i]
              if (node.x == null || node.y == null) continue
              const ddx = gx - node.x
              const ddy = gy - node.y
              if (Math.sqrt(ddx * ddx + ddy * ddy) <= 18) {
                onNodePress(node.id)
                return
              }
            }
          }
        },
      }),
    [updateTransform, simNodes, onNodePress]
  )

  return (
    <View style={{ flex: 1, backgroundColor: BG.canvas }} {...panResponder.panHandlers}>
      <Svg width={width} height={height}>
        <G transform={`translate(${transform.x}, ${transform.y}) scale(${transform.s})`}>
          {simLinks.map((link, i) => {
            const src = typeof link.source === 'object' ? link.source : undefined
            const tgt = typeof link.target === 'object' ? link.target : undefined
            if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return null
            return (
              <Line
                key={i}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="rgba(143,152,168,0.25)"
                strokeWidth={1}
              />
            )
          })}
          {simNodes.map((node) => {
            if (node.x == null || node.y == null) return null
            const color = typeColor(node.type)
            const label = node.title.length > 16 ? node.title.slice(0, 16) + '...' : node.title
            return (
              <G key={node.id}>
                <Circle cx={node.x} cy={node.y} r={12} fill={color} />
                <SvgText
                  x={node.x}
                  y={node.y + 24}
                  fontSize={9}
                  fill="#e7e0d1"
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              </G>
            )
          })}
        </G>
      </Svg>
    </View>
  )
}
