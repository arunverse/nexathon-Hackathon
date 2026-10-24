// Perplexity integration is not used in the frontend. If/when added, it MUST
// go through a Supabase Edge Function proxy (like the Gemini proxy) so the API
// key never reaches the browser bundle. Do NOT expose a VITE_PERPLEXITY_API_KEY.
export const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai'
