import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { clampPaneWidth, readPaneWidth, type ResizablePaneConfig } from '../lib/layout'

interface Options extends ResizablePaneConfig {
  direction?: 'left' | 'right'
}

interface DragState {
  startX: number
  startWidth: number
}

export function useResizablePane({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  direction = 'left',
}: Options) {
  const [width, setWidth] = useState(() => readPaneWidth({ storageKey, defaultWidth, minWidth, maxWidth }))
  const [isDragging, setIsDragging] = useState(false)
  const dragStateRef = useRef<DragState | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width))
    } catch {
      // Ignore unavailable storage and keep the current in-memory width.
    }
  }, [storageKey, width])

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const handleProps = useMemo(() => ({
    role: 'separator' as const,
    'aria-orientation': 'vertical' as const,
    onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      cleanupRef.current?.()
      dragStateRef.current = {
        startX: event.clientX,
        startWidth: width,
      }
      setIsDragging(true)

      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentDrag = dragStateRef.current
        if (!currentDrag) {
          return
        }

        const delta = direction === 'right'
          ? currentDrag.startX - moveEvent.clientX
          : moveEvent.clientX - currentDrag.startX

        setWidth(clampPaneWidth(currentDrag.startWidth + delta, minWidth, maxWidth))
      }

      const handleMouseUp = () => {
        cleanupRef.current?.()
      }

      const handleWindowBlur = () => {
        cleanupRef.current?.()
      }

      cleanupRef.current = () => {
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        dragStateRef.current = null
        setIsDragging(false)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('blur', handleWindowBlur)
        cleanupRef.current = null
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('blur', handleWindowBlur)
    },
  }), [direction, maxWidth, minWidth, width])

  return {
    width,
    isDragging,
    handleProps,
  }
}
