import type { Page } from 'puppeteer-core';

export interface EngagementAction {
  id: string;
  workspaceId: string;
  profileUrl: string;
  actionType: 'like_post' | 'comment_post' | 'endorse_skill' | 'follow_profile';
  targetId?: string;
  content?: string;
  status: 'pending' | 'completed' | 'failed';
  executedAt?: Date;
  error?: string;
}

export interface EngagementSettings {
  workspaceId: string;
  autoLikePosts: boolean;
  autoCommentPosts: boolean;
  autoEndorseSkills: boolean;
  autoFollowProfiles: boolean;
  maxLikesPerDay: number;
  maxCommentsPerDay: number;
  maxEndorsementsPerDay: number;
  maxFollowsPerDay: number;
  commentTemplates: string[];
  onlyEngageWithConnections: boolean;
  targetIndustries: string[];
  targetJobTitles: string[];
}

const engagementSettings: Map<string, EngagementSettings> = new Map();
const engagementActions: Map<string, EngagementAction[]> = new Map();
const dailyEngagementCounts: Map<string, {
  date: string;
  likes: number;
  comments: number;
  endorsements: number;
  follows: number;
}> = new Map();

const DEFAULT_COMMENT_TEMPLATES = [
  "Great insights, {{firstName}}! Thanks for sharing.",
  "Really valuable perspective on this topic. Appreciate the post!",
  "Couldn't agree more. This resonates with my experience as well.",
  "Thanks for putting this together, {{firstName}}. Very helpful!",
  "Excellent point! Looking forward to more content like this.",
];

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function getRandomComment(templates: string[], firstName?: string): string {
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace('{{firstName}}', firstName || 'there');
}

export function getEngagementSettings(workspaceId: string): EngagementSettings {
  return engagementSettings.get(workspaceId) || {
    workspaceId,
    autoLikePosts: true,
    autoCommentPosts: false,
    autoEndorseSkills: true,
    autoFollowProfiles: false,
    maxLikesPerDay: 30,
    maxCommentsPerDay: 10,
    maxEndorsementsPerDay: 15,
    maxFollowsPerDay: 20,
    commentTemplates: DEFAULT_COMMENT_TEMPLATES,
    onlyEngageWithConnections: false,
    targetIndustries: [],
    targetJobTitles: [],
  };
}

export function updateEngagementSettings(
  workspaceId: string,
  settings: Partial<EngagementSettings>
): EngagementSettings {
  const current = getEngagementSettings(workspaceId);
  const updated = { ...current, ...settings };
  engagementSettings.set(workspaceId, updated);
  return updated;
}

function getDailyCount(workspaceId: string) {
  const today = new Date().toISOString().split('T')[0];
  const counts = dailyEngagementCounts.get(workspaceId);
  
  if (!counts || counts.date !== today) {
    const newCounts = { date: today, likes: 0, comments: 0, endorsements: 0, follows: 0 };
    dailyEngagementCounts.set(workspaceId, newCounts);
    return newCounts;
  }
  
  return counts;
}

function incrementCount(workspaceId: string, type: 'likes' | 'comments' | 'endorsements' | 'follows') {
  const counts = getDailyCount(workspaceId);
  counts[type]++;
  dailyEngagementCounts.set(workspaceId, counts);
}

export async function likePost(
  page: Page,
  workspaceId: string,
  postUrl: string
): Promise<EngagementAction> {
  const action: EngagementAction = {
    id: `action_like_${Date.now()}`,
    workspaceId,
    profileUrl: postUrl,
    actionType: 'like_post',
    status: 'pending',
  };

  const settings = getEngagementSettings(workspaceId);
  const counts = getDailyCount(workspaceId);

  if (counts.likes >= settings.maxLikesPerDay) {
    action.status = 'failed';
    action.error = 'Daily like limit reached';
    return action;
  }

  try {
    await page.goto(postUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    const likeButton = await page.$('button[aria-label*="Like"], button.react-button__trigger, [data-control-name="like"]');
    
    if (!likeButton) {
      action.status = 'failed';
      action.error = 'Like button not found';
      return action;
    }

    const isAlreadyLiked = await page.evaluate(btn => {
      return btn?.getAttribute('aria-pressed') === 'true' || 
             btn?.classList.contains('react-button--active');
    }, likeButton);

    if (isAlreadyLiked) {
      action.status = 'completed';
      action.executedAt = new Date();
      return action;
    }

    await likeButton.click();
    await randomDelay(1000, 2000);

    incrementCount(workspaceId, 'likes');
    action.status = 'completed';
    action.executedAt = new Date();

    const actions = engagementActions.get(workspaceId) || [];
    actions.push(action);
    engagementActions.set(workspaceId, actions);

    return action;
  } catch (error: any) {
    action.status = 'failed';
    action.error = error.message;
    return action;
  }
}

export async function commentOnPost(
  page: Page,
  workspaceId: string,
  postUrl: string,
  comment?: string,
  authorFirstName?: string
): Promise<EngagementAction> {
  const action: EngagementAction = {
    id: `action_comment_${Date.now()}`,
    workspaceId,
    profileUrl: postUrl,
    actionType: 'comment_post',
    status: 'pending',
  };

  const settings = getEngagementSettings(workspaceId);
  const counts = getDailyCount(workspaceId);

  if (counts.comments >= settings.maxCommentsPerDay) {
    action.status = 'failed';
    action.error = 'Daily comment limit reached';
    return action;
  }

  try {
    await page.goto(postUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    const commentButton = await page.$('button[aria-label*="Comment"], [data-control-name="comment"]');
    if (commentButton) {
      await commentButton.click();
      await randomDelay(1500, 2500);
    }

    const commentBox = await page.$('div[role="textbox"][aria-label*="comment"], .comments-comment-box__form textarea, div.ql-editor');
    
    if (!commentBox) {
      action.status = 'failed';
      action.error = 'Comment box not found';
      return action;
    }

    const commentText = comment || getRandomComment(settings.commentTemplates, authorFirstName);
    action.content = commentText;

    await commentBox.click();
    await randomDelay(500, 1000);

    for (const char of commentText) {
      await page.keyboard.type(char);
      await randomDelay(30, 100);
    }

    await randomDelay(1000, 2000);

    const submitButton = await page.$('button[type="submit"].comments-comment-box__submit-button, button[aria-label*="Post comment"]');
    if (submitButton) {
      await submitButton.click();
    } else {
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
    }

    await randomDelay(2000, 3000);

    incrementCount(workspaceId, 'comments');
    action.status = 'completed';
    action.executedAt = new Date();

    const actions = engagementActions.get(workspaceId) || [];
    actions.push(action);
    engagementActions.set(workspaceId, actions);

    return action;
  } catch (error: any) {
    action.status = 'failed';
    action.error = error.message;
    return action;
  }
}

export async function endorseSkill(
  page: Page,
  workspaceId: string,
  profileUrl: string,
  skillName?: string
): Promise<EngagementAction> {
  const action: EngagementAction = {
    id: `action_endorse_${Date.now()}`,
    workspaceId,
    profileUrl,
    actionType: 'endorse_skill',
    status: 'pending',
    content: skillName,
  };

  const settings = getEngagementSettings(workspaceId);
  const counts = getDailyCount(workspaceId);

  if (counts.endorsements >= settings.maxEndorsementsPerDay) {
    action.status = 'failed';
    action.error = 'Daily endorsement limit reached';
    return action;
  }

  try {
    await page.goto(`${profileUrl.replace(/\/$/, '')}/details/skills/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    let endorseButton;

    if (skillName) {
      const skillSection = await page.$(`[aria-label*="${skillName}"], ::-p-text(${skillName})`);
      if (skillSection) {
        endorseButton = await skillSection.$('button[aria-label*="Endorse"], button:has-text("Endorse")');
      }
    }

    if (!endorseButton) {
      endorseButton = await page.$('button[aria-label*="Endorse"]:not([aria-pressed="true"]), button.pvs-profile-actions__action:has-text("Endorse")');
    }

    if (!endorseButton) {
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await randomDelay(2000, 3000);
      
      const skillsSection = await page.$('#skills');
      if (skillsSection) {
        await skillsSection.scrollIntoView();
        await randomDelay(1000, 2000);
        endorseButton = await page.$('button[aria-label*="Endorse"]:not([aria-pressed="true"])');
      }
    }

    if (!endorseButton) {
      action.status = 'failed';
      action.error = 'No endorseable skills found';
      return action;
    }

    await endorseButton.click();
    await randomDelay(1500, 2500);

    incrementCount(workspaceId, 'endorsements');
    action.status = 'completed';
    action.executedAt = new Date();

    const actions = engagementActions.get(workspaceId) || [];
    actions.push(action);
    engagementActions.set(workspaceId, actions);

    return action;
  } catch (error: any) {
    action.status = 'failed';
    action.error = error.message;
    return action;
  }
}

export async function followProfile(
  page: Page,
  workspaceId: string,
  profileUrl: string
): Promise<EngagementAction> {
  const action: EngagementAction = {
    id: `action_follow_${Date.now()}`,
    workspaceId,
    profileUrl,
    actionType: 'follow_profile',
    status: 'pending',
  };

  const settings = getEngagementSettings(workspaceId);
  const counts = getDailyCount(workspaceId);

  if (counts.follows >= settings.maxFollowsPerDay) {
    action.status = 'failed';
    action.error = 'Daily follow limit reached';
    return action;
  }

  try {
    await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    let followButton = await page.$('button[aria-label*="Follow"], button:has-text("Follow"):not(:has-text("Following"))');

    if (!followButton) {
      const moreButton = await page.$('button[aria-label="More actions"], button.artdeco-dropdown__trigger');
      if (moreButton) {
        await moreButton.click();
        await randomDelay(1000, 1500);
        followButton = await page.$('[data-control-name="follow"], button:has-text("Follow")');
      }
    }

    if (!followButton) {
      action.status = 'failed';
      action.error = 'Follow button not found - may already be following';
      return action;
    }

    await followButton.click();
    await randomDelay(1500, 2500);

    incrementCount(workspaceId, 'follows');
    action.status = 'completed';
    action.executedAt = new Date();

    const actions = engagementActions.get(workspaceId) || [];
    actions.push(action);
    engagementActions.set(workspaceId, actions);

    return action;
  } catch (error: any) {
    action.status = 'failed';
    action.error = error.message;
    return action;
  }
}

export async function engageWithProfile(
  page: Page,
  workspaceId: string,
  profileUrl: string,
  options: {
    likeRecentPosts?: number;
    endorseSkills?: number;
    follow?: boolean;
  }
): Promise<EngagementAction[]> {
  const results: EngagementAction[] = [];
  const settings = getEngagementSettings(workspaceId);

  await page.goto(profileUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await randomDelay(2000, 3000);

  if (options.follow && settings.autoFollowProfiles) {
    const followResult = await followProfile(page, workspaceId, profileUrl);
    results.push(followResult);
    await randomDelay(2000, 4000);
  }

  if (options.endorseSkills && options.endorseSkills > 0 && settings.autoEndorseSkills) {
    for (let i = 0; i < options.endorseSkills; i++) {
      const endorseResult = await endorseSkill(page, workspaceId, profileUrl);
      results.push(endorseResult);
      if (endorseResult.status === 'failed') break;
      await randomDelay(3000, 5000);
    }
  }

  if (options.likeRecentPosts && options.likeRecentPosts > 0 && settings.autoLikePosts) {
    const activityUrl = `${profileUrl.replace(/\/$/, '')}/recent-activity/all/`;
    await page.goto(activityUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 3000);

    const postLinks = await page.evaluate(() => {
      const posts = document.querySelectorAll('a[href*="/feed/update/"], a[data-control-id*="activity"]');
      return Array.from(posts).slice(0, 5).map(p => (p as HTMLAnchorElement).href);
    });

    for (let i = 0; i < Math.min(options.likeRecentPosts, postLinks.length); i++) {
      const likeResult = await likePost(page, workspaceId, postLinks[i]);
      results.push(likeResult);
      if (likeResult.status === 'failed' && likeResult.error?.includes('limit')) break;
      await randomDelay(3000, 6000);
    }
  }

  return results;
}

export function getEngagementActions(
  workspaceId: string,
  filters?: {
    actionType?: EngagementAction['actionType'];
    status?: EngagementAction['status'];
    dateFrom?: Date;
  }
): EngagementAction[] {
  let actions = engagementActions.get(workspaceId) || [];

  if (filters?.actionType) {
    actions = actions.filter(a => a.actionType === filters.actionType);
  }
  if (filters?.status) {
    actions = actions.filter(a => a.status === filters.status);
  }
  if (filters?.dateFrom) {
    actions = actions.filter(a => a.executedAt && a.executedAt >= filters.dateFrom!);
  }

  return actions;
}

export function getEngagementStats(workspaceId: string): {
  today: { likes: number; comments: number; endorsements: number; follows: number };
  limits: { likes: number; comments: number; endorsements: number; follows: number };
  remaining: { likes: number; comments: number; endorsements: number; follows: number };
  totalActions: number;
  successRate: number;
} {
  const settings = getEngagementSettings(workspaceId);
  const counts = getDailyCount(workspaceId);
  const actions = engagementActions.get(workspaceId) || [];

  const successfulActions = actions.filter(a => a.status === 'completed').length;
  const successRate = actions.length > 0 ? (successfulActions / actions.length) * 100 : 100;

  return {
    today: {
      likes: counts.likes,
      comments: counts.comments,
      endorsements: counts.endorsements,
      follows: counts.follows,
    },
    limits: {
      likes: settings.maxLikesPerDay,
      comments: settings.maxCommentsPerDay,
      endorsements: settings.maxEndorsementsPerDay,
      follows: settings.maxFollowsPerDay,
    },
    remaining: {
      likes: Math.max(0, settings.maxLikesPerDay - counts.likes),
      comments: Math.max(0, settings.maxCommentsPerDay - counts.comments),
      endorsements: Math.max(0, settings.maxEndorsementsPerDay - counts.endorsements),
      follows: Math.max(0, settings.maxFollowsPerDay - counts.follows),
    },
    totalActions: actions.length,
    successRate: Math.round(successRate),
  };
}

export const LinkedInEngagementActions = {
  getSettings: getEngagementSettings,
  updateSettings: updateEngagementSettings,
  likePost,
  commentOnPost,
  endorseSkill,
  followProfile,
  engageWithProfile,
  getActions: getEngagementActions,
  getStats: getEngagementStats,
};
