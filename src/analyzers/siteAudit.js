import axios from 'axios'
import * as cheerio from 'cheerio'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

/**
 * Crawl a page and extract SEO signals
 */
export async function auditPage(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'EdPaySEO-Auditor/1.0' },
    })
    const $ = cheerio.load(res.data)
    const issues = []

    // Title tag
    const title = $('title').text().trim()
    if (!title) issues.push({ type: 'critical', issue: 'Missing title tag' })
    else if (title.length < 30) issues.push({ type: 'warning', issue: `Title too short (${title.length} chars): "${title}"` })
    else if (title.length > 60) issues.push({ type: 'warning', issue: `Title too long (${title.length} chars): "${title}"` })

    // Meta description
    const metaDesc = $('meta[name="description"]').attr('content') || ''
    if (!metaDesc) issues.push({ type: 'critical', issue: 'Missing meta description' })
    else if (metaDesc.length < 70) issues.push({ type: 'warning', issue: `Meta description too short (${metaDesc.length} chars)` })
    else if (metaDesc.length > 160) issues.push({ type: 'warning', issue: `Meta description too long (${metaDesc.length} chars)` })

    // H1 tag
    const h1s = $('h1')
    if (h1s.length === 0) issues.push({ type: 'critical', issue: 'Missing H1 tag' })
    else if (h1s.length > 1) issues.push({ type: 'warning', issue: `Multiple H1 tags found (${h1s.length})` })

    // Heading hierarchy
    const h2s = $('h2').length
    const h3s = $('h3').length
    if (h2s === 0 && h3s > 0) issues.push({ type: 'warning', issue: 'H3 tags found without H2 — broken heading hierarchy' })

    // Images without alt
    const images = $('img')
    let missingAlt = 0
    images.each((_, el) => {
      if (!$(el).attr('alt')) missingAlt++
    })
    if (missingAlt > 0) issues.push({ type: 'warning', issue: `${missingAlt}/${images.length} images missing alt text` })

    // Open Graph
    const ogTitle = $('meta[property="og:title"]').attr('content')
    const ogDesc = $('meta[property="og:description"]').attr('content')
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (!ogTitle) issues.push({ type: 'info', issue: 'Missing og:title' })
    if (!ogDesc) issues.push({ type: 'info', issue: 'Missing og:description' })
    if (!ogImage) issues.push({ type: 'info', issue: 'Missing og:image' })

    // Twitter Card
    const twitterCard = $('meta[name="twitter:card"]').attr('content')
    if (!twitterCard) issues.push({ type: 'info', issue: 'Missing Twitter card meta tags' })

    // Canonical URL
    const canonical = $('link[rel="canonical"]').attr('href')
    if (!canonical) issues.push({ type: 'warning', issue: 'Missing canonical URL' })

    // Schema markup
    const schemas = $('script[type="application/ld+json"]')
    if (schemas.length === 0) issues.push({ type: 'warning', issue: 'No structured data (JSON-LD) found' })

    // Internal links count
    const internalLinks = $(`a[href^="/"], a[href^="${config.edpayu.website}"]`).length
    const externalLinks = $('a[href^="http"]').length - $(`a[href^="${config.edpayu.website}"]`).length

    // Page load size
    const pageSize = Buffer.byteLength(res.data, 'utf8')
    if (pageSize > 3 * 1024 * 1024) issues.push({ type: 'warning', issue: `Page too heavy (${(pageSize / 1024 / 1024).toFixed(1)}MB)` })

    // HTTPS check
    if (!url.startsWith('https://')) issues.push({ type: 'critical', issue: 'Not using HTTPS' })

    // Mobile viewport
    const viewport = $('meta[name="viewport"]').attr('content')
    if (!viewport) issues.push({ type: 'critical', issue: 'Missing viewport meta tag (not mobile friendly)' })

    // Response time
    const responseTime = res.headers['x-response-time'] || 'unknown'

    return {
      url,
      status: res.status,
      title,
      metaDescription: metaDesc,
      h1: h1s.first().text().trim(),
      headings: { h1: h1s.length, h2: h2s, h3: h3s },
      images: { total: images.length, missingAlt },
      links: { internal: internalLinks, external: externalLinks },
      canonical,
      hasSchema: schemas.length > 0,
      hasOpenGraph: !!ogTitle,
      hasTwitterCard: !!twitterCard,
      pageSize: `${(pageSize / 1024).toFixed(0)}KB`,
      responseTime,
      issues,
      score: calculateScore(issues),
    }
  } catch (err) {
    logger.error(`Audit failed for ${url}:`, { error: err.message })
    return { url, error: err.message, issues: [{ type: 'critical', issue: `Page unreachable: ${err.message}` }], score: 0 }
  }
}

function calculateScore(issues) {
  let score = 100
  for (const issue of issues) {
    if (issue.type === 'critical') score -= 15
    else if (issue.type === 'warning') score -= 5
    else if (issue.type === 'info') score -= 2
  }
  return Math.max(0, score)
}

/**
 * Audit multiple pages (sitemap or known URLs)
 */
export async function auditSite(urls) {
  if (!urls || !urls.length) {
    urls = [
      config.edpayu.website,
      `${config.edpayu.website}/features`,
      `${config.edpayu.website}/pricing`,
      `${config.edpayu.website}/about`,
      `${config.edpayu.website}/contact`,
      `${config.edpayu.website}/blog`,
    ]
  }

  logger.info(`Starting site audit for ${urls.length} pages...`)
  const results = []

  for (const url of urls) {
    const result = await auditPage(url)
    results.push(result)
    await new Promise(r => setTimeout(r, 500)) // polite crawl delay
  }

  const avgScore = results.reduce((s, r) => s + (r.score || 0), 0) / results.length
  const allIssues = results.flatMap(r => (r.issues || []).map(i => ({ ...i, page: r.url })))
  const criticalCount = allIssues.filter(i => i.type === 'critical').length
  const warningCount = allIssues.filter(i => i.type === 'warning').length

  const summary = {
    pagesAudited: results.length,
    averageScore: Math.round(avgScore),
    totalIssues: allIssues.length,
    critical: criticalCount,
    warnings: warningCount,
    topIssues: allIssues.filter(i => i.type === 'critical').slice(0, 10),
    pages: results,
  }

  logger.info('Site audit complete', {
    pages: results.length,
    avgScore: summary.averageScore,
    critical: criticalCount,
  })

  return summary
}

export default { auditPage, auditSite }
