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
  ground: { category: 'environment', aliases: ['地面', '底部', '草地', '沙滩'], capabilities: { ...DEFAULT_CAPABILITIES, delete: false } },
  sun: { category: 'sky', aliases: ['太阳', '日头', '落日', '夕阳'] },
  tree: { category: 'nature', aliases: ['树', '树木', '大树', '小树'] },
  cloud: { category: 'sky', aliases: ['云', '云朵', '白云', '云彩'] },
  house: { category: 'structure', aliases: ['房子', '小屋', '木屋', '屋子'] },
  flower: { category: 'nature', aliases: ['花', '小花', '鲜花', '花朵'] },
  person: { category: 'person', aliases: ['人', '小人', '人物', '老师'] },
  car: { category: 'vehicle', aliases: ['车', '汽车', '小车'] },
  mountain: { category: 'nature', aliases: ['山', '山峰', '远山'] },
  grass: { category: 'nature', aliases: ['草', '草地', '草丛'] },
  road: { category: 'path', aliases: ['路', '道路', '小路', '马路'] },
  river: { category: 'water', aliases: ['河', '河流', '水面', '海面', '水', '海'] },
  palm_tree: { category: 'nature', aliases: ['椰子树', '棕榈树', '树'] },
  bench: { category: 'furniture', aliases: ['长椅', '椅子', '椅', '公园长椅'] },
  balloon: { category: 'decoration', aliases: ['气球', '彩球'] },
  gift: { category: 'prop', aliases: ['礼物', '礼盒', '礼品'] },
  cake: { category: 'food', aliases: ['蛋糕', '生日蛋糕'] },
  building: { category: 'structure', aliases: ['楼', '高楼', '楼房', '建筑'] },
  sailboat: { category: 'vehicle', aliases: ['帆船', '船', '小船'] },
  fence: { category: 'structure', aliases: ['栅栏', '栏杆', '围栏'] },
  desk: { category: 'furniture', aliases: ['桌子', '课桌', '书桌'] },
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  shape: ['图形', '形状'],
  text: ['文字', '文本', '标题'],
  asset: ['素材', '图案', '图片'],
  group: ['组合', '对象'],
  environment: ['背景', '环境'],
  sky: ['天空物体', '天上'],
  nature: ['自然', '植物'],
  structure: ['建筑', '结构'],
  person: ['人物', '角色'],
  vehicle: ['交通工具'],
  path: ['道路', '路径'],
  water: ['水面', '水域'],
  furniture: ['家具'],
  prop: ['道具', '物品'],
  food: ['食物'],
  decoration: ['装饰', '点缀'],
  foreground: ['前景'],
  background: ['背景'],
}

const ROLE_ALIASES: Record<string, string[]> = {
  background: ['背景', '远景', '后面'],
  midground: ['中景', '中间层'],
  foreground: ['前景', '前面'],
  decoration: ['装饰', '点缀'],
  label: ['文字', '标签', '标题'],
}

const COLOR_VALUE_ALIASES: Record<string, string[]> = {
  red: ['红', '红色'],
  blue: ['蓝', '蓝色'],
  green: ['绿', '绿色'],
  yellow: ['黄', '黄色'],
  black: ['黑', '黑色'],
  white: ['白', '白色'],
  purple: ['紫', '紫色'],
  pink: ['粉', '粉色'],
  orange: ['橙', '橙色'],
  '#ef4444': ['红', '红色'],
  '#fb7185': ['粉', '粉色'],
  '#be123c': ['红', '红色'],
  '#2563eb': ['蓝', '蓝色'],
  '#60a5fa': ['蓝', '蓝色'],
  '#3b82f6': ['蓝', '蓝色'],
  '#22c55e': ['绿', '绿色'],
  '#16a34a': ['绿', '绿色'],
  '#15803d': ['绿', '绿色'],
  '#86efac': ['绿', '绿色'],
  '#facc15': ['黄', '黄色'],
  '#eab308': ['黄', '黄色'],
  '#fde68a': ['黄', '黄色'],
  '#f97316': ['橙', '橙色'],
  '#f59e0b': ['橙', '橙色'],
  '#8b5cf6': ['紫', '紫色'],
  '#a78bfa': ['紫', '紫色'],
  '#111827': ['黑', '黑色'],
  '#0f172a': ['黑', '黑色', '深色'],
  '#1f2937': ['黑', '黑色', '深色'],
  '#334155': ['灰', '灰色', '深色'],
  '#475569': ['灰', '灰色'],
  '#ffffff': ['白', '白色'],
  '#fff7ed': ['白', '白色', '浅色'],
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
  if (base.category && !['shape', 'group', 'object'].includes(base.category)) {
    return base.category
  }
  if (obj.sceneRole === 'background') return 'background'
  if (obj.sceneRole === 'decoration') return 'decoration'
  if (obj.sceneRole === 'foreground') return 'foreground'
  return base.category || 'object'
}

const inferColorAliases = (obj: CanvasContextObject) =>
  unique([obj.fill, obj.stroke].flatMap((value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized ? COLOR_VALUE_ALIASES[normalized] || [] : []
  }))

export const buildObjectProfiles = (context: CanvasCommandContext): ObjectSemanticProfile[] =>
  context.objects.map((obj) => {
    const kind = String(obj.kind || obj.type || 'object').toLowerCase()
    const type = String(obj.type || 'object').toLowerCase()
    const base = BASE_KIND_PROFILES[kind] || BASE_KIND_PROFILES[type] || {}
    const category = inferCategory(obj, base)
    const colorAliases = inferColorAliases(obj)
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
      ...(ROLE_ALIASES[obj.sceneRole || ''] || []),
      ...colorAliases,
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
