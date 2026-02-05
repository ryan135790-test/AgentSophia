import { findEmailByLinkedIn, findEmailByName } from './hunter-service';
import { findEmailWithApollo } from './apollo-service';

export interface EnrichmentResult {
  email: string | null;
  confidence: number;
  verified: boolean;
  source: 'hunter' | 'apollo' | 'hunter-demo' | 'apollo-demo' | 'demo';
}

export interface EnrichmentOptions {
  preferredProvider?: 'hunter' | 'apollo' | 'waterfall';
  skipIfEmailExists?: boolean;
}

export async function enrichWithEmail(
  firstName: string,
  lastName: string,
  company: string,
  linkedInUrl?: string,
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { preferredProvider = 'waterfall' } = options;

  if (preferredProvider === 'hunter') {
    const result = linkedInUrl
      ? await findEmailByLinkedIn(linkedInUrl, firstName, lastName, company)
      : await findEmailByName(firstName, lastName, company);
    
    return {
      email: result.email,
      confidence: result.confidence,
      verified: result.verified,
      source: result.source === 'demo' ? 'hunter-demo' : 'hunter',
    };
  }

  if (preferredProvider === 'apollo') {
    const result = await findEmailWithApollo(firstName, lastName, company, linkedInUrl);
    return {
      email: result.email,
      confidence: result.confidence,
      verified: result.verified,
      source: result.source === 'apollo-demo' ? 'apollo-demo' : 'apollo',
    };
  }

  const hunterResult = linkedInUrl
    ? await findEmailByLinkedIn(linkedInUrl, firstName, lastName, company)
    : await findEmailByName(firstName, lastName, company);

  const hunterSource: EnrichmentResult['source'] = hunterResult.source === 'demo' ? 'hunter-demo' : 'hunter';

  if (hunterResult.email && hunterResult.confidence >= 70) {
    console.log(`[Waterfall] Hunter found high-confidence email: ${hunterResult.email}`);
    return {
      email: hunterResult.email,
      confidence: hunterResult.confidence,
      verified: hunterResult.verified,
      source: hunterSource,
    };
  }

  console.log(`[Waterfall] Hunter result: ${hunterResult.email || 'none'} (${hunterResult.confidence}%), trying Apollo...`);
  
  const apolloResult = await findEmailWithApollo(firstName, lastName, company, linkedInUrl);
  const apolloSource: EnrichmentResult['source'] = apolloResult.source === 'apollo-demo' ? 'apollo-demo' : 'apollo';

  const hunterHasEmail = !!hunterResult.email;
  const apolloHasEmail = !!apolloResult.email;
  const hunterConf = hunterResult.confidence || 0;
  const apolloConf = apolloResult.confidence || 0;

  if (apolloHasEmail && (!hunterHasEmail || apolloConf > hunterConf)) {
    console.log(`[Waterfall] Apollo found better email: ${apolloResult.email} (${apolloConf}%)`);
    return {
      email: apolloResult.email,
      confidence: apolloConf,
      verified: apolloResult.verified,
      source: apolloSource,
    };
  }

  if (hunterHasEmail) {
    console.log(`[Waterfall] Using Hunter email: ${hunterResult.email} (${hunterConf}%)`);
    return {
      email: hunterResult.email,
      confidence: hunterConf,
      verified: hunterResult.verified,
      source: hunterSource,
    };
  }

  if (apolloHasEmail) {
    return {
      email: apolloResult.email,
      confidence: apolloConf,
      verified: apolloResult.verified,
      source: apolloSource,
    };
  }

  return {
    email: null,
    confidence: 0,
    verified: false,
    source: 'hunter-demo',
  };
}

export async function enrichProfilesWithWaterfall(
  profiles: Array<{
    first_name: string;
    last_name: string;
    company: string;
    linkedin_url?: string;
    email?: string;
  }>,
  options: EnrichmentOptions = {}
): Promise<Array<any>> {
  const enrichedProfiles = await Promise.all(
    profiles.map(async (profile) => {
      if (options.skipIfEmailExists && profile.email) {
        return {
          ...profile,
          email_confidence: 100,
          email_verified: true,
          email_source: 'existing',
        };
      }

      try {
        const enrichment = await enrichWithEmail(
          profile.first_name,
          profile.last_name,
          profile.company,
          profile.linkedin_url,
          options
        );

        return {
          ...profile,
          email: enrichment.email || profile.email,
          email_confidence: enrichment.confidence,
          email_verified: enrichment.verified,
          email_source: enrichment.source,
        };
      } catch (error) {
        console.error(`[Enrichment] Failed for ${profile.first_name} ${profile.last_name}:`, error);
        return profile;
      }
    })
  );

  return enrichedProfiles;
}

export function getEnrichmentStatus(): {
  hunterConfigured: boolean;
  apolloConfigured: boolean;
  activeProvider: string;
} {
  const hunterKey = process.env.HUNTER_API_KEY;
  const apolloKey = process.env.APOLLO_API_KEY;

  let activeProvider = 'demo';
  if (hunterKey && apolloKey) {
    activeProvider = 'waterfall (Hunter + Apollo)';
  } else if (hunterKey) {
    activeProvider = 'Hunter.io';
  } else if (apolloKey) {
    activeProvider = 'Apollo.io';
  }

  return {
    hunterConfigured: !!hunterKey,
    apolloConfigured: !!apolloKey,
    activeProvider,
  };
}

export interface EnrichmentSettings {
  workspaceId: string;
  primaryProvider: 'hunter' | 'apollo' | 'waterfall';
  autoEnrich: boolean;
  enrichOnImport: boolean;
  maxEnrichmentsPerDay: number;
  cacheResults: boolean;
}

const enrichmentSettings: Map<string, EnrichmentSettings> = new Map();
const dailyEnrichmentCount: Map<string, { date: string; count: number }> = new Map();

export function getEnrichmentSettings(workspaceId: string): EnrichmentSettings {
  return enrichmentSettings.get(workspaceId) || {
    workspaceId,
    primaryProvider: 'waterfall',
    autoEnrich: true,
    enrichOnImport: true,
    maxEnrichmentsPerDay: 100,
    cacheResults: true,
  };
}

export function updateEnrichmentSettings(
  workspaceId: string,
  settings: Partial<EnrichmentSettings>
): EnrichmentSettings {
  const current = getEnrichmentSettings(workspaceId);
  const updated = { ...current, ...settings };
  enrichmentSettings.set(workspaceId, updated);
  return updated;
}

export function getEnrichmentStats(workspaceId: string): {
  todayCount: number;
  dailyLimit: number;
  remaining: number;
} {
  const settings = getEnrichmentSettings(workspaceId);
  const today = new Date().toISOString().split('T')[0];
  const count = dailyEnrichmentCount.get(workspaceId);
  const todayCount = count?.date === today ? count.count : 0;

  return {
    todayCount,
    dailyLimit: settings.maxEnrichmentsPerDay,
    remaining: Math.max(0, settings.maxEnrichmentsPerDay - todayCount),
  };
}

export async function enrichFromLinkedInProfile(
  firstName: string,
  lastName: string,
  company: string,
  linkedInUrl?: string,
  workspaceId?: string
): Promise<EnrichmentResult> {
  if (workspaceId) {
    const settings = getEnrichmentSettings(workspaceId);
    const today = new Date().toISOString().split('T')[0];
    const count = dailyEnrichmentCount.get(workspaceId);
    
    if (count?.date === today && count.count >= settings.maxEnrichmentsPerDay) {
      return {
        email: null,
        confidence: 0,
        verified: false,
        source: 'demo',
      };
    }

    const result = await enrichWithEmail(firstName, lastName, company, linkedInUrl, {
      preferredProvider: settings.primaryProvider,
    });

    if (count?.date === today) {
      count.count++;
    } else {
      dailyEnrichmentCount.set(workspaceId, { date: today, count: 1 });
    }

    return result;
  }

  return enrichWithEmail(firstName, lastName, company, linkedInUrl);
}

export const EmailEnrichment = {
  enrich: enrichWithEmail,
  enrichFromLinkedIn: enrichFromLinkedInProfile,
  enrichProfiles: enrichProfilesWithWaterfall,
  getStatus: getEnrichmentStatus,
  getSettings: getEnrichmentSettings,
  updateSettings: updateEnrichmentSettings,
  getStats: getEnrichmentStats,
};
