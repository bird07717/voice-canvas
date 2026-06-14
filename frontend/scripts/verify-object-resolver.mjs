import { build } from 'esbuild'

const entry = `
import { resolveObjectTarget } from './src/services/objectResolver.ts'

const baseContext = {
  objects: [
    {
      id: 'cloud_left',
      type: 'group',
      kind: 'cloud',
      kindLabel: '云',
      x: 105,
      y: 59,
      width: 130,
      height: 70,
      centerX: 170,
      centerY: 94,
      area: 9100,
      sceneRole: 'background',
    },
    {
      id: 'cloud_mid',
      type: 'group',
      kind: 'cloud',
      kindLabel: '云',
      x: 365,
      y: 84,
      width: 120,
      height: 64,
      centerX: 425,
      centerY: 116,
      area: 7680,
      sceneRole: 'background',
    },
    {
      id: 'tree',
      type: 'group',
      kind: 'tree',
      kindLabel: '树',
      x: 40,
      y: 270,
      width: 170,
      height: 180,
      centerX: 125,
      centerY: 360,
      area: 30600,
      sceneRole: 'midground',
    },
  ],
  lastCreatedObjectId: 'tree',
  lastModifiedObjectId: 'tree',
  selectedObjectId: null,
  recentCommands: [],
}

const cases = [
  ['选中云朵', {}, 'ambiguous', null],
  ['选中左边云朵', {}, 'resolved', 'cloud_left'],
  ['选中右边云朵', {}, 'resolved', 'cloud_mid'],
  ['选中中间云朵', {}, 'resolved', 'cloud_mid'],
  ['云朵', { objects: [baseContext.objects[0]], recentCommands: [] }, 'resolved', 'cloud_left'],
]

for (const [text, contextPatch, status, objectId] of cases) {
  const context = { ...baseContext, ...contextPatch }
  const result = resolveObjectTarget(
    { rawText: text },
    context,
    { allowContextFallback: false, action: 'select' }
  )

  console.log(text, result.status, result.objectId, result.reason)

  if (result.status !== status || (objectId !== null && result.objectId !== objectId)) {
    throw new Error(
      text + ' expected ' + status + '/' + objectId + ' got ' + result.status + '/' + result.objectId
    )
  }
}
`

const result = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: 'verify-object-resolver.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
})

const encoded = Buffer.from(result.outputFiles[0].text).toString('base64')
await import('data:text/javascript;base64,' + encoded)
