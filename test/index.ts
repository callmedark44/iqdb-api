import { search } from '../src/api'
import * as fs from 'fs'
import * as assert from 'assert'

const proxy = process.env.https_proxy || process.env.http_proxy
const opts = proxy ? { proxy } : undefined

async function test() {
  // Test 1: file buffer
  const buf = fs.readFileSync('/tmp/test-iqdb.png')
  const r1 = await search(buf, opts)
  assert.ok(r1.searched > 0, 'should search images')
  assert.ok(r1.results.length > 0, 'should have results')
  assert.ok(r1.results[0].similarity > 0, 'should have similarity')
  assert.ok(r1.results[0].sources.length > 0, 'should have sources')
  assert.ok(r1.thumbnailSrc.startsWith('http'), 'should have thumbnail')
  console.log('✓ file buffer search')

  // Test 2: ignoreColors + pickOtherResults
  const r2 = await search(buf, Object.assign({}, opts, { ignoreColors: true, pickOtherResults: true }))
  assert.ok(r2.results.length > 0, 'should have results')
  console.log('✓ ignoreColors + pickOtherResults')

  // Test 3: search result structure
  const r3 = r1.results[0]
  assert.ok(['best', 'additional', 'possible', 'other'].includes(r3.match), 'valid match type')
  assert.ok(r3.thumbnail.fixedSrc.startsWith('http'), 'valid thumbnail src')
  assert.ok(r3.sources[0].service, 'service defined')
  assert.ok(r3.sources[0].fixedHref.startsWith('http'), 'valid source href')
  console.log('✓ result structure')

  console.log('\nAll tests passed!')
}

test().catch(e => {
  console.error('Test failed:', e.message)
  process.exit(1)
})
