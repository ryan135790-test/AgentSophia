import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { insertScheduledSocialPostSchema, insertRecurringSocialScheduleSchema, insertConnectedSocialAccountSchema } from '../shared/schema';

const router = Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let anthropic: Anthropic | null = null;
if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
  anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!,
  });
}

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

// ============================================
// RECURRING SOCIAL SCHEDULES
// ============================================

router.get('/recurring-schedules', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    const { data, error } = await supabase
      .from('recurring_social_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/recurring-schedules', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const validated = insertRecurringSocialScheduleSchema.parse(req.body);
    
    const { data, error } = await supabase
      .from('recurring_social_schedules')
      .insert({
        ...validated,
        user_id: user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    if (validated.auto_generate && data) {
      await generateUpcomingPosts(data.id, user.id, validated);
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.patch('/recurring-schedules/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('recurring_social_schedules')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.delete('/recurring-schedules/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    
    await supabase
      .from('scheduled_social_posts')
      .delete()
      .eq('recurring_schedule_id', id)
      .eq('user_id', user.id)
      .in('status', ['pending_generation', 'pending_approval']);
    
    const { error } = await supabase
      .from('recurring_social_schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

// ============================================
// SCHEDULED POSTS
// ============================================

router.get('/scheduled-posts', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { status, start_date, end_date } = req.query;
    
    let query = supabase
      .from('scheduled_social_posts')
      .select('*, recurring_social_schedules(name, platforms)')
      .eq('user_id', user.id)
      .order('scheduled_date', { ascending: true });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (start_date) {
      query = query.gte('scheduled_date', start_date);
    }
    
    if (end_date) {
      query = query.lte('scheduled_date', end_date);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.get('/scheduled-posts/pending-approval', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .select('*, recurring_social_schedules(name, platforms)')
      .eq('user_id', user.id)
      .eq('status', 'pending_approval')
      .order('scheduled_date', { ascending: true });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/scheduled-posts', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const validated = insertScheduledSocialPostSchema.parse(req.body);
    
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .insert({
        ...validated,
        user_id: user.id,
        status: validated.content ? 'pending_approval' : 'pending_generation'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.patch('/scheduled-posts/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/scheduled-posts/:id/approve', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const { notes } = req.body;
    
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .update({
        status: 'approved',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        approval_notes: notes || null
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (data?.recurring_schedule_id) {
      await supabase.rpc('increment_schedule_approvals', { schedule_id: data.recurring_schedule_id });
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/scheduled-posts/:id/reject', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const { notes } = req.body;
    
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .update({
        status: 'rejected',
        approval_status: 'rejected',
        approval_notes: notes || null
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/scheduled-posts/:id/regenerate', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const { feedback } = req.body;
    
    const { data: post, error: fetchError } = await supabase
      .from('scheduled_social_posts')
      .select('*, recurring_social_schedules(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!post) throw new Error('Post not found');
    
    const schedule = post.recurring_social_schedules;
    const newContent = await generatePostContent(
      post.platform,
      schedule?.topic_guidelines || post.ai_generation_prompt || 'engaging professional content',
      schedule?.content_themes || [],
      feedback
    );
    
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .update({
        content: newContent.content,
        hashtags: newContent.hashtags,
        status: 'pending_approval',
        approval_status: 'pending'
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.delete('/scheduled-posts/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    
    const { error } = await supabase
      .from('scheduled_social_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

// ============================================
// AI CONTENT GENERATION
// ============================================

router.post('/generate-post', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { platform, topic, themes, brandVoice, scheduledDate } = req.body;
    
    const content = await generatePostContent(platform, topic, themes || [], undefined, brandVoice);
    
    res.json({
      content: content.content,
      hashtags: content.hashtags,
      platform,
      scheduled_date: scheduledDate
    });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/generate-batch-posts', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { scheduleId, dates } = req.body;
    
    const { data: schedule, error: scheduleError } = await supabase
      .from('recurring_social_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('user_id', user.id)
      .single();
    
    if (scheduleError) throw scheduleError;
    if (!schedule) throw new Error('Schedule not found');
    
    const generatedPosts: any[] = [];
    
    for (const date of dates) {
      for (const platform of schedule.platforms) {
        const content = await generatePostContent(
          platform,
          schedule.topic_guidelines || 'engaging professional content',
          schedule.content_themes || []
        );
        
        const { data: post, error: postError } = await supabase
          .from('scheduled_social_posts')
          .insert({
            user_id: user.id,
            workspace_id: schedule.workspace_id,
            platform,
            content: content.content,
            hashtags: content.hashtags,
            scheduled_date: date,
            scheduled_time: schedule.post_time,
            status: 'pending_approval',
            approval_status: 'pending',
            brand_voice_id: schedule.brand_voice_id,
            recurring_schedule_id: scheduleId
          })
          .select()
          .single();
        
        if (!postError && post) {
          generatedPosts.push(post);
        }
      }
    }
    
    await supabase
      .from('recurring_social_schedules')
      .update({ posts_generated_count: schedule.posts_generated_count + generatedPosts.length })
      .eq('id', scheduleId);
    
    res.json({ success: true, posts: generatedPosts, count: generatedPosts.length });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

// ============================================
// CONNECTED SOCIAL ACCOUNTS (Multi-Account Support)
// ============================================

router.get('/connected-accounts', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { platform } = req.query;
    
    let query = supabase
      .from('connected_social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('platform')
      .order('is_default', { ascending: false });
    
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.post('/connected-accounts', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const validated = insertConnectedSocialAccountSchema.parse(req.body);
    
    // If this is set as default, unset other defaults for this platform
    if (validated.is_default) {
      await supabase
        .from('connected_social_accounts')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('platform', validated.platform);
    }
    
    const { data, error } = await supabase
      .from('connected_social_accounts')
      .insert({
        ...validated,
        user_id: user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.patch('/connected-accounts/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const updates = req.body;
    
    // If setting as default, unset others first
    if (updates.is_default) {
      const { data: account } = await supabase
        .from('connected_social_accounts')
        .select('platform')
        .eq('id', id)
        .single();
      
      if (account) {
        await supabase
          .from('connected_social_accounts')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('platform', account.platform)
          .neq('id', id);
      }
    }
    
    const { data, error } = await supabase
      .from('connected_social_accounts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.delete('/connected-accounts/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    
    const { error } = await supabase
      .from('connected_social_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

// Set default account for a platform
router.post('/connected-accounts/:id/set-default', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    
    // Get the account to find its platform
    const { data: account, error: fetchError } = await supabase
      .from('connected_social_accounts')
      .select('platform')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !account) throw new Error('Account not found');
    
    // Unset all defaults for this platform
    await supabase
      .from('connected_social_accounts')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('platform', account.platform);
    
    // Set this one as default
    const { data, error } = await supabase
      .from('connected_social_accounts')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

// Get accounts grouped by platform for selection UI
router.get('/connected-accounts/by-platform', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    const { data, error } = await supabase
      .from('connected_social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('platform')
      .order('is_default', { ascending: false });
    
    if (error) throw error;
    
    // Group by platform
    const grouped = (data || []).reduce((acc: Record<string, any[]>, account) => {
      if (!acc[account.platform]) {
        acc[account.platform] = [];
      }
      acc[account.platform].push(account);
      return acc;
    }, {});
    
    res.json(grouped);
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function generatePostContent(
  platform: string,
  topic: string,
  themes: string[],
  feedback?: string,
  brandVoice?: string
): Promise<{ content: string; hashtags: string[] }> {
  const platformLimits: Record<string, number> = {
    linkedin: 3000,
    facebook: 5000,
    twitter: 280,
    instagram: 2200,
    tiktok: 2200,
    youtube: 5000
  };
  
  const charLimit = platformLimits[platform] || 2000;
  const themeContext = themes.length > 0 ? `Rotate through these themes: ${themes.join(', ')}` : '';
  const feedbackContext = feedback ? `Previous feedback to address: ${feedback}` : '';
  const voiceContext = brandVoice ? `Brand voice: ${brandVoice}` : 'Professional but approachable tone';
  
  const prompt = `You are Agent Sophia, an expert social media content strategist. Create a compelling ${platform} post.

GUIDELINES:
- Topic/Theme: ${topic}
${themeContext}
${feedbackContext}
- ${voiceContext}
- Character limit: ${charLimit}
- Platform: ${platform}

PLATFORM-SPECIFIC TIPS:
- LinkedIn: Professional insights, industry trends, thought leadership
- Twitter/X: Punchy, conversational, timely
- Facebook: Community-focused, storytelling
- Instagram: Visual-friendly captions, lifestyle focus
- TikTok: Trendy, casual, hook-driven

Return ONLY valid JSON:
{
  "content": "Your post content here (without hashtags in the text)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`;

  try {
    if (anthropic) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const firstBlock = response.content[0];
      const text = firstBlock.type === 'text' ? (firstBlock as { type: 'text'; text: string }).text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024
    });
    
    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return generateFallbackContent(platform, topic);
  } catch (error) {
    console.error('AI generation error:', error);
    return generateFallbackContent(platform, topic);
  }
}

function generateFallbackContent(platform: string, topic: string): { content: string; hashtags: string[] } {
  const templates: Record<string, string[]> = {
    linkedin: [
      `Excited to share insights on ${topic}. What are your thoughts on this trending topic?`,
      `${topic} is transforming how we work. Here's what I've learned recently...`,
      `Key takeaway from my experience with ${topic}: Always stay curious and keep learning.`
    ],
    twitter: [
      `Hot take on ${topic}: It's changing everything. Thoughts?`,
      `${topic} update: The future is here and it's exciting!`,
      `Quick thread on ${topic} - thread coming soon!`
    ],
    facebook: [
      `Just learned something incredible about ${topic}. Had to share with you all!`,
      `${topic} - what's your experience been like? Share in the comments!`,
      `Here's why ${topic} matters more than ever...`
    ],
    instagram: [
      `${topic} vibes today. Double tap if you agree!`,
      `Exploring ${topic} and loving every moment of it.`,
      `${topic} is the mood. What's inspiring you today?`
    ],
    tiktok: [
      `POV: You just discovered ${topic} and can't stop talking about it`,
      `${topic} check! Who else is obsessed?`,
      `Wait for it... ${topic} edition`
    ]
  };
  
  const platformTemplates = templates[platform] || templates.linkedin;
  const content = platformTemplates[Math.floor(Math.random() * platformTemplates.length)];
  
  return {
    content,
    hashtags: [topic.replace(/\s+/g, ''), 'trending', 'growth', platform]
  };
}

async function generateUpcomingPosts(
  scheduleId: string,
  userId: string,
  schedule: any
): Promise<void> {
  const startDate = new Date(schedule.start_date);
  const endDate = schedule.end_date ? new Date(schedule.end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  
  const postsToGenerate: Date[] = [];
  let currentDate = new Date(Math.max(startDate.getTime(), now.getTime()));
  
  while (currentDate <= endDate && postsToGenerate.length < 14) {
    const dayOfWeek = currentDate.getDay();
    const dayOfMonth = currentDate.getDate();
    
    let shouldPost = false;
    
    switch (schedule.recurrence_type) {
      case 'daily':
        shouldPost = true;
        break;
      case 'weekly':
        shouldPost = schedule.recurrence_days.includes(dayOfWeek);
        break;
      case 'biweekly':
        const weeksSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        shouldPost = weeksSinceStart % 2 === 0 && schedule.recurrence_days.includes(dayOfWeek);
        break;
      case 'monthly':
        shouldPost = schedule.recurrence_dates.includes(dayOfMonth);
        break;
      case 'custom':
        shouldPost = schedule.recurrence_days.includes(dayOfWeek);
        break;
    }
    
    if (shouldPost) {
      postsToGenerate.push(new Date(currentDate));
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  for (const date of postsToGenerate) {
    for (const platform of schedule.platforms) {
      try {
        const content = await generatePostContent(
          platform,
          schedule.topic_guidelines || 'engaging professional content',
          schedule.content_themes || []
        );
        
        await supabase
          .from('scheduled_social_posts')
          .insert({
            user_id: userId,
            workspace_id: schedule.workspace_id,
            platform,
            content: content.content,
            hashtags: content.hashtags,
            scheduled_date: date.toISOString().split('T')[0],
            scheduled_time: schedule.post_time,
            status: 'pending_approval',
            approval_status: 'pending',
            brand_voice_id: schedule.brand_voice_id,
            recurring_schedule_id: scheduleId
          });
      } catch (error) {
        console.error('Error generating post:', error);
      }
    }
  }
  
  await supabase
    .from('recurring_social_schedules')
    .update({ posts_generated_count: postsToGenerate.length * schedule.platforms.length })
    .eq('id', scheduleId);
}

export default router;
