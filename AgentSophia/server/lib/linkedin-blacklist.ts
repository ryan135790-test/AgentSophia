export interface BlacklistEntry {
  id: string;
  workspaceId: string;
  type: 'profile' | 'company' | 'email_domain' | 'keyword';
  value: string;
  reason?: string;
  addedBy: string;
  addedAt: Date;
  source: 'manual' | 'auto_rejection' | 'unsubscribe' | 'bounce' | 'import';
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingContactId?: string;
  existingCampaignIds?: string[];
  lastContactedAt?: Date;
  reason?: string;
}

export interface DeduplicationConfig {
  workspaceId: string;
  enabled: boolean;
  checkLinkedInUrl: boolean;
  checkEmail: boolean;
  checkName: boolean;
  cooldownDays: number;
  allowMultipleCampaigns: boolean;
  maxCampaignsPerContact: number;
}

const blacklists = new Map<string, BlacklistEntry[]>();
const contactHistory = new Map<string, {
  contactId: string;
  linkedInUrl?: string;
  email?: string;
  firstName: string;
  lastName: string;
  company?: string;
  campaignIds: string[];
  lastContactedAt: Date;
}>();
const deduplicationConfigs = new Map<string, DeduplicationConfig>();
let entryIdCounter = 1;

export function getBlacklist(workspaceId: string): BlacklistEntry[] {
  return blacklists.get(workspaceId) || [];
}

export function addToBlacklist(
  workspaceId: string,
  type: BlacklistEntry['type'],
  value: string,
  addedBy: string,
  reason?: string,
  source: BlacklistEntry['source'] = 'manual'
): BlacklistEntry {
  const entry: BlacklistEntry = {
    id: `bl_${entryIdCounter++}`,
    workspaceId,
    type,
    value: value.toLowerCase().trim(),
    reason,
    addedBy,
    addedAt: new Date(),
    source,
  };

  const list = blacklists.get(workspaceId) || [];
  const exists = list.some(e => e.type === type && e.value === entry.value);
  if (!exists) {
    list.push(entry);
    blacklists.set(workspaceId, list);
  }

  return entry;
}

export function removeFromBlacklist(workspaceId: string, entryId: string): boolean {
  const list = blacklists.get(workspaceId) || [];
  const index = list.findIndex(e => e.id === entryId);
  if (index !== -1) {
    list.splice(index, 1);
    blacklists.set(workspaceId, list);
    return true;
  }
  return false;
}

export function isBlacklisted(
  workspaceId: string,
  profile: {
    linkedInUrl?: string;
    email?: string;
    company?: string;
    headline?: string;
  }
): { blocked: boolean; reason?: string; entry?: BlacklistEntry } {
  const list = blacklists.get(workspaceId) || [];

  for (const entry of list) {
    switch (entry.type) {
      case 'profile':
        if (profile.linkedInUrl?.toLowerCase().includes(entry.value)) {
          return { blocked: true, reason: `LinkedIn profile is blacklisted`, entry };
        }
        break;

      case 'company':
        if (profile.company?.toLowerCase().includes(entry.value)) {
          return { blocked: true, reason: `Company "${profile.company}" is blacklisted`, entry };
        }
        break;

      case 'email_domain':
        if (profile.email?.toLowerCase().endsWith(`@${entry.value}`)) {
          return { blocked: true, reason: `Email domain is blacklisted`, entry };
        }
        break;

      case 'keyword':
        const searchText = `${profile.company || ''} ${profile.headline || ''}`.toLowerCase();
        if (searchText.includes(entry.value)) {
          return { blocked: true, reason: `Contains blacklisted keyword: "${entry.value}"`, entry };
        }
        break;
    }
  }

  return { blocked: false };
}

export function bulkAddToBlacklist(
  workspaceId: string,
  entries: Array<{ type: BlacklistEntry['type']; value: string; reason?: string }>,
  addedBy: string,
  source: BlacklistEntry['source'] = 'import'
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;

  for (const entry of entries) {
    const list = blacklists.get(workspaceId) || [];
    const normalizedValue = entry.value.toLowerCase().trim();
    const exists = list.some(e => e.type === entry.type && e.value === normalizedValue);

    if (exists) {
      skipped++;
    } else {
      addToBlacklist(workspaceId, entry.type, entry.value, addedBy, entry.reason, source);
      added++;
    }
  }

  return { added, skipped };
}

export function getDeduplicationConfig(workspaceId: string): DeduplicationConfig {
  return deduplicationConfigs.get(workspaceId) || {
    workspaceId,
    enabled: true,
    checkLinkedInUrl: true,
    checkEmail: true,
    checkName: false,
    cooldownDays: 30,
    allowMultipleCampaigns: false,
    maxCampaignsPerContact: 1,
  };
}

export function updateDeduplicationConfig(
  config: Partial<DeduplicationConfig> & { workspaceId: string }
): DeduplicationConfig {
  const existing = getDeduplicationConfig(config.workspaceId);
  const updated = { ...existing, ...config };
  deduplicationConfigs.set(config.workspaceId, updated);
  return updated;
}

export function recordContact(
  workspaceId: string,
  contactId: string,
  campaignId: string,
  profile: {
    linkedInUrl?: string;
    email?: string;
    firstName: string;
    lastName: string;
    company?: string;
  }
): void {
  const key = `${workspaceId}:${contactId}`;
  const existing = contactHistory.get(key);

  if (existing) {
    if (!existing.campaignIds.includes(campaignId)) {
      existing.campaignIds.push(campaignId);
    }
    existing.lastContactedAt = new Date();
    contactHistory.set(key, existing);
  } else {
    contactHistory.set(key, {
      contactId,
      linkedInUrl: profile.linkedInUrl,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      company: profile.company,
      campaignIds: [campaignId],
      lastContactedAt: new Date(),
    });
  }
}

export function checkDuplicate(
  workspaceId: string,
  campaignId: string,
  profile: {
    linkedInUrl?: string;
    email?: string;
    firstName: string;
    lastName: string;
    company?: string;
  }
): DeduplicationResult {
  const config = getDeduplicationConfig(workspaceId);

  if (!config.enabled) {
    return { isDuplicate: false };
  }

  for (const [key, contact] of contactHistory.entries()) {
    if (!key.startsWith(`${workspaceId}:`)) continue;

    let isMatch = false;
    let matchReason = '';

    if (config.checkLinkedInUrl && profile.linkedInUrl && contact.linkedInUrl) {
      if (normalizeLinkedInUrl(profile.linkedInUrl) === normalizeLinkedInUrl(contact.linkedInUrl)) {
        isMatch = true;
        matchReason = 'LinkedIn URL match';
      }
    }

    if (!isMatch && config.checkEmail && profile.email && contact.email) {
      if (profile.email.toLowerCase() === contact.email.toLowerCase()) {
        isMatch = true;
        matchReason = 'Email match';
      }
    }

    if (!isMatch && config.checkName) {
      if (
        profile.firstName.toLowerCase() === contact.firstName.toLowerCase() &&
        profile.lastName.toLowerCase() === contact.lastName.toLowerCase() &&
        profile.company?.toLowerCase() === contact.company?.toLowerCase()
      ) {
        isMatch = true;
        matchReason = 'Name + Company match';
      }
    }

    if (isMatch) {
      if (contact.campaignIds.includes(campaignId)) {
        return {
          isDuplicate: true,
          existingContactId: contact.contactId,
          existingCampaignIds: contact.campaignIds,
          lastContactedAt: contact.lastContactedAt,
          reason: `Already in this campaign (${matchReason})`,
        };
      }

      const daysSinceContact = Math.floor(
        (Date.now() - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceContact < config.cooldownDays) {
        return {
          isDuplicate: true,
          existingContactId: contact.contactId,
          existingCampaignIds: contact.campaignIds,
          lastContactedAt: contact.lastContactedAt,
          reason: `Contacted ${daysSinceContact} days ago (cooldown: ${config.cooldownDays} days)`,
        };
      }

      if (!config.allowMultipleCampaigns) {
        return {
          isDuplicate: true,
          existingContactId: contact.contactId,
          existingCampaignIds: contact.campaignIds,
          lastContactedAt: contact.lastContactedAt,
          reason: `Already contacted in campaign(s): ${contact.campaignIds.join(', ')}`,
        };
      }

      if (contact.campaignIds.length >= config.maxCampaignsPerContact) {
        return {
          isDuplicate: true,
          existingContactId: contact.contactId,
          existingCampaignIds: contact.campaignIds,
          lastContactedAt: contact.lastContactedAt,
          reason: `Max campaigns (${config.maxCampaignsPerContact}) reached`,
        };
      }
    }
  }

  return { isDuplicate: false };
}

function normalizeLinkedInUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')
    .replace(/\/$/, '')
    .split('/')[0];
}

export function getBlacklistStats(workspaceId: string): {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  recentlyAdded: number;
} {
  const list = getBlacklist(workspaceId);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let recentlyAdded = 0;

  for (const entry of list) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    if (entry.addedAt > weekAgo) recentlyAdded++;
  }

  return {
    total: list.length,
    byType,
    bySource,
    recentlyAdded,
  };
}

export function getContactHistoryStats(workspaceId: string): {
  totalContacts: number;
  contactsInMultipleCampaigns: number;
  contactedThisWeek: number;
  contactedThisMonth: number;
} {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let total = 0;
  let multiple = 0;
  let week = 0;
  let month = 0;

  for (const [key, contact] of contactHistory.entries()) {
    if (!key.startsWith(`${workspaceId}:`)) continue;

    total++;
    if (contact.campaignIds.length > 1) multiple++;
    if (contact.lastContactedAt > weekAgo) week++;
    if (contact.lastContactedAt > monthAgo) month++;
  }

  return {
    totalContacts: total,
    contactsInMultipleCampaigns: multiple,
    contactedThisWeek: week,
    contactedThisMonth: month,
  };
}

export function searchBlacklist(
  workspaceId: string,
  query: string,
  type?: BlacklistEntry['type']
): BlacklistEntry[] {
  const list = getBlacklist(workspaceId);
  const lowerQuery = query.toLowerCase();

  return list.filter(entry => {
    if (type && entry.type !== type) return false;
    return entry.value.includes(lowerQuery) || entry.reason?.toLowerCase().includes(lowerQuery);
  });
}
