import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export function getModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return anthropic('claude-haiku-4-5-20251001');
  }

  if (process.env.GROQ_API_KEY) {
    const groq = createOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    // Use .chat() to force Chat Completions format — Groq doesn't support the newer Responses API
    return groq.chat('llama-3.3-70b-versatile');
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai('gpt-4o-mini');
  }

  throw new Error(
    'No API key found. Set ANTHROPIC_API_KEY, GROQ_API_KEY or OPENAI_API_KEY in .env'
  );
}
