export interface Env {
  QELVION_DB: D1Database;
  HEAVY_TASK_QUEUE: Queue;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_TELEGRAM_IDS?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  XKIRO_API_KEY?: string;
  GROQ_API_KEY?: string;
  POLLINATIONS_API_KEY?: string;
  SEARXNG_BASE_URL?: string;
  SEARXNG_USERNAME?: string;
  SEARXNG_PASSWORD?: string;
  ADMIN_MINI_APP_URL?: string;
}
