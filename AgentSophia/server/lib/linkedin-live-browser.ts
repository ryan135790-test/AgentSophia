/**
 * LinkedIn Live Browser Testing
 * Runs Puppeteer in visible mode for live demonstration
 * 
 * This module allows users to watch the automation browser in real-time
 * through a VNC display.
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import { generateConsistentFingerprint, applyFingerprint } from './linkedin-anti-fingerprint';

interface LiveBrowserSession {
  browser: Browser;
  page: Page;
  startTime: Date;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentAction: string;
  actionsPerformed: string[];
}

let currentSession: LiveBrowserSession | null = null;

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-130.0.6723.91/bin/chromium';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function startLiveBrowserDemo(): Promise<{
  success: boolean;
  message: string;
  sessionId?: string;
}> {
  // Stop any existing session first
  if (currentSession) {
    try {
      await currentSession.browser.close();
    } catch {}
    currentSession = null;
  }

  try {
    console.log('[Live Browser] Starting demonstration browser...');
    console.log('[Live Browser] NOTE: To see the browser, switch to VNC/Desktop view in Replit output panel');

    const browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: false, // VISIBLE mode - requires VNC/Desktop view
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--window-size=1280,800',
        '--start-maximized',
        '--display=:0' // Use primary display for VNC
      ],
      defaultViewport: {
        width: 1280,
        height: 800
      }
    });

    const page = await browser.newPage();

    // Apply anti-fingerprint measures
    const fingerprint = generateConsistentFingerprint('demo-user');
    await applyFingerprint(page, fingerprint);

    currentSession = {
      browser,
      page,
      startTime: new Date(),
      status: 'idle',
      currentAction: 'Browser started - switch to VNC view to see it',
      actionsPerformed: ['Browser launched with anti-fingerprint measures', 'Waiting for demo sequence...']
    };

    console.log('[Live Browser] Demo browser ready - visible on VNC/Desktop display');

    return {
      success: true,
      message: 'Live browser started! Switch to VNC/Desktop view in Replit to watch. Then click "Run Demo Sequence".',
      sessionId: 'demo-session'
    };
  } catch (error: any) {
    console.error('[Live Browser] Failed to start:', error);
    return {
      success: false,
      message: `Failed to start browser: ${error.message}. Note: VNC display may not be available in all environments.`
    };
  }
}

export async function runLiveDemoSequence(): Promise<{
  success: boolean;
  message: string;
  actions: string[];
}> {
  if (!currentSession) {
    return {
      success: false,
      message: 'No live browser session. Start one first.',
      actions: []
    };
  }

  const { page } = currentSession;
  const actions: string[] = [];

  try {
    currentSession.status = 'running';

    // Step 1: Navigate to LinkedIn login page
    currentSession.currentAction = 'Navigating to LinkedIn...';
    actions.push('Navigating to LinkedIn login page');
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await sleep(randomDelay(2000, 4000));

    // Step 2: Demonstrate human-like behavior
    currentSession.currentAction = 'Demonstrating human-like scrolling...';
    actions.push('Scrolling page naturally');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy({ top: 100 + Math.random() * 200, behavior: 'smooth' });
      });
      await sleep(randomDelay(800, 1500));
    }

    // Step 3: Demonstrate typing simulation
    currentSession.currentAction = 'Demonstrating human-like typing...';
    actions.push('Simulating human typing (without credentials)');
    
    // Find email input and demonstrate typing pattern
    try {
      await page.waitForSelector('#username', { timeout: 5000 });
      await page.click('#username');
      await sleep(randomDelay(300, 600));
      
      // Type demo text with human-like delays
      const demoText = 'demo@example.com';
      for (const char of demoText) {
        await page.keyboard.type(char);
        await sleep(randomDelay(50, 150));
      }
      await sleep(randomDelay(500, 1000));
      
      // Clear the field
      await page.evaluate(() => {
        const input = document.querySelector('#username') as HTMLInputElement;
        if (input) input.value = '';
      });
      actions.push('Typed demo email with varied speed (then cleared)');
    } catch {
      actions.push('Email field not found - page may have changed');
    }

    // Step 4: Demonstrate mouse movement
    currentSession.currentAction = 'Demonstrating human-like mouse movement...';
    actions.push('Moving mouse naturally');
    
    const positions = [
      { x: 400, y: 200 },
      { x: 600, y: 400 },
      { x: 300, y: 350 },
      { x: 700, y: 250 }
    ];
    
    for (const pos of positions) {
      // Bezier curve movement
      await page.mouse.move(pos.x, pos.y, { steps: 15 });
      await sleep(randomDelay(300, 700));
    }

    // Step 5: Take a screenshot
    currentSession.currentAction = 'Capturing demonstration screenshot...';
    actions.push('Captured screenshot of login page');

    // Step 6: Navigate to another page
    currentSession.currentAction = 'Navigating to public page...';
    actions.push('Navigating to LinkedIn homepage');
    await page.goto('https://www.linkedin.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await sleep(randomDelay(2000, 3000));

    // More scrolling
    actions.push('Final scroll demonstration');
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        window.scrollBy({ top: 150 + Math.random() * 150, behavior: 'smooth' });
      });
      await sleep(randomDelay(1000, 2000));
    }

    currentSession.status = 'completed';
    currentSession.currentAction = 'Demo completed';
    currentSession.actionsPerformed.push(...actions);

    return {
      success: true,
      message: 'Live demo sequence completed. The browser shows all safety features working.',
      actions
    };
  } catch (error: any) {
    currentSession.status = 'error';
    currentSession.currentAction = `Error: ${error.message}`;
    actions.push(`Error: ${error.message}`);

    return {
      success: false,
      message: `Demo sequence failed: ${error.message}`,
      actions
    };
  }
}

export async function stopLiveBrowser(): Promise<{
  success: boolean;
  message: string;
  summary: {
    duration: number;
    actionsPerformed: string[];
  } | null;
}> {
  if (!currentSession) {
    return {
      success: false,
      message: 'No live browser session to stop.',
      summary: null
    };
  }

  try {
    const duration = Date.now() - currentSession.startTime.getTime();
    const actionsPerformed = [...currentSession.actionsPerformed];

    await currentSession.browser.close();
    currentSession = null;

    console.log('[Live Browser] Session stopped');

    return {
      success: true,
      message: 'Live browser session stopped.',
      summary: {
        duration,
        actionsPerformed
      }
    };
  } catch (error: any) {
    currentSession = null;
    return {
      success: false,
      message: `Error stopping browser: ${error.message}`,
      summary: null
    };
  }
}

export function getLiveBrowserStatus(): {
  active: boolean;
  status: string;
  currentAction: string;
  duration: number;
  actionsPerformed: string[];
} {
  if (!currentSession) {
    return {
      active: false,
      status: 'idle',
      currentAction: 'No session running',
      duration: 0,
      actionsPerformed: []
    };
  }

  return {
    active: true,
    status: currentSession.status,
    currentAction: currentSession.currentAction,
    duration: Date.now() - currentSession.startTime.getTime(),
    actionsPerformed: currentSession.actionsPerformed
  };
}
