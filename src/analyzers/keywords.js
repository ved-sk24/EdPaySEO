import axios from 'axios'
import * as cheerio from 'cheerio'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'
import { generateText, parseJSON } from '../utils/ai.js'

/**
 * Use Claude to analyze competitors and find keyword gaps
 */
export async function analyzeCompetitorKeywords() {
  const competitors = config.edpayu.competitors
  const ourKeywords = config.edpayu.primaryKeywords

  const prompt = `You are an SEO expert specializing in the Indian education technology market.

Our product: ${config.edpayu.brand} — ${config.edpayu.tagline}
Website: ${config.edpayu.website}
Target audience: ${config.edpayu.targetAudience.join(', ')}

Our competitors: ${competitors.join(', ')}

Our current target keywords:
${ourKeywords.map(k => `- ${k}`).join('\n')}

Analyze this and return a JSON object with:
1. "gaps": Array of 15 keyword opportunities we're missing (that competitors likely rank for)
2. "longTail": Array of 20 long-tail keywords with low competition for Indian education market
3. "trending": Array of 10 trending education tech keywords in India right now
4. "localSeo": Array of 10 location-based keywords (city + school management software)
5. "questions": Array of 15 "People Also Ask" style questions Indian school admins would search

Focus on keywords with:
- High intent (people ready to buy/try a school management tool)
- India-specific terms (CBSE, ICSE, NEP 2020, state boards)
- Hindi transliteration keywords (how Indians type Hindi in English)

Return ONLY valid JSON, no markdown or explanation.`

  try {
    const text = await generateText(prompt)
    const result = parseJSON(text)
    logger.info('Competitor keyword analysis complete', {
      gaps: result.gaps?.length,
      longTail: result.longTail?.length,
      trending: result.trending?.length,
    })
    return result
  } catch (err) {
    logger.error('Failed to parse keyword analysis:', { error: err.message })
    return { gaps: [], longTail: [], trending: [], localSeo: [], questions: [] }
  }
}

/**
 * Scrape Google autocomplete suggestions for keyword ideas
 */
export async function getAutocompleteSuggestions(keyword) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&gl=in&hl=en&q=${encodeURIComponent(keyword)}`
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000,
    })
    const suggestions = res.data[1] || []
    logger.info(`Got ${suggestions.length} autocomplete suggestions for "${keyword}"`)
    return suggestions
  } catch (err) {
    logger.warn(`Autocomplete failed for "${keyword}":`, { error: err.message })
    return []
  }
}

/**
 * Get autocomplete suggestions for all our primary keywords
 */
export async function expandKeywords() {
  const allSuggestions = new Map()

  for (const keyword of config.edpayu.primaryKeywords.slice(0, 10)) {
    const suggestions = await getAutocompleteSuggestions(keyword)
    for (const s of suggestions) {
      if (!allSuggestions.has(s)) {
        allSuggestions.set(s, keyword)
      }
    }
    // Rate limit — don't hammer Google
    await new Promise(r => setTimeout(r, 500))
  }

  const expanded = Array.from(allSuggestions.entries()).map(([suggestion, source]) => ({
    keyword: suggestion,
    source,
  }))

  logger.info(`Expanded to ${expanded.length} keyword ideas from autocomplete`)
  return expanded
}

/**
 * Scrape "People Also Ask" from Google search results
 */
export async function getPeopleAlsoAsk(keyword) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&gl=in&hl=en`
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      },
      timeout: 10000,
    })
    const $ = cheerio.load(res.data)
    const questions = []
    $('[data-q]').each((_, el) => {
      const q = $(el).attr('data-q')
      if (q) questions.push(q)
    })
    // Fallback: look for expandable question divs
    if (!questions.length) {
      $('div[data-sgrd] span').each((_, el) => {
        const t = $(el).text().trim()
        if (t.endsWith('?') && t.length > 15) questions.push(t)
      })
    }
    return questions.slice(0, 10)
  } catch (err) {
    logger.warn(`PAA scrape failed for "${keyword}":`, { error: err.message })
    return []
  }
}

/**
 * Generate a full keyword research report
 */
export async function generateKeywordReport() {
  logger.info('Starting keyword research...')

  const [competitorAnalysis, expanded] = await Promise.all([
    analyzeCompetitorKeywords(),
    expandKeywords(),
  ])

  // Get PAA for top 3 keywords
  const paaResults = []
  for (const kw of config.edpayu.primaryKeywords.slice(0, 3)) {
    const questions = await getPeopleAlsoAsk(kw)
    paaResults.push({ keyword: kw, questions })
    await new Promise(r => setTimeout(r, 1000))
  }

  const report = {
    date: new Date().toISOString(),
    competitorGaps: competitorAnalysis.gaps,
    longTailKeywords: competitorAnalysis.longTail,
    trendingKeywords: competitorAnalysis.trending,
    localSeoKeywords: competitorAnalysis.localSeo,
    expandedKeywords: expanded,
    peopleAlsoAsk: paaResults,
    aiGeneratedQuestions: competitorAnalysis.questions,
    totalOpportunities:
      (competitorAnalysis.gaps?.length || 0) +
      (competitorAnalysis.longTail?.length || 0) +
      expanded.length,
  }

  logger.info('Keyword research complete', {
    totalOpportunities: report.totalOpportunities,
  })

  return report
}

export default {
  analyzeCompetitorKeywords,
  getAutocompleteSuggestions,
  expandKeywords,
  getPeopleAlsoAsk,
  generateKeywordReport,
}
