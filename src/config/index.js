import dotenv from 'dotenv'
dotenv.config()

export const config = {
  // AI Provider: 'gemini' (free) or 'anthropic' (paid)
  aiProvider: process.env.AI_PROVIDER || 'gemini',

  // Gemini API (FREE — 1500 req/day)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },

  // Claude API (paid fallback)
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
  },

  // Google Search Console
  google: {
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || './credentials/google-service-account.json',
    siteUrl: process.env.SITE_URL || 'https://app.edpayu.com',
  },

  // Replicate (Image Generation)
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN,
    model: 'black-forest-labs/flux-1.1-pro',
  },

  // Social Media
  social: {
    instagram: {
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
      accountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY,
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
    },
    twitter: {
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    },
    linkedin: {
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
      orgId: process.env.LINKEDIN_ORG_ID,
    },
    facebook: {
      pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      pageId: process.env.FACEBOOK_PAGE_ID,
    },
    whatsapp: {
      token: process.env.WHATSAPP_BUSINESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    },
  },

  // Blog/CMS
  cms: {
    type: process.env.EDPAYU_BLOG_CMS || 'wordpress',
    url: process.env.WORDPRESS_URL,
    user: process.env.WORDPRESS_USER,
    appPassword: process.env.WORDPRESS_APP_PASSWORD,
  },

  // Agent settings
  agent: {
    languages: (process.env.CONTENT_LANGUAGE || 'en,hi').split(','),
    region: process.env.TARGET_REGION || 'India',
    dailyRunTime: process.env.DAILY_RUN_TIME || '06:00',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // EdPayU-specific SEO config
  edpayu: {
    brand: 'EdPayU',
    tagline: 'School Management Made Simple',
    website: 'https://edpayu.com',
    appUrl: 'https://app.edpayu.com',
    targetAudience: [
      'School principals in India',
      'School administrators',
      'Education institution owners',
      'CBSE/ICSE school management',
      'School fee management',
      'Indian school ERP buyers',
    ],
    competitors: [
      'Teachmint',
      'Classplus',
      'Vidyalaya',
      'MyClassboard',
      'Fedena',
      'Entab',
      'SchoolAdmin',
    ],
    primaryKeywords: [
      'school management software India',
      'school ERP India',
      'school fee management app',
      'student attendance app India',
      'school administration software',
      'CBSE school management system',
      'ICSE school software',
      'online fee collection school',
      'school exam management app',
      'parent teacher communication app',
      'school homework app India',
      'student progress tracking software',
      'school transport management',
      'school timetable software',
      'digital school management',
    ],
    hindiKeywords: [
      'स्कूल प्रबंधन सॉफ्टवेयर',
      'स्कूल फीस ऐप',
      'विद्यालय प्रबंधन प्रणाली',
      'छात्र उपस्थिति ऐप',
      'ऑनलाइन फीस भुगतान स्कूल',
      'परीक्षा प्रबंधन सॉफ्टवेयर',
      'अभिभावक शिक्षक संवाद ऐप',
      'होमवर्क प्रबंधन ऐप',
    ],
    contentPillars: [
      'School Digital Transformation',
      'Fee Collection & Payment',
      'Student Performance & Analytics',
      'Parent Engagement',
      'Teacher Productivity',
      'School Administration Tips',
      'Indian Education Trends',
      'NEP 2020 Compliance',
    ],
  },
}

export default config
