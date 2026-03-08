import axios from 'axios'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

const { token, phoneNumberId } = config.social.whatsapp
const GRAPH_API = 'https://graph.facebook.com/v19.0'

function isConfigured() {
  return token && phoneNumberId
}

/**
 * Send a WhatsApp Business message (template or text)
 */
export async function sendMessage({ to, text, templateName = null }) {
  if (!isConfigured()) {
    logger.warn('WhatsApp Business not configured — skipping message')
    return null
  }

  try {
    let body
    if (templateName) {
      // Template message (pre-approved by Meta)
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: 'en' } },
      }
    } else {
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }
    }

    const res = await axios.post(`${GRAPH_API}/${phoneNumberId}/messages`, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    logger.info(`WhatsApp message sent to ${to}`)
    return res.data
  } catch (err) {
    logger.error('WhatsApp send failed:', { error: err.response?.data?.error || err.message })
    return null
  }
}

/**
 * Send broadcast to multiple numbers
 */
export async function sendBroadcast({ numbers, text, templateName = null }) {
  if (!isConfigured()) return []
  const results = []

  for (const to of numbers) {
    const result = await sendMessage({ to, text, templateName })
    results.push({ to, success: !!result })
    await new Promise(r => setTimeout(r, 500)) // rate limit
  }

  const sent = results.filter(r => r.success).length
  logger.info(`WhatsApp broadcast: ${sent}/${numbers.length} sent`)
  return results
}

export default { sendMessage, sendBroadcast, isConfigured }
