import { search } from './api'
import * as fs from 'fs'

const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.log('Usage: iqdb <image-url|file-path>')
    console.log('  - If arg starts with http(s)://, treated as URL')
    console.log('  - Otherwise, treated as local file path')
    process.exit(1)
  }

  const opts = proxy ? { proxy } : undefined
  const isUrl = /^https?:\/\//.test(input)

  try {
    const result = await search(
      isUrl ? input : fs.readFileSync(input),
      opts
    )

    console.log(`\nSearched ${result.searched.toLocaleString()} images in ${result.timeSeconds}s`)
    console.log(`Your image: ${result.thumbnailSrc}\n`)

    if (result.results.length === 0) {
      console.log('No results found.')
      return
    }

    for (const r of result.results) {
      const sim = `${r.similarity}%`.padEnd(5)
      const match = r.match.padEnd(12)
      const source = r.sources[0]?.service?.padEnd(20) || ''
      const dims = r.width && r.height ? `${r.width}x${r.height}`.padEnd(14) : ''.padEnd(14)
      const type = r.type.padEnd(10)
      console.log(`${sim} ${match} ${source} ${dims} ${type} ${r.sources[0]?.fixedHref || ''}`)
    }

    console.log('\nOther search sites:')
    console.log(`  SauceNao:  ${result.otherSearchHrefs.saucenao}`)
    console.log(`  ascii2d:   ${result.otherSearchHrefs.ascii2d}`)
    console.log(`  Google:    ${result.otherSearchHrefs.google}`)
    console.log(`  TinEye:    ${result.otherSearchHrefs.tineye}`)
  } catch (e: any) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

main()
