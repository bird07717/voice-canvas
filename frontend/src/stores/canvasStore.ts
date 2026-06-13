import { create } from 'zustand'
import Konva from 'konva'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

type TransformOptions = {
  dx: number
  dy: number
  scaleX: number
  scaleY: number
  originX: number
  originY: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const hasOwn = (object: any, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key)

const getDefinedUpdates = (updates: any) =>
  Object.fromEntries(Object.entries(updates || {}).filter(([, value]) => value !== undefined))

const sanitizeGroupParams = (params: any) => {
  const {
    x,
    y,
    width,
    height,
    radius,
    innerRadius,
    outerRadius,
    points,
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    ...rest
  } = params || {}

  return rest
}

const getPointBounds = (points: number[]): Bounds | null => {
  if (!Array.isArray(points) || points.length < 2) return null

  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)
  if (!xs.length || !ys.length) return null

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

const getObjectBounds = (obj: any): Bounds | null => {
  const params = obj.params || {}

  if (obj.type === 'group') {
    const childBounds = (obj.children || [])
      .map((child: any) => getObjectBounds(child))
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

  if (Array.isArray(params.points)) {
    return getPointBounds(params.points)
  }

  if (obj.type === 'circle') {
    const radius = isFiniteNumber(params.radius) ? params.radius : 0
    return {
      x: (params.x || 0) - radius,
      y: (params.y || 0) - radius,
      width: radius * 2,
      height: radius * 2,
    }
  }

  if (obj.type === 'star') {
    const radius = isFiniteNumber(params.outerRadius) ? params.outerRadius : 0
    return {
      x: (params.x || 0) - radius,
      y: (params.y || 0) - radius,
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

  if (!isFiniteNumber(params.x) || !isFiniteNumber(params.y)) return null

  return {
    x: params.x,
    y: params.y,
    width,
    height,
  }
}

const transformPoint = (x: number, y: number, transform: TransformOptions) => ({
  x: transform.originX + (x - transform.originX) * transform.scaleX + transform.dx,
  y: transform.originY + (y - transform.originY) * transform.scaleY + transform.dy,
})

const transformObject = (obj: any, transform: TransformOptions): any => {
  if (obj.type === 'group') {
    return {
      ...obj,
      children: (obj.children || []).map((child: any) => transformObject(child, transform)),
    }
  }

  const params = { ...(obj.params || {}) }
  const radiusScale = (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2

  if (Array.isArray(params.points)) {
    params.points = params.points.map((point: number, index: number, points: number[]) => {
      if (index % 2 === 1) return point
      const nextPoint = transformPoint(point, points[index + 1], transform)
      return nextPoint.x
    })
    params.points = params.points.map((point: number, index: number, points: number[]) => {
      if (index % 2 === 0) return point
      const previousX = points[index - 1]
      const nextPoint = transformPoint(previousX, point, transform)
      return nextPoint.y
    })
  }

  if (isFiniteNumber(params.x) && isFiniteNumber(params.y)) {
    const nextPoint = transformPoint(params.x, params.y, transform)
    params.x = nextPoint.x
    params.y = nextPoint.y
  }

  if (isFiniteNumber(params.width)) params.width *= transform.scaleX
  if (isFiniteNumber(params.height)) params.height *= transform.scaleY
  if (isFiniteNumber(params.radius)) params.radius *= radiusScale
  if (isFiniteNumber(params.innerRadius)) params.innerRadius *= radiusScale
  if (isFiniteNumber(params.outerRadius)) params.outerRadius *= radiusScale
  if (isFiniteNumber(params.fontSize)) params.fontSize *= radiusScale

  return { ...obj, params }
}

const getCanvasClampDelta = (bounds: Bounds) => {
  let dx = 0
  let dy = 0

  if (bounds.width >= CANVAS_WIDTH) {
    dx = -bounds.x
  } else if (bounds.x < 0) {
    dx = -bounds.x
  } else if (bounds.x + bounds.width > CANVAS_WIDTH) {
    dx = CANVAS_WIDTH - (bounds.x + bounds.width)
  }

  if (bounds.height >= CANVAS_HEIGHT) {
    dy = -bounds.y
  } else if (bounds.y < 0) {
    dy = -bounds.y
  } else if (bounds.y + bounds.height > CANVAS_HEIGHT) {
    dy = CANVAS_HEIGHT - (bounds.y + bounds.height)
  }

  return { dx, dy }
}

const clampObjectToCanvas = (obj: any): any => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return obj

  const { dx, dy } = getCanvasClampDelta(bounds)
  if (dx === 0 && dy === 0) return obj

  return transformObject(obj, {
    dx,
    dy,
    scaleX: 1,
    scaleY: 1,
    originX: bounds.x,
    originY: bounds.y,
  })
}

const getStyleUpdates = (updates: any) => {
  const styleUpdates: any = {}
  ;['fill', 'stroke', 'strokeWidth', 'opacity'].forEach((key) => {
    if (hasOwn(updates, key)) {
      styleUpdates[key] = updates[key]
    }
  })
  return styleUpdates
}

const applyStyleUpdates = (obj: any, updates: any): any => {
  if (!Object.keys(updates).length) return obj

  if (obj.type === 'group') {
    return {
      ...obj,
      params: { ...(obj.params || {}), ...updates },
      children: (obj.children || []).map((child: any) => applyStyleUpdates(child, updates)),
    }
  }

  const params = { ...(obj.params || {}) }

  if (hasOwn(updates, 'fill')) {
    if (obj.type === 'line') {
      params.stroke = updates.stroke ?? updates.fill
    } else {
      params.fill = updates.fill
    }
  }

  if (hasOwn(updates, 'stroke')) params.stroke = updates.stroke
  if (hasOwn(updates, 'strokeWidth')) params.strokeWidth = updates.strokeWidth
  if (hasOwn(updates, 'opacity')) params.opacity = updates.opacity

  return { ...obj, params }
}

const updateGroupObject = (obj: any, updates: any): any => {
  const groupParams = obj.params || {}
  const legacyOffsetX = isFiniteNumber(groupParams.x) ? groupParams.x : 0
  const legacyOffsetY = isFiniteNumber(groupParams.y) ? groupParams.y : 0
  let children = obj.children || []
  let bounds = getObjectBounds(obj)

  if (bounds && (legacyOffsetX !== 0 || legacyOffsetY !== 0)) {
    const legacyTransform: TransformOptions = {
      dx: legacyOffsetX,
      dy: legacyOffsetY,
      scaleX: 1,
      scaleY: 1,
      originX: bounds.x,
      originY: bounds.y,
    }

    children = children.map((child: any) => transformObject(child, legacyTransform))
    bounds = {
      ...bounds,
      x: bounds.x + legacyOffsetX,
      y: bounds.y + legacyOffsetY,
    }
  }

  if (bounds) {
    const hasX = hasOwn(updates, 'x') && isFiniteNumber(updates.x)
    const hasY = hasOwn(updates, 'y') && isFiniteNumber(updates.y)
    const hasWidth = hasOwn(updates, 'width') && isFiniteNumber(updates.width) && bounds.width
    const hasHeight = hasOwn(updates, 'height') && isFiniteNumber(updates.height) && bounds.height

    const widthScale = hasWidth ? updates.width / bounds.width : null
    const heightScale = hasHeight ? updates.height / bounds.height : null
    const scaleX = widthScale ?? heightScale ?? 1
    const scaleY = heightScale ?? widthScale ?? 1

    const transform: TransformOptions = {
      dx: hasX ? updates.x - bounds.x : 0,
      dy: hasY ? updates.y - bounds.y : 0,
      scaleX,
      scaleY,
      originX: bounds.x + bounds.width / 2,
      originY: bounds.y + bounds.height / 2,
    }

    const shouldTransform =
      transform.dx !== 0 || transform.dy !== 0 || transform.scaleX !== 1 || transform.scaleY !== 1

    if (shouldTransform) {
      children = children.map((child: any) => transformObject(child, transform))
    }
  }

  const styleUpdates = getStyleUpdates(updates)
  if (Object.keys(styleUpdates).length) {
    children = children.map((child: any) => applyStyleUpdates(child, styleUpdates))
  }

  const nextGroupParams = sanitizeGroupParams({ ...groupParams, ...styleUpdates })

  return clampObjectToCanvas({
    ...obj,
    params: nextGroupParams,
    children,
  })
}

const updateCanvasObject = (obj: any, id: string, updates: any): any => {
  if (obj.id !== id) return obj

  const definedUpdates = getDefinedUpdates(updates)

  if (obj.type === 'group') {
    return updateGroupObject(obj, definedUpdates)
  }

  return clampObjectToCanvas({ ...obj, params: { ...obj.params, ...definedUpdates } })
}

interface CanvasState {
  currentCanvasId: number | null
  canvasObjects: any[]
  lastCreatedObjectId: string | null
  lastModifiedObjectId: string | null
  selectedObjectId: string | null
  recentCommands: any[]
  history: any[][]
  historyStep: number
  isDrawing: boolean
  stageRef: Konva.Stage | null

  setCurrentCanvasId: (id: number | null) => void
  setCanvasObjects: (objects: any[]) => void
  setSelectedObjectId: (id: string | null) => void
  recordCommands: (commands: any[]) => void
  addObject: (object: any) => void
  updateObject: (id: string, updates: any) => void
  removeObject: (id: string) => void
  clearCanvas: () => void
  undo: () => void
  redo: () => void
  saveToHistory: () => void
  setStageRef: (stage: Konva.Stage | null) => void
  loadCanvasJson: (json: any) => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentCanvasId: null,
  canvasObjects: [],
  lastCreatedObjectId: null,
  lastModifiedObjectId: null,
  selectedObjectId: null,
  recentCommands: [],
  history: [[]],
  historyStep: 0,
  isDrawing: false,
  stageRef: null,

  setCurrentCanvasId: (id) => set({ currentCanvasId: id }),

  setCanvasObjects: (objects) => set({ canvasObjects: objects }),

  setSelectedObjectId: (id) => set({ selectedObjectId: id }),

  recordCommands: (commands) =>
    set((state) => ({
      recentCommands: [...state.recentCommands, ...commands].slice(-20),
    })),

  addObject: (object) => {
    set((state) => ({
      canvasObjects: [...state.canvasObjects, object],
      lastCreatedObjectId: object.id,
      lastModifiedObjectId: object.id,
    }))
    get().saveToHistory()
  },

  updateObject: (id, updates) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) => updateCanvasObject(obj, id, updates)),
      lastModifiedObjectId: id,
    }))
    get().saveToHistory()
  },

  removeObject: (id) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }))
    get().saveToHistory()
  },

  clearCanvas: () => {
    set({
      canvasObjects: [],
      lastCreatedObjectId: null,
      lastModifiedObjectId: null,
      selectedObjectId: null,
      recentCommands: [],
    })
    get().saveToHistory()
  },

  undo: () => {
    const { history, historyStep } = get()
    if (historyStep > 0) {
      const newStep = historyStep - 1
      set({
        historyStep: newStep,
        canvasObjects: JSON.parse(JSON.stringify(history[newStep])),
        lastModifiedObjectId: null,
      })
    }
  },

  redo: () => {
    const { history, historyStep } = get()
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1
      set({
        historyStep: newStep,
        canvasObjects: JSON.parse(JSON.stringify(history[newStep])),
        lastModifiedObjectId: null,
      })
    }
  },

  saveToHistory: () => {
    const { canvasObjects, history, historyStep } = get()
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(JSON.parse(JSON.stringify(canvasObjects)))
    set({
      history: newHistory,
      historyStep: newHistory.length - 1,
    })
  },

  setStageRef: (stage) => set({ stageRef: stage }),

  loadCanvasJson: (json) => {
    if (json && json.objects) {
      set({
        canvasObjects: json.objects,
        history: [json.objects],
        historyStep: 0,
        lastCreatedObjectId: json.objects[json.objects.length - 1]?.id || null,
        lastModifiedObjectId: null,
        selectedObjectId: null,
        recentCommands: [],
      })
    }
  },
}))
