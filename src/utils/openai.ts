import OpenAI from 'openai';
import { StoryCategory } from './reddit';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Assistant IDs for each subreddit style
const ASSISTANT_IDS = {
  'AmItheAsshole': process.env.OPENAI_AITA_ASSISTANT_ID,
  'TrueOffMyChest': process.env.OPENAI_CONFESSION_ASSISTANT_ID,
  'nosleep': process.env.OPENAI_HORROR_ASSISTANT_ID,
  'ShortScaryStories': process.env.OPENAI_SHORT_HORROR_ASSISTANT_ID,
  'revengestories': process.env.OPENAI_REVENGE_ASSISTANT_ID
};

interface StoryGenerationParams {
  category: StoryCategory;
  style: keyof typeof ASSISTANT_IDS;
  length: 'short' | 'medium' | 'long';
  theme?: string;
  prompt?: string;
}

export async function generateStory({
  category,
  style,
  length,
  theme,
  prompt
}: StoryGenerationParams) {
  try {
    const assistantId = ASSISTANT_IDS[style];
    if (!assistantId) {
      throw new Error(`No assistant configured for style: ${style}`);
    }

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add the user's message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: generatePrompt({ category, length, theme, prompt })
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    // Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === 'failed') {
        throw new Error('Story generation failed');
      }
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (!assistantMessage?.content[0]) {
      throw new Error('No story generated');
    }

    const content = assistantMessage.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected message content type');
    }

    const story = content.text.value;

    // Extract title from the first line
    const [title, ...contentLines] = story.split('\n');
    const contentTrimmed = contentLines.join('\n').trim();

    return {
      title: title.replace(/^Title:\s*/, ''),
      content: contentTrimmed,
      metadata: {
        category,
        style,
        length,
        theme,
        word_count: contentTrimmed.split(/\s+/).length,
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error generating story:', error);
    throw error;
  }
}

function generatePrompt({
  category,
  length,
  theme,
  prompt
}: Omit<StoryGenerationParams, 'style'>) {
  const lengthGuides = {
    short: '300-500 words',
    medium: '500-800 words',
    long: '800-1200 words'
  };

  const basePrompt = `Generate a compelling ${category} story in ${lengthGuides[length]}.
The story should be highly engaging and suitable for short-form video content.
Format the response with a clear title on the first line (prefixed with "Title: ").

Story requirements:
- Hook the audience in the first sentence
- Include natural dialogue and vivid descriptions
- Build tension and maintain engagement throughout
- End with a satisfying conclusion or twist
- Avoid explicit content or excessive violence
${theme ? `- Incorporate the theme: ${theme}` : ''}
${prompt ? `- Additional requirements: ${prompt}` : ''}

Write the story now:`;

  return basePrompt;
}

export async function getAssistantResponse(threadId: string): Promise<string> {
  try {
    // Get messages from the thread
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Find the latest assistant message
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (!assistantMessage?.content[0]) {
      throw new Error('No story generated');
    }

    const content = assistantMessage.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected message content type');
    }

    return content.text.value;
  } catch (error) {
    console.error('Failed to get assistant response:', error);
    throw error;
  }
} 