import { EventEmitter } from 'events';

const MEMORY_WARNING_THRESHOLD_MB = 400;
const MEMORY_CRITICAL_THRESHOLD_MB = 500;
const MAX_CONCURRENT_BROWSER_SESSIONS = 3;
const PROCESS_TIMEOUT_MS = 300000; // 5 minutes max for any single operation
const HEALTH_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

interface ActiveProcess {
  id: string;
  type: 'browser' | 'job' | 'request';
  startedAt: number;
  timeoutId?: NodeJS.Timeout;
  cleanup?: () => Promise<void>;
}

class ResourceManager extends EventEmitter {
  private activeProcesses: Map<string, ActiveProcess> = new Map();
  private browserSessions: Set<string> = new Set();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    super();
    this.startHealthMonitor();
  }

  private startHealthMonitor(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, HEALTH_CHECK_INTERVAL_MS);

    console.log('[ResourceManager] Health monitor started');
  }

  private checkHealth(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    if (heapUsedMB > MEMORY_CRITICAL_THRESHOLD_MB) {
      console.warn(`[ResourceManager] CRITICAL: Memory usage ${heapUsedMB}MB exceeds ${MEMORY_CRITICAL_THRESHOLD_MB}MB`);
      this.emit('memory-critical', { heapUsedMB, rssMB });
      this.cleanupStaleProcesses();
      
      if (global.gc) {
        console.log('[ResourceManager] Triggering garbage collection');
        global.gc();
      }
    } else if (heapUsedMB > MEMORY_WARNING_THRESHOLD_MB) {
      console.warn(`[ResourceManager] WARNING: Memory usage ${heapUsedMB}MB exceeds ${MEMORY_WARNING_THRESHOLD_MB}MB`);
      this.emit('memory-warning', { heapUsedMB, rssMB });
    }

    const staleProcesses = this.getStaleProcesses();
    if (staleProcesses.length > 0) {
      console.warn(`[ResourceManager] Found ${staleProcesses.length} stale processes, cleaning up...`);
      staleProcesses.forEach(p => this.terminateProcess(p.id, 'stale'));
    }
  }

  private getStaleProcesses(): ActiveProcess[] {
    const now = Date.now();
    return Array.from(this.activeProcesses.values()).filter(
      p => now - p.startedAt > PROCESS_TIMEOUT_MS
    );
  }

  private cleanupStaleProcesses(): void {
    const stale = this.getStaleProcesses();
    stale.forEach(p => this.terminateProcess(p.id, 'memory-pressure'));
  }

  canAcquireBrowserSession(): boolean {
    return this.browserSessions.size < MAX_CONCURRENT_BROWSER_SESSIONS && !this.isShuttingDown;
  }

  acquireBrowserSession(sessionId: string): boolean {
    if (!this.canAcquireBrowserSession()) {
      console.warn(`[ResourceManager] Cannot acquire browser session: limit reached (${this.browserSessions.size}/${MAX_CONCURRENT_BROWSER_SESSIONS})`);
      return false;
    }
    
    this.browserSessions.add(sessionId);
    console.log(`[ResourceManager] Browser session acquired: ${sessionId} (${this.browserSessions.size}/${MAX_CONCURRENT_BROWSER_SESSIONS})`);
    return true;
  }

  releaseBrowserSession(sessionId: string): void {
    this.browserSessions.delete(sessionId);
    console.log(`[ResourceManager] Browser session released: ${sessionId} (${this.browserSessions.size}/${MAX_CONCURRENT_BROWSER_SESSIONS})`);
  }

  registerProcess(
    id: string,
    type: 'browser' | 'job' | 'request',
    cleanup?: () => Promise<void>,
    timeoutMs: number = PROCESS_TIMEOUT_MS
  ): void {
    const timeoutId = setTimeout(() => {
      console.warn(`[ResourceManager] Process ${id} timed out after ${timeoutMs}ms`);
      this.terminateProcess(id, 'timeout');
    }, timeoutMs);

    this.activeProcesses.set(id, {
      id,
      type,
      startedAt: Date.now(),
      timeoutId,
      cleanup,
    });
  }

  unregisterProcess(id: string): void {
    const process = this.activeProcesses.get(id);
    if (process?.timeoutId) {
      clearTimeout(process.timeoutId);
    }
    this.activeProcesses.delete(id);
  }

  async terminateProcess(id: string, reason: string): Promise<void> {
    const process = this.activeProcesses.get(id);
    if (!process) return;

    console.log(`[ResourceManager] Terminating process ${id} (reason: ${reason})`);

    if (process.timeoutId) {
      clearTimeout(process.timeoutId);
    }

    if (process.cleanup) {
      try {
        await Promise.race([
          process.cleanup(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
          )
        ]);
      } catch (error) {
        console.error(`[ResourceManager] Cleanup failed for ${id}:`, error);
      }
    }

    this.activeProcesses.delete(id);

    if (process.type === 'browser') {
      this.browserSessions.delete(id);
    }
  }

  getStatus(): {
    memory: { heapUsedMB: number; rssMB: number };
    activeProcesses: number;
    browserSessions: number;
    maxBrowserSessions: number;
  } {
    const memUsage = process.memoryUsage();
    return {
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      activeProcesses: this.activeProcesses.size,
      browserSessions: this.browserSessions.size,
      maxBrowserSessions: MAX_CONCURRENT_BROWSER_SESSIONS,
    };
  }

  async shutdown(): Promise<void> {
    console.log('[ResourceManager] Shutting down...');
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const processes = Array.from(this.activeProcesses.values());
    await Promise.allSettled(
      processes.map(p => this.terminateProcess(p.id, 'shutdown'))
    );

    console.log('[ResourceManager] Shutdown complete');
  }
}

export const resourceManager = new ResourceManager();

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

export function createSafeInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  name: string
): { start: () => void; stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null;
  let isRunning = false;

  const wrappedCallback = async () => {
    if (isRunning) {
      console.log(`[${name}] Skipping tick - previous execution still running`);
      return;
    }

    isRunning = true;
    const processId = `${name}-${Date.now()}`;

    try {
      resourceManager.registerProcess(processId, 'job', undefined, intervalMs * 2);
      await callback();
    } catch (error) {
      console.error(`[${name}] Error during execution:`, error);
    } finally {
      resourceManager.unregisterProcess(processId);
      isRunning = false;
    }
  };

  return {
    start: () => {
      if (intervalId) return;
      intervalId = setInterval(wrappedCallback, intervalMs);
      console.log(`[${name}] Started with interval ${intervalMs}ms`);
    },
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log(`[${name}] Stopped`);
      }
    },
  };
}

process.on('SIGTERM', () => {
  console.log('[ResourceManager] Received SIGTERM');
  resourceManager.shutdown();
});

process.on('SIGINT', () => {
  console.log('[ResourceManager] Received SIGINT');
  resourceManager.shutdown();
});
