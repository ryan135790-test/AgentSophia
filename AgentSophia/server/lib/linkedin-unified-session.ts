/**
 * LinkedIn Unified Session Manager
 * Manages browser sessions with toggleable visibility for live campaign viewing
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import { generateConsistentFingerprint, applyFingerprint } from './linkedin-anti-fingerprint';
import { decryptToken } from './encryption';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-130.0.6723.91/bin/chromium';

export interface SessionEvent {
  timestamp: Date;
  type: 'action' | 'navigation' | 'status' | 'error';
  message: string;
  details?: any;
}

export interface UnifiedSession {
  id: string;
  browser: Browser;
  page: Page;
  userId: string;
  workspaceId: string;
  campaignId?: string;
  isVisible: boolean;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentAction: string;
  events: SessionEvent[];
  startTime: Date;
  lastActivity: Date;
  observerLock?: string;
}

interface SessionOptions {
  userId: string;
  workspaceId: string;
  campaignId?: string;
  visible?: boolean;
  cookies?: string;
  observerId?: string;
}

const sessions: Map<string, UnifiedSession> = new Map();
let activeVisibleSession: UnifiedSession | null = null;

function getSessionKey(userId: string, workspaceId: string, campaignId?: string): string {
  return campaignId ? `${userId}:${workspaceId}:${campaignId}` : `${userId}:${workspaceId}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function createUnifiedSession(options: SessionOptions): Promise<UnifiedSession> {
  const { userId, workspaceId, campaignId, visible = false, cookies, observerId } = options;
  const sessionKey = getSessionKey(userId, workspaceId, campaignId);

  if (visible && activeVisibleSession && activeVisibleSession.id !== sessionKey) {
    throw new Error('Another visible session is already running. Only one visible session allowed at a time.');
  }

  const existingSession = sessions.get(sessionKey);
  if (existingSession) {
    if (visible && !existingSession.isVisible) {
      await closeUnifiedSession(sessionKey);
    } else {
      existingSession.lastActivity = new Date();
      return existingSession;
    }
  }

  console.log(`[Unified Session] Creating ${visible ? 'VISIBLE' : 'headless'} session for ${sessionKey}`);

  const fingerprint = generateConsistentFingerprint(userId);

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--window-size=1280,800',
  ];

  if (visible) {
    args.push('--start-maximized', '--display=:0');
  }

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: !visible,
    args,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  await applyFingerprint(page, fingerprint);

  if (cookies) {
    try {
      const decrypted = decryptToken(cookies);
      const parsedCookies = JSON.parse(decrypted);
      await page.setCookie(...parsedCookies);
      console.log(`[Unified Session] Applied ${parsedCookies.length} cookies`);
    } catch (error) {
      console.error('[Unified Session] Failed to apply cookies:', error);
    }
  }

  const session: UnifiedSession = {
    id: sessionKey,
    browser,
    page,
    userId,
    workspaceId,
    campaignId,
    isVisible: visible,
    status: 'idle',
    currentAction: visible ? 'Session started - visible in VNC/Desktop' : 'Session started',
    events: [{
      timestamp: new Date(),
      type: 'status',
      message: `Session created (${visible ? 'visible' : 'headless'})`
    }],
    startTime: new Date(),
    lastActivity: new Date(),
    observerLock: observerId
  };

  sessions.set(sessionKey, session);

  if (visible) {
    activeVisibleSession = session;
  }

  return session;
}

export async function closeUnifiedSession(sessionKey: string): Promise<void> {
  const session = sessions.get(sessionKey);
  if (session) {
    try {
      await session.browser.close();
    } catch {}
    sessions.delete(sessionKey);
    if (activeVisibleSession?.id === sessionKey) {
      activeVisibleSession = null;
    }
    console.log(`[Unified Session] Closed session ${sessionKey}`);
  }
}

export function getSession(sessionKey: string): UnifiedSession | undefined {
  return sessions.get(sessionKey);
}

export function getActiveVisibleSession(): UnifiedSession | null {
  return activeVisibleSession;
}

export function getAllSessions(): UnifiedSession[] {
  return Array.from(sessions.values());
}

export function addSessionEvent(sessionKey: string, event: Omit<SessionEvent, 'timestamp'>): void {
  const session = sessions.get(sessionKey);
  if (session) {
    session.events.push({ ...event, timestamp: new Date() });
    session.currentAction = event.message;
    session.lastActivity = new Date();
    if (session.events.length > 100) {
      session.events = session.events.slice(-100);
    }
  }
}

export function updateSessionStatus(sessionKey: string, status: UnifiedSession['status'], action?: string): void {
  const session = sessions.get(sessionKey);
  if (session) {
    session.status = status;
    if (action) session.currentAction = action;
    session.lastActivity = new Date();
  }
}

export async function humanTypeInSession(session: UnifiedSession, selector: string, text: string): Promise<void> {
  const { page } = session;
  addSessionEvent(session.id, { type: 'action', message: `Typing into ${selector}...` });

  await page.waitForSelector(selector, { timeout: 10000 });
  await page.focus(selector);
  await sleep(randomDelay(100, 300));

  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(randomDelay(30, 150));
  }

  addSessionEvent(session.id, { type: 'action', message: `Typed ${text.length} characters` });
}

export async function humanClickInSession(session: UnifiedSession, selector: string): Promise<void> {
  const { page } = session;
  addSessionEvent(session.id, { type: 'action', message: `Clicking ${selector}...` });

  await page.waitForSelector(selector, { timeout: 10000 });
  
  const element = await page.$(selector);
  if (element) {
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + box.width / 2 + randomDelay(-5, 5);
      const y = box.y + box.height / 2 + randomDelay(-5, 5);
      await page.mouse.move(x, y, { steps: randomDelay(10, 25) });
      await sleep(randomDelay(50, 150));
    }
  }

  await page.click(selector);
  addSessionEvent(session.id, { type: 'action', message: `Clicked ${selector}` });
}

export async function navigateInSession(session: UnifiedSession, url: string): Promise<void> {
  const { page } = session;
  addSessionEvent(session.id, { type: 'navigation', message: `Navigating to ${url}...` });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(randomDelay(1000, 2000));

  addSessionEvent(session.id, { type: 'navigation', message: `Loaded ${url}` });
}

export async function scrollInSession(session: UnifiedSession, amount: number = 300): Promise<void> {
  const { page } = session;
  addSessionEvent(session.id, { type: 'action', message: 'Scrolling page...' });

  await page.evaluate((scrollAmount) => {
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }, amount);

  await sleep(randomDelay(500, 1500));
}

export async function takeScreenshotInSession(session: UnifiedSession): Promise<Buffer | null> {
  try {
    const screenshot = await session.page.screenshot({ type: 'png' });
    addSessionEvent(session.id, { type: 'action', message: 'Screenshot captured' });
    return screenshot as Buffer;
  } catch (error) {
    return null;
  }
}

export function getSessionStatus(sessionKey: string): {
  active: boolean;
  visible: boolean;
  status: string;
  currentAction: string;
  duration: number;
  events: SessionEvent[];
} | null {
  const session = sessions.get(sessionKey);
  if (!session) return null;

  return {
    active: true,
    visible: session.isVisible,
    status: session.status,
    currentAction: session.currentAction,
    duration: Date.now() - session.startTime.getTime(),
    events: session.events.slice(-20)
  };
}

export async function promoteToVisible(sessionKey: string, observerId: string): Promise<boolean> {
  const session = sessions.get(sessionKey);
  if (!session) return false;

  if (activeVisibleSession && activeVisibleSession.id !== sessionKey) {
    throw new Error('Another visible session is active. Close it first.');
  }

  if (session.isVisible) {
    session.observerLock = observerId;
    return true;
  }

  const cookies = await session.page.cookies();
  await closeUnifiedSession(sessionKey);

  const newSession = await createUnifiedSession({
    userId: session.userId,
    workspaceId: session.workspaceId,
    campaignId: session.campaignId,
    visible: true,
    observerId
  });

  if (cookies.length > 0) {
    await newSession.page.setCookie(...cookies);
  }

  return true;
}

export function releaseObserverLock(sessionKey: string, observerId: string): void {
  const session = sessions.get(sessionKey);
  if (session && session.observerLock === observerId) {
    session.observerLock = undefined;
  }
}
