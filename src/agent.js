import cron from 'node-cron'
import { config } from './config/index.js'
import logger from './utils/logger.js'
import searchConsole from './analyzers/searchConsole.js'
import keywords from './analyzers/keywords.js'
import siteAudit from './analyzers/siteAudit.js'
import blog from './creators/blog.js'
import social from './creators/social.js'
import images from './creators/images.js'
import twitter from './distributors/twitter.js'
import linkedin from './distributors/linkedin.js'
import instagram from './distributors/instagram.js'
import facebook from './distributors/facebook.js'
import whatsapp from './distributors/whatsapp.js'
import wordpress from './distributors/wordpress.js'

// ─── CLI Args ───────────────────────────────────────────
const args = process.argv.slice(2)
const taskFlag = args.indexOf('--task')
const specificTask = taskFlag !== -1 ? args[taskFlag + 1] : null

// ─── Task Definitions ───────────────────────────────────

/**
 * DAILY TASK: Analyze search performance, find opportunities, generate content
 */
async function dailyRun() {
  logger.info('═══ Daily SEO Agent Run Started ═══')
  const report = { date: new Date().toISOString(), tasks: [] }

  try {
    // 1. Check search performance
    logger.info('Step 1: Analyzing search performance...')
    const summary = await searchConsole.getSummary()
    if (summary) {
      report.searchSummary = summary
      logger.info('Search Summary:', summary)
    }

    // 2. Find dropping keywords → improve those pages
    logger.info('Step 2: Finding dropping keywords...')
    const dropping = await searchConsole.findDroppingKeywords()
    if (dropping.length > 0) {
      logger.info(`Found ${dropping.length} dropping keywords`)
      report.droppingKeywords = dropping
      // TODO: Auto-improve content for dropping pages
    }

    // 3. Find "almost ranking" keywords (position 5-20)
    logger.info('Step 3: Finding almost-ranking keywords...')
    const almostRanking = await searchConsole.findAlmostRankingKeywords()
    if (almostRanking.length > 0) {
      logger.info(`Found ${almostRanking.length} almost-ranking keywords`)
      report.almostRanking = almostRanking.slice(0, 10)
    }

    // 4. Generate a blog post for the top opportunity
    const targetKeyword = almostRanking[0]?.query || config.edpayu.primaryKeywords[
      Math.floor(Math.random() * config.edpayu.primaryKeywords.length)
    ]

    logger.info(`Step 4: Generating blog post for "${targetKeyword}"...`)
    const blogPost = await blog.generateBlogPost({ keyword: targetKeyword })
    if (blogPost) {
      report.tasks.push({ task: 'blog', keyword: targetKeyword, title: blogPost.title })

      // 5. Generate blog image
      logger.info('Step 5: Generating blog image...')
      const blogImage = await images.generateBlogImage(blogPost.title)
      if (blogImage) report.tasks.push({ task: 'blogImage', file: blogImage.filepath })

      // 6. Publish to WordPress (as draft)
      logger.info('Step 6: Publishing to WordPress...')
      const wpPost = await wordpress.publishPost({
        title: blogPost.title,
        content: blogPost.content,
        slug: blogPost.slug,
        metaDescription: blogPost.metaDescription,
        featuredImageUrl: blogImage?.url,
      })
      if (wpPost) report.tasks.push({ task: 'wordpress', postId: wpPost.id, link: wpPost.link })

      // 7. Generate social posts from the blog
      logger.info('Step 7: Generating social media posts...')
      const socialPosts = await social.generateSocialPosts({
        topic: blogPost.title,
        blogContent: blogPost.content,
        keyword: targetKeyword,
      })

      if (socialPosts) {
        // 8. Post to all platforms
        logger.info('Step 8: Distributing to social platforms...')
        await distributeSocialPosts(socialPosts, wpPost?.link)
        report.tasks.push({ task: 'social', platforms: getActivePlatforms() })
      }
    }

    logger.info('═══ Daily Run Complete ═══', { tasks: report.tasks.length })
  } catch (err) {
    logger.error('Daily run failed:', { error: err.message, stack: err.stack })
    report.error = err.message
  }

  return report
}

/**
 * Distribute social posts to all configured platforms
 */
async function distributeSocialPosts(posts, blogUrl) {
  const results = {}

  // Twitter
  if (twitter.isConfigured() && posts.twitter?.posts?.length) {
    for (const post of posts.twitter.posts) {
      if (post.type === 'thread' && post.thread) {
        results.twitter = await twitter.postThread([post.text, ...post.thread])
      } else {
        results.twitter = await twitter.postTweet(post.text)
      }
    }
  }

  // LinkedIn
  if (linkedin.isConfigured() && posts.linkedin?.posts?.length) {
    for (const post of posts.linkedin.posts) {
      results.linkedin = await linkedin.postToLinkedIn({
        text: post.text,
        articleUrl: blogUrl,
      })
    }
  }

  // Instagram
  if (instagram.isConfigured() && posts.instagram?.posts?.length) {
    for (const post of posts.instagram.posts) {
      if (post.imagePrompt) {
        const img = await images.generateSocialImage(post.imagePrompt, 'instagram')
        if (img) {
          if (post.type === 'carousel' && post.carouselSlides) {
            const carouselImgs = await images.generateCarouselImages(post.carouselSlides, post.imagePrompt)
            const urls = carouselImgs.map(i => i.url).filter(Boolean)
            if (urls.length > 0) {
              results.instagram = await instagram.postCarousel({ imageUrls: urls, caption: post.caption })
            }
          } else {
            results.instagram = await instagram.postImage({ imageUrl: img.url, caption: post.caption })
          }
        }
      }
    }
  }

  // Facebook
  if (facebook.isConfigured() && posts.facebook?.posts?.length) {
    for (const post of posts.facebook.posts) {
      results.facebook = await facebook.postToFacebook({
        text: post.text,
        link: blogUrl,
      })
    }
  }

  return results
}

function getActivePlatforms() {
  const platforms = []
  if (twitter.isConfigured()) platforms.push('twitter')
  if (linkedin.isConfigured()) platforms.push('linkedin')
  if (instagram.isConfigured()) platforms.push('instagram')
  if (facebook.isConfigured()) platforms.push('facebook')
  if (whatsapp.isConfigured()) platforms.push('whatsapp')
  if (wordpress.isConfigured()) platforms.push('wordpress')
  return platforms
}

/**
 * ANALYZE: Run SEO analysis only
 */
async function analyze() {
  logger.info('═══ SEO Analysis ═══')

  const [summary, topPages, almostRanking, dropping] = await Promise.all([
    searchConsole.getSummary(),
    searchConsole.getTopPages(),
    searchConsole.findAlmostRankingKeywords(),
    searchConsole.findDroppingKeywords(),
  ])

  const report = { summary, topPages: topPages.slice(0, 10), almostRanking: almostRanking.slice(0, 10), dropping }

  console.log('\n📊 Search Performance Summary:')
  if (summary) {
    console.log(`   Clicks: ${summary.totalClicks} | Impressions: ${summary.totalImpressions}`)
    console.log(`   Avg Position: ${summary.avgPosition} | Avg CTR: ${summary.avgCtr.toFixed(1)}%`)
    console.log(`   Keywords: Top 5: ${summary.keywordsInTop5} | Top 10: ${summary.keywordsInTop10} | Top 20: ${summary.keywordsInTop20}`)
  } else {
    console.log('   Google Search Console not connected yet')
  }

  console.log(`\n🎯 Almost Ranking (position 5-20): ${almostRanking.length} keywords`)
  almostRanking.slice(0, 5).forEach(k => console.log(`   #${k.position} "${k.query}" (${k.impressions} imp)`))

  console.log(`\n📉 Dropping Keywords: ${dropping.length}`)
  dropping.slice(0, 5).forEach(k => console.log(`   "${k.query}" dropped ${k.drop} positions`))

  return report
}

/**
 * GENERATE: Generate content only (no posting)
 */
async function generate() {
  logger.info('═══ Content Generation ═══')

  const keyword = config.edpayu.primaryKeywords[
    Math.floor(Math.random() * config.edpayu.primaryKeywords.length)
  ]

  console.log(`\n✍️  Generating blog post for: "${keyword}"`)
  const blogPost = await blog.generateBlogPost({ keyword })

  if (blogPost) {
    console.log(`   Title: "${blogPost.title}"`)
    console.log(`   Saved: ${blogPost.filepath}`)

    console.log('\n🎨 Generating blog image...')
    const img = await images.generateBlogImage(blogPost.title)
    if (img) console.log(`   Image: ${img.filepath}`)

    console.log('\n📱 Generating social posts...')
    const socialPosts = await social.generateSocialPosts({
      topic: blogPost.title,
      blogContent: blogPost.content,
      keyword,
    })
    if (socialPosts) console.log(`   Saved: ${socialPosts.filepath}`)
  }
}

/**
 * POST: Post pre-generated content to social platforms
 */
async function post() {
  logger.info('═══ Social Distribution ═══')
  const platforms = getActivePlatforms()
  console.log(`\n📡 Active platforms: ${platforms.join(', ') || 'None configured'}`)

  if (!platforms.length) {
    console.log('\n⚠️  No social platforms configured. Add API keys to .env file.')
    console.log('   See .env.example for required keys.')
    return
  }

  // Generate and post a quick update
  const topic = config.edpayu.contentPillars[Math.floor(Math.random() * config.edpayu.contentPillars.length)]
  console.log(`\n📝 Generating posts about: "${topic}"`)

  const posts = await social.generateSocialPosts({ topic })
  if (posts) {
    console.log('📤 Posting to platforms...')
    await distributeSocialPosts(posts)
    console.log('✅ Done!')
  }
}

/**
 * AUDIT: Run technical SEO audit
 */
async function audit() {
  logger.info('═══ Technical SEO Audit ═══')
  const result = await siteAudit.auditSite()

  console.log(`\n🔍 Site Audit Results:`)
  console.log(`   Pages audited: ${result.pagesAudited}`)
  console.log(`   Average score: ${result.averageScore}/100`)
  console.log(`   Critical issues: ${result.critical}`)
  console.log(`   Warnings: ${result.warnings}`)

  if (result.topIssues.length) {
    console.log('\n❌ Critical Issues:')
    result.topIssues.forEach(i => console.log(`   [${i.page}] ${i.issue}`))
  }

  result.pages.forEach(p => {
    if (!p.error) {
      console.log(`\n   📄 ${p.url} — Score: ${p.score}/100`)
      p.issues.forEach(i => console.log(`      ${i.type === 'critical' ? '❌' : i.type === 'warning' ? '⚠️' : 'ℹ️'} ${i.issue}`))
    }
  })

  return result
}

/**
 * KEYWORDS: Run keyword research
 */
async function keywordResearch() {
  logger.info('═══ Keyword Research ═══')
  console.log('\n🔑 Running keyword research (this takes 1-2 minutes)...\n')

  const report = await keywords.generateKeywordReport()

  console.log(`📊 Keyword Research Complete:`)
  console.log(`   Total opportunities: ${report.totalOpportunities}`)

  if (report.competitorGaps?.length) {
    console.log('\n🎯 Competitor Gaps (keywords they rank for, we don\'t):')
    report.competitorGaps.slice(0, 10).forEach(k => console.log(`   - ${k}`))
  }

  if (report.longTailKeywords?.length) {
    console.log('\n🔗 Long-tail Keywords (low competition):')
    report.longTailKeywords.slice(0, 10).forEach(k => console.log(`   - ${k}`))
  }

  if (report.trendingKeywords?.length) {
    console.log('\n📈 Trending in India:')
    report.trendingKeywords.forEach(k => console.log(`   - ${k}`))
  }

  if (report.expandedKeywords?.length) {
    console.log(`\n🔍 Google Autocomplete Ideas: ${report.expandedKeywords.length} keywords`)
    report.expandedKeywords.slice(0, 10).forEach(k => console.log(`   - ${k.keyword}`))
  }

  return report
}

// ─── Main Execution ─────────────────────────────────────

async function main() {
  logger.info(`EdPaySEO Agent v1.0 — ${config.edpayu.brand}`)
  logger.info(`Active platforms: ${getActivePlatforms().join(', ') || 'none'}`)

  if (specificTask) {
    // Run specific task from CLI
    switch (specificTask) {
      case 'daily': return await dailyRun()
      case 'analyze': return await analyze()
      case 'generate': return await generate()
      case 'post': return await post()
      case 'audit': return await audit()
      case 'keywords': return await keywordResearch()
      default:
        console.log(`Unknown task: ${specificTask}`)
        console.log('Available: daily, analyze, generate, post, audit, keywords')
        process.exit(1)
    }
  }

  // No specific task — run as daemon with cron
  const [hour, minute] = config.agent.dailyRunTime.split(':')
  const cronSchedule = `${minute} ${hour} * * *` // Daily at configured time

  console.log(`\n🤖 EdPaySEO Agent running as daemon`)
  console.log(`   Daily run scheduled at: ${config.agent.dailyRunTime} IST`)
  console.log(`   Cron: ${cronSchedule}`)
  console.log(`   Press Ctrl+C to stop\n`)

  // Run daily task on schedule
  cron.schedule(cronSchedule, async () => {
    logger.info('Cron trigger: starting daily run')
    await dailyRun()
  }, { timezone: 'Asia/Kolkata' })

  // Weekly keyword research (every Monday at 5 AM)
  cron.schedule('0 5 * * 1', async () => {
    logger.info('Cron trigger: weekly keyword research')
    await keywordResearch()
  }, { timezone: 'Asia/Kolkata' })

  // Weekly site audit (every Sunday at 4 AM)
  cron.schedule('0 4 * * 0', async () => {
    logger.info('Cron trigger: weekly site audit')
    await audit()
  }, { timezone: 'Asia/Kolkata' })

  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('Agent shutting down...')
    process.exit(0)
  })
}

main().catch(err => {
  logger.error('Agent fatal error:', { error: err.message, stack: err.stack })
  process.exit(1)
})
