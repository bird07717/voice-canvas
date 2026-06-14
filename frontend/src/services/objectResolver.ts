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
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PRECISE_MATCH_GAP = 18
const SPATIAL_TIE_GAP = 24
const LARGE_AREA_TIE_RATIO = 0.08

type RankedTargetCandidate = {
  profile: ObjectSemanticProfile
  score: number
  reason: string
}

const hasContextReference = (text: string) =>
  /它|这个|刚才|最后|上一个/.test(text)
  || /当前(对象|图形)?$/.test(text)
  || /选中(的|对象|图形)?$/.test(text)

const hasTargetActionPrefix = (text: string) =>
  /^(选中|选择|选一下|点一下|点选|删除|删掉|去掉|移除)/.test(text)

const hasMoveDirectionPhrase = (text: string) =>
  /(左移|右移|上移|下移|往左|往右|往上|往下|向左|向右|向上|向下|左边一点|右边一点|上面一点|下面一点|靠左一点|靠右一点|靠上一点|靠下一点)/.test(text)

const explicitlyTargetsEnvironment = (text: string) =>
  /背景|天空|地面|草地|沙滩|海面|道路|路|环境/.test(text)

const PROTECTED_ENVIRONMENT_KINDS = new Set(['background', 'ground'])

const isProtectedEnvironmentProfile = (profile: ObjectSemanticProfile) =>
  PROTECTED_ENVIRONMENT_KINDS.has(profile.kind)
  || (
    profile.role === 'background'
    && profile.area >= 800 * 600 * 0.55
    && ['rect', 'rectangle', 'square'].includes(profile.kind)
  )

const canProfileHandleAction = (
  profile: ObjectSemanticProfile,
  action: ResolveAction | undefined,
  text: string
) => {
  if (!action || action === 'select') return true

  const environmentRequested = explicitlyTargetsEnvironment(text)
  if (!environmentRequested && isProtectedEnvironmentProfile(profile)) return false

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
  if (/最左|左边|左侧/.test(normalized) && !hasMoveDirectionPhrase(normalized)) return 'left'
  if (/最右|右边|右侧/.test(normalized) && !hasMoveDirectionPhrase(normalized)) return 'right'
  if (/最上|上边|上面|顶部/.test(normalized) && !hasMoveDirectionPhrase(normalized)) return 'top'
  if (/最下|下边|下面|底部/.test(normalized) && !hasMoveDirectionPhrase(normalized)) return 'bottom'
  if (
    /中间的|中央的|中心的|中间那个|中央那个|中心那个/.test(normalized)
    || /中间|中央|中心/.test(normalized)
    || (targetAction && /(中间|中央|中心)$/.test(normalized))
  ) return 'center'
  return undefined
}

export const hasSemanticTargetHint = (text: string, context: CanvasCommandContext) => {
  const queryText = normalizeQueryText(text)
  if (!queryText) return false
  if (detectSpatialHint(queryText)) return true
  return buildObjectProfiles(context).some((profile) =>
    profile.aliases.some((alias) => textMentionsTerm(queryText, alias))
    || (hasTargetActionPrefix(queryText) && profile.attributes.some((attribute) => textMentionsTerm(queryText, attribute)))
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

const textMentionsTerm = (text: string, term: string) => {
  const normalizedText = normalizeQueryText(text)
  const normalizedTerm = normalizeQueryText(term)
  if (!normalizedText || !normalizedTerm) return false
  return normalizedText.includes(normalizedTerm)
}

const bestTermMatchScore = (input: string, terms: string[]) => {
  const normalizedInput = normalizeQueryText(input)
  let bestScore = 0
  let bestTerm = ''

  if (!normalizedInput) {
    return { score: 0, term: '' }
  }

  for (const term of terms) {
    const normalizedTerm = normalizeQueryText(term)
    if (!normalizedTerm) continue

    let score = 0
    if (normalizedInput === normalizedTerm) {
      score = 120 + Math.min(normalizedTerm.length, 8)
    } else if (normalizedInput.includes(normalizedTerm)) {
      score = (normalizedTerm.length >= 2 ? 82 : 58) + Math.min(normalizedTerm.length, 8)
    } else if (normalizedTerm.includes(normalizedInput) && normalizedInput.length >= 2) {
      score = 70 + Math.min(normalizedInput.length, 8)
    }

    if (score > bestScore) {
      bestScore = score
      bestTerm = normalizedTerm
    }
  }

  return { score: bestScore, term: bestTerm }
}

const getProfileCenter = (profile: ObjectSemanticProfile) => ({
  x: profile.centerX
    ?? (
      typeof profile.source.x === 'number'
        ? profile.source.x + (profile.source.width || 0) / 2
        : CANVAS_WIDTH / 2
    ),
  y: profile.centerY
    ?? (
      typeof profile.source.y === 'number'
        ? profile.source.y + (profile.source.height || 0) / 2
        : CANVAS_HEIGHT / 2
    ),
})

const toResolveCandidates = (ranked: RankedTargetCandidate[]) =>
  ranked.slice(0, 5).map((item) => ({
    objectId: item.profile.objectId,
    score: item.score,
    reason: item.reason,
  }))

const scorePreciseProfile = (
  profile: ObjectSemanticProfile,
  query: TargetQuery,
  normalizedText: string
): RankedTargetCandidate | null => {
  const reasons: string[] = []
  let score = 0
  let targetTermMatched = false

  const addTargetScore = (value: number, reason: string) => {
    if (value <= 0) return
    score += value
    reasons.push(reason)
    targetTermMatched = true
  }

  const normalizedKind = normalizeQueryText(query.kind || '')
  if (normalizedKind) {
    if (profile.kind === normalizedKind || profile.type === normalizedKind) {
      addTargetScore(125, `kind:${normalizedKind}`)
    } else {
      const kindAliasMatch = bestTermMatchScore(normalizedKind, profile.aliases)
      addTargetScore(Math.min(105, kindAliasMatch.score), `kind-alias:${kindAliasMatch.term}`)
    }
  }

  if (query.label) {
    const labelMatch = bestTermMatchScore(query.label, profile.aliases)
    addTargetScore(labelMatch.score, `label:${labelMatch.term}`)
  }

  const normalizedCategory = normalizeQueryText(query.category || '')
  if (normalizedCategory && profile.category === normalizedCategory) {
    addTargetScore(78, `category:${normalizedCategory}`)
  }

  const normalizedRole = normalizeQueryText(query.role || '')
  if (normalizedRole && normalizeQueryText(profile.role || '') === normalizedRole) {
    addTargetScore(52, `role:${normalizedRole}`)
  }

  const rawAliasMatch = bestTermMatchScore(normalizedText, profile.aliases)
  addTargetScore(rawAliasMatch.score, `alias:${rawAliasMatch.term}`)

  if (!targetTermMatched) return null

  const attributeMatch = bestTermMatchScore(normalizedText, profile.attributes)
  if (attributeMatch.score > 0) {
    score += Math.min(28, attributeMatch.score / 4)
    reasons.push(`attribute:${attributeMatch.term}`)
  }

  return {
    profile,
    score,
    reason: reasons.filter((reason) => !reason.endsWith(':')).join(', ') || 'precise semantic match',
  }
}

const rankBySpatialHint = (
  ranked: RankedTargetCandidate[],
  spatial: TargetQuery['spatial']
) => {
  if (!spatial) return ranked

  const withSpatialScore = ranked.map((item) => {
    const center = getProfileCenter(item.profile)
    let spatialScore = 0

    if (spatial === 'left') spatialScore = CANVAS_WIDTH - center.x
    if (spatial === 'right') spatialScore = center.x
    if (spatial === 'top') spatialScore = CANVAS_HEIGHT - center.y
    if (spatial === 'bottom') spatialScore = center.y
    if (spatial === 'center') {
      const distance = Math.hypot(center.x - CANVAS_WIDTH / 2, center.y - CANVAS_HEIGHT / 2)
      spatialScore = Math.max(0, CANVAS_WIDTH - distance)
    }
    if (spatial === 'largest') spatialScore = item.profile.area

    return {
      ...item,
      score: item.score + Math.min(35, spatialScore / 20),
      reason: `${item.reason}, spatial:${spatial}`,
      spatialScore,
    }
  })

  return withSpatialScore.sort((a, b) => {
    if (b.spatialScore !== a.spatialScore) return b.spatialScore - a.spatialScore
    return b.score - a.score
  })
}

const spatialWinnerIsDistinct = (
  picked: RankedTargetCandidate & { spatialScore?: number },
  runnerUp: RankedTargetCandidate & { spatialScore?: number },
  spatial: TargetQuery['spatial']
) => {
  const pickedSpatialScore = picked.spatialScore || 0
  const runnerUpSpatialScore = runnerUp.spatialScore || 0

  if (spatial === 'largest') {
    return picked.profile.area - runnerUp.profile.area >= Math.max(1, picked.profile.area * LARGE_AREA_TIE_RATIO)
  }

  return Math.abs(pickedSpatialScore - runnerUpSpatialScore) >= SPATIAL_TIE_GAP
}

const resolveFromPreciseCandidates = (
  ranked: RankedTargetCandidate[],
  spatial: TargetQuery['spatial']
): ResolveResult => {
  const scoreRanked = [...ranked].sort((a, b) => b.score - a.score)

  if (spatial && scoreRanked.length > 1) {
    const topScore = scoreRanked[0].score
    const runnerUpScore = scoreRanked[1].score
    const spatialPool = topScore - runnerUpScore >= PRECISE_MATCH_GAP
      ? [scoreRanked[0]]
      : scoreRanked.filter((item) => topScore - item.score < PRECISE_MATCH_GAP)
    const spatialRanked = rankBySpatialHint(spatialPool, spatial)
    const picked = spatialRanked[0]
    const runnerUp = spatialRanked[1]

    if (!runnerUp || spatialWinnerIsDistinct(picked, runnerUp, spatial)) {
      return {
        objectId: picked.profile.objectId,
        confidence: 0.92,
        status: 'resolved',
        reason: picked.reason,
        candidates: toResolveCandidates(spatialRanked),
      }
    }

    return {
      objectId: null,
      confidence: 0.74,
      status: 'ambiguous',
      reason: `位置描述仍不够明确：${spatial}`,
      candidates: toResolveCandidates(spatialRanked),
    }
  }

  const picked = scoreRanked[0]
  const runnerUp = scoreRanked[1]

  if (!runnerUp || picked.score - runnerUp.score >= PRECISE_MATCH_GAP) {
    return {
      objectId: picked.profile.objectId,
      confidence: 0.9,
      status: 'resolved',
      reason: picked.reason,
      candidates: toResolveCandidates(scoreRanked),
    }
  }

  return {
    objectId: null,
    confidence: 0.72,
    status: 'ambiguous',
    reason: '找到多个同类目标，需要用户确认',
    candidates: toResolveCandidates(scoreRanked),
  }
}

const resolveSpatialOnlyTarget = (
  profiles: ObjectSemanticProfile[],
  spatial: TargetQuery['spatial'],
  normalizedText: string
): ResolveResult | null => {
  if (!spatial) return null

  const candidates = profiles
    .filter((profile) => explicitlyTargetsEnvironment(normalizedText) || !isProtectedEnvironmentProfile(profile))
    .map((profile) => ({
      profile,
      score: spatial === 'largest' ? 34 : 30,
      reason: `spatial-only:${spatial}`,
    }))

  if (!candidates.length) return null

  return resolveFromPreciseCandidates(candidates, spatial)
}

const resolvePreciseTarget = (
  query: TargetQuery,
  profiles: ObjectSemanticProfile[],
  options: ResolveOptions,
  normalizedText: string
): ResolveResult | null => {
  const actionProfiles = profiles.filter((profile) => canProfileHandleAction(profile, options.action, normalizedText))
  const explicitTargetId = query.target && query.target !== '__last__'
    ? actionProfiles.find((profile) => profile.objectId === query.target)
    : null

  if (explicitTargetId) {
    return {
      objectId: explicitTargetId.objectId,
      confidence: 0.98,
      status: 'resolved',
      reason: 'exact target id',
      candidates: [{ objectId: explicitTargetId.objectId, score: 100, reason: 'exact target id' }],
    }
  }

  const spatial = query.spatial || detectSpatialHint(normalizedText)
  const ranked = actionProfiles
    .map((profile) => scorePreciseProfile(profile, query, normalizedText))
    .filter(Boolean) as RankedTargetCandidate[]

  if (ranked.length) {
    return resolveFromPreciseCandidates(ranked, spatial)
  }

  if (spatial && hasTargetActionPrefix(normalizedText)) {
    return resolveSpatialOnlyTarget(actionProfiles, spatial, normalizedText)
  }

  return null
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
  const hasStructuredTarget = Boolean(query.kind || query.label || query.category || query.role || query.spatial)

  if ((!hasStructuredTarget && hasContextReference(normalizedText)) || query.target === '__last__') {
    return resolveContextTarget(context)
  }

  const profiles = buildObjectProfiles(context)
  const preciseResult = resolvePreciseTarget(query, profiles, options, normalizedText)
  if (preciseResult) return preciseResult

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
