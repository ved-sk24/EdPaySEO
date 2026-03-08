import fs from 'fs/promises'
import path from 'path'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'
import { generateText, parseJSON } from '../utils/ai.js'

/**
 * Generate social media posts from a blog post or topic
 */
export async function generateSocialPosts({ topic, blogContent, keyword }) {
  logger.info(`Generating social posts for: "${topic || keyword}"`)

  const context = blogContent
    ? `Based on this blog post:\n---\n${blogContent.substring(0, 3000)}\n---`
    : `Topic: "${topic || keyword}"`

  const prompt = `You are a social media expert for an Indian EdTech brand.

Brand: ${config.edpayu.brand} — ${config.edpayu.tagline}
Website: ${config.edpayu.website}
Target audience: Indian school principals, administrators, teachers, parents

${context}

Generate engaging social media posts for ALL of these platforms. Make them India-specific and relatable.

Return a JSON object:
{
  "twitter": {
    "posts": [
      {
        "text": "Tweet text (max 280 chars). Include 2-3 relevant hashtags.",
        "type": "text"
      },
      {
        "text": "Thread tweet 1/3...",
        "type": "thread",
        "thread": ["Tweet 2/3...", "Tweet 3/3... Link: ${config.edpayu.website}"]
      }
    ]
  },
  "linkedin": {
    "posts": [
      {
        "text": "Professional LinkedIn post (300-600 words). Include relevant hashtags. Use line breaks for readability. Add a hook in the first line.",
        "type": "article"
      }
    ]
  },
  "instagram": {
    "posts": [
      {
        "caption": "Instagram caption with emojis. Include 15-20 hashtags at the end. Max 2200 chars.",
        "type": "carousel",
        "carouselSlides": ["Slide 1 text", "Slide 2 text", "Slide 3 text", "CTA slide"],
        "imagePrompt": "Description of the image to generate for this post"
      }
    ]
  },
  "facebook": {
    "posts": [
      {
        "text": "Facebook post. Conversational tone. Ask a question to drive engagement. Include link.",
        "type": "post"
      }
    ]
  },
  "whatsapp": {
    "posts": [
      {
        "text": "WhatsApp broadcast message. Short, personal, with emoji. Include link. Max 500 chars.",
        "type": "broadcast"
      }
    ]
  },
  "youtubeShorts": {
    "scripts": [
      {
        "title": "Video title (max 100 chars)",
        "script": "30-60 second script for a YouTube Short / Instagram Reel. Include visual directions in [brackets].",
        "description": "YouTube description with keywords",
        "tags": ["tag1", "tag2"]
      }
    ]
  }
}

Make content:
- Relatable to Indian school context
- Mix of Hindi-English (Hinglish) where appropriate
- Educational but not boring
- Include a clear CTA in each post

Return ONLY valid JSON.`

  try {
    const text = await generateText(prompt)
    const posts = parseJSON(text)

    // Save to file
    const filename = `${new Date().toISOString().split('T')[0]}-${(topic || keyword || 'posts').replace(/\s+/g, '-').toLowerCase().substring(0, 40)}.json`
    const filepath = path.join('content', 'social', filename)
    await fs.writeFile(filepath, JSON.stringify(posts, null, 2))

    const totalPosts =
      (posts.twitter?.posts?.length || 0) +
      (posts.linkedin?.posts?.length || 0) +
      (posts.instagram?.posts?.length || 0) +
      (posts.facebook?.posts?.length || 0) +
      (posts.whatsapp?.posts?.length || 0) +
      (posts.youtubeShorts?.scripts?.length || 0)

    logger.info(`Generated ${totalPosts} social posts across all platforms`, { file: filepath })
    return { ...posts, filepath }
  } catch (err) {
    logger.error('Failed to parse social posts:', { error: err.message })
    return null
  }
}

/**
 * Generate a content calendar for the week
 */
export async function generateWeeklyCalendar() {
  const prompt = `You are a social media strategist for ${config.edpayu.brand}, an Indian school management software.

Content pillars: ${config.edpayu.contentPillars.join(', ')}
Target audience: ${config.edpayu.targetAudience.join(', ')}

Create a 7-day social media content calendar starting from tomorrow.

Return a JSON array of 7 objects:
[
  {
    "day": "Monday",
    "date": "YYYY-MM-DD",
    "theme": "Content pillar for the day",
    "blog": { "topic": "Blog post topic if any (2 per week)", "keyword": "target keyword" },
    "posts": [
      {
        "platform": "twitter|linkedin|instagram|facebook",
        "time": "10:00 AM IST",
        "type": "text|carousel|video|poll|article",
        "topic": "Post topic",
        "hook": "First line to grab attention"
      }
    ]
  }
]

Guidelines:
- Post 2-3 times per day across platforms
- Monday/Thursday: Publish blog posts
- Tuesday/Friday: Instagram carousels or reels
- Wednesday: LinkedIn thought leadership
- Saturday: Tips & tricks, weekend engagement
- Sunday: Light content, motivation, weekly roundup
- Best posting times for India: 9-10 AM, 12-1 PM, 6-8 PM IST

Return ONLY valid JSON.`

  try {
    const text = await generateText(prompt)
    const calendar = parseJSON(text)
    logger.info(`Weekly calendar generated: ${calendar.length} days planned`)
    return calendar
  } catch (err) {
    logger.error('Failed to parse content calendar:', { error: err.message })
    return []
  }
}

export default { generateSocialPosts, generateWeeklyCalendar }
