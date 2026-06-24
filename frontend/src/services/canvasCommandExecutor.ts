import { useCanvasStore } from '@/stores/canvasStore'
import { CanvasCommandContext, CanvasObject, DrawCommand } from '@/types'
import { ResolveAction, resolveObjectTarget } from './objectResolver'
import {
  buildMoveByUpdates,
  buildMoveToUpdates,
  buildScaleAroundCenterUpdates,
  getObjectBounds as getResolvedObjectBounds,
} from './transformEngine'
import { PENDING_TARGET } from './fastCommandMatcher'

export type CommandExecutionResult = {
  success: boolean
  message: string
}

export type CommandExecutionOptions = {
  deferHistory?: boolean
  mode?: 'normal' | 'replaceScene'
}

export const DRAW_COMMAND_PROTOCOL = 'draw-command-v1'

const DRAW_COMMAND_ACTIONS = new Set([
  'create',
  'replaceScene',
  'modify',
  'move',
  'moveBy',
  'scale',
  'select',
  'delete',
  'clear',
  'undo',
  'redo',
])

export type PendingCommandResolution = {
  commands: DrawCommand[]
  candidates: string[]
}

export type PreparedCommandsResult =
  | { status: 'ready'; commands: DrawCommand[] }
  | { status: 'pending'; pending: PendingCommandResolution }
  | { status: 'error'; message: string }

export const validateDrawCommands = (commands: DrawCommand[]): CommandExecutionResult => {
  if (!Array.isArray(commands)) {
    return { success: false, message: '命令协议错误：commands 必须是数组。' }
  }

  for (const command of commands) {
    if (!command || !DRAW_COMMAND_ACTIONS.has(command.action)) {
      return { success: false, message: '命令协议错误：未知绘图命令。' }
    }
    if (command.action === 'create' && (!command.id || !command.type)) {
      return { success: false, message: '命令协议错误：创建命令缺少 id 或 type。' }
    }
    if (command.action === 'replaceScene') {
      const objects = command.params?.objects
      if (!Array.isArray(objects)) {
        return { success: false, message: '命令协议错误：replaceScene 缺少 objects。' }
      }
    }
    if (['modify', 'move', 'moveBy', 'scale', 'select', 'delete'].includes(command.action) && !command.target) {
      return { success: false, message: '命令协议错误：目标命令缺少 target。' }
    }
  }

  return { success: true, message: '命令协议校验通过' }
}

const translateSceneObject = (obj: CanvasObject, dx: number, dy: number): CanvasObject => {
  const params = { ...(obj.params || {}) }

  if (Array.isArray(params.points)) {
    params.points = params.points.map((point: number, index: number) =>
      index % 2 === 0 ? point + dx : point + dy
    )
  } else {
    params.x = (params.x || 0) + dx
    params.y = (params.y || 0) + dy
  }

  return {
    ...obj,
    params,
    children: obj.children?.map((child) => translateSceneObject(child, dx, dy)),
  }
}

const scaleSceneObject = (obj: CanvasObject, scale: number): CanvasObject => {
  const params = { ...(obj.params || {}) }

  if (typeof params.width === 'number') params.width = Math.max(8, params.width * scale)
  if (typeof params.height === 'number') params.height = Math.max(8, params.height * scale)
  if (typeof params.radius === 'number') params.radius = Math.max(6, params.radius * scale)
  if (typeof params.innerRadius === 'number') params.innerRadius = Math.max(4, params.innerRadius * scale)
  if (typeof params.outerRadius === 'number') params.outerRadius = Math.max(6, params.outerRadius * scale)
  if (typeof params.fontSize === 'number') params.fontSize = Math.max(10, params.fontSize * scale)

  return {
    ...obj,
    params,
    children: obj.children?.map((child) => scaleSceneObject(child, scale)),
  }
}

const applySceneObjectParams = (obj: CanvasObject, updates: any): CanvasObject => {
  let nextObject = obj

  if (typeof updates?.dx === 'number' || typeof updates?.dy === 'number') {
    nextObject = translateSceneObject(nextObject, updates.dx || 0, updates.dy || 0)
  }

  const scale = typeof updates?.scale_delta === 'number'
    ? updates.scale_delta
    : typeof updates?.scale === 'number'
      ? updates.scale
      : null

  if (scale && scale > 0) {
    nextObject = scaleSceneObject(nextObject, scale)
  }

  const filteredUpdates = Object.fromEntries(
    Object.entries(updates || {}).filter(([key]) => !['dx', 'dy', 'scale', 'scale_delta'].includes(key))
  )
  const params = { ...(nextObject.params || {}), ...filteredUpdates }
  const styleKeys = ['fill', 'stroke', 'strokeWidth', 'opacity']
  const styleUpdates = Object.fromEntries(
    Object.entries(filteredUpdates || {}).filter(([key]) => styleKeys.includes(key))
  )

  if (nextObject.type !== 'group' || Object.keys(styleUpdates).length === 0) {
    return { ...nextObject, params }
  }

  return {
    ...nextObject,
    params,
    children: nextObject.children?.map((child) => applySceneObjectParams(child, styleUpdates)),
  }
}

const resolveSceneCommandTarget = (
  target: string,
  lastCreatedId: string | null,
  sceneObjects: CanvasObject[]
) => {
  if (target === '__last__') return lastCreatedId || sceneObjects[sceneObjects.length - 1]?.id || null

  if (target.startsWith('__kind__:')) {
    const kind = target.replace('__kind__:', '').toLowerCase()
    const matched = [...sceneObjects]
      .reverse()
      .find((obj) => obj.type?.toLowerCase() === kind || obj.params?.kind?.toLowerCase() === kind)
    return matched?.id || null
  }

  return sceneObjects.some((obj) => obj.id === target) ? target : null
}

const executeSceneReplacementCommands = (commands: DrawCommand[]): CommandExecutionResult => {
  let lastCreatedId: string | null = null
  let sceneObjects = commands
    .reduce<CanvasObject[]>((objects, command) => {
      if (command.action !== 'create' || !command.type || !command.id) return objects
      lastCreatedId = command.id
      objects.push({
        id: command.id,
        type: command.type,
        params: command.params || {},
        children: command.children,
      })
      return objects
    }, [])

  if (sceneObjects.length === 0) {
    return {
      success: false,
      message: '没有可执行的场景命令',
    }
  }

  for (const command of commands) {
    if (command.action === 'modify' && command.target && command.params) {
      const targetId = resolveSceneCommandTarget(command.target, lastCreatedId, sceneObjects)
      if (targetId) {
        sceneObjects = sceneObjects.map((obj) =>
          obj.id === targetId ? applySceneObjectParams(obj, command.params) : obj
        )
      }
    }

    if (command.action === 'delete' && command.target) {
      const targetId = resolveSceneCommandTarget(command.target, lastCreatedId, sceneObjects)
      if (targetId) {
        sceneObjects = sceneObjects.filter((obj) => obj.id !== targetId)
      }
    }

    if (command.action === 'moveBy' && command.target && command.params) {
      const targetId = resolveSceneCommandTarget(command.target, lastCreatedId, sceneObjects)
      if (targetId) {
        sceneObjects = sceneObjects.map((obj) =>
          obj.id === targetId
            ? translateSceneObject(obj, command.params?.dx || 0, command.params?.dy || 0)
            : obj
        )
      }
    }
  }

  useCanvasStore.getState().replaceSceneObjects(sceneObjects)

  return {
    success: true,
    message: `已完成：生成 ${sceneObjects.length} 个场景对象`,
  }
}

const executeReplaceSceneCommand = (command: DrawCommand): CommandExecutionResult => {
  const objects = command.params?.objects || []
  if (!Array.isArray(objects) || objects.length === 0) {
    return {
      success: false,
      message: '没有可替换的场景对象',
    }
  }

  useCanvasStore.getState().replaceSceneObjects(objects)

  return {
    success: true,
    message: `已完成：替换 ${objects.length} 个场景对象`,
  }
}

const getNoOpMessage = (commands: DrawCommand[]) => {
  const action = commands[0]?.action
  if (action === 'undo') return '当前没有可撤销的操作。'
  if (action === 'redo') return '当前没有可重做的操作。'
  return '没有可修改的对象，请先选中或创建一个对象。'
}

const getMoveByUpdates = (targetId: string, dx: number, dy: number) => {
  const obj = useCanvasStore.getState().canvasObjects.find((item) => item.id === targetId)
  if (!obj) return null
  return buildMoveByUpdates(obj, dx, dy)
}

const getMoveToUpdates = (targetId: string, x: number, y: number) => {
  const obj = useCanvasStore.getState().canvasObjects.find((item) => item.id === targetId)
  if (!obj || typeof x !== 'number' || typeof y !== 'number') return null
  return buildMoveToUpdates(obj, x, y)
}

const getScaleUpdates = (targetId: string, scale: number) => {
  const obj = useCanvasStore.getState().canvasObjects.find((item) => item.id === targetId)
  if (!obj) return null
  return buildScaleAroundCenterUpdates(obj, scale)
}

const resolveCommandTarget = (target: string, lastCreatedId: string | null) => {
  const state = useCanvasStore.getState()

  if (target === '__last__') {
    return (
      lastCreatedId ||
      state.selectedObjectId ||
      state.lastModifiedObjectId ||
      state.lastCreatedObjectId ||
      state.canvasObjects[state.canvasObjects.length - 1]?.id ||
      null
    )
  }

  if (target.startsWith('__kind__:')) {
    const kind = target.replace('__kind__:', '').toLowerCase()
    const matched = [...state.canvasObjects]
      .reverse()
      .find((obj) => obj.type?.toLowerCase() === kind || obj.params?.kind?.toLowerCase() === kind)
    return matched?.id || null
  }

  return target
}

const executeStandardCommands = (
  commands: DrawCommand[],
  options: CommandExecutionOptions = {}
): CommandExecutionResult => {
  const {
    addObject,
    updateObject,
    removeObject,
    clearCanvas,
    undo,
    redo,
    setSelectedObjectId,
  } = useCanvasStore.getState()

  let lastCreatedId: string | null = null
  let executedCount = 0

  commands.forEach((cmd) => {
    switch (cmd.action) {
      case 'create':
        if (cmd.type && cmd.id) {
          lastCreatedId = cmd.id
          addObject({
            id: cmd.id,
            type: cmd.type,
            params: cmd.params || {},
            children: cmd.children,
          }, { deferHistory: options.deferHistory })
          executedCount += 1
        }
        break

      case 'replaceScene':
        {
          const result = executeReplaceSceneCommand(cmd)
          if (result.success) executedCount += 1
        }
        break

      case 'modify':
        if (cmd.target && cmd.params) {
          const target = resolveCommandTarget(cmd.target, lastCreatedId)
          if (target) {
            updateObject(target, cmd.params)
            executedCount += 1
          }
        }
        break

      case 'move':
        if (cmd.target && cmd.params) {
          const target = resolveCommandTarget(cmd.target, lastCreatedId)
          const updates = target ? getMoveToUpdates(target, cmd.params.x, cmd.params.y) : null
          if (target && updates) {
            updateObject(target, updates)
            executedCount += 1
          }
        }
        break

      case 'moveBy':
        if (cmd.target && cmd.params) {
          const target = resolveCommandTarget(cmd.target, lastCreatedId)
          const updates = target ? getMoveByUpdates(target, cmd.params.dx || 0, cmd.params.dy || 0) : null
          if (target && updates) {
            updateObject(target, updates)
            executedCount += 1
          }
        }
        break

      case 'scale':
        if (cmd.target && cmd.params) {
          const target = resolveCommandTarget(cmd.target, lastCreatedId)
          const updates = target ? getScaleUpdates(target, cmd.params.scale || 1) : null
          if (target && updates) {
            updateObject(target, updates)
            executedCount += 1
          }
        }
        break

      case 'select':
        if (cmd.target) {
          const target = resolveCommandTarget(cmd.target, lastCreatedId)
          if (target) {
            setSelectedObjectId(target)
            executedCount += 1
          }
        }
        break

      case 'delete':
        if (cmd.target) {
          const target = resolveCommandTarget(cmd.target, lastCreatedId)
          if (target) {
            removeObject(target)
            executedCount += 1
          }
        }
        break

      case 'clear':
        clearCanvas()
        executedCount += 1
        break

      case 'undo':
        if (useCanvasStore.getState().historyStep <= 0) return
        undo()
        executedCount += 1
        break

      case 'redo':
        {
          const state = useCanvasStore.getState()
          if (state.historyStep >= state.history.length - 1) return
          redo()
          executedCount += 1
        }
        break

      default:
        console.warn('未知命令:', cmd)
    }
  })

  if (executedCount === 0) {
    return {
      success: false,
      message: getNoOpMessage(commands),
    }
  }

  return {
    success: true,
    message: `已完成：执行 ${executedCount} 个命令`,
  }
}

export const executeDrawCommands = (
  commands: DrawCommand[],
  options: CommandExecutionOptions = {}
): CommandExecutionResult => {
  const validation = validateDrawCommands(commands)
  if (!validation.success) return validation

  if (commands[0]?.action === 'replaceScene') {
    return executeReplaceSceneCommand(commands[0])
  }

  if (options.mode === 'replaceScene') {
    return executeSceneReplacementCommands(commands)
  }

  return executeStandardCommands(commands, options)
}

const getResolveActionForCommand = (command: DrawCommand): ResolveAction => {
  if (command.action === 'delete') return 'delete'
  if (command.action === 'move' || command.action === 'moveBy') return 'move'
  if (command.action === 'scale') return 'scale'
  if (command.action === 'select') return 'select'
  if (command.action === 'modify') {
    if (command.params && ('fill' in command.params || 'stroke' in command.params)) {
      return 'recolor'
    }
    return 'edit'
  }
  return 'edit'
}

export const prepareCommandsWithTargetQueries = (
  commands: DrawCommand[],
  context: CanvasCommandContext,
  userText: string
): PreparedCommandsResult => {
  const preparedCommands: DrawCommand[] = []

  for (const [index, command] of commands.entries()) {
    if (!command.targetQuery) {
      preparedCommands.push(command)
      continue
    }

    const action = getResolveActionForCommand(command)
    const result = resolveObjectTarget(
      {
        ...command.targetQuery,
        rawText: command.targetQuery.rawText || userText,
      },
      context,
      {
        allowContextFallback: false,
        action,
      }
    )

    if (result.status === 'ambiguous' && result.candidates?.length) {
      const candidates = result.candidates.map((candidate) => candidate.objectId).filter(Boolean)
      return {
        status: 'pending',
        pending: {
          commands: [
            ...preparedCommands,
            {
              ...command,
              target: PENDING_TARGET,
              targetQuery: undefined,
            },
            ...commands.slice(index + 1),
          ],
          candidates,
        },
      }
    }

    if (result.status !== 'resolved' || !result.objectId) {
      return {
        status: 'error',
        message: '没有找到 AI 命令要修改的对象，请换一种更明确的说法。',
      }
    }

    preparedCommands.push({
      ...command,
      target: result.objectId,
      targetQuery: undefined,
    })
  }

  return { status: 'ready', commands: preparedCommands }
}

export const buildDisambiguationPrompt = (candidateIds: string[]) =>
  `找到 ${candidateIds.length} 个可能对象，请说第几个、左边那个或右边那个。`

const normalizeReplyText = (text: string) =>
  text.trim().replace(/[，。！？、,.!?:：\s]/g, '')

const parseOrdinalIndex = (text: string) => {
  const digitMatch = text.match(/第?([1-5一二三四五])个?/)
  const raw = digitMatch?.[1]
  if (!raw) return null

  const map: Record<string, number> = {
    '1': 0,
    '2': 1,
    '3': 2,
    '4': 3,
    '5': 4,
    一: 0,
    二: 1,
    三: 2,
    四: 3,
    五: 4,
  }
  return map[raw] ?? null
}

export const resolveDisambiguationTarget = (text: string, candidateIds: string[]) => {
  const normalized = normalizeReplyText(text)
  const state = useCanvasStore.getState()

  const selectedCandidate = state.selectedObjectId && candidateIds.includes(state.selectedObjectId)
    ? state.selectedObjectId
    : null
  if (/^(这个|当前|选中|就这个|是这个)$/.test(normalized) && selectedCandidate) {
    return selectedCandidate
  }

  const ordinalIndex = parseOrdinalIndex(normalized)
  if (ordinalIndex !== null && candidateIds[ordinalIndex]) {
    return candidateIds[ordinalIndex]
  }

  const candidateObjects = candidateIds
    .map((id) => {
      const obj = state.canvasObjects.find((item) => item.id === id)
      const bounds = obj ? getResolvedObjectBounds(obj) : null
      return obj && bounds
        ? {
            id,
            centerX: bounds.x + bounds.width / 2,
            centerY: bounds.y + bounds.height / 2,
            area: bounds.width * bounds.height,
          }
        : null
    })
    .filter(Boolean) as Array<{ id: string; centerX: number; centerY: number; area: number }>

  if (!candidateObjects.length) return null

  if (/左边|左侧|最左/.test(normalized)) {
    return [...candidateObjects].sort((a, b) => a.centerX - b.centerX)[0]?.id || null
  }
  if (/右边|右侧|最右/.test(normalized)) {
    return [...candidateObjects].sort((a, b) => b.centerX - a.centerX)[0]?.id || null
  }
  if (/上面|上边|顶部|最上/.test(normalized)) {
    return [...candidateObjects].sort((a, b) => a.centerY - b.centerY)[0]?.id || null
  }
  if (/下面|下边|底部|最下/.test(normalized)) {
    return [...candidateObjects].sort((a, b) => b.centerY - a.centerY)[0]?.id || null
  }
  if (/最大|大的/.test(normalized)) {
    return [...candidateObjects].sort((a, b) => b.area - a.area)[0]?.id || null
  }
  if (/最小|小的/.test(normalized)) {
    return [...candidateObjects].sort((a, b) => a.area - b.area)[0]?.id || null
  }

  return null
}

export const replacePendingTarget = (commands: DrawCommand[], targetId: string): DrawCommand[] =>
  commands.map((command) => ({
    ...command,
    target: command.target === PENDING_TARGET ? targetId : command.target,
    children: command.children,
    params: command.params,
  }))

export const summarizeCanvasObject = (obj: CanvasObject) => {
  const bounds = getResolvedObjectBounds(obj)
  const width = obj.params?.width ?? bounds?.width
  const height = obj.params?.height ?? bounds?.height

  return {
    id: obj.id,
    type: obj.type,
    kind: obj.params?.kind,
    kindLabel: obj.params?.kindLabel,
    text: obj.params?.text,
    x: obj.params?.x ?? bounds?.x,
    y: obj.params?.y ?? bounds?.y,
    width,
    height,
    radius: obj.params?.radius,
    fill: obj.params?.fill,
    stroke: obj.params?.stroke,
    centerX: bounds ? bounds.x + bounds.width / 2 : undefined,
    centerY: bounds ? bounds.y + bounds.height / 2 : undefined,
    area: typeof width === 'number' && typeof height === 'number' ? width * height : undefined,
    sceneType: obj.params?.sceneType,
    sceneRole: obj.params?.sceneRole,
    idHint: obj.params?.idHint,
    assetId: obj.params?.assetId,
    assetCategory: obj.params?.assetCategory,
    semanticAliases: Array.isArray(obj.params?.semanticAliases) ? obj.params.semanticAliases : undefined,
  }
}

export const buildCanvasContext = (): CanvasCommandContext => {
  const state = useCanvasStore.getState()

  return {
    objects: state.canvasObjects.slice(-30).map((obj: CanvasObject) => summarizeCanvasObject(obj)),
    lastCreatedObjectId: state.lastCreatedObjectId,
    lastModifiedObjectId: state.lastModifiedObjectId,
    selectedObjectId: state.selectedObjectId,
    recentCommands: state.recentCommands.slice(-10),
  }
}
