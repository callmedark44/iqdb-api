import { Website, Service, SearchInput, SearchOptions, SearchResult, SearchResponse } from './type'
import { Readable } from 'stream'
import got from 'got'
import FormData from 'form-data'
import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import crypto from 'crypto'
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent'
import { CookieJar } from 'tough-cookie'

export async function search (input: SearchInput, options?: SearchOptions): Promise<SearchResponse> {
  const cookieJar = new CookieJar()
  const baseOpts = buildBaseOptions(options)
  const maxRetries = options?.maxQueueRetries ?? 30

  const url = WebsiteUrls[options?.website?.origin || 'www']
  if (!url) throw new Error('Invalid website origin: ' + options?.website?.origin)

  let response = await postSearch(input, options, baseOpts, cookieJar)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = tryParseResponse(response, options)
    if (result !== undefined) return result

    const pos = parseQueuePosition(response)
    if (pos !== undefined) {
      options?.onQueuePosition?.(pos)
    } else {
      options?.onQueuePosition?.(-1)
    }

    const wait = pos !== undefined ? Math.min(pos * 2000, 10000) : 3000
    await new Promise(r => setTimeout(r, wait))
    response = await get(url, baseOpts, cookieJar)
  }

  throw new Error('iqdb queue timeout after ' + maxRetries + ' retries')
}

const WebsiteUrls: Record<Website, string> = {
  www: 'https://iqdb.org/',
  '3d': 'https://3d.iqdb.org/'
}

const Services = Object.values(Service)
const ServiceIdMappings: Record<Service, number> = {
  [Service.Danbooru]: 1,
  [Service.Konachan]: 2,
  [Service.Yandere]: 3,
  [Service.Gelbooru]: 4,
  [Service.SankakuChannel]: 5,
  [Service.EShuushuu]: 6,
  [Service.Zerochan]: 11,
  [Service.AnimePictures]: 13,
  [Service.ThreeDBooru]: 7,
  [Service.IdolComplex]: 9
}

const SourceNamedServiceMappings = Services.reduce((acc, service) => {
  const lowerCase = service.toLowerCase()
  acc[lowerCase] = service
  acc[lowerCase.replace(/\s/g, '-')] = service
  return acc
}, {} as Record<string, Service>)

function buildBaseOptions (options?: SearchOptions) {
  const agent = options?.proxy
    ? {
        http: new HttpProxyAgent({ proxy: options.proxy }),
        https: new HttpsProxyAgent({ proxy: options.proxy })
      }
    : undefined
  return { agent }
}

function postSearch (input: SearchInput, options: SearchOptions | undefined, baseOpts: ReturnType<typeof buildBaseOptions>, cookieJar: CookieJar): Promise<string> {
  const url = WebsiteUrls[options?.website?.origin || 'www']
  if (!url) throw new Error('Invalid website origin: ' + options?.website?.origin)

  const formData = new FormData()

  if (input instanceof Buffer || input instanceof Readable) {
    const length = Math.ceil(Math.random() * 10 + 5)
    const filename = options?.filename || crypto.randomBytes(length).toString('hex')
    formData.append('file', input, { filename })
  } else if (typeof input === 'string') {
    formData.append('url', input)
  } else {
    throw new Error('Expected input to be a string, buffer or a Readable stream')
  }

  if (options?.website?.services && Array.isArray(options?.website?.services)) {
    for (const service of options.website.services) {
      const id = ServiceIdMappings[service as Service]
      id && formData.append('service[]', id)
    }
  }

  if (options?.ignoreColors) {
    formData.append('forcegray', '1')
  }

  return got.post(url, {
    body: formData,
    headers: formData.getHeaders() as Record<string, string>,
    agent: baseOpts.agent,
    cookieJar,
    timeout: { request: 120000 }
  }).text()
}

function get (url: string, baseOpts: ReturnType<typeof buildBaseOptions>, cookieJar: CookieJar): Promise<string> {
  return got.get(url, {
    agent: baseOpts.agent,
    cookieJar,
    timeout: { request: 120000 }
  }).text()
}

function tryParseResponse (response: string, options?: SearchOptions): SearchResponse | undefined {
  const $ = cheerio.load(response)
  const error = parseError($)
  if (error) throw new Error(error)

  if (hasSearchedMetadata($)) {
    const metadata = parseMetadata($)
    const results = parseResults($, options?.pickOtherResults)
    return { ...metadata, results }
  }

  if (isQueued($)) return undefined

  throw new Error('Unexpected response from iqdb')
}

function hasSearchedMetadata ($: cheerio.CheerioAPI): boolean {
  const paragraphs = $('body p')
  let found = false
  paragraphs.each((_i: number, el: AnyNode) => {
    if ($(el).text().toLowerCase().startsWith('searched')) found = true
  })
  return found
}

function isQueued ($: cheerio.CheerioAPI): boolean {
  return $('script').toArray().some(el => {
    return $(el).text().includes('Place in queue')
  })
}

function parseQueuePosition (response: string): number | undefined {
  const $ = cheerio.load(response)
  const scripts = $('script').toArray()
  for (const el of scripts) {
    const text = $(el).text()
    const match = text.match(/queue\((\d+)/)
    if (match) return parseInt(match[1], 10)
  }
}

function parseError ($: cheerio.CheerioAPI): string | undefined {
  const $errEl = $('body .err')
  if ($errEl?.length > 0) {
    return $errEl.first().text()
  }
}

function parseMetadata ($: cheerio.CheerioAPI) {
  const $searchedEls = $('body p')
  const $searchedEl = $searchedEls.map((_i: number, $el: AnyNode) => {
    const text = $($el).text().toLowerCase()
    if (text.startsWith('searched')) return $el
    return undefined
  })

  const searchedText = $searchedEl.text()
  const searchedTextParts = searchedText.split(' ')
  if (!searchedTextParts[1]) throw new Error('Unexpected response from iqdb (no search metadata found)')
  const searched = parseInt(searchedTextParts[1].replace(/,/g, '').trim())
  const timeSeconds = parseFloat(searchedTextParts[4].trim())
  const timeMilliseconds = timeSeconds * 1000

  const $yourImageEl = $('body div#pages').children().first().find('img')
  const yourImageSrc = $yourImageEl.attr('src') as string
  const fixedYourImageSrc = fixedHref(yourImageSrc)

  return {
    searched,
    timeSeconds,
    timeMilliseconds,
    thumbnailSrc: fixedYourImageSrc,
    otherSearchHrefs: {
      saucenao: `https://saucenao.com/search.php?&url=${fixedYourImageSrc}`,
      ascii2d: `https://ascii2d.net/search/url/${fixedYourImageSrc}`,
      google: `https://lens.google.com/uploadbyurl?url=${fixedYourImageSrc}`,
      tineye: `https://tineye.com/search?url=${fixedYourImageSrc}`
    }
  }
}

function parseResults ($: cheerio.CheerioAPI, pickOtherResults?: boolean): SearchResult[] {
  let results = $('body div#pages')
    .children()
    .map((_i: number, $pageEl: AnyNode) => parseResultsPage($, $pageEl))
    .get() as SearchResult[]

  const $moreEl = pickOtherResults ? $('body div#more1') : undefined
  if ($moreEl && $moreEl.length > 0) {
    const moreResults = $($moreEl).find('div.pages')
      .children()
      .map((_i: number, $pageEl: AnyNode) => parseResultsPage($, $pageEl))
      .get() as SearchResult[]
    if (moreResults.length > 0) {
      results = results.concat(moreResults)
    }
  }
  return results
}

function parseResultsPage ($: cheerio.CheerioAPI, $pageEl: AnyNode): SearchResult | undefined {
  const $rows = $($pageEl).find('table tr')
  if ($rows.length <= 0) return undefined

  const $matchEl = $($rows[0]).find('th')
  const $thumbnailLinkEl = $($rows[$matchEl.length]).find('td a')
  const $thumbnailImageEl = $($thumbnailLinkEl).find('img')
  if ($thumbnailImageEl.length <= 0) return undefined

  const matchText = $matchEl.length > 0 ? $matchEl.text().toLowerCase() : 'other'
  const thumbnailLinkHref = $thumbnailLinkEl.attr('href') as string
  const thumbnailImageSrc = $thumbnailImageEl.attr('src') as string
  const thumbnailImageAlt = $thumbnailImageEl.attr('alt') as string

  const match = matchText.replace(/match/g, '').trim()
  const thumbnail: SearchResult['thumbnail'] = {
    src: thumbnailImageSrc,
    fixedSrc: fixedHref(thumbnailImageSrc),
    ...parseImageProperties(thumbnailImageAlt)
  }

  const $sourceEl = $($rows[$matchEl.length + 1]).find('td')
  const firstSource = $sourceEl.clone().children().remove().end().text().trim().toLowerCase()
  const otherSources = $sourceEl.find('span.el a').map((_i: number, $el: AnyNode) => {
    const ref = $($el)
    const service = ref.text().trim().toLowerCase()
    const href = ref.attr('href') as string
    return {
      service: SourceNamedServiceMappings[service],
      href,
      fixedHref: fixedHref(href)
    }
  }).get() as SearchResult['sources']

  const sources: SearchResult['sources'] = [
    {
      service: SourceNamedServiceMappings[firstSource],
      href: thumbnailLinkHref,
      fixedHref: fixedHref(thumbnailLinkHref)
    }
  ].concat(otherSources)

  const $dimensionEl = $($rows[$matchEl.length + 2]).find('td')
  const dimensionOrTypeText = $dimensionEl.text().trim()
  const dimensionOrTypeMatch = /^(\d+).?(\d+)\s?\[(\w+)\]|\[(\w+)\]$/.exec(dimensionOrTypeText)
  let width = 0
  let height = 0
  let type: SearchResult['type'] = 'unrated'
  if (dimensionOrTypeMatch) {
    width = dimensionOrTypeMatch[1] ? parseInt(dimensionOrTypeMatch[1]) : 0
    height = dimensionOrTypeMatch[2] ? parseInt(dimensionOrTypeMatch[2]) : 0
    type = (dimensionOrTypeMatch[3] || dimensionOrTypeMatch[4]).toLowerCase() as SearchResult['type']
  }

  const $similarityEl = $($rows[$matchEl.length + 3]).find('td')
  const similarityTexts = $similarityEl.text().trim().split(' ')
  const similarity = parseInt(similarityTexts[0].replace('%', ''))
  const similarityPercentage = similarity / 100

  return {
    match,
    thumbnail,
    sources,
    width,
    height,
    type,
    similarity,
    similarityPercentage
  } as SearchResult
}

function fixedHref (href: string): string {
  if (href[0] === '/' && href[1] === '/') {
    return 'http:' + href
  } else if (href[0] === '/') {
    return 'https://iqdb.org' + href
  } return href
}

function parseImageProperties (alt: string) {
  const parts = alt.split(' ')
  const properties: Record<string, string | string[]> = {}
  let tmp = ''
  for (const part of parts) {
    if (part.charAt(part.length - 1) === ':') {
      tmp = part.substring(0, part.length - 1).toLowerCase()
      continue
    }
    const value = properties[tmp]
    value
      ? (!Array.isArray(value) ? (properties[tmp] = [value]) : value).push(part)
      : properties[tmp] = part
  }

  return {
    rating: properties.rating as string,
    score: properties.score ? parseInt(properties.score as string) : undefined,
    tags: fixedTags(properties.tags)
  }
}

function fixedTags (tags?: string | string[]): string[] | undefined {
  if (!tags) return undefined
  if (typeof tags === 'string') return [tags]

  const newTags: string[] = []
  for (const tag of tags) {
    const parts = tag.split(',')
    for (let part of parts) {
      part = part.trim()
      if (part.length > 0) {
        newTags.push(part)
      }
    }
  } return newTags
}
