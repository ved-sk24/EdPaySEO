import axios from 'axios'
import { config } from '../config/index.js'
import logger from './logger.js'

/**
 * Unified AI client — uses Gemini (free) by default, falls back to Claude API
 */
export async function generateText(prompt) {
  if (config.aiProvider === 'gemini' && config.gemini.apiKey) {
    return geminiGenerate(prompt)
  }

  if (config.anthropic.apiKey) {
    return claudeGenerate(prompt)
  }

  throw new Error('No AI provider configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in .env')
}

/**
 * Google Gemini — FREE tier (1500 req/day, 15 req/min)
 */
async function geminiGenerate(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`

  try {
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain',
      },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    })

    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty response from Gemini')

    logger.debug('Gemini response received', { chars: text.length })
    return text
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message
    logger.error('Gemini API failed:', { error: errorMsg })

    // Fallback to Claude if Gemini fails and Claude is configured
    if (config.anthropic.apiKey) {
      logger.info('Falling back to Claude API...')
      return claudeGenerate(prompt)
    }

    throw err
  }
}

/**
 * Anthropic Claude — paid API
 */
async function claudeGenerate(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: config.anthropic.apiKey })

  const message = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].text
  logger.debug('Claude response received', { chars: text.length })
  return text
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
export function parseJSON(text) {
  const cleaned = text.trim()
  // Try direct parse
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return JSON.parse(cleaned)
  }
  // Extract from markdown code block
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) return JSON.parse(match[1].trim())
  // Extract JSON object/array
  const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) return JSON.parse(jsonMatch[1])
  throw new Error('No valid JSON found in response')
}

export default { generateText, parseJSON }
