export type SVGAssetManifestEntry = {
  assetId: string
  kind: string
  label: string
  category: string
  aliases: string[]
}

export type SVGAssetSemanticQuery = {
  assetId?: string | null
  kind?: string | null
  label?: string | null
}

export const SVG_ASSET_MANIFEST: SVGAssetManifestEntry[] = [
  { assetId: 'animals/bird', kind: 'bird', label: '小鸟', category: 'animal', aliases: ['bird', '鸟', '小鸟', '飞鸟'] },
  { assetId: 'animals/butterfly', kind: 'butterfly', label: '蝴蝶', category: 'animal', aliases: ['butterfly', '蝴蝶'] },
  { assetId: 'animals/cat', kind: 'cat', label: '小猫', category: 'animal', aliases: ['cat', 'kitten', '猫', '小猫', '猫咪'] },
  { assetId: 'animals/dog', kind: 'dog', label: '小狗', category: 'animal', aliases: ['dog', 'puppy', '狗', '小狗', '狗狗'] },
  { assetId: 'animals/fish', kind: 'fish', label: '鱼', category: 'animal', aliases: ['fish', '鱼', '小鱼'] },
  { assetId: 'animals/person_sitting', kind: 'person_sitting', label: '坐着的人', category: 'person', aliases: ['person', 'person sitting', '人', '人物', '坐着的人', '坐姿人物'] },
  { assetId: 'animals/person_standing', kind: 'person_standing', label: '站着的人', category: 'person', aliases: ['person', 'person standing', '人', '人物', '站着的人', '站姿人物'] },
  { assetId: 'architecture/building_office', kind: 'building_office', label: '办公楼', category: 'structure', aliases: ['building', 'office building', '楼', '楼房', '办公楼', '建筑'] },
  { assetId: 'architecture/door', kind: 'door', label: '门', category: 'structure', aliases: ['door', '门', '房门'] },
  { assetId: 'architecture/fence_wood', kind: 'fence_wood', label: '木栅栏', category: 'structure', aliases: ['fence', 'wood fence', '栅栏', '木栅栏', '围栏'] },
  { assetId: 'architecture/house_simple', kind: 'house_simple', label: '房子', category: 'structure', aliases: ['house', 'simple house', '房子', '小屋', '屋子'] },
  { assetId: 'architecture/road_straight', kind: 'road_straight', label: '道路', category: 'path', aliases: ['road', 'straight road', '路', '道路', '马路'] },
  { assetId: 'architecture/window', kind: 'window', label: '窗户', category: 'structure', aliases: ['window', '窗', '窗户'] },
  { assetId: 'birthday/balloon', kind: 'balloon', label: '气球', category: 'decoration', aliases: ['balloon', '气球', '彩球'] },
  { assetId: 'birthday/cake', kind: 'cake', label: '蛋糕', category: 'food', aliases: ['cake', '蛋糕', '生日蛋糕'] },
  { assetId: 'birthday/confetti', kind: 'confetti', label: '彩纸屑', category: 'decoration', aliases: ['confetti', '彩纸', '彩纸屑', '纸屑'] },
  { assetId: 'birthday/gift', kind: 'gift', label: '礼物', category: 'prop', aliases: ['gift', 'present', '礼物', '礼盒', '礼品'] },
  { assetId: 'city/bicycle', kind: 'bicycle', label: '自行车', category: 'vehicle', aliases: ['bicycle', 'bike', '自行车', '单车'] },
  { assetId: 'city/building', kind: 'building', label: '高楼', category: 'structure', aliases: ['building', '楼', '高楼', '楼房', '建筑'] },
  { assetId: 'city/car', kind: 'car', label: '汽车', category: 'vehicle', aliases: ['car', '汽车', '小车', '车'] },
  { assetId: 'city/car_sedan', kind: 'car_sedan', label: '轿车', category: 'vehicle', aliases: ['car', 'sedan', '汽车', '轿车', '小车'] },
  { assetId: 'city/street_light', kind: 'street_light', label: '路灯', category: 'structure', aliases: ['street light', '路灯', '灯杆'] },
  { assetId: 'decoration/cactus', kind: 'cactus', label: '仙人掌', category: 'nature', aliases: ['cactus', '仙人掌'] },
  { assetId: 'decoration/candle', kind: 'candle', label: '蜡烛', category: 'decoration', aliases: ['candle', '蜡烛'] },
  { assetId: 'decoration/clock', kind: 'clock', label: '时钟', category: 'prop', aliases: ['clock', '钟', '时钟', '挂钟'] },
  { assetId: 'decoration/curtain', kind: 'curtain', label: '窗帘', category: 'decoration', aliases: ['curtain', '窗帘'] },
  { assetId: 'decoration/cushion', kind: 'cushion', label: '靠垫', category: 'furniture', aliases: ['cushion', 'pillow', '靠垫', '抱枕', '垫子'] },
  { assetId: 'decoration/lamp_desk', kind: 'lamp_desk', label: '台灯', category: 'furniture', aliases: ['lamp', 'desk lamp', '台灯', '灯'] },
  { assetId: 'decoration/lamp_floor', kind: 'lamp_floor', label: '落地灯', category: 'furniture', aliases: ['lamp', 'floor lamp', '落地灯', '灯'] },
  { assetId: 'decoration/picture_frame', kind: 'picture_frame', label: '相框', category: 'decoration', aliases: ['picture frame', 'frame', '相框', '画框'] },
  { assetId: 'decoration/plant_potted', kind: 'plant_potted', label: '盆栽', category: 'nature', aliases: ['plant', 'potted plant', '盆栽', '绿植', '植物'] },
  { assetId: 'decoration/vase', kind: 'vase', label: '花瓶', category: 'decoration', aliases: ['vase', '花瓶'] },
  { assetId: 'electronics/computer_desktop', kind: 'computer_desktop', label: '台式电脑', category: 'electronics', aliases: ['computer', 'desktop', '台式电脑', '电脑', '显示器'] },
  { assetId: 'electronics/keyboard', kind: 'keyboard', label: '键盘', category: 'electronics', aliases: ['keyboard', '键盘'] },
  { assetId: 'electronics/laptop', kind: 'laptop', label: '笔记本电脑', category: 'electronics', aliases: ['laptop', 'notebook', '笔记本', '笔记本电脑', '电脑'] },
  { assetId: 'electronics/mouse', kind: 'mouse', label: '鼠标', category: 'electronics', aliases: ['mouse', '鼠标'] },
  { assetId: 'electronics/phone', kind: 'phone', label: '手机', category: 'electronics', aliases: ['phone', 'mobile phone', '手机', '电话'] },
  { assetId: 'electronics/tablet', kind: 'tablet', label: '平板', category: 'electronics', aliases: ['tablet', '平板', '平板电脑'] },
  { assetId: 'food/cup_coffee', kind: 'cup_coffee', label: '咖啡杯', category: 'food', aliases: ['coffee', 'cup', 'coffee cup', '咖啡', '咖啡杯', '杯子'] },
  { assetId: 'food/plate', kind: 'plate', label: '盘子', category: 'food', aliases: ['plate', '盘子', '餐盘'] },
  { assetId: 'furniture/bed', kind: 'bed', label: '床', category: 'furniture', aliases: ['bed', '床', '床铺'] },
  { assetId: 'furniture/bookshelf', kind: 'bookshelf', label: '书架', category: 'furniture', aliases: ['bookshelf', 'bookcase', '书架', '书柜'] },
  { assetId: 'furniture/chair_dining', kind: 'chair_dining', label: '餐椅', category: 'furniture', aliases: ['chair', 'dining chair', '椅子', '餐椅'] },
  { assetId: 'furniture/sofa', kind: 'sofa', label: '沙发', category: 'furniture', aliases: ['sofa', 'couch', '沙发'] },
  { assetId: 'furniture/table_coffee', kind: 'table_coffee', label: '茶几', category: 'furniture', aliases: ['table', 'coffee table', '茶几', '桌子'] },
  { assetId: 'furniture/table_desk', kind: 'table_desk', label: '书桌', category: 'furniture', aliases: ['desk', 'table', '书桌', '桌子', '办公桌'] },
  { assetId: 'furniture/table_dining', kind: 'table_dining', label: '餐桌', category: 'furniture', aliases: ['table', 'dining table', '餐桌', '桌子'] },
  { assetId: 'holiday/banner', kind: 'banner', label: '横幅', category: 'decoration', aliases: ['banner', '横幅', '条幅'] },
  { assetId: 'holiday/christmas_tree', kind: 'christmas_tree', label: '圣诞树', category: 'decoration', aliases: ['christmas tree', '圣诞树', '树'] },
  { assetId: 'holiday/firework', kind: 'firework', label: '烟花', category: 'decoration', aliases: ['firework', '烟花', '礼花'] },
  { assetId: 'holiday/gift_box', kind: 'gift_box', label: '礼盒', category: 'prop', aliases: ['gift', 'gift box', '礼物', '礼盒'] },
  { assetId: 'holiday/heart', kind: 'heart', label: '爱心', category: 'decoration', aliases: ['heart', '爱心', '心形'] },
  { assetId: 'holiday/lantern_chinese', kind: 'lantern_chinese', label: '灯笼', category: 'decoration', aliases: ['lantern', 'chinese lantern', '灯笼', '红灯笼'] },
  { assetId: 'holiday/pumpkin', kind: 'pumpkin', label: '南瓜', category: 'decoration', aliases: ['pumpkin', '南瓜'] },
  { assetId: 'holiday/red_envelope', kind: 'red_envelope', label: '红包', category: 'prop', aliases: ['red envelope', '红包', '压岁钱'] },
  { assetId: 'holiday/snowflake', kind: 'snowflake', label: '雪花', category: 'decoration', aliases: ['snowflake', '雪花'] },
  { assetId: 'holiday/snowman', kind: 'snowman', label: '雪人', category: 'decoration', aliases: ['snowman', '雪人'] },
  { assetId: 'holiday/streamer', kind: 'streamer', label: '彩带', category: 'decoration', aliases: ['streamer', '彩带', '飘带'] },
  { assetId: 'house', kind: 'house', label: '房子', category: 'structure', aliases: ['house', '房子', '小屋', '屋子'] },
  { assetId: 'lamp', kind: 'lamp', label: '灯', category: 'furniture', aliases: ['lamp', '灯', '台灯', '灯具'] },
  { assetId: 'nature/bush', kind: 'bush', label: '灌木', category: 'nature', aliases: ['bush', '灌木', '灌木丛'] },
  { assetId: 'nature/cloud', kind: 'cloud', label: '云', category: 'sky', aliases: ['cloud', '云', '云朵', '白云', '云彩'] },
  { assetId: 'nature/cloud_rain', kind: 'cloud_rain', label: '雨云', category: 'sky', aliases: ['rain cloud', 'cloud', '雨云', '下雨云', '云'] },
  { assetId: 'nature/flower_bunch', kind: 'flower_bunch', label: '花束', category: 'nature', aliases: ['flower', 'flower bunch', '花', '花束', '鲜花'] },
  { assetId: 'nature/flower_single', kind: 'flower_single', label: '花', category: 'nature', aliases: ['flower', 'single flower', '花', '小花', '鲜花'] },
  { assetId: 'nature/grass_patch', kind: 'grass_patch', label: '草丛', category: 'nature', aliases: ['grass', 'grass patch', '草', '草地', '草丛'] },
  { assetId: 'nature/hill', kind: 'hill', label: '小山丘', category: 'nature', aliases: ['hill', '小山', '山丘', '小山丘'] },
  { assetId: 'nature/moon', kind: 'moon', label: '月亮', category: 'sky', aliases: ['moon', '月亮', '月'] },
  { assetId: 'nature/mountain', kind: 'mountain', label: '山', category: 'nature', aliases: ['mountain', '山', '山峰', '远山'] },
  { assetId: 'nature/star', kind: 'star', label: '星星', category: 'sky', aliases: ['star', '星星', '五角星'] },
  { assetId: 'nature/sun', kind: 'sun', label: '太阳', category: 'sky', aliases: ['sun', '太阳', '日头'] },
  { assetId: 'nature/tree_deciduous', kind: 'tree_deciduous', label: '阔叶树', category: 'nature', aliases: ['tree', 'deciduous tree', '树', '树木', '阔叶树'] },
  { assetId: 'nature/tree_oak', kind: 'tree_oak', label: '橡树', category: 'nature', aliases: ['tree', 'oak', '树', '树木', '橡树'] },
  { assetId: 'nature/tree_pine', kind: 'tree_pine', label: '松树', category: 'nature', aliases: ['tree', 'pine', '树', '树木', '松树'] },
  { assetId: 'nature/water_surface', kind: 'water_surface', label: '水面', category: 'water', aliases: ['water', 'water surface', '水', '水面', '湖面', '海面'] },
  { assetId: 'nature/wave', kind: 'wave', label: '波浪', category: 'water', aliases: ['wave', '波浪', '海浪', '浪花'] },
  { assetId: 'park/bench', kind: 'bench', label: '长椅', category: 'furniture', aliases: ['bench', '长椅', '椅子', '公园长椅'] },
  { assetId: 'park/flower_patch', kind: 'flower_patch', label: '花丛', category: 'nature', aliases: ['flower', 'flower patch', '花', '花丛', '花朵'] },
  { assetId: 'park/kite', kind: 'kite', label: '风筝', category: 'prop', aliases: ['kite', '风筝'] },
  { assetId: 'park/swing', kind: 'swing', label: '秋千', category: 'furniture', aliases: ['swing', '秋千'] },
  { assetId: 'people/child', kind: 'child', label: '小孩', category: 'person', aliases: ['child', 'kid', '小孩', '孩子', '儿童'] },
  { assetId: 'people/person_sitting', kind: 'person_sitting', label: '坐着的人', category: 'person', aliases: ['person', 'person sitting', '人', '人物', '坐着的人'] },
  { assetId: 'people/teacher', kind: 'teacher', label: '老师', category: 'person', aliases: ['teacher', '老师', '人物'] },
  { assetId: 'tree', kind: 'tree', label: '树', category: 'nature', aliases: ['tree', '树', '树木', '大树'] },
]

const normalizeAssetTerm = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/[，。！？、,.!?:：\s]+/g, '')
    .toLowerCase()

const assetById = new Map(SVG_ASSET_MANIFEST.map((asset) => [normalizeAssetTerm(asset.assetId), asset]))
const assetByKind = new Map(SVG_ASSET_MANIFEST.map((asset) => [normalizeAssetTerm(asset.kind), asset]))
const assetByTerm = new Map<string, SVGAssetManifestEntry>()

SVG_ASSET_MANIFEST.forEach((asset) => {
  ;[asset.label, asset.kind, asset.assetId, ...asset.aliases].forEach((term) => {
    const normalized = normalizeAssetTerm(term)
    if (normalized && !assetByTerm.has(normalized)) {
      assetByTerm.set(normalized, asset)
    }
  })
})

export const findSVGAssetSemantic = (query: SVGAssetSemanticQuery) => {
  const assetId = normalizeAssetTerm(query.assetId)
  if (assetId && assetById.has(assetId)) return assetById.get(assetId)

  const kind = normalizeAssetTerm(query.kind)
  if (kind && assetByKind.has(kind)) return assetByKind.get(kind)

  const label = normalizeAssetTerm(query.label)
  if (label && assetByTerm.has(label)) return assetByTerm.get(label)
  if (kind && assetByTerm.has(kind)) return assetByTerm.get(kind)

  return undefined
}
