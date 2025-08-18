import OpenAI from 'openai';
import { TEST_PROMPTS } from '../prompts/test';

// Map of subreddit prompts with type safety
export const SUBREDDIT_PROMPTS: Record<string, { full: string; cliffhanger: string }> = {
  ...TEST_PROMPTS,
  // Add other subreddit prompts here
};

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  return new OpenAI({ apiKey });
}

type StoryPrompt = {
  subreddit: string;
  isCliffhanger: boolean;
  narratorGender: 'male' | 'female';
};

export type SubredditStory = {
  title: string;
  story: string;
  subreddit: string;
  author: string;
  startingQuestion?: string;
};

export async function generateStory({ subreddit, isCliffhanger, narratorGender }: StoryPrompt): Promise<SubredditStory> {
  console.log('Generating story with params:', JSON.stringify({ subreddit, isCliffhanger, narratorGender }, null, 2));
  
  const promptTemplate = SUBREDDIT_PROMPTS[subreddit]?.[isCliffhanger ? 'cliffhanger' : 'full'];
  console.log('Found prompt template:', promptTemplate ? 'yes' : 'no');
  console.log('Available subreddits:', Object.keys(SUBREDDIT_PROMPTS));
  
  if (!promptTemplate) {
    console.error('No prompt template found for:', { subreddit, isCliffhanger, availableSubreddits: Object.keys(SUBREDDIT_PROMPTS) });
    throw new Error(`No prompt template found for subreddit: ${subreddit}`);
  }

  try {
    console.log(`Generating ${isCliffhanger ? 'cliffhanger' : 'full'} story for ${subreddit}`);
    console.log('Using prompt template:', promptTemplate);
    
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a creative writer who specializes in generating engaging Reddit stories. Follow the prompt exactly as given, including all formatting requirements. Write in a style that would be natural for a ${narratorGender} narrator to tell.${
            isCliffhanger ? '\n\nIMPORTANT: This is a cliffhanger story. You MUST include a [BREAK] tag at a suspenseful moment, roughly 1-2 minutes into the story when read aloud.' : ''
          }`,
        },
        {
          role: 'user',
          content: promptTemplate,
        },
      ],
      temperature: 0.9,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      console.error('No response from OpenAI');
      throw new Error('No response from OpenAI');
    }

    console.log('Received story response:', response);

    // Parse the response into our expected format
    const lines = response.split('\n').filter(line => line.trim() !== '');
    console.log('Parsed lines:', JSON.stringify(lines, null, 2));
    
    const story: Partial<SubredditStory> = {
      subreddit, // Always include the subreddit
      author: 'Anonymous', // Default author
    };

    // Extract title and story directly using regex
    const titleMatch = response.match(/Title:\s*(.+?)(?:\n|$)/);
    const storyMatch = response.match(/Story:\s*(.+?)(?:\n|$)/);

    if (!titleMatch || !storyMatch) {
      console.error('Failed to parse story format:', response);
      throw new Error('Story is missing required fields (title or story content)');
    }

    story.title = titleMatch[1].trim();
    story.story = storyMatch[1].trim();

    console.log('Parsed story before validation:', JSON.stringify(story, null, 2));

    // Validate the story format
    if (!story.title || !story.story) {
      console.error('Invalid story format:', JSON.stringify(story, null, 2));
      throw new Error('Story is missing required fields (title or story content)');
    }

    // Validate title word count for test subreddit
    if (subreddit === 'r/test') {
      const titleWords = story.title.split(/\s+/).length;
      // For story word count, exclude the [BREAK] tag from counting
      const storyWithoutBreak = story.story.replace(/\[BREAK\]/g, '').trim();
      const storyWords = storyWithoutBreak.split(/\s+/).filter(word => word.length > 0).length;
      
      if (titleWords > 6) {
        console.error('Invalid test story format - title must be 6 words or less:', story.title);
        throw new Error('Test story title must be 6 words or less');
      }
      
      if (storyWords > 15) {
        console.error('Invalid test story format - story must be 15 words or less:', story.story);
        throw new Error('Test story must be 15 words or less');
      }
    }

    // Some subreddits require starting questions
    if (subreddit === 'r/ProRevenge' && !story.startingQuestion) {
      console.error('ProRevenge story missing starting question:', JSON.stringify(story, null, 2));
      throw new Error('ProRevenge story must include a starting question');
    }

    // Ensure story has proper structure for cliffhangers
    if (isCliffhanger && !(story.story as string).includes('[BREAK]')) {
      console.log('Cliffhanger story missing [BREAK] tag, regenerating...');
      return generateStory({ subreddit, isCliffhanger, narratorGender });
    }

    console.log('Successfully generated and validated story:', JSON.stringify(story, null, 2));
    return story as SubredditStory;
  } catch (error) {
    console.error('Failed to generate story:', error);
    throw error;
  }
} 