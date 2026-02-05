export interface ProspectOutreachRecord {
  prospectLinkedInUrl: string;
  workspaceId: string;
  accountId: string;
  actionType: 'connection_request' | 'message' | 'inmail' | 'profile_view' | 'post_like';
  campaignId: string;
  sentAt: Date;
  status: 'sent' | 'accepted' | 'replied' | 'declined' | 'no_response';
}

export interface DuplicationCheckResult {
  isDuplicate: boolean;
  existingRecord?: ProspectOutreachRecord;
  reason?: string;
  daysSinceLastContact?: number;
}

export interface DeduplicationConfig {
  preventDuplicateConnections: boolean;
  preventDuplicateMessages: boolean;
  allowRecontactAfterDays: number;
  allowRecontactOnReply: boolean;
  allowRecontactOnAccept: boolean;
  crossCampaignDeduplication: boolean;
  crossAccountDeduplication: boolean;
}

class LinkedInAntiDuplicationEngine {
  private outreachHistory: Map<string, ProspectOutreachRecord[]> = new Map();
  private globalBlacklist: Set<string> = new Set();
  private workspaceBlacklists: Map<string, Set<string>> = new Map();

  private getProspectKey(workspaceId: string, prospectUrl: string): string {
    return `${workspaceId}:${this.normalizeLinkedInUrl(prospectUrl)}`;
  }

  normalizeLinkedInUrl(url: string): string {
    let normalized = url.toLowerCase().trim();
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');
    normalized = normalized.replace(/\/$/, '');
    normalized = normalized.replace(/\/+/g, '/');
    
    const match = normalized.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (match) {
      return `linkedin.com/in/${match[1]}`;
    }
    
    return normalized;
  }

  checkForDuplicate(
    workspaceId: string,
    prospectUrl: string,
    actionType: 'connection_request' | 'message' | 'inmail' | 'profile_view' | 'post_like',
    config: DeduplicationConfig
  ): DuplicationCheckResult {
    const normalizedUrl = this.normalizeLinkedInUrl(prospectUrl);
    
    if (this.globalBlacklist.has(normalizedUrl)) {
      return {
        isDuplicate: true,
        reason: 'Prospect is on global blacklist',
      };
    }

    const workspaceBlacklist = this.workspaceBlacklists.get(workspaceId);
    if (workspaceBlacklist?.has(normalizedUrl)) {
      return {
        isDuplicate: true,
        reason: 'Prospect is on workspace blacklist',
      };
    }

    const key = this.getProspectKey(workspaceId, prospectUrl);
    const records = this.outreachHistory.get(key) || [];

    if (records.length === 0) {
      return { isDuplicate: false };
    }

    const connectionRecords = records.filter(r => r.actionType === 'connection_request');
    const messageRecords = records.filter(r => r.actionType === 'message' || r.actionType === 'inmail');

    if (actionType === 'connection_request' && config.preventDuplicateConnections) {
      const existingConnection = connectionRecords.find(r => 
        r.status === 'sent' || r.status === 'accepted' || r.status === 'declined'
      );
      
      if (existingConnection) {
        const daysSince = Math.floor((Date.now() - existingConnection.sentAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (existingConnection.status === 'accepted') {
          return {
            isDuplicate: true,
            existingRecord: existingConnection,
            reason: 'Already connected with this prospect',
            daysSinceLastContact: daysSince,
          };
        }

        if (existingConnection.status === 'declined') {
          if (daysSince < config.allowRecontactAfterDays) {
            return {
              isDuplicate: true,
              existingRecord: existingConnection,
              reason: `Connection was declined ${daysSince} days ago. Can retry after ${config.allowRecontactAfterDays} days.`,
              daysSinceLastContact: daysSince,
            };
          }
        }

        if (existingConnection.status === 'sent') {
          if (daysSince < 14) {
            return {
              isDuplicate: true,
              existingRecord: existingConnection,
              reason: 'Connection request pending (sent within last 14 days)',
              daysSinceLastContact: daysSince,
            };
          }
        }
      }
    }

    if ((actionType === 'message' || actionType === 'inmail') && config.preventDuplicateMessages) {
      const recentMessage = messageRecords.find(r => {
        const daysSince = Math.floor((Date.now() - r.sentAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince < config.allowRecontactAfterDays;
      });

      if (recentMessage) {
        const daysSince = Math.floor((Date.now() - recentMessage.sentAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (recentMessage.status === 'replied' && config.allowRecontactOnReply) {
          return { isDuplicate: false };
        }

        return {
          isDuplicate: true,
          existingRecord: recentMessage,
          reason: `Message sent ${daysSince} days ago. Can send again after ${config.allowRecontactAfterDays} days.`,
          daysSinceLastContact: daysSince,
        };
      }
    }

    return { isDuplicate: false };
  }

  recordOutreach(record: ProspectOutreachRecord): void {
    const key = this.getProspectKey(record.workspaceId, record.prospectLinkedInUrl);
    const records = this.outreachHistory.get(key) || [];
    records.push({
      ...record,
      prospectLinkedInUrl: this.normalizeLinkedInUrl(record.prospectLinkedInUrl),
    });
    this.outreachHistory.set(key, records);
  }

  updateOutreachStatus(
    workspaceId: string,
    prospectUrl: string,
    campaignId: string,
    newStatus: ProspectOutreachRecord['status']
  ): void {
    const key = this.getProspectKey(workspaceId, prospectUrl);
    const records = this.outreachHistory.get(key);
    
    if (records) {
      const record = records.find(r => r.campaignId === campaignId);
      if (record) {
        record.status = newStatus;
      }
    }
  }

  addToGlobalBlacklist(prospectUrls: string[]): void {
    prospectUrls.forEach(url => {
      this.globalBlacklist.add(this.normalizeLinkedInUrl(url));
    });
  }

  removeFromGlobalBlacklist(prospectUrl: string): void {
    this.globalBlacklist.delete(this.normalizeLinkedInUrl(prospectUrl));
  }

  addToWorkspaceBlacklist(workspaceId: string, prospectUrls: string[]): void {
    if (!this.workspaceBlacklists.has(workspaceId)) {
      this.workspaceBlacklists.set(workspaceId, new Set());
    }
    const blacklist = this.workspaceBlacklists.get(workspaceId)!;
    prospectUrls.forEach(url => {
      blacklist.add(this.normalizeLinkedInUrl(url));
    });
  }

  removeFromWorkspaceBlacklist(workspaceId: string, prospectUrl: string): void {
    const blacklist = this.workspaceBlacklists.get(workspaceId);
    if (blacklist) {
      blacklist.delete(this.normalizeLinkedInUrl(prospectUrl));
    }
  }

  getProspectHistory(workspaceId: string, prospectUrl: string): ProspectOutreachRecord[] {
    const key = this.getProspectKey(workspaceId, prospectUrl);
    return this.outreachHistory.get(key) || [];
  }

  deduplicateProspectList(
    workspaceId: string,
    prospects: Array<{ linkedInUrl: string; [key: string]: any }>,
    config: DeduplicationConfig
  ): {
    unique: typeof prospects;
    duplicates: Array<{ prospect: typeof prospects[0]; reason: string }>;
    stats: {
      total: number;
      unique: number;
      duplicates: number;
      blacklisted: number;
    };
  } {
    const seen = new Set<string>();
    const unique: typeof prospects = [];
    const duplicates: Array<{ prospect: typeof prospects[0]; reason: string }> = [];
    let blacklisted = 0;

    for (const prospect of prospects) {
      const normalizedUrl = this.normalizeLinkedInUrl(prospect.linkedInUrl);
      
      if (seen.has(normalizedUrl)) {
        duplicates.push({ prospect, reason: 'Duplicate in current list' });
        continue;
      }
      seen.add(normalizedUrl);

      const check = this.checkForDuplicate(workspaceId, prospect.linkedInUrl, 'connection_request', config);
      
      if (check.isDuplicate) {
        duplicates.push({ prospect, reason: check.reason || 'Already contacted' });
        if (check.reason?.includes('blacklist')) {
          blacklisted++;
        }
      } else {
        unique.push(prospect);
      }
    }

    return {
      unique,
      duplicates,
      stats: {
        total: prospects.length,
        unique: unique.length,
        duplicates: duplicates.length,
        blacklisted,
      },
    };
  }

  intersectLists(
    list1: Array<{ linkedInUrl: string; [key: string]: any }>,
    list2: Array<{ linkedInUrl: string; [key: string]: any }>
  ): typeof list1 {
    const set2 = new Set(list2.map(p => this.normalizeLinkedInUrl(p.linkedInUrl)));
    return list1.filter(p => set2.has(this.normalizeLinkedInUrl(p.linkedInUrl)));
  }

  combineLists(
    ...lists: Array<Array<{ linkedInUrl: string; [key: string]: any }>>
  ): Array<{ linkedInUrl: string; [key: string]: any }> {
    const seen = new Set<string>();
    const combined: Array<{ linkedInUrl: string; [key: string]: any }> = [];

    for (const list of lists) {
      for (const prospect of list) {
        const normalized = this.normalizeLinkedInUrl(prospect.linkedInUrl);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          combined.push(prospect);
        }
      }
    }

    return combined;
  }

  getStats(workspaceId: string): {
    totalProspectsContacted: number;
    pendingConnections: number;
    acceptedConnections: number;
    declinedConnections: number;
    messagesSent: number;
    replies: number;
    blacklistSize: number;
  } {
    let stats = {
      totalProspectsContacted: 0,
      pendingConnections: 0,
      acceptedConnections: 0,
      declinedConnections: 0,
      messagesSent: 0,
      replies: 0,
      blacklistSize: this.workspaceBlacklists.get(workspaceId)?.size || 0,
    };

    for (const [key, records] of this.outreachHistory) {
      if (key.startsWith(`${workspaceId}:`)) {
        stats.totalProspectsContacted++;
        
        for (const record of records) {
          if (record.actionType === 'connection_request') {
            if (record.status === 'sent') stats.pendingConnections++;
            if (record.status === 'accepted') stats.acceptedConnections++;
            if (record.status === 'declined') stats.declinedConnections++;
          }
          if (record.actionType === 'message' || record.actionType === 'inmail') {
            stats.messagesSent++;
            if (record.status === 'replied') stats.replies++;
          }
        }
      }
    }

    return stats;
  }
}

export const linkedInAntiDuplicationEngine = new LinkedInAntiDuplicationEngine();

export const defaultDeduplicationConfig: DeduplicationConfig = {
  preventDuplicateConnections: true,
  preventDuplicateMessages: true,
  allowRecontactAfterDays: 30,
  allowRecontactOnReply: true,
  allowRecontactOnAccept: true,
  crossCampaignDeduplication: true,
  crossAccountDeduplication: true,
};
