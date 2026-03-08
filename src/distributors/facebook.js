import axios from 'axios'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { pageAccessToken, pageId } = config.social.facebook
const GRAPH_API = 'https://graph.facebook.com/v19.0'

function isConfigured() {
  return pageAccessToken && pageId
}

/**
 * Post to Facebook page
 */
export async function postToFacebook({ text, link = null, imageUrl = null }) {
  if (!isConfigured()) {
    logger.warn('Facebook not configured — skipping post')
    return null
  }

  try {
    const body = { message: text, access_token: pageAccessToken }
    if (link) body.link = link

    let endpoint = `${GRAPH_API}/${pageId}/feed`

    // If posting an image
    if (imageUrl && !link) {
      endpoint = `${GRAPH_API}/${pageId}/photos`
      body.url = imageUrl
    }

    const res = await axios.post(endpoint, body)
    logger.info(`Facebook post published: ${res.data.id}`)
    return res.data
  } catch (err) {
    logger.error('Facebook post failed:', { error: err.response?.data?.error || err.message })
    return null
  }
}

export default { postToFacebook, isConfigured }
