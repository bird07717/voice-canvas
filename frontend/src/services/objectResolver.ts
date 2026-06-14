import { CanvasCommandContext } from '@/types'
import {
  ObjectSemanticProfile,
  SpatialSlot,
  buildObjectProfiles,
  normalizeQueryText,
  textMatchesTerm,
} from './semanticRegistry'

export type TargetQuery = {
  rawText?: string
  target?: string
  kind?: string
  label?: string
  category?: string
  role?: string
  spatial?: SpatialSlot | 'largest'
}

export type ResolveAction = 'select' | 'move' | 'scale' | 'recolor' | 'delete' | 'edit'

export type ResolveStatus = 'resolved' | 'ambiguous' | 'not_found'

export type ResolveResult = {
  objectId: string | null
  confidence: number
  status: ResolveStatus
  reason: string
  candidates?: Array<{ objectId: string; score: number; reason: string }>
}

type ResolveOptions = {
  allowContextFallback?: boolean
  minScore?: number
  minGap?: number
  action?: ResolveAction
}

const DEFAULT_MIN_SCORE = 36
const SPATIAL_ONLY_MIN_SCORE = 24
const DEFAULT_MIN_GAP = 12

const hasContextReference = (text: string) =>
  /它|这个|当前|选中|刚才|最后|上一个/.test(text)

const hasTargetActionPrefix = (text: string) =>
  /^(选中|选择|选一下|点一下|点选|删除|删掉|去掉|移除)/.test(text)

const explicitlyTargetsEnvironment = (text: string) =>
  /背景|天空|地面|草地|沙滩|海面|道路|路|环境/.test(text)

const isEnvironmentProfile = (profile: ObjectSemanticProfile) =>
  profile.category === 'background'
  || profile.category === 'environment'
  || profile.role === 'background'
  || profile.kind === 'background'
  || profile.kind === 'ground'

const canProfileHandleAction = (
  profile: ObjectSemanticProfile,
  action: ResolveAction | undefined,
  text: string
) => {
  if (!action || action === 'select') return true

  const environmentRequested = explicitlyTargetsEnvironment(text)
  if (!environmentRequested && isEnvironmentProfile(profile)) return false

  if (action === 'move') {
    return profile.capabilities.move && profile.area < 800 * 600 * 0.65
  }
  if (action === 'scale') return profile.capabilities.scale
  if (action === 'recolor') return profile.capabilities.recolor
  if (action === 'delete') return profile.capabilities.delete
  if (action === 'edit') return true

  return true
}

export const detectSpatialHint = (text: string): TargetQuery['spatial'] => {
  const normalized = normalizeQueryText(text)
  const targetAction = hasTargetActionPrefix(normalized)

  if (/最大|最大的|最宽|最大的那个/.test(normalized)) return 'largest'
  if (/最左|左边的|左侧的|左边那个|左侧那个|左边这个|左侧这个/.test(normalized) || (targetAction && /(左边|左侧)$/.test(normalized))) return 'left'
  if (/最右|右边的|右侧的|右边那个|右侧那个|右边这个|右侧这个/.test(normalized) || (targetAction && /(右边|右侧)$/.test(normalized))) return 'right'
  if (/最上|上边的|上面的|顶部的|上边那个|上面那个|顶部那个/.test(normalized) || (targetAction && /(上边|上面|顶部)$/.test(normalized))) return 'top'
  if (/最下|下边的|下面的|底部的|下边那个|下面那个|底部那个/.test(normalized) || (targetAction && /(下边|下面|底部)$/.test(normalized))) return 'bottom'
  if (/中间的|中央的|中心的|中间那个|中央那个|中心那个/.test(normalized) || (targetAction && /(中间|中央|中心)$/.test(normalized))) return 'center'
  return undefined
}

export const hasSemanticTargetHint = (text: string, context: CanvasCommandContext) => {
  const queryText = normalizeQueryText(text)
  if (!queryText) return false
  if (detectSpatialHint(queryText)) return true
  return buildObjectProfiles(context).some((profile) =>
    profile.aliases.some((alias) => textMatchesTerm(queryText, alias))
    || profile.attributes.some((attribute) => textMatchesTerm(queryText, attribute))
  )
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
    status: objectId ? 'resolved' : 'not_found',
    reason: objectId ? '使用当前选中或最近对象' : '当前没有可用对象',
  }
}

const scoreProfile = (
  profile: ObjectSemanticProfile,
  query: TargetQuery,
  context: CanvasCommandContext,
  maxArea: number
) => {
  const text = normalizeQueryText(query.rawText || query.target || '')
  const spatial = query.spatial || detectSpatialHint(text)
  const reasons: string[] = []
  let score = 0

  if (query.kind && profile.kind === query.kind) {
    score += 45
    reasons.push('kind')
  }
  if (query.category && profile.category === query.category) {
    score += 32
    reasons.push('category')
  }
  if (query.role && profile.role === query.role) {
    score += 28
    reasons.push('role')
  }
  if (query.label && profile.aliases.some((alias) => textMatchesTerm(query.label || '', alias))) {
    score += 48
    reasons.push('label')
  }

  const aliasHits = profile.aliases.filter((alias) => textMatchesTerm(text, alias))
  if (aliasHits.length) {
    score += Math.min(70, 38 + aliasHits.length * 8)
    reasons.push(`alias:${aliasHits.slice(0, 2).join('/')}`)
  }

  const attributeHits = profile.attributes.filter((attribute) => textMatchesTerm(text, attribute))
  if (attributeHits.length) {
    score += Math.min(28, attributeHits.length * 10)
    reasons.push(`attribute:${attributeHits.slice(0, 2).join('/')}`)
  }

  if (spatial === 'largest') {
    if (profile.area > 0 && profile.area === maxArea) {
      score += 26
      reasons.push('largest')
    }
  } else if (spatial && profile.spatialSlot === spatial) {
    score += 24
    reasons.push(`spatial:${spatial}`)
  }

  if (profile.objectId === context.selectedObjectId) {
    score += 14
    reasons.push('selected')
  } else if (profile.objectId === context.lastModifiedObjectId || profile.objectId === context.lastCreatedObjectId) {
    score += 8
    reasons.push('recent')
  }

  return {
    profile,
    score,
    reason: reasons.join(', ') || 'no semantic match',
  }
}

export const resolveObjectTarget = (
  query: TargetQuery,
  context: CanvasCommandContext,
  options: ResolveOptions = {}
): ResolveResult => {
  const text = query.rawText || query.target || ''
  const normalizedText = normalizeQueryText(text)
  const allowContextFallback = options.allowContextFallback ?? true

  if (hasContextReference(normalizedText) || query.target === '__last__') {
    return resolveContextTarget(context)
  }

  const profiles = buildObjectProfiles(context)
  const maxArea = Math.max(...profiles.map((profile) => profile.area || 0), 0)
  const hasSemanticHint = hasSemanticTargetHint(normalizedText, context)
  const spatial = query.spatial || detectSpatialHint(normalizedText)
  const minScore = options.minScore ?? (spatial ? SPATIAL_ONLY_MIN_SCORE : DEFAULT_MIN_SCORE)
  const minGap = options.minGap ?? DEFAULT_MIN_GAP
  const ranked = profiles
    .filter((profile) => canProfileHandleAction(profile, options.action, normalizedText))
    .map((profile) => scoreProfile(profile, query, context, maxArea))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
  const candidates = ranked.slice(0, 5).map((item) => ({
    objectId: item.profile.objectId,
    score: item.score,
    reason: item.reason,
  }))

  if (ranked.length) {
    const picked = ranked[0]
    const runnerUp = ranked[1]

    if (picked.score < minScore) {
      if (allowContextFallback && !hasSemanticHint) {
        return resolveContextTarget(context)
      }

      return {
        objectId: null,
        confidence: Math.min(0.96, picked.score / 100),
        status: 'not_found',
        reason: `最高候选分数过低：${picked.reason}`,
        candidates,
      }
    }

    if (runnerUp && picked.score - runnerUp.score < minGap) {
      return {
        objectId: null,
        confidence: Math.min(0.96, picked.score / 100),
        status: 'ambiguous',
        reason: `候选对象分差过小：${picked.reason}`,
        candidates,
      }
    }

    return {
      objectId: picked.profile.objectId,
      confidence: Math.min(0.96, picked.score / 100),
      status: 'resolved',
      reason: picked.reason,
      candidates,
    }
  }

  if (allowContextFallback && !hasSemanticHint) {
    return resolveContextTarget(context)
  }

  return {
    objectId: null,
    confidence: 0,
    status: 'not_found',
    reason: hasSemanticHint ? '没有匹配到明确对象' : '没有可用的上下文对象',
    candidates,
  }
}
