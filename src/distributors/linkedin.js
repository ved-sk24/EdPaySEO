import axios from 'axios'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { accessToken, orgId } = config.social.linkedin

function isConfigured() {
  return accessToken && orgId
}

/**
 * Post to LinkedIn company page
 */
export async function postToLinkedIn({ text, imageUrl = null, articleUrl = null }) {
  if (!isConfigured()) {
    logger.warn('LinkedIn not configured — skipping post')
    return null
  }

  try {
    const body = {
      author: `urn:li:organization:${orgId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: imageUrl || articleUrl ? 'ARTICLE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    if (articleUrl) {
      body.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        originalUrl: articleUrl,
      }]
    }

    const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    logger.info('LinkedIn post published', { id: res.data.id })
    return res.data
  } catch (err) {
    logger.error('LinkedIn post failed:', { error: err.response?.data || err.message })
    return null
  }
}

export default { postToLinkedIn, isConfigured }
