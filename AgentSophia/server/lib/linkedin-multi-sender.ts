import { calculateAdjustedLimits, performSafetyCheck } from './linkedin-safety';
import type { UserLinkedInSettings } from '../../shared/schema';

export interface LinkedInAccount {
  id: string;
  userId: string;
  workspaceId: string;
  linkedinProfileUrl: string;
  displayName: string;
  sessionCookie: string;
  proxyId: string | null;
  isActive: boolean;
  isPrimary: boolean;
  dailyConnectionsSent: number;
  dailyMessagesSent: number;
  hourlyConnectionsSent: number;
  hourlyMessagesSent: number;
  lastActivityAt: Date | null;
  warmupDay: number;
  acceptanceRate: number;
  safetyScore: number;
  createdAt: Date;
}

export interface SendTask {
  id: string;
  campaignId: string;
  prospectId: string;
  prospectLinkedInUrl: string;
  actionType: 'connection_request' | 'message' | 'inmail' | 'profile_view' | 'post_like';
  messageContent?: string;
  connectionNote?: string;
  priority: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  assignedAccountId: string | null;
  scheduledFor: Date | null;
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
}

export interface RotationResult {
  accountId: string;
  accountName: string;
  tasksAssigned: number;
  estimatedCompletionTime: Date;
}

export interface AccountCapacity {
  account: LinkedInAccount;
  remainingConnections: number;
  remainingMessages: number;
  remainingHourlyConnections: number;
  remainingHourlyMessages: number;
  availableSlots: number;
  isAvailable: boolean;
  reason?: string;
}

class LinkedInMultiSenderEngine {
  private accounts: Map<string, LinkedInAccount> = new Map();
  private taskQueue: SendTask[] = [];
  private processedProspects: Set<string> = new Set();
  private accountRotationIndex: number = 0;

  getAccountCapacity(account: LinkedInAccount): AccountCapacity {
    const settings: Partial<UserLinkedInSettings> = {
      user_id: account.userId,
      workspace_id: account.workspaceId,
      daily_connection_limit: 50,
      daily_message_limit: 80,
      connections_sent_today: account.dailyConnectionsSent,
      messages_sent_today: account.dailyMessagesSent,
      hourly_connection_limit: 8,
      hourly_message_limit: 12,
      connections_sent_this_hour: account.hourlyConnectionsSent,
      messages_sent_this_hour: account.hourlyMessagesSent,
      is_warming_up: account.warmupDay < 7,
      warmup_day: account.warmupDay,
      acceptance_rate: account.acceptanceRate,
      total_connections_sent: account.dailyConnectionsSent,
      total_connections_accepted: Math.round(account.dailyConnectionsSent * (account.acceptanceRate / 100)),
      linkedin_account_age_days: 180,
      respect_business_hours: true,
      business_hours_start: 9,
      business_hours_end: 18,
      timezone: 'America/New_York',
      reduce_weekend_activity: true,
      weekend_activity_percent: 30,
    };

    const safetyCheck = performSafetyCheck(settings as UserLinkedInSettings, 'connection');
    const limits = calculateAdjustedLimits(settings as UserLinkedInSettings);
    
    const remainingConnections = Math.max(0, limits.dailyConnections - account.dailyConnectionsSent);
    const remainingMessages = Math.max(0, limits.dailyMessages - account.dailyMessagesSent);
    const remainingHourlyConnections = Math.max(0, limits.hourlyConnections - account.hourlyConnectionsSent);
    const remainingHourlyMessages = Math.max(0, limits.hourlyMessages - account.hourlyMessagesSent);

    return {
      account,
      remainingConnections,
      remainingMessages,
      remainingHourlyConnections,
      remainingHourlyMessages,
      availableSlots: remainingConnections + remainingMessages,
      isAvailable: safetyCheck.canProceed && account.isActive && !!account.sessionCookie,
      reason: safetyCheck.reason,
    };
  }

  getAvailableAccounts(workspaceId: string): AccountCapacity[] {
    const workspaceAccounts = Array.from(this.accounts.values())
      .filter(a => a.workspaceId === workspaceId && a.isActive);
    
    return workspaceAccounts
      .map(account => this.getAccountCapacity(account))
      .filter(cap => cap.isAvailable)
      .sort((a, b) => b.availableSlots - a.availableSlots);
  }

  selectBestAccount(
    workspaceId: string, 
    actionType: 'connection_request' | 'message' | 'inmail',
    prospectUrl: string
  ): LinkedInAccount | null {
    const available = this.getAvailableAccounts(workspaceId);
    
    if (available.length === 0) return null;

    if (actionType === 'connection_request') {
      const withCapacity = available.filter(a => a.remainingHourlyConnections > 0 && a.remainingConnections > 0);
      if (withCapacity.length === 0) return null;
      
      this.accountRotationIndex = (this.accountRotationIndex + 1) % withCapacity.length;
      return withCapacity[this.accountRotationIndex].account;
    }

    if (actionType === 'message') {
      const withCapacity = available.filter(a => a.remainingHourlyMessages > 0 && a.remainingMessages > 0);
      if (withCapacity.length === 0) return null;
      
      this.accountRotationIndex = (this.accountRotationIndex + 1) % withCapacity.length;
      return withCapacity[this.accountRotationIndex].account;
    }

    return available[0]?.account || null;
  }

  distributeTasksAcrossAccounts(
    tasks: SendTask[], 
    workspaceId: string
  ): Map<string, SendTask[]> {
    const distribution: Map<string, SendTask[]> = new Map();
    const availableAccounts = this.getAvailableAccounts(workspaceId);
    
    if (availableAccounts.length === 0) {
      return distribution;
    }

    const accountQueues: Map<string, { capacity: AccountCapacity; tasks: SendTask[] }> = new Map();
    availableAccounts.forEach(cap => {
      accountQueues.set(cap.account.id, { capacity: cap, tasks: [] });
    });

    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

    for (const task of sortedTasks) {
      if (this.processedProspects.has(task.prospectLinkedInUrl)) {
        task.status = 'skipped';
        continue;
      }

      let bestAccount: { id: string; queue: { capacity: AccountCapacity; tasks: SendTask[] } } | null = null;
      let maxCapacity = 0;

      for (const [accountId, queue] of accountQueues) {
        let availableCapacity = 0;
        
        if (task.actionType === 'connection_request') {
          availableCapacity = Math.min(
            queue.capacity.remainingConnections - queue.tasks.filter(t => t.actionType === 'connection_request').length,
            queue.capacity.remainingHourlyConnections
          );
        } else if (task.actionType === 'message' || task.actionType === 'inmail') {
          availableCapacity = Math.min(
            queue.capacity.remainingMessages - queue.tasks.filter(t => t.actionType === 'message' || t.actionType === 'inmail').length,
            queue.capacity.remainingHourlyMessages
          );
        } else {
          availableCapacity = 100;
        }

        if (availableCapacity > maxCapacity) {
          maxCapacity = availableCapacity;
          bestAccount = { id: accountId, queue };
        }
      }

      if (bestAccount && maxCapacity > 0) {
        task.assignedAccountId = bestAccount.id;
        task.status = 'assigned';
        bestAccount.queue.tasks.push(task);
        this.processedProspects.add(task.prospectLinkedInUrl);
      }
    }

    for (const [accountId, queue] of accountQueues) {
      if (queue.tasks.length > 0) {
        distribution.set(accountId, queue.tasks);
      }
    }

    return distribution;
  }

  calculateTotalDailyCapacity(workspaceId: string): {
    totalConnectionCapacity: number;
    totalMessageCapacity: number;
    activeAccounts: number;
    utilizationPercent: number;
  } {
    const accounts = this.getAvailableAccounts(workspaceId);
    
    const totalConnectionCapacity = accounts.reduce((sum, a) => sum + a.remainingConnections, 0);
    const totalMessageCapacity = accounts.reduce((sum, a) => sum + a.remainingMessages, 0);
    
    const maxPossibleConnections = accounts.length * 50;
    const usedConnections = accounts.reduce((sum, a) => sum + a.account.dailyConnectionsSent, 0);
    const utilizationPercent = maxPossibleConnections > 0 
      ? Math.round((usedConnections / maxPossibleConnections) * 100) 
      : 0;

    return {
      totalConnectionCapacity,
      totalMessageCapacity,
      activeAccounts: accounts.length,
      utilizationPercent,
    };
  }

  addAccount(account: LinkedInAccount): void {
    this.accounts.set(account.id, account);
  }

  removeAccount(accountId: string): void {
    this.accounts.delete(accountId);
  }

  updateAccountStats(accountId: string, stats: Partial<LinkedInAccount>): void {
    const account = this.accounts.get(accountId);
    if (account) {
      Object.assign(account, stats);
    }
  }

  resetDailyCounters(): void {
    for (const account of this.accounts.values()) {
      account.dailyConnectionsSent = 0;
      account.dailyMessagesSent = 0;
    }
  }

  resetHourlyCounters(): void {
    for (const account of this.accounts.values()) {
      account.hourlyConnectionsSent = 0;
      account.hourlyMessagesSent = 0;
    }
  }

  clearProcessedProspects(): void {
    this.processedProspects.clear();
  }

  isProspectProcessed(prospectUrl: string): boolean {
    return this.processedProspects.has(prospectUrl);
  }

  markProspectProcessed(prospectUrl: string): void {
    this.processedProspects.add(prospectUrl);
  }

  getRotationStats(workspaceId: string): {
    accounts: Array<{
      id: string;
      name: string;
      connectionsSent: number;
      connectionLimit: number;
      messagesSent: number;
      messageLimit: number;
      acceptanceRate: number;
      safetyScore: number;
      isWarmedUp: boolean;
    }>;
    totalCapacity: ReturnType<typeof this.calculateTotalDailyCapacity>;
  } {
    const workspaceAccounts = Array.from(this.accounts.values())
      .filter(a => a.workspaceId === workspaceId);

    const accounts = workspaceAccounts.map(account => {
      const capacity = this.getAccountCapacity(account);
      return {
        id: account.id,
        name: account.displayName,
        connectionsSent: account.dailyConnectionsSent,
        connectionLimit: capacity.remainingConnections + account.dailyConnectionsSent,
        messagesSent: account.dailyMessagesSent,
        messageLimit: capacity.remainingMessages + account.dailyMessagesSent,
        acceptanceRate: account.acceptanceRate,
        safetyScore: account.safetyScore,
        isWarmedUp: account.warmupDay >= 7,
      };
    });

    return {
      accounts,
      totalCapacity: this.calculateTotalDailyCapacity(workspaceId),
    };
  }
}

export const linkedInMultiSenderEngine = new LinkedInMultiSenderEngine();
