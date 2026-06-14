import { CanvasCommandContext, CanvasContextObject } from '@/types'

export type TargetQuery = {
  rawText?: string
  target?: string
  kind?: string
  label?: string
  spatial?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'largest'
}

export type ResolveResult = {
  objectId: string | null
  confidence: number
  reason: string
}

const KIND_ALIASES: Array<{ pattern: RegExp; kinds: string[]; labels: string[] }> = [
  { pattern: /圆|圆形/, kinds: ['circle', 'round'], labels: ['圆形'] },
  { pattern: /矩形|长方形|方块|方形|正方形/, kinds: ['rect', 'rectangle', 'square'], labels: ['矩形', '方形'] },
  { pattern: /线|直线|线条/, kinds: ['line'], labels: ['线条'] },
  { pattern: /星星|五角星/, kinds: ['star'], labels: ['星星'] },
  { pattern: /文字|文本|字/, kinds: ['text'], labels: ['文字'] },
  { pattern: /蛋糕/, kinds: ['cake'], labels: ['蛋糕', '生日蛋糕'] },
  { pattern: /气球/, kinds: ['balloon'], labels: ['气球'] },
  { pattern: /礼物/, kinds: ['gift'], labels: ['礼物'] },
  { pattern: /长椅|椅子|凳子/, kinds: ['bench'], labels: ['长椅', '椅子'] },
  { pattern: /房子|小屋/, kinds: ['house'], labels: ['房子', '小屋'] },
  { pattern: /树|树木/, kinds: ['tree', 'palm_tree'], labels: ['树', '椰子树'] },
  { pattern: /太阳|落日/, kinds: ['sun', 'circle'], labels: ['太阳', '落日'] },
  { pattern: /云/, kinds: ['cloud'], labels: ['云'] },
  { pattern: /花/, kinds: ['flower'], labels: ['花'] },
  { pattern: /人|小人|老师/, kinds: ['person'], labels: ['小人', '老师'] },
  { pattern: /车|汽车/, kinds: ['car'], labels: ['汽车'] },
  { pattern: /山|山峰/, kinds: ['mountain'], labels: ['山'] },
  { pattern: /草|草地/, kinds: ['grass'], labels: ['草地'] },
  { pattern: /路|道路|小路/, kinds: ['road'], labels: ['道路', '小路'] },
  { pattern: /河|河流|海|海面/, kinds: ['river'], labels: ['河流', '海面'] },
  { pattern: /背景|天空/, kinds: ['background'], labels: ['背景', '天空'] },
  { pattern: /地面|沙滩/, kinds: ['ground', 'rect'], labels: ['地面', '沙滩'] },
]

export const detectSpatialHint = (text: string): TargetQuery['spatial'] => {
  if (/最大|最大的|最宽|最大的那个/.test(text)) return 'largest'
  if (/左边|最左|左侧/.test(text)) return 'left'
  if (/右边|最右|右侧/.test(text)) return 'right'
  if (/上边|最上|上面|顶部/.test(text)) return 'top'
  if (/下边|最下|下面|底部/.test(text)) return 'bottom'
  if (/中间|中央|中心/.test(text)) return 'center'
  return undefined
}

export const detectKindQuery = (text: string) => {
  return KIND_ALIASES.find((alias) => alias.pattern.test(text)) || null
}

const objectMatches = (
  obj: CanvasContextObject,
  query: { kinds?: string[]; labels?: string[]; kind?: string; label?: string }
) => {
  const type = String(obj.type || '').toLowerCase()
  const kind = String(obj.kind || '').toLowerCase()
  const kindLabel = String(obj.kindLabel || '')
  const text = String(obj.text || '')

  if (query.kind && (type === query.kind || kind === query.kind)) return true
  if (query.label && (kindLabel.includes(query.label) || text.includes(query.label))) return true
  if (query.kinds?.some((item) => type === item || kind === item)) return true
  if (query.labels?.some((item) => kindLabel.includes(item) || text.includes(item))) return true

  return false
}

const areaOf = (obj: CanvasContextObject) =>
  Math.max(0, obj.width || 0) * Math.max(0, obj.height || 0)

const pickBySpatial = (
  objects: CanvasContextObject[],
  spatial: TargetQuery['spatial']
) => {
  if (!objects.length) return null
  if (!spatial) return [...objects].reverse()[0]

  const withPosition = objects.filter((obj) => typeof obj.x === 'number' && typeof obj.y === 'number')
  const candidates = withPosition.length ? withPosition : objects

  if (spatial === 'left') return [...candidates].sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0]
  if (spatial === 'right') return [...candidates].sort((a, b) => (b.x ?? 0) - (a.x ?? 0))[0]
  if (spatial === 'top') return [...candidates].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))[0]
  if (spatial === 'bottom') return [...candidates].sort((a, b) => (b.y ?? 0) - (a.y ?? 0))[0]
  if (spatial === 'largest') return [...candidates].sort((a, b) => areaOf(b) - areaOf(a))[0]

  return [...candidates].sort((a, b) => {
    const ax = (a.x ?? 400) + (a.width ?? 0) / 2
    const ay = (a.y ?? 300) + (a.height ?? 0) / 2
    const bx = (b.x ?? 400) + (b.width ?? 0) / 2
    const by = (b.y ?? 300) + (b.height ?? 0) / 2
    return Math.abs(ax - 400) + Math.abs(ay - 300) - (Math.abs(bx - 400) + Math.abs(by - 300))
  })[0]
}

export const resolveContextTarget = (context: CanvasCommandContext): ResolveResult => {
  const objectId =
    context.selectedObjectId ||
    context.lastModifiedObjectId ||
    context.lastCreatedObjectId ||
    context.objects[context.objects.length - 1]?.id ||
    null

  return {
    objectId,
    confidence: objectId ? 0.76 : 0,
    reason: objectId ? '使用当前选中或最近对象' : '当前没有可用对象',
  }
}

export const resolveObjectTarget = (
  query: TargetQuery,
  context: CanvasCommandContext
): ResolveResult => {
  const text = query.rawText || query.target || ''

  if (/它|这个|当前|选中|刚才|最后|上一个/.test(text) || query.target === '__last__') {
    return resolveContextTarget(context)
  }

  const alias = detectKindQuery(text)
  const spatial = query.spatial || detectSpatialHint(text)
  const matchedObjects = context.objects.filter((obj) =>
    objectMatches(obj, {
      kinds: alias?.kinds,
      labels: alias?.labels,
      kind: query.kind,
      label: query.label,
    })
  )

  if (matchedObjects.length) {
    const picked = pickBySpatial(matchedObjects, spatial)
    return {
      objectId: picked?.id || null,
      confidence: picked ? (matchedObjects.length === 1 && !spatial ? 0.92 : 0.84) : 0,
      reason: spatial ? `按对象类型和空间位置匹配：${spatial}` : '按对象类型匹配',
    }
  }

  if (spatial) {
    const picked = pickBySpatial(context.objects, spatial)
    return {
      objectId: picked?.id || null,
      confidence: picked ? 0.58 : 0,
      reason: `未找到明确类型，按空间位置匹配：${spatial}`,
    }
  }

  return resolveContextTarget(context)
}
