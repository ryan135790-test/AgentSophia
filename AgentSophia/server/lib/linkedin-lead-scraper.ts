import type { Page } from 'puppeteer-core';
import { db } from './db-service';

async function logScrapingActivity(
  workspaceId: string,
  action: string,
  details: string,
  status: 'success' | 'pending' | 'in_progress' | 'error',
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await db.addSophiaActivityLog({
      id: `linkedin_scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaign_id: `linkedin_scraping_${workspaceId}`,
      action,
      details,
      status,
      metadata: { ...metadata, channel: 'linkedin', type: 'scraping' }
    });
  } catch (error) {
    console.error('[LinkedIn Scraper] Failed to log activity:', error);
  }
}

export interface ScrapedLead {
  profileUrl: string;
  name: string;
  headline?: string;
  company?: string;
  location?: string;
  connectionDegree?: string;
  mutualConnections?: number;
  profileImageUrl?: string;
  source: 'group' | 'event' | 'post_likers' | 'post_commenters' | 'search';
  sourceId: string;
  sourceName: string;
  scrapedAt: Date;
}

export interface GroupInfo {
  id: string;
  name: string;
  memberCount: number;
  url: string;
}

export interface EventInfo {
  id: string;
  name: string;
  attendeeCount: number;
  url: string;
  date?: string;
}

export interface PostInfo {
  id: string;
  authorName: string;
  authorUrl: string;
  content: string;
  likeCount: number;
  commentCount: number;
  url: string;
}

const scrapedLeads: Map<string, ScrapedLead[]> = new Map();
const scrapingJobs: Map<string, {
  id: string;
  workspaceId: string;
  type: 'group' | 'event' | 'post_likers' | 'post_commenters';
  sourceId: string;
  sourceName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalFound: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}> = new Map();

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function scrapeGroupMembers(
  page: Page,
  workspaceId: string,
  groupUrl: string,
  maxMembers: number = 100
): Promise<{ leads: ScrapedLead[]; jobId: string }> {
  const jobId = `job_group_${Date.now()}`;
  
  const groupIdMatch = groupUrl.match(/groups\/(\d+)/);
  const groupId = groupIdMatch?.[1] || 'unknown';

  scrapingJobs.set(jobId, {
    id: jobId,
    workspaceId,
    type: 'group',
    sourceId: groupId,
    sourceName: '',
    status: 'running',
    progress: 0,
    totalFound: 0,
    startedAt: new Date(),
  });

  await logScrapingActivity(
    workspaceId,
    'LinkedIn Group Scrape Started',
    `Starting to scrape members from LinkedIn group (max ${maxMembers} members)`,
    'in_progress',
    { jobId, groupUrl, maxMembers }
  );

  const leads: ScrapedLead[] = [];

  try {
    await page.goto(`${groupUrl}/members/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    const groupName = await page.evaluate(() => {
      const nameEl = document.querySelector('h1.group-title, .t-24');
      return nameEl?.textContent?.trim() || 'Unknown Group';
    });

    const job = scrapingJobs.get(jobId)!;
    job.sourceName = groupName;

    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;

    while (leads.length < maxMembers && scrollAttempts < maxScrollAttempts) {
      const memberCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('.group-members-list__member, [data-member-id]');
        return Array.from(cards).map(card => {
          const linkEl = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
          const nameEl = card.querySelector('.artdeco-entity-lockup__title, .actor-name');
          const headlineEl = card.querySelector('.artdeco-entity-lockup__subtitle, .actor-headline');
          const imgEl = card.querySelector('img[src*="profile"]') as HTMLImageElement;

          return {
            profileUrl: linkEl?.href || '',
            name: nameEl?.textContent?.trim() || '',
            headline: headlineEl?.textContent?.trim() || '',
            profileImageUrl: imgEl?.src || '',
          };
        }).filter(m => m.profileUrl && m.name);
      });

      for (const member of memberCards) {
        if (leads.length >= maxMembers) break;
        if (leads.some(l => l.profileUrl === member.profileUrl)) continue;

        leads.push({
          ...member,
          source: 'group',
          sourceId: groupId,
          sourceName: groupName,
          scrapedAt: new Date(),
        });
      }

      job.progress = Math.min(100, (leads.length / maxMembers) * 100);
      job.totalFound = leads.length;

      await page.evaluate(() => window.scrollBy(0, 800));
      await randomDelay(1500, 3000);

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
        previousHeight = currentHeight;
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.totalFound = leads.length;
    job.progress = 100;

    const workspaceLeads = scrapedLeads.get(workspaceId) || [];
    workspaceLeads.push(...leads);
    scrapedLeads.set(workspaceId, workspaceLeads);

    await logScrapingActivity(
      workspaceId,
      'LinkedIn Group Scrape Completed',
      `Successfully scraped ${leads.length} members from LinkedIn group "${job.sourceName}"`,
      'success',
      { jobId, leadsFound: leads.length, sourceName: job.sourceName }
    );

    return { leads, jobId };
  } catch (error: any) {
    const job = scrapingJobs.get(jobId)!;
    job.status = 'failed';
    job.error = error.message;

    await logScrapingActivity(
      workspaceId,
      'LinkedIn Group Scrape Failed',
      `Failed to scrape LinkedIn group: ${error.message}`,
      'error',
      { jobId, error: error.message }
    );

    throw error;
  }
}

export async function scrapeEventAttendees(
  page: Page,
  workspaceId: string,
  eventUrl: string,
  maxAttendees: number = 100
): Promise<{ leads: ScrapedLead[]; jobId: string }> {
  const jobId = `job_event_${Date.now()}`;
  
  const eventIdMatch = eventUrl.match(/events\/(\d+)/);
  const eventId = eventIdMatch?.[1] || 'unknown';

  scrapingJobs.set(jobId, {
    id: jobId,
    workspaceId,
    type: 'event',
    sourceId: eventId,
    sourceName: '',
    status: 'running',
    progress: 0,
    totalFound: 0,
    startedAt: new Date(),
  });

  await logScrapingActivity(
    workspaceId,
    'LinkedIn Event Scrape Started',
    `Starting to scrape attendees from LinkedIn event (max ${maxAttendees} attendees)`,
    'in_progress',
    { jobId, eventUrl, maxAttendees }
  );

  const leads: ScrapedLead[] = [];

  try {
    await page.goto(`${eventUrl}/attendees/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    const eventName = await page.evaluate(() => {
      const nameEl = document.querySelector('h1.event-title, .t-24');
      return nameEl?.textContent?.trim() || 'Unknown Event';
    });

    const job = scrapingJobs.get(jobId)!;
    job.sourceName = eventName;

    let previousHeight = 0;
    let scrollAttempts = 0;

    while (leads.length < maxAttendees && scrollAttempts < 20) {
      const attendeeCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('.event-attendee-card, [data-attendee-id], .reusable-search__result-container');
        return Array.from(cards).map(card => {
          const linkEl = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
          const nameEl = card.querySelector('.artdeco-entity-lockup__title, .actor-name, .entity-result__title-text a');
          const headlineEl = card.querySelector('.artdeco-entity-lockup__subtitle, .entity-result__primary-subtitle');
          const locationEl = card.querySelector('.entity-result__secondary-subtitle');
          const imgEl = card.querySelector('img[src*="profile"]') as HTMLImageElement;

          return {
            profileUrl: linkEl?.href || '',
            name: nameEl?.textContent?.trim() || '',
            headline: headlineEl?.textContent?.trim() || '',
            location: locationEl?.textContent?.trim() || '',
            profileImageUrl: imgEl?.src || '',
          };
        }).filter(a => a.profileUrl && a.name);
      });

      for (const attendee of attendeeCards) {
        if (leads.length >= maxAttendees) break;
        if (leads.some(l => l.profileUrl === attendee.profileUrl)) continue;

        leads.push({
          ...attendee,
          source: 'event',
          sourceId: eventId,
          sourceName: eventName,
          scrapedAt: new Date(),
        });
      }

      job.progress = Math.min(100, (leads.length / maxAttendees) * 100);
      job.totalFound = leads.length;

      await page.evaluate(() => window.scrollBy(0, 800));
      await randomDelay(1500, 3000);

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
        previousHeight = currentHeight;
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.totalFound = leads.length;
    job.progress = 100;

    const workspaceLeads = scrapedLeads.get(workspaceId) || [];
    workspaceLeads.push(...leads);
    scrapedLeads.set(workspaceId, workspaceLeads);

    await logScrapingActivity(
      workspaceId,
      'LinkedIn Event Scrape Completed',
      `Successfully scraped ${leads.length} attendees from LinkedIn event "${job.sourceName}"`,
      'success',
      { jobId, leadsFound: leads.length, sourceName: job.sourceName }
    );

    return { leads, jobId };
  } catch (error: any) {
    const job = scrapingJobs.get(jobId)!;
    job.status = 'failed';
    job.error = error.message;

    await logScrapingActivity(
      workspaceId,
      'LinkedIn Event Scrape Failed',
      `Failed to scrape LinkedIn event attendees: ${error.message}`,
      'error',
      { jobId, error: error.message }
    );

    throw error;
  }
}

export async function scrapePostEngagers(
  page: Page,
  workspaceId: string,
  postUrl: string,
  type: 'likers' | 'commenters',
  maxEngagers: number = 100
): Promise<{ leads: ScrapedLead[]; jobId: string }> {
  const jobId = `job_post_${type}_${Date.now()}`;
  
  const postIdMatch = postUrl.match(/activity-(\d+)|urn:li:activity:(\d+)/);
  const postId = postIdMatch?.[1] || postIdMatch?.[2] || 'unknown';

  scrapingJobs.set(jobId, {
    id: jobId,
    workspaceId,
    type: type === 'likers' ? 'post_likers' : 'post_commenters',
    sourceId: postId,
    sourceName: '',
    status: 'running',
    progress: 0,
    totalFound: 0,
    startedAt: new Date(),
  });

  await logScrapingActivity(
    workspaceId,
    `LinkedIn Post ${type === 'likers' ? 'Likers' : 'Commenters'} Scrape Started`,
    `Starting to scrape ${type} from LinkedIn post (max ${maxEngagers} engagers)`,
    'in_progress',
    { jobId, postUrl, maxEngagers, type }
  );

  const leads: ScrapedLead[] = [];

  try {
    await page.goto(postUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    const job = scrapingJobs.get(jobId)!;
    job.sourceName = `Post ${postId}`;

    if (type === 'likers') {
      const reactionsButton = await page.$('button[aria-label*="reaction"], .social-details-social-counts__reactions');
      if (reactionsButton) {
        await reactionsButton.click();
        await randomDelay(2000, 3000);
        await page.waitForSelector('.artdeco-modal, [role="dialog"]', { timeout: 10000 });
      }

      let scrollAttempts = 0;
      while (leads.length < maxEngagers && scrollAttempts < 20) {
        const likerCards = await page.evaluate(() => {
          const cards = document.querySelectorAll('.artdeco-modal .artdeco-list__item, [data-entity-hovercard-id]');
          return Array.from(cards).map(card => {
            const linkEl = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
            const nameEl = card.querySelector('.artdeco-entity-lockup__title, .text-view-model');
            const headlineEl = card.querySelector('.artdeco-entity-lockup__subtitle');
            const imgEl = card.querySelector('img[src*="profile"]') as HTMLImageElement;

            return {
              profileUrl: linkEl?.href || '',
              name: nameEl?.textContent?.trim() || '',
              headline: headlineEl?.textContent?.trim() || '',
              profileImageUrl: imgEl?.src || '',
            };
          }).filter(l => l.profileUrl && l.name);
        });

        for (const liker of likerCards) {
          if (leads.length >= maxEngagers) break;
          if (leads.some(l => l.profileUrl === liker.profileUrl)) continue;

          leads.push({
            ...liker,
            source: 'post_likers',
            sourceId: postId,
            sourceName: `Post ${postId}`,
            scrapedAt: new Date(),
          });
        }

        job.progress = Math.min(100, (leads.length / maxEngagers) * 100);
        job.totalFound = leads.length;

        const modal = await page.$('.artdeco-modal__content, [role="dialog"] .overflow-y-auto');
        if (modal) {
          await page.evaluate(el => el?.scrollBy(0, 400), modal);
        }
        await randomDelay(1500, 2500);
        scrollAttempts++;
      }
    } else {
      let scrollAttempts = 0;
      while (leads.length < maxEngagers && scrollAttempts < 20) {
        const commenterCards = await page.evaluate(() => {
          const comments = document.querySelectorAll('.comments-comment-item, [data-id*="comment"]');
          return Array.from(comments).map(comment => {
            const linkEl = comment.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
            const nameEl = comment.querySelector('.comments-post-meta__name-text, .artdeco-entity-lockup__title');
            const headlineEl = comment.querySelector('.comments-post-meta__headline');
            const imgEl = comment.querySelector('img[src*="profile"]') as HTMLImageElement;

            return {
              profileUrl: linkEl?.href || '',
              name: nameEl?.textContent?.trim() || '',
              headline: headlineEl?.textContent?.trim() || '',
              profileImageUrl: imgEl?.src || '',
            };
          }).filter(c => c.profileUrl && c.name);
        });

        for (const commenter of commenterCards) {
          if (leads.length >= maxEngagers) break;
          if (leads.some(l => l.profileUrl === commenter.profileUrl)) continue;

          leads.push({
            ...commenter,
            source: 'post_commenters',
            sourceId: postId,
            sourceName: `Post ${postId}`,
            scrapedAt: new Date(),
          });
        }

        job.progress = Math.min(100, (leads.length / maxEngagers) * 100);
        job.totalFound = leads.length;

        const loadMoreButton = await page.$('button[aria-label*="more comments"], .comments-comments-list__load-more-comments-button');
        if (loadMoreButton) {
          await loadMoreButton.click();
          await randomDelay(2000, 3000);
        }

        await page.evaluate(() => window.scrollBy(0, 500));
        await randomDelay(1500, 2500);
        scrollAttempts++;
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.totalFound = leads.length;
    job.progress = 100;

    const workspaceLeads = scrapedLeads.get(workspaceId) || [];
    workspaceLeads.push(...leads);
    scrapedLeads.set(workspaceId, workspaceLeads);

    await logScrapingActivity(
      workspaceId,
      `LinkedIn Post ${type === 'likers' ? 'Likers' : 'Commenters'} Scrape Completed`,
      `Successfully scraped ${leads.length} ${type} from LinkedIn post`,
      'success',
      { jobId, leadsFound: leads.length, type }
    );

    return { leads, jobId };
  } catch (error: any) {
    const job = scrapingJobs.get(jobId)!;
    job.status = 'failed';
    job.error = error.message;

    await logScrapingActivity(
      workspaceId,
      `LinkedIn Post ${type === 'likers' ? 'Likers' : 'Commenters'} Scrape Failed`,
      `Failed to scrape LinkedIn post ${type}: ${error.message}`,
      'error',
      { jobId, error: error.message, type }
    );

    throw error;
  }
}

export function getScrapedLeads(
  workspaceId: string,
  filters?: {
    source?: 'group' | 'event' | 'post_likers' | 'post_commenters';
    sourceId?: string;
    dateFrom?: Date;
  }
): ScrapedLead[] {
  let leads = scrapedLeads.get(workspaceId) || [];

  if (filters?.source) {
    leads = leads.filter(l => l.source === filters.source);
  }
  if (filters?.sourceId) {
    leads = leads.filter(l => l.sourceId === filters.sourceId);
  }
  if (filters?.dateFrom) {
    leads = leads.filter(l => l.scrapedAt >= filters.dateFrom!);
  }

  return leads;
}

export function getScrapingJob(jobId: string) {
  return scrapingJobs.get(jobId);
}

export function getScrapingJobs(workspaceId: string) {
  return Array.from(scrapingJobs.values())
    .filter(job => job.workspaceId === workspaceId)
    .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
}

export function exportLeadsToCSV(leads: ScrapedLead[]): string {
  const headers = ['Name', 'Profile URL', 'Headline', 'Company', 'Location', 'Source', 'Source Name', 'Scraped At'];
  const rows = leads.map(l => [
    l.name,
    l.profileUrl,
    l.headline || '',
    l.company || '',
    l.location || '',
    l.source,
    l.sourceName,
    l.scrapedAt.toISOString(),
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}

export const LinkedInLeadScraper = {
  scrapeGroupMembers,
  scrapeEventAttendees,
  scrapePostEngagers,
  getLeads: getScrapedLeads,
  getJob: getScrapingJob,
  getJobs: getScrapingJobs,
  exportCSV: exportLeadsToCSV,
};
