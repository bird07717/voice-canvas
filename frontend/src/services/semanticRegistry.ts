import { CanvasCommandContext, CanvasContextObject } from '@/types'

export type SpatialSlot = 'left' | 'right' | 'top' | 'bottom' | 'center'

export type ObjectCapabilities = {
  move: boolean
  scale: boolean
  recolor: boolean
  editText: boolean
  delete: boolean
}

export type ObjectSemanticProfile = {
  objectId: string
  kind: string
  type: string
  category: string
  aliases: string[]
  attributes: string[]
  role?: string
  spatialSlot?: SpatialSlot
  sceneType?: string
  idHint?: string
  area: number
  centerX?: number
  centerY?: number
  capabilities: ObjectCapabilities
  source: CanvasContextObject
}

const DEFAULT_CAPABILITIES: ObjectCapabilities = {
  move: true,
  scale: true,
  recolor: true,
  editText: false,
  delete: true,
}

const BASE_KIND_PROFILES: Record<string, Partial<ObjectSemanticProfile> & { aliases?: string[] }> = {
  circle: { category: 'shape', aliases: ['圆', '圆形', '圈'] },
  round: { category: 'shape', aliases: ['圆', '圆形', '圈'] },
  rect: { category: 'shape', aliases: ['矩形', '方形', '方块', '长方形'] },
  rectangle: { category: 'shape', aliases: ['矩形', '方形', '方块', '长方形'] },
  square: { category: 'shape', aliases: ['方形', '方块', '正方形'] },
  line: { category: 'shape', aliases: ['线', '线条', '直线'] },
  star: { category: 'shape', aliases: ['星星', '五角星'] },
  text: {
    category: 'text',
    aliases: ['文字', '文本', '字', '标题'],
    capabilities: { ...DEFAULT_CAPABILITIES, editText: true },
  },
  image: { category: 'asset', aliases: ['素材', '图片', '图案'] },
  group: { category: 'group', aliases: ['组合', '对象'] },
  background: { category: 'environment', aliases: ['背景', '天空'], capabilities: { ...DEFAULT_CAPABILITIES, delete: false } },
  ground: { category: 'environment', aliases: ['地面', '底部'] },
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  shape: ['图形', '形状'],
  text: ['文字', '文本', '标题'],
  asset: ['素材', '图案', '图片'],
  group: ['组合', '对象'],
  environment: ['背景', '环境'],
  decoration: ['装饰', '点缀'],
  foreground: ['前景'],
  background: ['背景'],
}

const unique = (items: Array<string | undefined | null>) =>
  [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]

const inferSpatialSlot = (obj: CanvasContextObject): SpatialSlot | undefined => {
  const centerX = obj.centerX ?? (typeof obj.x === 'number' ? obj.x + (obj.width || 0) / 2 : undefined)
  const centerY = obj.centerY ?? (typeof obj.y === 'number' ? obj.y + (obj.height || 0) / 2 : undefined)

  if (typeof centerX !== 'number' || typeof centerY !== 'number') return undefined
  if (centerX < 280) return 'left'
  if (centerX > 520) return 'right'
  if (centerY < 200) return 'top'
  if (centerY > 430) return 'bottom'
  return 'center'
}

const inferCategory = (obj: CanvasContextObject, base: Partial<ObjectSemanticProfile>) => {
  if (obj.sceneRole === 'background') return 'background'
  if (obj.sceneRole === 'decoration') return 'decoration'
  if (obj.sceneRole === 'foreground') return 'foreground'
  return base.category || 'object'
}

export const buildObjectProfiles = (context: CanvasCommandContext): ObjectSemanticProfile[] =>
  context.objects.map((obj) => {
    const kind = String(obj.kind || obj.type || 'object').toLowerCase()
    const type = String(obj.type || 'object').toLowerCase()
    const base = BASE_KIND_PROFILES[kind] || BASE_KIND_PROFILES[type] || {}
    const category = inferCategory(obj, base)
    const aliases = unique([
      obj.kindLabel,
      obj.text,
      obj.idHint,
      kind,
      type,
      ...(base.aliases || []),
      ...(CATEGORY_ALIASES[category] || []),
    ])
    const attributes = unique([
      obj.sceneRole,
      obj.sceneType,
      inferSpatialSlot(obj),
      category,
    ])

    return {
      objectId: obj.id,
      kind,
      type,
      category,
      aliases,
      attributes,
      role: obj.sceneRole,
      spatialSlot: inferSpatialSlot(obj),
      sceneType: obj.sceneType,
      idHint: obj.idHint,
      area: obj.area ?? Math.max(0, obj.width || 0) * Math.max(0, obj.height || 0),
      centerX: obj.centerX,
      centerY: obj.centerY,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        ...(base.capabilities || {}),
      },
      source: obj,
    }
  })

export const normalizeQueryText = (text: string) =>
  String(text || '')
    .trim()
    .replace(/[，。！？、,.!?:：\s]/g, '')
    .toLowerCase()

export const textMatchesTerm = (text: string, term: string) => {
  const normalizedText = normalizeQueryText(text)
  const normalizedTerm = normalizeQueryText(term)
  if (!normalizedText || !normalizedTerm) return false
  return normalizedText.includes(normalizedTerm) || normalizedTerm.includes(normalizedText)
}
