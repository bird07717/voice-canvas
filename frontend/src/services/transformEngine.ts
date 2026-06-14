import { CanvasObject } from '@/types'

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const getPointBounds = (points: number[]): Bounds | null => {
  if (!Array.isArray(points) || points.length < 2) return null

  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)
  if (!xs.length || !ys.length) return null

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

export const getObjectBounds = (obj: CanvasObject): Bounds | null => {
  const params = obj.params || {}

  if (obj.type === 'group') {
    const childBounds = (obj.children || [])
      .map((child) => getObjectBounds(child))
      .filter(Boolean) as Bounds[]

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

  if (Array.isArray(params.points)) return getPointBounds(params.points)

  if (!isFiniteNumber(params.x) || !isFiniteNumber(params.y)) return null

  if (isFiniteNumber(params.radius)) {
    return {
      x: params.x - params.radius,
      y: params.y - params.radius,
      width: params.radius * 2,
      height: params.radius * 2,
    }
  }

  if (obj.type === 'star') {
    const radius = isFiniteNumber(params.outerRadius) ? params.outerRadius : 0
    return {
      x: params.x - radius,
      y: params.y - radius,
      width: radius * 2,
      height: radius * 2,
    }
  }

  const width = isFiniteNumber(params.width) ? params.width : 0
  const height = isFiniteNumber(params.height)
    ? params.height
    : obj.type === 'text'
      ? params.fontSize || 24
      : 0

  return {
    x: params.x,
    y: params.y,
    width,
    height,
  }
}

const transformPoint = (
  x: number,
  y: number,
  transform: { dx: number; dy: number; scale: number; originX: number; originY: number }
) => ({
  x: transform.originX + (x - transform.originX) * transform.scale + transform.dx,
  y: transform.originY + (y - transform.originY) * transform.scale + transform.dy,
})

const transformObject = (
  obj: CanvasObject,
  transform: { dx: number; dy: number; scale: number; originX: number; originY: number }
): CanvasObject => {
  if (obj.type === 'group') {
    return {
      ...obj,
      children: obj.children?.map((child) => transformObject(child, transform)),
    }
  }

  const params = { ...(obj.params || {}) }

  if (Array.isArray(params.points)) {
    params.points = params.points.map((point: number, index: number, points: number[]) => {
      if (index % 2 === 1) return point
      return transformPoint(point, points[index + 1], transform).x
    })
    params.points = params.points.map((point: number, index: number, points: number[]) => {
      if (index % 2 === 0) return point
      return transformPoint(points[index - 1], point, transform).y
    })
  }

  if (isFiniteNumber(params.x) && isFiniteNumber(params.y)) {
    const nextPoint = transformPoint(params.x, params.y, transform)
    params.x = nextPoint.x
    params.y = nextPoint.y
  }

  if (isFiniteNumber(params.width)) params.width = Math.max(8, params.width * transform.scale)
  if (isFiniteNumber(params.height)) params.height = Math.max(8, params.height * transform.scale)
  if (isFiniteNumber(params.radius)) params.radius = Math.max(6, params.radius * transform.scale)
  if (isFiniteNumber(params.innerRadius)) params.innerRadius = Math.max(4, params.innerRadius * transform.scale)
  if (isFiniteNumber(params.outerRadius)) params.outerRadius = Math.max(6, params.outerRadius * transform.scale)
  if (isFiniteNumber(params.fontSize)) params.fontSize = Math.max(10, params.fontSize * transform.scale)

  return { ...obj, params }
}

const clampObjectToCanvas = (obj: CanvasObject): CanvasObject => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return obj

  let dx = 0
  let dy = 0

  if (bounds.x < 0) dx = -bounds.x
  if (bounds.y < 0) dy = -bounds.y
  if (bounds.x + bounds.width > CANVAS_WIDTH) dx = CANVAS_WIDTH - (bounds.x + bounds.width)
  if (bounds.y + bounds.height > CANVAS_HEIGHT) dy = CANVAS_HEIGHT - (bounds.y + bounds.height)

  if (dx === 0 && dy === 0) return obj

  return transformObject(obj, {
    dx,
    dy,
    scale: 1,
    originX: bounds.x,
    originY: bounds.y,
  })
}

export const buildMoveByUpdates = (obj: CanvasObject, dx: number, dy: number) => {
  const nextObject = clampObjectToCanvas(
    transformObject(obj, {
      dx,
      dy,
      scale: 1,
      originX: 0,
      originY: 0,
    })
  )
  return { ...nextObject.params, children: nextObject.children }
}

export const buildMoveToUpdates = (obj: CanvasObject, x: number, y: number) => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return { x, y }

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return buildMoveByUpdates(obj, x - centerX, y - centerY)
}

export const buildScaleAroundCenterUpdates = (obj: CanvasObject, scale: number) => {
  const bounds = getObjectBounds(obj)
  if (!bounds || !Number.isFinite(scale) || scale <= 0) return null

  const nextObject = clampObjectToCanvas(
    transformObject(obj, {
      dx: 0,
      dy: 0,
      scale,
      originX: bounds.x + bounds.width / 2,
      originY: bounds.y + bounds.height / 2,
    })
  )
  return { ...nextObject.params, children: nextObject.children }
}
