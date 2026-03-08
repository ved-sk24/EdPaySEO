import axios from 'axios'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { url: wpUrl, user, appPassword } = config.cms

function isConfigured() {
  return wpUrl && user && appPassword
}

/**
 * Publish a blog post to WordPress
 */
export async function publishPost({ title, content, slug, metaDescription, categories = [], tags = [], featuredImageUrl = null }) {
  if (!isConfigured()) {
    logger.warn('WordPress not configured — skipping blog publish')
    return null
  }

  try {
    const auth = Buffer.from(`${user}:${appPassword}`).toString('base64')
    const apiUrl = `${wpUrl}/wp-json/wp/v2`

    // Create the post
    const postData = {
      title,
      content,
      slug,
      status: 'draft', // publish as draft first for review
      excerpt: metaDescription,
      meta: {
        _yoast_wpseo_metadesc: metaDescription,
        _yoast_wpseo_focuskw: slug.replace(/-/g, ' '),
      },
    }

    // Upload featured image if provided
    if (featuredImageUrl) {
      try {
        const imgResponse = await axios.get(featuredImageUrl, { responseType: 'arraybuffer' })
        const imgUpload = await axios.post(`${apiUrl}/media`, imgResponse.data, {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="${slug}-featured.png"`,
          },
        })
        postData.featured_media = imgUpload.data.id
      } catch (imgErr) {
        logger.warn('Featured image upload failed:', { error: imgErr.message })
      }
    }

    const res = await axios.post(`${apiUrl}/posts`, postData, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    logger.info(`WordPress post created: "${title}"`, { id: res.data.id, status: res.data.status, link: res.data.link })
    return {
      id: res.data.id,
      link: res.data.link,
      status: res.data.status,
    }
  } catch (err) {
    logger.error('WordPress publish failed:', { error: err.response?.data || err.message })
    return null
  }
}

/**
 * Update an existing WordPress post
 */
export async function updatePost(postId, updates) {
  if (!isConfigured()) return null

  try {
    const auth = Buffer.from(`${user}:${appPassword}`).toString('base64')
    const res = await axios.put(`${wpUrl}/wp-json/wp/v2/posts/${postId}`, updates, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    logger.info(`WordPress post ${postId} updated`)
    return res.data
  } catch (err) {
    logger.error(`WordPress update failed for post ${postId}:`, { error: err.message })
    return null
  }
}

/**
 * Publish a draft post (change status to 'publish')
 */
export async function publishDraft(postId) {
  return updatePost(postId, { status: 'publish' })
}

export default { publishPost, updatePost, publishDraft, isConfigured }
