import { search } from '../src/api'
import * as fs from 'fs'

const proxy = process.env.https_proxy || process.env.http_proxy

async function main() {
  console.log('=== Test 1: File buffer search ===')
  try {
    const buf = fs.readFileSync('/tmp/test-iqdb.png')
    const r = await search(buf, proxy ? { proxy } : undefined)
    console.log('searched:', r.searched)
    console.log('time:', r.timeSeconds, 's')
    console.log('thumbnail:', r.thumbnailSrc)
    console.log('results count:', r.results.length)
    if (r.results.length > 0) {
      const first = r.results[0]
      console.log('first match:', first.match, 'sim:', first.similarity + '%')
      console.log('first source:', first.sources[0]?.service)
      console.log('first source href:', first.sources[0]?.fixedHref)
    }
    console.log('otherSearchHrefs:', r.otherSearchHrefs)
    console.log('OK')
  } catch (e: any) {
    console.error('FAILED:', e.message)
    console.error('STACK:', e.stack?.substring?.(0, 300))
  }

  console.log('\n=== Test 2: URL string search ===')
  try {
    const r = await search('https://iqdb.org/thu/thu_7ad870eb.jpg', proxy ? { proxy } : undefined)
    console.log('searched:', r.searched)
    console.log('results count:', r.results.length)
    console.log('OK')
  } catch (e: any) {
    console.error('FAILED:', e.message)
  }

  console.log('\n=== Test 3: Search with ignoreColors ===')
  try {
    const buf = fs.readFileSync('/tmp/test-iqdb.png')
    const r = await search(buf, { ignoreColors: true, ...(proxy ? { proxy } : {}) })
    console.log('searched:', r.searched)
    console.log('results count:', r.results.length)
    console.log('OK')
  } catch (e: any) {
    console.error('FAILED:', e.message)
  }

  console.log('\n=== Test 4: Search with pickOtherResults ===')
  try {
    const buf = fs.readFileSync('/tmp/test-iqdb.png')
    const r = await search(buf, { pickOtherResults: true, ...(proxy ? { proxy } : {}) })
    console.log('searched:', r.searched)
    console.log('results count:', r.results.length)
    console.log('OK')
  } catch (e: any) {
    console.error('FAILED:', e.message)
  }
}

main()
