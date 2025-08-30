import { SUBREDDIT_PROMPTS } from './openai';
import OpenAI from 'openai';

export type GeneratedStory = {
  title: string;
  content: string;
  metadata: {
    category: string;
    length: 'short' | 'medium' | 'long';
    style: string;
    word_count: number;
    generated_at: string;
  };
};

type GenerateParams = {
  subreddit: string; // expects form like 'r/aita'
  isCliffhanger?: boolean;
  narratorGender?: 'male' | 'female';
};

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  return new OpenAI({ apiKey });
}

export async function generateStructuredStory({ subreddit, isCliffhanger = false, narratorGender = 'male' }: GenerateParams): Promise<GeneratedStory> {
  const sr = subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`;
  const prompt = SUBREDDIT_PROMPTS[sr]?.[isCliffhanger ? 'cliffhanger' : 'full'];
  if (!prompt) {
    throw new Error(`No prompt available for subreddit ${sr}`);
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a creative Reddit storyteller. Follow the prompt EXACTLY, especially formatting. Write in a style natural for a ${narratorGender} narrator.` + (isCliffhanger ? '\n\nIMPORTANT: Include a [BREAK] tag around the 1-2 minute mark, at a suspenseful moment.' : ''),
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 2000,
  });

  const response = completion.choices[0]?.message?.content || '';
  if (!response) throw new Error('OpenAI returned empty content');

  // Primary parse: explicit Title:/Story:
  let title = '';
  let content = '';
  const titleMatch = response.match(/\bTitle:\s*(.*)/i);
  const storyMatch = response.match(/\bStory:\s*([\s\S]*)/i);
  if (titleMatch && storyMatch) {
    title = titleMatch[1].trim();
    content = storyMatch[1].trim();
  } else {
    // Fallback: first non-empty line = title, rest = content
    const lines = response.split(/\r?\n/).filter(l => l.trim().length > 0);
    title = (lines.shift() || '').replace(/^Title:\s*/i, '').trim();
    content = lines.join('\n').replace(/^Story:\s*/i, '').trim();
  }

  // Compute simple metadata
  const wc = content.replace(/\[BREAK\]/g, '').trim().split(/\s+/).filter(Boolean).length;
  const length: 'short' | 'medium' | 'long' = wc < 450 ? 'short' : wc < 800 ? 'medium' : 'long';

  return {
    title,
    content,
    metadata: {
      category: sr,
      length,
      style: sr.replace(/^r\//, ''),
      word_count: wc,
      generated_at: new Date().toISOString(),
    },
  };
}

export function splitStoryIntoBeats(text: string): { beats: string[] } {
  // Use [BREAK] to split if present; otherwise split by paragraph
  if (text.includes('[BREAK]')) {
    const parts = text.split('[BREAK]').map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { beats: parts };
  }
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return { beats: paras.length ? paras : [text.trim()] };
}


