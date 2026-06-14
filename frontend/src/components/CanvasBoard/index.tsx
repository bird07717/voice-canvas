import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Circle, Rect, Line, Text, Star, Group, Image as KonvaImage } from 'react-konva'
import { useCanvasStore } from '@/stores/canvasStore'
import { CanvasObject } from '@/types'
import { resolveApiUrl } from '@/services/api'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

function CanvasImage(props: any) {
  const { imageUrl, ...konvaProps } = props
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const resolvedImageUrl = resolveApiUrl(imageUrl)

    if (!resolvedImageUrl) {
      setImage(null)
      return
    }

    const nextImage = new window.Image()
    nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => setImage(nextImage)
    nextImage.onerror = () => {
      console.warn('Canvas image failed to load:', resolvedImageUrl)
      setImage(null)
    }
    nextImage.src = resolvedImageUrl
  }, [imageUrl])

  if (!image) {
    return <Rect {...konvaProps} fill={konvaProps.fill || '#E5E7EB'} stroke={konvaProps.stroke || '#94A3B8'} />
  }

  return <KonvaImage {...konvaProps} image={image} />
}

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

const getShapeBounds = (obj: CanvasObject) => {
  const params = obj.params || {}

  if (obj.type === 'group') {
    const childBounds = (obj.children || [])
      .map((child) => getShapeBounds(child))
      .filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>

    if (!childBounds.length) return null

    const minX = Math.min(...childBounds.map((bounds) => bounds.x))
    const minY = Math.min(...childBounds.map((bounds) => bounds.y))
    const maxX = Math.max(...childBounds.map((bounds) => bounds.x + bounds.width))
    const maxY = Math.max(...childBounds.map((bounds) => bounds.y + bounds.height))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  if (Array.isArray(params.points) && params.points.length >= 4) {
    const xs = params.points.filter((_: number, index: number) => index % 2 === 0)
    const ys = params.points.filter((_: number, index: number) => index % 2 === 1)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  if (typeof params.x !== 'number' || typeof params.y !== 'number') return null

  if (typeof params.radius === 'number') {
    return {
      x: params.x - params.radius,
      y: params.y - params.radius,
      width: params.radius * 2,
      height: params.radius * 2,
    }
  }

  if (obj.type === 'star') {
    const radius = Number(params.outerRadius || 40)
    return {
      x: params.x - radius,
      y: params.y - radius,
      width: radius * 2,
      height: radius * 2,
    }
  }

  if (obj.type === 'text') {
    const text = String(params.text || '')
    const fontSize = Number(params.fontSize || 24)
    return {
      x: params.x,
      y: params.y,
      width: Math.max(40, text.length * fontSize * 0.62),
      height: fontSize * 1.4,
    }
  }

  if (obj.type === 'image') {
    return {
      x: params.x,
      y: params.y,
      width: Number(params.width || 0),
      height: Number(params.height || 0),
    }
  }

  return {
    x: params.x,
    y: params.y,
    width: Number(params.width || 0),
    height: Number(params.height || 0),
  }
}

const getObjectLabel = (obj: CanvasObject) => {
  if (obj.params?.kindLabel) return String(obj.params.kindLabel)

  const kind = String(obj.params?.kind || obj.type || '')
  const labels: Record<string, string> = {
    circle: '圆形',
    round: '圆形',
    rect: '矩形',
    rectangle: '矩形',
    square: '方形',
    line: '线条',
    polygon: '多边形',
    star: '星星',
    text: '文字',
    group: '组合',
    sun: '太阳',
    tree: '树',
    cloud: '云',
    house: '房子',
    flower: '花',
    person: '小人',
    car: '汽车',
    mountain: '山',
    grass: '草地',
    road: '道路',
    river: '河流',
    image: '素材',
  }

  return labels[kind.toLowerCase()] || kind || '对象'
}

export default function CanvasBoard() {
  const stageRef = useRef<any>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const {
    canvasObjects,
    selectedObjectId,
    disambiguationCandidateIds,
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

  const selectedObject = canvasObjects.find((obj) => obj.id === selectedObjectId) || null
  const selectedBounds = selectedObject ? getShapeBounds(selectedObject) : null
  const disambiguationCandidates = disambiguationCandidateIds
    .map((id, index) => {
      const obj = canvasObjects.find((item) => item.id === id)
      const bounds = obj ? getShapeBounds(obj) : null
      return obj && bounds ? { id, index, obj, bounds } : null
    })
    .filter(Boolean) as Array<{
      id: string
      index: number
      obj: CanvasObject
      bounds: { x: number; y: number; width: number; height: number }
    }>

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

      case 'image':
        return <CanvasImage {...commonProps} />

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
            {disambiguationCandidates.map((candidate) => (
              <Group key={`candidate-${candidate.id}`} listening={false}>
                <Rect
                  x={candidate.bounds.x - 10}
                  y={candidate.bounds.y - 10}
                  width={candidate.bounds.width + 20}
                  height={candidate.bounds.height + 20}
                  stroke="#f97316"
                  strokeWidth={3}
                  dash={[7, 5]}
                  cornerRadius={6}
                  shadowColor="#f97316"
                  shadowBlur={8}
                  shadowOpacity={0.22}
                />
                <Circle
                  x={candidate.bounds.x - 10}
                  y={candidate.bounds.y - 10}
                  radius={13}
                  fill="#f97316"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={candidate.bounds.x - 16}
                  y={candidate.bounds.y - 18}
                  width={12}
                  align="center"
                  text={String(candidate.index + 1)}
                  fontSize={14}
                  fontStyle="bold"
                  fill="#ffffff"
                />
              </Group>
            ))}
            {selectedBounds && (
              <>
                <Rect
                  x={selectedBounds.x - 8}
                  y={selectedBounds.y - 8}
                  width={selectedBounds.width + 16}
                  height={selectedBounds.height + 16}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dash={[8, 5]}
                  cornerRadius={6}
                  listening={false}
                  shadowColor="#2563eb"
                  shadowBlur={6}
                  shadowOpacity={0.18}
                />
                {selectedObject && (
                  <>
                    <Rect
                      x={selectedBounds.x - 8}
                      y={Math.max(4, selectedBounds.y - 34)}
                      width={Math.max(72, getObjectLabel(selectedObject).length * 14 + 38)}
                      height={22}
                      fill="#2563eb"
                      cornerRadius={5}
                      listening={false}
                    />
                    <Text
                      x={selectedBounds.x + 2}
                      y={Math.max(8, selectedBounds.y - 29)}
                      text={`当前：${getObjectLabel(selectedObject)}`}
                      fontSize={12}
                      fill="#ffffff"
                      listening={false}
                    />
                  </>
                )}
              </>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
