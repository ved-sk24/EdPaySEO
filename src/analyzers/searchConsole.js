import { google } from 'googleapis'
import fs from 'fs'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

let searchConsole = null

async function getClient() {
  if (searchConsole) return searchConsole

  try {
    const keyFile = config.google.serviceAccountJson
    if (!fs.existsSync(keyFile)) {
      logger.warn('Google service account JSON not found — Search Console disabled')
      return null
    }

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })

    searchConsole = google.searchconsole({ version: 'v1', auth })
    return searchConsole
  } catch (err) {
    logger.error('Failed to init Google Search Console:', { error: err.message })
    return null
  }
}

/**
 * Get search performance data — queries, clicks, impressions, position
 */
export async function getSearchPerformance({ startDate, endDate, rowLimit = 100, dimensions = ['query'] } = {}) {
  const client = await getClient()
  if (!client) return []

  const end = endDate || new Date().toISOString().split('T')[0]
  const start = startDate || new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]

  try {
    const res = await client.searchanalytics.query({
      siteUrl: config.google.siteUrl,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions,
        rowLimit,
        dataState: 'final',
      },
    })

    const rows = (res.data.rows || []).map(row => ({
      query: row.keys[0],
      page: dimensions.includes('page') ? row.keys[dimensions.indexOf('page')] : null,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100, // percentage
      position: Math.round(row.position * 10) / 10,
    }))

    logger.info(`Fetched ${rows.length} search performance rows`, { start, end })
    return rows
  } catch (err) {
    logger.error('Search Console query failed:', { error: err.message })
    return []
  }
}

/**
 * Find keywords where we rank 5-20 (almost top 5 — easy wins)
 */
export async function findAlmostRankingKeywords() {
  const data = await getSearchPerformance({ rowLimit: 500 })
  return data
    .filter(r => r.position >= 5 && r.position <= 20 && r.impressions > 10)
    .sort((a, b) => a.position - b.position)
}

/**
 * Find keywords where ranking dropped (need attention)
 */
export async function findDroppingKeywords() {
  const now = new Date()
  const thisWeek = await getSearchPerformance({
    startDate: new Date(now - 7 * 86400000).toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
    rowLimit: 200,
  })
  const lastWeek = await getSearchPerformance({
    startDate: new Date(now - 14 * 86400000).toISOString().split('T')[0],
    endDate: new Date(now - 7 * 86400000).toISOString().split('T')[0],
    rowLimit: 200,
  })

  const lastWeekMap = new Map(lastWeek.map(r => [r.query, r]))
  const dropping = []

  for (const current of thisWeek) {
    const prev = lastWeekMap.get(current.query)
    if (prev && current.position > prev.position + 2) {
      dropping.push({
        query: current.query,
        currentPosition: current.position,
        previousPosition: prev.position,
        drop: Math.round((current.position - prev.position) * 10) / 10,
        impressions: current.impressions,
      })
    }
  }

  return dropping.sort((a, b) => b.drop - a.drop)
}

/**
 * Get top performing pages
 */
export async function getTopPages() {
  return getSearchPerformance({ dimensions: ['page'], rowLimit: 50 })
}

/**
 * Get search performance summary
 */
export async function getSummary() {
  const data = await getSearchPerformance({ rowLimit: 500 })
  if (!data.length) return null

  const totalClicks = data.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = data.reduce((s, r) => s + r.impressions, 0)
  const avgPosition = data.reduce((s, r) => s + r.position, 0) / data.length

  const top5 = data.filter(r => r.position <= 5).length
  const top10 = data.filter(r => r.position <= 10).length
  const top20 = data.filter(r => r.position <= 20).length

  return {
    totalClicks,
    totalImpressions,
    avgCtr: totalClicks / totalImpressions * 100,
    avgPosition: Math.round(avgPosition * 10) / 10,
    keywordsInTop5: top5,
    keywordsInTop10: top10,
    keywordsInTop20: top20,
    totalKeywords: data.length,
  }
}

export default {
  getSearchPerformance,
  findAlmostRankingKeywords,
  findDroppingKeywords,
  getTopPages,
  getSummary,
}
