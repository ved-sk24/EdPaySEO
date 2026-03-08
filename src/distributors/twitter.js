import axios from 'axios'
import crypto from 'crypto'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { apiKey, apiSecret, accessToken, accessSecret } = config.social.twitter

function isConfigured() {
  return apiKey && apiSecret && accessToken && accessSecret
}

/**
 * Generate OAuth 1.0a signature for Twitter API
 */
function generateOAuthHeader(method, url, params = {}) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  }

  const allParams = { ...oauthParams, ...params }
  const sortedKeys = Object.keys(allParams).sort()
  const paramString = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`).join('&')
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  oauthParams.oauth_signature = signature
  const authHeader = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ')

  return authHeader
}

/**
 * Post a tweet
 */
export async function postTweet(text, replyToId = null) {
  if (!isConfigured()) {
    logger.warn('Twitter not configured — skipping tweet')
    return null
  }

  try {
    const url = 'https://api.twitter.com/2/tweets'
    const body = { text }
    if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId }

    const auth = generateOAuthHeader('POST', url)
    const res = await axios.post(url, body, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    })

    logger.info(`Tweet posted: ${res.data.data.id}`, { text: text.substring(0, 50) })
    return res.data.data
  } catch (err) {
    logger.error('Tweet failed:', { error: err.response?.data || err.message })
    return null
  }
}

/**
 * Post a thread (multiple connected tweets)
 */
export async function postThread(tweets) {
  if (!isConfigured()) return null
  const posted = []
  let replyToId = null

  for (const text of tweets) {
    const tweet = await postTweet(text, replyToId)
    if (tweet) {
      posted.push(tweet)
      replyToId = tweet.id
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  logger.info(`Thread posted: ${posted.length}/${tweets.length} tweets`)
  return posted
}

export default { postTweet, postThread, isConfigured }
