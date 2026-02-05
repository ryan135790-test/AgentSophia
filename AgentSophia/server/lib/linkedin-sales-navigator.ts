export interface SalesNavigatorSearch {
  id: string;
  workspaceId: string;
  name: string;
  searchUrl: string;
  filters: SalesNavigatorFilters;
  lastImportAt: Date | null;
  totalImported: number;
  status: 'active' | 'paused' | 'completed';
  autoImport: boolean;
  autoImportFrequency: 'daily' | 'weekly' | 'never';
  createdAt: Date;
}

export interface SalesNavigatorFilters {
  keywords?: string;
  titles?: string[];
  companies?: string[];
  industries?: string[];
  companyHeadcount?: string[];
  geography?: string[];
  seniorityLevel?: string[];
  function?: string[];
  yearsInCurrentPosition?: string;
  yearsInCurrentCompany?: string;
  yearsOfExperience?: string;
  groups?: string[];
  schools?: string[];
  connectionLevel?: ('1st' | '2nd' | '3rd+')[];
  spotlightFilters?: ('changed_jobs' | 'posted_recently' | 'mentioned_in_news' | 'share_experiences')[];
}

export interface SalesNavigatorLead {
  linkedInUrl: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  title: string;
  company: string;
  companyLinkedInUrl: string | null;
  location: string;
  industry: string | null;
  connectionDegree: '1st' | '2nd' | '3rd+';
  mutualConnections: number;
  avatarUrl: string | null;
  profileSummary: string | null;
  isOpenToInMail: boolean;
  isPremium: boolean;
  recentActivity: string | null;
  savedAt: Date;
  tags: string[];
  notes: string | null;
}

export interface ImportResult {
  searchId: string;
  totalFound: number;
  imported: number;
  duplicatesSkipped: number;
  errors: number;
  leads: SalesNavigatorLead[];
  importedAt: Date;
}

class LinkedInSalesNavigatorEngine {
  private searches: Map<string, SalesNavigatorSearch> = new Map();
  private leads: Map<string, SalesNavigatorLead[]> = new Map();

  createSearch(
    workspaceId: string,
    name: string,
    searchUrl: string,
    filters: SalesNavigatorFilters,
    autoImport: boolean = false,
    autoImportFrequency: 'daily' | 'weekly' | 'never' = 'never'
  ): SalesNavigatorSearch {
    const search: SalesNavigatorSearch = {
      id: `sn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      name,
      searchUrl,
      filters,
      lastImportAt: null,
      totalImported: 0,
      status: 'active',
      autoImport,
      autoImportFrequency,
      createdAt: new Date(),
    };

    this.searches.set(search.id, search);
    return search;
  }

  parseSearchUrl(url: string): SalesNavigatorFilters {
    const filters: SalesNavigatorFilters = {};

    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      if (params.has('keywords')) {
        filters.keywords = params.get('keywords') || undefined;
      }

      if (params.has('titleIncluded')) {
        filters.titles = params.get('titleIncluded')?.split(',') || [];
      }

      if (params.has('geoIncluded')) {
        filters.geography = params.get('geoIncluded')?.split(',') || [];
      }

      if (params.has('industryIncluded')) {
        filters.industries = params.get('industryIncluded')?.split(',') || [];
      }

      if (params.has('seniorityIncluded')) {
        filters.seniorityLevel = params.get('seniorityIncluded')?.split(',') || [];
      }

    } catch (error) {
      console.error('Failed to parse Sales Navigator URL:', error);
    }

    return filters;
  }

  async importFromSearch(searchId: string): Promise<ImportResult> {
    const search = this.searches.get(searchId);
    if (!search) {
      throw new Error('Search not found');
    }

    const mockLeads: SalesNavigatorLead[] = [
      {
        linkedInUrl: 'https://linkedin.com/in/john-smith-ceo',
        firstName: 'John',
        lastName: 'Smith',
        fullName: 'John Smith',
        headline: 'CEO at TechCorp | Building the Future',
        title: 'CEO',
        company: 'TechCorp',
        companyLinkedInUrl: 'https://linkedin.com/company/techcorp',
        location: 'San Francisco Bay Area',
        industry: 'Technology',
        connectionDegree: '2nd',
        mutualConnections: 5,
        avatarUrl: null,
        profileSummary: 'Experienced CEO with 15+ years in tech...',
        isOpenToInMail: true,
        isPremium: true,
        recentActivity: 'Posted about AI trends 2 days ago',
        savedAt: new Date(),
        tags: [],
        notes: null,
      },
      {
        linkedInUrl: 'https://linkedin.com/in/sarah-johnson-vp',
        firstName: 'Sarah',
        lastName: 'Johnson',
        fullName: 'Sarah Johnson',
        headline: 'VP of Sales | Revenue Growth Expert',
        title: 'VP of Sales',
        company: 'SalesForce Solutions',
        companyLinkedInUrl: 'https://linkedin.com/company/salesforce-solutions',
        location: 'New York City Metropolitan Area',
        industry: 'Software',
        connectionDegree: '2nd',
        mutualConnections: 12,
        avatarUrl: null,
        profileSummary: 'Driven sales leader with track record...',
        isOpenToInMail: true,
        isPremium: false,
        recentActivity: 'Changed jobs 3 months ago',
        savedAt: new Date(),
        tags: [],
        notes: null,
      },
      {
        linkedInUrl: 'https://linkedin.com/in/mike-chen-founder',
        firstName: 'Mike',
        lastName: 'Chen',
        fullName: 'Mike Chen',
        headline: 'Founder & CTO | Serial Entrepreneur',
        title: 'Founder & CTO',
        company: 'InnovateTech',
        companyLinkedInUrl: 'https://linkedin.com/company/innovatetech',
        location: 'Austin, Texas',
        industry: 'Information Technology',
        connectionDegree: '3rd+',
        mutualConnections: 2,
        avatarUrl: null,
        profileSummary: 'Built 3 startups from zero to exit...',
        isOpenToInMail: false,
        isPremium: true,
        recentActivity: 'Mentioned in TechCrunch article',
        savedAt: new Date(),
        tags: [],
        notes: null,
      },
    ];

    const existingLeads = this.leads.get(search.workspaceId) || [];
    const existingUrls = new Set(existingLeads.map(l => l.linkedInUrl));

    let imported = 0;
    let duplicatesSkipped = 0;

    for (const lead of mockLeads) {
      if (existingUrls.has(lead.linkedInUrl)) {
        duplicatesSkipped++;
      } else {
        existingLeads.push(lead);
        imported++;
      }
    }

    this.leads.set(search.workspaceId, existingLeads);

    search.lastImportAt = new Date();
    search.totalImported += imported;

    return {
      searchId: search.id,
      totalFound: mockLeads.length,
      imported,
      duplicatesSkipped,
      errors: 0,
      leads: mockLeads.filter(l => !existingUrls.has(l.linkedInUrl)),
      importedAt: new Date(),
    };
  }

  getSearches(workspaceId: string): SalesNavigatorSearch[] {
    return Array.from(this.searches.values())
      .filter(s => s.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getLeads(workspaceId: string, filters?: {
    search?: string;
    companies?: string[];
    titles?: string[];
    connectionDegree?: ('1st' | '2nd' | '3rd+')[];
    tags?: string[];
  }): SalesNavigatorLead[] {
    let results = this.leads.get(workspaceId) || [];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(l =>
        l.fullName.toLowerCase().includes(search) ||
        l.company.toLowerCase().includes(search) ||
        l.headline.toLowerCase().includes(search)
      );
    }

    if (filters?.companies?.length) {
      results = results.filter(l =>
        filters.companies!.some(c => l.company.toLowerCase().includes(c.toLowerCase()))
      );
    }

    if (filters?.titles?.length) {
      results = results.filter(l =>
        filters.titles!.some(t => l.title.toLowerCase().includes(t.toLowerCase()))
      );
    }

    if (filters?.connectionDegree?.length) {
      results = results.filter(l => filters.connectionDegree!.includes(l.connectionDegree));
    }

    if (filters?.tags?.length) {
      results = results.filter(l =>
        filters.tags!.some(t => l.tags.includes(t))
      );
    }

    return results;
  }

  tagLeads(workspaceId: string, linkedInUrls: string[], tag: string): number {
    const leads = this.leads.get(workspaceId) || [];
    let tagged = 0;

    for (const lead of leads) {
      if (linkedInUrls.includes(lead.linkedInUrl) && !lead.tags.includes(tag)) {
        lead.tags.push(tag);
        tagged++;
      }
    }

    return tagged;
  }

  addNote(workspaceId: string, linkedInUrl: string, note: string): boolean {
    const leads = this.leads.get(workspaceId) || [];
    const lead = leads.find(l => l.linkedInUrl === linkedInUrl);

    if (lead) {
      lead.notes = note;
      return true;
    }

    return false;
  }

  deleteSearch(searchId: string): boolean {
    return this.searches.delete(searchId);
  }

  exportLeads(workspaceId: string, format: 'csv' | 'json'): string {
    const leads = this.leads.get(workspaceId) || [];

    if (format === 'json') {
      return JSON.stringify(leads, null, 2);
    }

    const headers = ['LinkedIn URL', 'First Name', 'Last Name', 'Title', 'Company', 'Location', 'Industry', 'Connection'];
    const rows = leads.map(l => [
      l.linkedInUrl,
      l.firstName,
      l.lastName,
      l.title,
      l.company,
      l.location,
      l.industry || '',
      l.connectionDegree,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  getStats(workspaceId: string): {
    totalLeads: number;
    byConnectionDegree: Record<string, number>;
    byIndustry: Record<string, number>;
    byTitle: Record<string, number>;
    openToInMail: number;
    premiumMembers: number;
    recentlyActive: number;
  } {
    const leads = this.leads.get(workspaceId) || [];

    const byConnectionDegree: Record<string, number> = {};
    const byIndustry: Record<string, number> = {};
    const byTitle: Record<string, number> = {};
    let openToInMail = 0;
    let premiumMembers = 0;
    let recentlyActive = 0;

    for (const lead of leads) {
      byConnectionDegree[lead.connectionDegree] = (byConnectionDegree[lead.connectionDegree] || 0) + 1;

      if (lead.industry) {
        byIndustry[lead.industry] = (byIndustry[lead.industry] || 0) + 1;
      }

      const titleCategory = this.categorizeTitle(lead.title);
      byTitle[titleCategory] = (byTitle[titleCategory] || 0) + 1;

      if (lead.isOpenToInMail) openToInMail++;
      if (lead.isPremium) premiumMembers++;
      if (lead.recentActivity) recentlyActive++;
    }

    return {
      totalLeads: leads.length,
      byConnectionDegree,
      byIndustry,
      byTitle,
      openToInMail,
      premiumMembers,
      recentlyActive,
    };
  }

  private categorizeTitle(title: string): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('ceo') || titleLower.includes('chief executive')) return 'CEO';
    if (titleLower.includes('cto') || titleLower.includes('chief technology')) return 'CTO';
    if (titleLower.includes('cfo') || titleLower.includes('chief financial')) return 'CFO';
    if (titleLower.includes('cmo') || titleLower.includes('chief marketing')) return 'CMO';
    if (titleLower.includes('vp') || titleLower.includes('vice president')) return 'VP';
    if (titleLower.includes('director')) return 'Director';
    if (titleLower.includes('manager')) return 'Manager';
    if (titleLower.includes('founder')) return 'Founder';

    return 'Other';
  }
}

export const linkedInSalesNavigatorEngine = new LinkedInSalesNavigatorEngine();
