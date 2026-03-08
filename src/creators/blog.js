import fs from 'fs/promises'
import path from 'path'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'
import { generateText, parseJSON } from '../utils/ai.js'

/**
 * Generate an SEO-optimized blog post
 */
export async function generateBlogPost({ keyword, title, language = 'en', wordCount = 1500 }) {
  logger.info(`Generating blog post for keyword: "${keyword}"`, { language })

  const langInstructions = language === 'hi'
    ? 'Write the blog post in Hindi (Devanagari script). Include some English terms where they are commonly used in India (like "software", "app", "ERP", "dashboard").'
    : 'Write in English. Use simple language that Indian school administrators and principals can easily understand.'

  const prompt = `You are an expert SEO content writer for the Indian education technology market.

Product: ${config.edpayu.brand} — ${config.edpayu.tagline}
Website: ${config.edpayu.website}
Target keyword: "${keyword}"
${title ? `Suggested title: "${title}"` : ''}

Write a ${wordCount}-word SEO-optimized blog post. ${langInstructions}

Requirements:
1. **Title**: Compelling, includes target keyword, under 60 characters
2. **Meta description**: 150-160 characters, includes keyword, has a call-to-action
3. **Structure**: Use H2 and H3 headings with keywords naturally integrated
4. **Opening**: Hook the reader in the first 2 sentences, mention the problem
5. **Body**: Provide actionable advice, real examples from Indian schools, statistics if possible
6. **CTA**: Natural mention of EdPayU as a solution (not too salesy, max 2 mentions)
7. **Internal linking**: Suggest 2-3 places to link to EdPayU pages
8. **FAQ section**: Include 3-4 questions (these can appear as featured snippets in Google)
9. **Conclusion**: Summary + clear CTA

SEO best practices:
- Keyword density: 1-2% (natural usage, no stuffing)
- Include LSI keywords (related terms)
- Use short paragraphs (2-3 sentences max)
- Include bullet points and numbered lists
- Mention Indian cities, boards (CBSE, ICSE), and NEP 2020 where relevant

Return a JSON object with:
{
  "title": "...",
  "metaDescription": "...",
  "slug": "url-friendly-slug",
  "keywords": ["primary", "secondary", "..."],
  "content": "Full markdown blog post content",
  "faqSchema": [{"question": "...", "answer": "..."}],
  "suggestedInternalLinks": [{"anchor": "text", "url": "/page"}],
  "estimatedReadTime": "X min"
}

Return ONLY valid JSON.`

  try {
    const text = await generateText(prompt)
    const post = parseJSON(text)

    // Save to file
    const filename = `${new Date().toISOString().split('T')[0]}-${post.slug || 'post'}.json`
    const filepath = path.join('content', 'blogs', filename)
    await fs.writeFile(filepath, JSON.stringify(post, null, 2))

    logger.info(`Blog post generated: "${post.title}"`, { slug: post.slug, file: filepath })
    return { ...post, filepath }
  } catch (err) {
    logger.error('Failed to generate blog post:', { error: err.message })
    return null
  }
}

/**
 * Generate multiple blog posts from keyword list
 */
export async function generateBlogBatch(keywords, language = 'en') {
  const posts = []
  for (const keyword of keywords) {
    const post = await generateBlogPost({ keyword, language })
    if (post) posts.push(post)
    await new Promise(r => setTimeout(r, 2000))
  }
  logger.info(`Generated ${posts.length}/${keywords.length} blog posts`)
  return posts
}

/**
 * Improve an existing blog post for better SEO
 */
export async function improveBlogPost({ content, keyword, currentPosition }) {
  const prompt = `You are an SEO expert. This blog post currently ranks at position ${currentPosition} on Google India for the keyword "${keyword}".

Analyze and improve it to rank in the top 5.

Current content:
---
${content.substring(0, 6000)}
---

Return a JSON object:
{
  "improvements": ["list of specific changes made"],
  "improvedContent": "full improved markdown content",
  "newMetaDescription": "improved meta description",
  "addedFAQs": [{"question": "...", "answer": "..."}],
  "addedSections": ["new sections/headings added"],
  "removedWeaknesses": ["issues fixed"]
}

Focus on:
- Better keyword placement (title, first 100 words, headings)
- More comprehensive coverage than competing pages
- Add FAQ schema questions for featured snippets
- Improve readability for Indian audience
- Add statistics or data points about Indian education

Return ONLY valid JSON.`

  try {
    const text = await generateText(prompt)
    return parseJSON(text)
  } catch (err) {
    logger.error('Failed to parse improved post:', { error: err.message })
    return null
  }
}

export default { generateBlogPost, generateBlogBatch, improveBlogPost }
