import { CanvasCommandContext, DrawCommand } from '@/types'
import { ResolveAction, ResolveResult, hasSemanticTargetHint, resolveContextTarget, resolveObjectTarget } from './objectResolver'

export const PENDING_TARGET = '__pending_target__'

export type FastCommandResult = {
  matched: boolean
  interpretation?: string
  commands?: DrawCommand[]
  message?: string
  errorMessage?: string
  needsDisambiguation?: boolean
  pendingCommands?: DrawCommand[]
  candidates?: ResolveResult['candidates']
  controlAction?: 'save' | 'export' | 'cancel' | 'continue'
}

const COLOR_MAP: Array<[RegExp, string, string]> = [
  [/红色?|红的/, '#ef4444', '红色'],
  [/蓝色?|蓝的/, '#2563eb', '蓝色'],
  [/绿色?|绿的/, '#22c55e', '绿色'],
  [/黄色?|黄的/, '#eab308', '黄色'],
  [/黑色?|黑的/, '#111827', '黑色'],
  [/白色?|白的/, '#ffffff', '白色'],
  [/紫色?|紫的/, '#8b5cf6', '紫色'],
  [/粉色?|粉的/, '#ec4899', '粉色'],
  [/橙色?|橙的/, '#f97316', '橙色'],
]

const SCENE_REQUEST_PATTERNS = [
  /海边日落|海边|日落/,
  /公园/,
  /生日贺卡|贺卡/,
  /城市夜景|夜晚城市|城市/,
  /森林小屋|森林/,
  /山水风景|山水/,
  /教室|课堂/,
  /温馨客厅|客厅/,
  /桌面工作区|工作区|书桌|办公桌|学习桌/,
  /节日派对|派对|节日装饰|生日派对|庆祝场景/,
]

const OPEN_SCENE_REQUEST_PATTERNS = [
  ...SCENE_REQUEST_PATTERNS,
  /场景|一幅|一张/,
  /画面|插画|风景|海报|卡片|房间/,
  /书房|卧室|厨房|办公室|工作室|实验室|咖啡馆|餐厅|商店|室内/,
  /赛博朋克|蒸汽朋克|未来感|科幻/,
]

const normalizeSceneRequestText = (rawText: string) =>
  rawText
    .trim()
    .replace(/[，。！？、,.!?:：\s]/g, '')
    .replace(/^请/, '')
    .replace(/^帮我/, '')
    .replace(/^给我/, '')

const hasSceneRequestPrefix = (text: string) =>
  /^(画|画一个|画个|生成|创建|来一个|来个|做一个|做个)/.test(text)

const isBlockedSceneCommand = (text: string) => {
  if (/^(选中|选择|删除|删掉|去掉|撤销|重做|保存|导出|清空)/.test(text)) return true
  if (/^(把|将|让|改|换|变|移动|移到|移去|挪到|放到|放在|去掉|移除)/.test(text)) return true
  return /(变大|变小|放大|缩小|左移|右移|上移|下移|往左|往右|往上|往下)/.test(text)
}

export const isTemplateSceneRequest = (rawText: string) => {
  const text = normalizeSceneRequestText(rawText)
  if (!text || isBlockedSceneCommand(text)) return false
  return hasSceneRequestPrefix(text) && SCENE_REQUEST_PATTERNS.some((pattern) => pattern.test(text))
}

export const isLikelySceneRequest = (rawText: string) => {
  const text = normalizeSceneRequestText(rawText)
  if (!text || isBlockedSceneCommand(text)) return false
  return hasSceneRequestPrefix(text) && OPEN_SCENE_REQUEST_PATTERNS.some((pattern) => pattern.test(text))
}

const normalizeText = (text: string) => {
  let normalized = text
    .trim()
    .replace(/[，。！？、,.!?:：\s]/g, '')
    .replace(/^请/, '')
    .replace(/^帮我/, '')
    .replace(/^给我/, '')
    .replace(/选种|选重|选钟|泉州|选州|悬中|选衷/g, '选中')
    .replace(/原型|圆新|元形|园形|圆行/g, '圆形')
    .replace(/举型|拒形|矩行|举形/g, '矩形')
    .replace(/蓝瑟|兰色|蓝的/g, '蓝色')
    .replace(/红瑟|洪色|红的/g, '红色')
    .replace(/绿色的|绿的/g, '绿色')
    .replace(/黄色的|黄的/g, '黄色')
    .replace(/黑色的|黑的/g, '黑色')
    .replace(/白色的|白的/g, '白色')
    .replace(/紫色的|紫的/g, '紫色')
    .replace(/粉色的|粉的/g, '粉色')
    .replace(/橙色的|橙的/g, '橙色')
    .replace(/有上角|又上角/g, '右上角')
    .replace(/有下角|又下角/g, '右下角')
    .replace(/网左|望左/g, '往左')
    .replace(/网右|望右/g, '往右')
    .replace(/网上|望上/g, '往上')
    .replace(/网下|望下/g, '往下')
    .replace(/房大/g, '放大')
    .replace(/边大/g, '变大')
    .replace(/边小/g, '变小')
    .replace(/删了|删掉了/g, '删掉')
    .replace(/到处|导出/g, '导出')

  normalized = normalized
    .replace(/^选中$/, '选中当前')
    .replace(/^选择$/, '选择当前')
    .replace(/^点一下$/, '点一下当前')

  return normalized
}

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const parseColor = (text: string, fallback = '#60a5fa') => {
  const match = COLOR_MAP.find(([pattern]) => pattern.test(text))
  return {
    value: match?.[1] || fallback,
    label: match?.[2] || '',
  }
}

const hasExplicitColor = (text: string) =>
  COLOR_MAP.some(([pattern]) => pattern.test(text))

const getShapeColor = (text: string) =>
  parseColor(text, '#60a5fa')

const resolveSemanticTarget = (text: string, context: CanvasCommandContext, action?: ResolveAction) => {
  if (!hasSemanticTargetHint(text, context)) return null
  return resolveObjectTarget({ rawText: text }, context, { allowContextFallback: false, action })
}

const resolveSpokenTarget = (text: string, context: CanvasCommandContext, action?: ResolveAction) =>
  resolveObjectTarget({ rawText: text }, context, { action })

const getTargetErrorMessage = (result: ResolveResult) => {
  if (result.status === 'ambiguous') {
    return '找到多个可能对象，请说清楚位置、名称或先点选目标对象。'
  }

  return '没有找到要修改的对象，请换一种说法或先点一下对象。'
}

const disambiguationResult = (
  interpretation: string,
  pendingCommands: DrawCommand[],
  resolveResult: ResolveResult
): FastCommandResult => ({
  matched: true,
  interpretation,
  needsDisambiguation: true,
  pendingCommands,
  candidates: resolveResult.candidates,
  message: '找到多个可能对象，请说第几个、左边那个或右边那个。',
})

const commandOrDisambiguationResult = (
  interpretation: string,
  targetResult: ResolveResult,
  buildCommands: (target: string) => DrawCommand[],
  message?: string
): FastCommandResult => {
  const target = targetResult.objectId
  if (!target) {
    if (targetResult.status === 'ambiguous') {
      return disambiguationResult(
        interpretation,
        buildCommands(PENDING_TARGET),
        targetResult
      )
    }

    return {
      matched: true,
      interpretation,
      errorMessage: getTargetErrorMessage(targetResult),
    }
  }

  return commandResult(interpretation, buildCommands(target), message)
}

const commandResult = (
  interpretation: string,
  commands: DrawCommand[],
  message = `快速匹配：${interpretation}`
): FastCommandResult => ({
  matched: true,
  interpretation,
  commands,
  message,
})

const controlResult = (
  interpretation: string,
  controlAction: FastCommandResult['controlAction'],
  message = `快速匹配：${interpretation}`
): FastCommandResult => ({
  matched: true,
  interpretation,
  controlAction,
  message,
})

export function matchFastCommand(
  rawText: string,
  context: CanvasCommandContext
): FastCommandResult {
  if (isLikelySceneRequest(rawText)) {
    return {
      matched: false,
      message: '场景命令交给 Scene Planner 处理。',
    }
  }

  const text = normalizeText(rawText)
  if (!text) {
    return {
      matched: true,
      interpretation: '未识别到有效语音',
      errorMessage: '没听清，请再说一次。',
    }
  }

  if (/^(取消|重说|停止听|停止识别|别听了)$/.test(text)) {
    return controlResult('停止当前语音识别', 'cancel', '已停止语音识别')
  }

  if (/^(继续听|开始听|继续识别|接着听)$/.test(text)) {
    return controlResult('继续语音识别', 'continue', '继续听')
  }

  if (/^(保存|保存画布|保存一下|存一下)$/.test(text)) {
    return controlResult('保存当前画布', 'save')
  }

  if (/^(导出|导出PNG|导出图片|下载图片|导出一下|下载一下)$/.test(text)) {
    return controlResult('导出 PNG 图片', 'export')
  }

  if (/^(撤销|退回一步|上一步|退一步|回退)$/.test(text)) {
    return commandResult('撤销上一步', [{ action: 'undo' }])
  }

  if (/^(重做|恢复一步|下一步|恢复|再做)$/.test(text)) {
    return commandResult('重做下一步', [{ action: 'redo' }])
  }

  if (/^(清空|清空画布|全部清空|清除画布)$/.test(text)) {
    return commandResult('清空画布', [{ action: 'clear' }])
  }

  if (/^(删除|删掉|去掉|移除)(它|这个|选中|当前)?$/.test(text) || (/^(删除|删掉|去掉|移除).+/.test(text) && hasSemanticTargetHint(text, context))) {
    const targetResult = resolveSpokenTarget(text, context, 'delete')
    return commandOrDisambiguationResult('删除对象', targetResult, (target) => [
      { action: 'delete', target },
    ])
  }

  if (/^(选中|选择|选一下|点一下|点选).+/.test(text)) {
    const semanticResult = resolveSemanticTarget(text, context, 'select')
    const targetResult = semanticResult || (/最后|刚才|上一个|当前|这个|它/.test(text) ? resolveContextTarget(context) : null)
    if (!targetResult) {
      return {
        matched: true,
        interpretation: '选择对象',
        errorMessage: '没有找到要选择的对象，请换一种说法或直接点一下对象。',
      }
    }

    return commandOrDisambiguationResult('选择对象', targetResult, (target) => [
      { action: 'select', target },
    ] as DrawCommand[])
  }

  if (/(变|换|改)(成|为)?(红|红色|蓝|蓝色|绿|绿色|黄|黄色|黑|黑色|白|白色|紫|紫色|粉|粉色|橙|橙色)/.test(text) || /^(红|红色|蓝|蓝色|绿|绿色|黄|黄色|黑|黑色|白|白色|紫|紫色|粉|粉色|橙|橙色)$/.test(text)) {
    const targetResult = resolveSpokenTarget(text, context, 'recolor')
    const color = parseColor(text)
    return commandOrDisambiguationResult(`把对象变成${color.label || '指定颜色'}`, targetResult, (target) => [
      {
        action: 'modify',
        target,
        params: {
          fill: color.value,
          stroke: color.value,
        },
      },
    ])
  }

  if (/(变大|放大|弄大|大一点|大一些|再大一点)/.test(text)) {
    const targetResult = resolveSpokenTarget(text, context, 'scale')
    return commandOrDisambiguationResult('放大对象', targetResult, (target) => [
      { action: 'scale', target, params: { scale: 1.2 } },
    ] as DrawCommand[])
  }

  if (/(变小|缩小|弄小|小一点|小一些|再小一点)/.test(text)) {
    const targetResult = resolveSpokenTarget(text, context, 'scale')
    return commandOrDisambiguationResult('缩小对象', targetResult, (target) => [
      { action: 'scale', target, params: { scale: 0.8 } },
    ] as DrawCommand[])
  }

  const moveMap: Array<[RegExp, string, number, number]> = [
    [/(左移|往左|向左|向左挪|往左挪|左边一点|靠左一点)/, '左移一点', -40, 0],
    [/(右移|往右|向右|向右挪|往右挪|右边一点|靠右一点)/, '右移一点', 40, 0],
    [/(上移|往上|向上|向上挪|往上挪|上面一点|靠上一点)/, '上移一点', 0, -40],
    [/(下移|往下|向下|向下挪|往下挪|下面一点|靠下一点)/, '下移一点', 0, 40],
  ]
  const moveMatch = moveMap.find(([pattern]) => pattern.test(text))
  if (moveMatch) {
    const targetResult = resolveSpokenTarget(text, context, 'move')
    return commandOrDisambiguationResult(moveMatch[1], targetResult, (target) => [
      { action: 'moveBy', target, params: { dx: moveMatch[2], dy: moveMatch[3] } },
    ] as DrawCommand[])
  }

  const cornerMap: Array<[RegExp, string, number, number]> = [
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?左上角$/, '移动到左上角', 130, 110],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?右上角$/, '移动到右上角', 670, 110],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?左下角$/, '移动到左下角', 130, 490],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?右下角$/, '移动到右下角', 670, 490],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?(中间|中间位置)$/, '移动到画布中间', 400, 300],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?中央$/, '移动到画布中央', 400, 300],
  ]
  const cornerMatch = cornerMap.find(([pattern]) => pattern.test(text))
  if (cornerMatch) {
    const targetResult = resolveSpokenTarget(text, context, 'move')
    return commandOrDisambiguationResult(cornerMatch[1], targetResult, (target) => [
      { action: 'move', target, params: { x: cornerMatch[2], y: cornerMatch[3] } },
    ] as DrawCommand[])
  }

  const sideMap: Array<[RegExp, string, number, number]> = [
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?(左边|左侧)$/, '移动到左边', 130, 300],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?(右边|右侧)$/, '移动到右边', 670, 300],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?(上面|顶部)$/, '移动到上方', 400, 100],
    [/(移动|移到|移动到|放到|放在|挪到|挪去)?(下面|底部)$/, '移动到底部', 400, 500],
  ]
  const sideMatch = sideMap.find(([pattern]) => pattern.test(text))
  if (sideMatch) {
    const targetResult = resolveSpokenTarget(text, context, 'move')
    return commandOrDisambiguationResult(sideMatch[1], targetResult, (target) => [
      { action: 'move', target, params: { x: sideMatch[2], y: sideMatch[3] } },
    ] as DrawCommand[])
  }

  const color = getShapeColor(text)
  const shapePrefix = '(画|画个|画一个|换一个|换个|来一个|来个|创建|生成|加一个|加个|弄一个|做一个)'

  if (new RegExp(`^${shapePrefix}.*(圆|圆形|圈)$`).test(text) || /^(画圆|画个圆|来个圆|画圈|画个圈|来个圈)$/.test(text)) {
    const label = `${color.label || ''}圆形`
    return commandResult(`创建${label}`, [
      {
        action: 'create',
        id: createId('circle'),
        type: 'circle',
        params: {
          x: 400,
          y: 300,
          radius: 50,
          fill: color.value,
          stroke: hasExplicitColor(text) ? color.value : '#111827',
          strokeWidth: 2,
          kind: 'circle',
        },
      },
    ])
  }

  if (new RegExp(`^${shapePrefix}.*(矩形|长方形|方块|方形|正方形)$`).test(text) || /^(画方块|画矩形|来个方块)$/.test(text)) {
    const label = `${color.label || ''}矩形`
    return commandResult(`创建${label}`, [
      {
        action: 'create',
        id: createId('rect'),
        type: 'rect',
        params: {
          x: 340,
          y: 260,
          width: 120,
          height: 80,
          fill: color.value,
          stroke: hasExplicitColor(text) ? color.value : '#111827',
          strokeWidth: 2,
          kind: 'rect',
        },
      },
    ])
  }

  if (new RegExp(`^(画|画一条|来一条|创建|生成|加一条|弄一条).*(线|直线|线条)$`).test(text) || /^(画线|来条线)$/.test(text)) {
    return commandResult('创建线条', [
      {
        action: 'create',
        id: createId('line'),
        type: 'line',
        params: {
          points: [300, 300, 500, 300],
          stroke: hasExplicitColor(text) ? color.value : '#111827',
          strokeWidth: 4,
          lineCap: 'round',
          lineJoin: 'round',
          kind: 'line',
        },
      },
    ])
  }

  if (new RegExp(`^${shapePrefix}.*(星星|五角星)$`).test(text) || /^(画星星|来个星星)$/.test(text)) {
    return commandResult('创建星星', [
      {
        action: 'create',
        id: createId('star'),
        type: 'star',
        params: {
          x: 400,
          y: 300,
          numPoints: 5,
          innerRadius: 25,
          outerRadius: 55,
          fill: color.value,
          stroke: hasExplicitColor(text) ? color.value : '#111827',
          strokeWidth: 2,
          kind: 'star',
        },
      },
    ])
  }

  const textMatch = rawText.match(/(?:写文字|写上|添加文字|输入文字)[:：]?\s*(.+)$/)
  if (textMatch?.[1]?.trim()) {
    const content = textMatch[1].trim()
    return commandResult(`写文字：${content}`, [
      {
        action: 'create',
        id: createId('text'),
        type: 'text',
        params: {
          x: 330,
          y: 280,
          text: content,
          fontSize: 28,
          fill: '#111827',
          kind: 'text',
        },
      },
    ])
  }

  return {
    matched: false,
    message: '这个命令我还不会，我会交给 AI 理解。',
  }
}
