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

export type ResolveResult = {
  objectId: string | null
  confidence: number
  reason: string
  candidates?: Array<{ objectId: string; score: number; reason: string }>
}

export const detectSpatialHint = (text: string): TargetQuery['spatial'] => {
  if (/最大|最大的|最宽|最大的那个/.test(text)) return 'largest'
  if (/左边|最左|左侧/.test(text)) return 'left'
  if (/右边|最右|右侧/.test(text)) return 'right'
  if (/上边|最上|上面|顶部/.test(text)) return 'top'
  if (/下边|最下|下面|底部/.test(text)) return 'bottom'
  if (/中间|中央|中心/.test(text)) return 'center'
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
  context: CanvasCommandContext
): ResolveResult => {
  const text = query.rawText || query.target || ''

  if (/它|这个|当前|选中|刚才|最后|上一个/.test(text) || query.target === '__last__') {
    return resolveContextTarget(context)
  }

  const profiles = buildObjectProfiles(context)
  const maxArea = Math.max(...profiles.map((profile) => profile.area || 0), 0)
  const ranked = profiles
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
    return {
      objectId: picked.profile.objectId,
      confidence: Math.min(0.96, picked.score / 100),
      reason: picked.reason,
      candidates,
    }
  }

  return resolveContextTarget(context)
}
