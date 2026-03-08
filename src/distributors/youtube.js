import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { clientId, clientSecret, refreshToken } = config.social.youtube

function isConfigured() {
  return clientId && clientSecret && refreshToken
}

async function getAuthClient() {
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return oauth2
}

/**
 * Upload a video to YouTube (works for Shorts if < 60 seconds + vertical)
 */
export async function uploadVideo({ filePath, title, description, tags = [], isShort = false }) {
  if (!isConfigured()) {
    logger.warn('YouTube not configured — skipping upload')
    return null
  }

  try {
    const auth = await getAuthClient()
    const youtube = google.youtube({ version: 'v3', auth })

    // Add #Shorts to title if it's a Short
    const videoTitle = isShort && !title.includes('#Shorts') ? `${title} #Shorts` : title

    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: videoTitle,
          description: `${description}\n\n${config.edpayu.website}`,
          tags: [...tags, 'EdPayU', 'school management', 'India', 'education'],
          categoryId: '27', // Education
          defaultLanguage: 'en',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    })

    logger.info(`YouTube video uploaded: ${res.data.id}`, { title: videoTitle })
    return {
      id: res.data.id,
      url: `https://youtube.com/watch?v=${res.data.id}`,
      title: videoTitle,
    }
  } catch (err) {
    logger.error('YouTube upload failed:', { error: err.response?.data?.error || err.message })
    return null
  }
}

/**
 * Upload a YouTube Short from a script (generates placeholder — needs video file)
 */
export async function postShort({ script, title, description, tags = [] }) {
  if (!isConfigured()) {
    logger.warn('YouTube not configured — skipping Short')
    return null
  }

  // For now, save the script for manual video creation
  // Full automation requires a video generation API (HeyGen, RunwayML)
  const filename = `short-${Date.now()}.json`
  const filepath = path.join('content', 'social', filename)
  const shortData = { title, script, description, tags, createdAt: new Date().toISOString() }

  fs.writeFileSync(filepath, JSON.stringify(shortData, null, 2))
  logger.info(`YouTube Short script saved: ${filepath}`, { title })

  return { filepath, ...shortData }
}

export default { uploadVideo, postShort, isConfigured }
