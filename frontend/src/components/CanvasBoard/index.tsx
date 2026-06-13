import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Circle, Rect, Line, Text, Star, Group } from 'react-konva'
import { useCanvasStore } from '@/stores/canvasStore'
import { CanvasObject } from '@/types'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const translateChild = (child: CanvasObject, dx: number, dy: number): CanvasObject => {
  const params = { ...(child.params || {}) }

  if (Array.isArray(params.points)) {
    params.points = params.points.map((point: number, index: number) =>
      index % 2 === 0 ? point + dx : point + dy
    )
  } else {
    params.x = (params.x || 0) + dx
    params.y = (params.y || 0) + dy
  }

  return {
    ...child,
    params,
    children: child.children?.map((nestedChild) => translateChild(nestedChild, dx, dy)),
  }
}

export default function CanvasBoard() {
  const stageRef = useRef<any>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const {
    canvasObjects,
    selectedObjectId,
    setStageRef,
    updateObject,
    setSelectedObjectId,
  } = useCanvasStore()

  useEffect(() => {
    if (stageRef.current) {
      setStageRef(stageRef.current)
    }
  }, [stageRef, setStageRef])

  useEffect(() => {
    const updateScale = () => {
      if (!frameRef.current) return

      const { width, height } = frameRef.current.getBoundingClientRect()
      const nextScale = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT, 1.35)
      setScale(Math.max(0.7, nextScale))
    }

    updateScale()

    const observer = new ResizeObserver(updateScale)
    if (frameRef.current) {
      observer.observe(frameRef.current)
    }

    window.addEventListener('resize', updateScale)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  const getSelectedProps = (obj: CanvasObject, nested: boolean) => {
    if (nested || obj.id !== selectedObjectId) return {}

    return {
      stroke: '#2563eb',
      strokeWidth: Math.max(3, Number(obj.params?.strokeWidth || 1) + 2),
      shadowColor: '#2563eb',
      shadowBlur: 8,
      shadowOpacity: 0.28,
    }
  }

  const handleDragEnd = (obj: CanvasObject, event: any) => {
    const node = event.target
    const dx = node.x()
    const dy = node.y()

    if (Array.isArray(obj.params?.points)) {
      const nextPoints = obj.params.points.map((point: number, index: number) =>
        index % 2 === 0 ? point + dx : point + dy
      )
      node.position({ x: 0, y: 0 })
      updateObject(obj.id, { points: nextPoints, x: 0, y: 0 })
      setSelectedObjectId(obj.id)
      return
    }

    if (obj.type === 'group') {
      node.position({ x: 0, y: 0 })
      updateObject(obj.id, {
        children: obj.children?.map((child) => translateChild(child, dx, dy)),
      })
      setSelectedObjectId(obj.id)
      return
    }

    updateObject(obj.id, {
      x: node.x(),
      y: node.y(),
    })
    setSelectedObjectId(obj.id)
  }

  const renderObject = (obj: CanvasObject, nested = false) => {
    const commonProps = {
      key: obj.id,
      id: obj.id,
      draggable: !nested,
      ...obj.params,
      ...getSelectedProps(obj, nested),
      onClick: (event: any) => {
        if (nested) return
        event.cancelBubble = true
        setSelectedObjectId(obj.id)
      },
      onTap: (event: any) => {
        if (nested) return
        event.cancelBubble = true
        setSelectedObjectId(obj.id)
      },
      onDragEnd: (event: any) => {
        if (nested) return
        handleDragEnd(obj, event)
      },
    }

    switch (obj.type) {
      case 'circle':
        return <Circle {...commonProps} />

      case 'rect':
        return <Rect {...commonProps} />

      case 'line':
        return <Line {...commonProps} />

      case 'text':
        return <Text {...commonProps} />

      case 'star':
        return (
          <Star
            {...commonProps}
            numPoints={obj.params.numPoints ?? 5}
            innerRadius={obj.params.innerRadius ?? 20}
            outerRadius={obj.params.outerRadius ?? 40}
          />
        )

      case 'group':
        return (
          <Group {...commonProps}>
            {obj.children?.map((child) => renderObject(child, true))}
          </Group>
        )

      case 'polygon':
        return <Line {...commonProps} closed />

      default:
        return null
    }
  }

  return (
    <div className="canvas-board-frame" ref={frameRef}>
      <div
        className="konva-container"
        style={{
          width: CANVAS_WIDTH * scale,
          height: CANVAS_HEIGHT * scale,
        }}
      >
        <Stage
          width={CANVAS_WIDTH * scale}
          height={CANVAS_HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          ref={stageRef}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) {
              setSelectedObjectId(null)
            }
          }}
          onTouchStart={(event) => {
            if (event.target === event.target.getStage()) {
              setSelectedObjectId(null)
            }
          }}
        >
          <Layer>
            {canvasObjects.map((obj) => renderObject(obj))}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
