import Replicate from 'replicate'
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

let replicate = null

function getClient() {
  if (!replicate && config.replicate.apiToken) {
    replicate = new Replicate({ auth: config.replicate.apiToken })
  }
  return replicate
}

/**
 * Generate an image using Replicate Flux
 */
export async function generateImage({
  prompt,
  style = 'professional',
  width = 1200,
  height = 630, // OG image / blog header default
  outputFilename,
}) {
  const client = getClient()
  if (!client) {
    logger.warn('Replicate not configured — skipping image generation')
    return null
  }

  // Enhance prompt for consistent brand style
  const brandPrompt = buildBrandPrompt(prompt, style)

  try {
    logger.info(`Generating image: "${prompt.substring(0, 60)}..."`)

    const output = await client.run(config.replicate.model, {
      input: {
        prompt: brandPrompt,
        width,
        height,
        num_outputs: 1,
        guidance_scale: 7.5,
        output_format: 'png',
      },
    })

    // Download the generated image
    const imageUrl = Array.isArray(output) ? output[0] : output
    if (!imageUrl) {
      logger.error('No image URL returned from Replicate')
      return null
    }

    const filename = outputFilename || `${Date.now()}-${style}.png`
    const filepath = path.join('content', 'images', filename)

    const response = await axios.get(imageUrl.toString(), { responseType: 'arraybuffer' })
    await fs.writeFile(filepath, response.data)

    logger.info(`Image saved: ${filepath}`, { size: `${(response.data.length / 1024).toFixed(0)}KB` })

    return {
      filepath,
      url: imageUrl.toString(),
      prompt: brandPrompt,
      size: { width, height },
    }
  } catch (err) {
    logger.error('Image generation failed:', { error: err.message })
    return null
  }
}

function buildBrandPrompt(prompt, style) {
  const styles = {
    professional: 'Clean, modern, professional design. Corporate blue and white color scheme. Minimalist flat illustration style.',
    blog: 'Blog header image. Clean typography-friendly background. Professional education theme. Soft gradients.',
    social: 'Eye-catching social media graphic. Vibrant colors. Bold and modern. Instagram-worthy.',
    infographic: 'Clean infographic style. Data visualization. Professional charts and icons. Blue and teal color palette.',
    carousel: 'Instagram carousel slide. Clean white background with blue accents. Professional text-friendly layout.',
  }

  return `${prompt}. ${styles[style] || styles.professional} Indian education context. No text in the image. High quality, 4K resolution.`
}

/**
 * Generate blog header image from title
 */
export async function generateBlogImage(blogTitle) {
  return generateImage({
    prompt: `Blog header illustration for an article about "${blogTitle}" in Indian school education context. Shows diverse Indian students and teachers in a modern school setting.`,
    style: 'blog',
    width: 1200,
    height: 630,
    outputFilename: `blog-${blogTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 40)}.png`,
  })
}

/**
 * Generate social media image
 */
export async function generateSocialImage(topic, platform = 'instagram') {
  const sizes = {
    instagram: { width: 1080, height: 1080 },
    instagramStory: { width: 1080, height: 1920 },
    facebook: { width: 1200, height: 630 },
    twitter: { width: 1200, height: 675 },
    linkedin: { width: 1200, height: 627 },
    youtube: { width: 1280, height: 720 },
  }

  const size = sizes[platform] || sizes.instagram

  return generateImage({
    prompt: `Social media graphic about "${topic}" for Indian school management. Modern EdTech visual. Diverse Indian school context.`,
    style: 'social',
    ...size,
    outputFilename: `social-${platform}-${Date.now()}.png`,
  })
}

/**
 * Generate multiple images for a carousel post
 */
export async function generateCarouselImages(slides, topic) {
  const images = []
  for (let i = 0; i < Math.min(slides.length, 5); i++) {
    const img = await generateImage({
      prompt: `Instagram carousel slide ${i + 1}: "${slides[i]}". Clean educational infographic style. Indian school context. Modern design.`,
      style: 'carousel',
      width: 1080,
      height: 1080,
      outputFilename: `carousel-${Date.now()}-slide${i + 1}.png`,
    })
    if (img) images.push(img)
    await new Promise(r => setTimeout(r, 2000)) // rate limit
  }
  logger.info(`Generated ${images.length}/${slides.length} carousel images`)
  return images
}

export default { generateImage, generateBlogImage, generateSocialImage, generateCarouselImages }
