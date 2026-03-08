import fs from 'fs'
import path from 'path'

console.log(`
╔══════════════════════════════════════════════════╗
║          EdPaySEO Agent — Setup Guide            ║
╚══════════════════════════════════════════════════╝

Follow these steps to get the SEO agent running:

━━━ Step 1: Environment Variables ━━━

  cp .env.example .env
  # Edit .env with your API keys

━━━ Step 2: Required API Keys ━━━

  MUST HAVE (agent won't work without these):
  ✅ ANTHROPIC_API_KEY — Get from https://console.anthropic.com
     Cost: ~₹1,200/mo

  RECOMMENDED:
  ✅ REPLICATE_API_TOKEN — Get from https://replicate.com
     Cost: ~₹250/mo for images

  ✅ Google Search Console — Free
     1. Go to https://search.google.com/search-console
     2. Add your site
     3. Create a service account at https://console.cloud.google.com
     4. Download JSON key → save as credentials/google-service-account.json
     5. Add service account email as user in Search Console

  OPTIONAL (add as needed):
  📸 Instagram Business API
     1. Create Facebook Developer App
     2. Connect Instagram Business Account
     3. Get long-lived access token

  🐦 Twitter/X API
     1. Apply at https://developer.twitter.com
     2. Create project → get API keys

  💼 LinkedIn API
     1. Create app at https://www.linkedin.com/developers
     2. Request Marketing Developer Platform access

  📘 Facebook Page API
     1. Same Facebook Developer App as Instagram
     2. Get Page Access Token

  💬 WhatsApp Business API
     1. Meta Business Suite → WhatsApp
     2. Get token from https://developers.facebook.com

  📝 WordPress (for blog auto-publishing)
     1. Go to WP Admin → Users → Application Passwords
     2. Create new application password
     3. Add to .env

━━━ Step 3: Run the Agent ━━━

  # One-time keyword research
  npm run keywords

  # Run SEO audit
  npm run audit

  # Generate content (blog + social posts)
  npm run generate

  # Post to social media
  npm run post

  # Full daily run (analyze + generate + post)
  npm run daily

  # Run as daemon (scheduled daily)
  npm start

━━━ Step 4: Deploy on VM ━━━

  # On your EdPayU VM:
  pm2 start src/agent.js --name edpay-seo --cron-restart="0 6 * * *"
  pm2 save

`)

// Check which services are configured
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  console.log('\n━━━ Current Configuration Status ━━━\n')
  const checks = [
    ['ANTHROPIC_API_KEY', 'Claude API (content generation)'],
    ['REPLICATE_API_TOKEN', 'Replicate (image generation)'],
    ['GOOGLE_SERVICE_ACCOUNT_JSON', 'Google Search Console'],
    ['INSTAGRAM_ACCESS_TOKEN', 'Instagram'],
    ['TWITTER_API_KEY', 'Twitter/X'],
    ['LINKEDIN_ACCESS_TOKEN', 'LinkedIn'],
    ['FACEBOOK_PAGE_ACCESS_TOKEN', 'Facebook'],
    ['WHATSAPP_BUSINESS_TOKEN', 'WhatsApp Business'],
    ['WORDPRESS_URL', 'WordPress CMS'],
  ]

  for (const [key, name] of checks) {
    const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'))
    const configured = match && match[1].trim() && !match[1].includes('xxxxx')
    console.log(`  ${configured ? '✅' : '❌'} ${name}`)
  }
} else {
  console.log('\n⚠️  No .env file found. Run: cp .env.example .env')
}
