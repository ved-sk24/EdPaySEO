import axios from 'axios'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { accessToken, accountId } = config.social.instagram
const GRAPH_API = 'https://graph.facebook.com/v19.0'

function isConfigured() {
  return accessToken && accountId
}

/**
 * Post a single image to Instagram
 */
export async function postImage({ imageUrl, caption }) {
  if (!isConfigured()) {
    logger.warn('Instagram not configured — skipping post')
    return null
  }

  try {
    // Step 1: Create media container
    const container = await axios.post(`${GRAPH_API}/${accountId}/media`, {
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    })

    const containerId = container.data.id
    logger.info(`Instagram container created: ${containerId}`)

    // Step 2: Wait for processing (Instagram needs time)
    await new Promise(r => setTimeout(r, 5000))

    // Step 3: Publish
    const publish = await axios.post(`${GRAPH_API}/${accountId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    })

    logger.info(`Instagram post published: ${publish.data.id}`)
    return publish.data
  } catch (err) {
    logger.error('Instagram post failed:', { error: err.response?.data?.error || err.message })
    return null
  }
}

/**
 * Post a carousel (multiple images) to Instagram
 */
export async function postCarousel({ imageUrls, caption }) {
  if (!isConfigured()) return null

  try {
    // Step 1: Create media containers for each image
    const containerIds = []
    for (const url of imageUrls) {
      const res = await axios.post(`${GRAPH_API}/${accountId}/media`, {
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      })
      containerIds.push(res.data.id)
      await new Promise(r => setTimeout(r, 2000))
    }

    // Step 2: Create carousel container
    const carousel = await axios.post(`${GRAPH_API}/${accountId}/media`, {
      media_type: 'CAROUSEL',
      children: containerIds.join(','),
      caption,
      access_token: accessToken,
    })

    await new Promise(r => setTimeout(r, 5000))

    // Step 3: Publish
    const publish = await axios.post(`${GRAPH_API}/${accountId}/media_publish`, {
      creation_id: carousel.data.id,
      access_token: accessToken,
    })

    logger.info(`Instagram carousel published: ${publish.data.id}`, { images: imageUrls.length })
    return publish.data
  } catch (err) {
    logger.error('Instagram carousel failed:', { error: err.response?.data?.error || err.message })
    return null
  }
}

export default { postImage, postCarousel, isConfigured }
