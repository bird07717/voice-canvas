import { CanvasCommandContext, DrawCommand } from '@/types'

export type FastCommandResult = {
  matched: boolean
  interpretation?: string
  commands?: DrawCommand[]
  message?: string
  errorMessage?: string
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

const normalizeText = (text: string) =>
  text
    .trim()
    .replace(/[，。！？、,.!?:：\s]/g, '')
    .replace(/^请/, '')
    .replace(/^帮我/, '')
    .replace(/^给我/, '')

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

const resolveContextTarget = (context: CanvasCommandContext) =>
  context.selectedObjectId ||
  context.lastModifiedObjectId ||
  context.lastCreatedObjectId ||
  context.objects[context.objects.length - 1]?.id ||
  null

const KIND_ALIASES: Array<[RegExp, string[], string]> = [
  [/圆|圆形/, ['circle', 'round'], '圆形'],
  [/矩形|长方形|方块|方形|正方形/, ['rect', 'rectangle', 'square'], '矩形'],
  [/线|直线|线条/, ['line'], '线条'],
  [/星星|五角星/, ['star'], '星星'],
  [/文字|文本|字/, ['text'], '文字'],
  [/房子/, ['house'], '房子'],
  [/树/, ['tree'], '树'],
  [/太阳/, ['sun'], '太阳'],
  [/云/, ['cloud'], '云'],
  [/花/, ['flower'], '花'],
  [/人|小人/, ['person'], '小人'],
  [/车|汽车/, ['car'], '汽车'],
]

const findTargetByKind = (text: string, context: CanvasCommandContext) => {
  const alias = KIND_ALIASES.find(([pattern]) => pattern.test(text))
  if (!alias) return null

  const [, kinds] = alias
  const matched = [...context.objects]
    .reverse()
    .find((obj) => {
      const type = String(obj.type || '').toLowerCase()
      const kind = String(obj.kind || '').toLowerCase()
      return kinds.includes(type) || kinds.includes(kind)
    })

  return matched?.id || null
}

const resolveSpokenTarget = (text: string, context: CanvasCommandContext) =>
  findTargetByKind(text, context) || resolveContextTarget(context)

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

  if (/^(继续听|开始听|继续识别)$/.test(text)) {
    return controlResult('继续语音识别', 'continue', '继续听')
  }

  if (/^(保存|保存画布)$/.test(text)) {
    return controlResult('保存当前画布', 'save')
  }

  if (/^(导出|导出PNG|导出图片|下载图片)$/.test(text)) {
    return controlResult('导出 PNG 图片', 'export')
  }

  if (/^(撤销|退回一步|上一步)$/.test(text)) {
    return commandResult('撤销上一步', [{ action: 'undo' }])
  }

  if (/^(重做|恢复一步|下一步)$/.test(text)) {
    return commandResult('重做下一步', [{ action: 'redo' }])
  }

  if (/^(清空|清空画布|全部清空|清除画布)$/.test(text)) {
    return commandResult('清空画布', [{ action: 'clear' }])
  }

  if (/^(删除|删掉|去掉|移除)(它|这个|选中|当前)?$/.test(text) || /^(删除|删掉|去掉|移除).*(圆|圆形|矩形|长方形|线|星星|文字|房子|树|太阳|云|花|人|车)$/.test(text)) {
    const target = resolveSpokenTarget(text, context)
    if (!target) {
      return {
        matched: true,
        interpretation: '删除选中对象',
        errorMessage: '没有可修改的对象，请先选中或创建一个对象。',
      }
    }

    return commandResult('删除选中对象', [{ action: 'delete', target }])
  }

  const selectTarget = findTargetByKind(text, context)
  if (/^(选中|选择|选一下|点一下).+/.test(text)) {
    const target = selectTarget || (/最后|刚才|上一个|当前|这个|它/.test(text) ? resolveContextTarget(context) : null)
    if (!target) {
      return {
        matched: true,
        interpretation: '选择对象',
        errorMessage: '没有找到要选择的对象，请换一种说法或直接点一下对象。',
      }
    }

    return commandResult('选择对象', [
      { action: 'select', target },
    ] as DrawCommand[])
  }

  const target = resolveSpokenTarget(text, context)

  if (/^(把|将)?(它|这个|选中|当前)?(变|换|改)(成|为)?(红|红色|蓝|蓝色|绿|绿色|黄|黄色|黑|黑色|白|白色|紫|紫色|粉|粉色|橙|橙色)/.test(text) || /^(红|红色|蓝|蓝色|绿|绿色|黄|黄色|黑|黑色|白|白色|紫|紫色|粉|粉色|橙|橙色)$/.test(text)) {
    if (!target) {
      return {
        matched: true,
        interpretation: '修改对象颜色',
        errorMessage: '没有可修改的对象，请先选中或创建一个对象。',
      }
    }

    const color = parseColor(text)
    return commandResult(`把选中对象变成${color.label || '指定颜色'}`, [
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

  if (/^(把|将)?(它|这个|选中|当前)?(变|放|弄)?(大|大一点|大一些)|^放大(它|这个|选中)?$|^(大一点|再大一点)$/.test(text)) {
    if (!target) {
      return {
        matched: true,
        interpretation: '放大对象',
        errorMessage: '没有可修改的对象，请先选中或创建一个对象。',
      }
    }

    return commandResult('放大选中对象', [
      { action: 'scale', target, params: { scale: 1.2 } },
    ] as DrawCommand[])
  }

  if (/^(把|将)?(它|这个|选中|当前)?(变|缩|弄)?(小|小一点|小一些)|^缩小(它|这个|选中)?$|^(小一点|再小一点)$/.test(text)) {
    if (!target) {
      return {
        matched: true,
        interpretation: '缩小对象',
        errorMessage: '没有可修改的对象，请先选中或创建一个对象。',
      }
    }

    return commandResult('缩小选中对象', [
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
    if (!target) {
      return {
        matched: true,
        interpretation: moveMatch[1],
        errorMessage: '没有可修改的对象，请先选中或创建一个对象。',
      }
    }

    return commandResult(moveMatch[1], [
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
    if (!target) {
      return {
        matched: true,
        interpretation: cornerMatch[1],
        errorMessage: '没有可修改的对象，请先选中或创建一个对象。',
      }
    }

    return commandResult(cornerMatch[1], [
      { action: 'move', target, params: { x: cornerMatch[2], y: cornerMatch[3] } },
    ] as DrawCommand[])
  }

  const color = getShapeColor(text)
  const shapePrefix = '(画|画个|画一个|换一个|换个|来一个|来个|创建|生成|加一个|加个|弄一个|做一个)'

  if (new RegExp(`^${shapePrefix}.*(圆|圆形)$`).test(text) || /^(画圆|画个圆|来个圆)$/.test(text)) {
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
