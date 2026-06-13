import { useRef, useEffect } from 'react'
import { Stage, Layer, Circle, Rect, Line, Text, Star, Group } from 'react-konva'
import { useCanvasStore } from '@/stores/canvasStore'
import { CanvasObject } from '@/types'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

export default function CanvasBoard() {
  const stageRef = useRef<any>(null)
  const { canvasObjects, setStageRef } = useCanvasStore()

  useEffect(() => {
    if (stageRef.current) {
      setStageRef(stageRef.current)
    }
  }, [stageRef, setStageRef])

  const renderObject = (obj: CanvasObject) => {
    const commonProps = {
      key: obj.id,
      id: obj.id,
      draggable: true,
      ...obj.params,
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
        return <Star {...commonProps} />

      case 'group':
        return (
          <Group {...commonProps}>
            {obj.children?.map((child) => renderObject(child))}
          </Group>
        )

      case 'polygon':
        return <Line {...commonProps} closed />

      default:
        return null
    }
  }

  return (
    <div className="konva-container">
      <Stage
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        ref={stageRef}
      >
        <Layer>
          {canvasObjects.map((obj) => renderObject(obj))}
        </Layer>
      </Stage>
    </div>
  )
}
