interface HunterEmailResponse {
  data: {
    person?: {
      id: string;
      name: {
        fullName: string;
        givenName: string;
        familyName: string;
      };
      email: string;
      location?: string;
      employment?: {
        domain: string;
        name: string;
        title?: string;
        role?: string;
        seniority?: string;
      };
    };
    email?: string;
    confidence?: number;
    type?: 'personal' | 'generic';
    sources?: Array<{
      domain: string;
      uri: string;
      extracted_on: string;
      last_seen_on: string;
      still_on_page: boolean;
    }>;
  };
  errors?: Array<{ id: string; code: number; details: string }>;
}

interface EnrichmentResult {
  email: string | null;
  confidence: number;
  type: 'personal' | 'generic' | null;
  verified: boolean;
  source: 'hunter' | 'demo';
}

export async function findEmailByName(
  firstName: string,
  lastName: string,
  company: string
): Promise<EnrichmentResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  
  if (!apiKey) {
    console.log('[Hunter] No API key configured, using demo mode');
    return generateDemoEmail(firstName, lastName, company);
  }

  try {
    const params = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      company: company,
      api_key: apiKey,
    });

    const response = await fetch(
      `https://api.hunter.io/v2/email-finder?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Hunter] API error:', response.status, errorText);
      
      if (response.status === 401) {
        console.log('[Hunter] Invalid API key, falling back to demo mode');
        return generateDemoEmail(firstName, lastName, company);
      }
      
      return { email: null, confidence: 0, type: null, verified: false, source: 'hunter' };
    }

    const data: HunterEmailResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('[Hunter] API returned errors:', data.errors);
      return { email: null, confidence: 0, type: null, verified: false, source: 'hunter' };
    }

    const email = data.data?.email || data.data?.person?.email;
    const confidence = data.data?.confidence || 0;
    const type = data.data?.type || null;

    console.log(`[Hunter] Found email for ${firstName} ${lastName}: ${email} (${confidence}% confidence)`);

    return {
      email: email || null,
      confidence,
      type,
      verified: confidence >= 80,
      source: 'hunter',
    };
  } catch (error) {
    console.error('[Hunter] Request failed:', error);
    return { email: null, confidence: 0, type: null, verified: false, source: 'hunter' };
  }
}

export async function findEmailByLinkedIn(
  linkedInUrl: string,
  firstName?: string,
  lastName?: string,
  company?: string
): Promise<EnrichmentResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  
  if (!apiKey) {
    console.log('[Hunter] No API key configured, using demo mode');
    return generateDemoEmail(firstName || '', lastName || '', company || '');
  }

  try {
    const linkedInHandle = extractLinkedInHandle(linkedInUrl);
    
    const params: Record<string, string> = {
      api_key: apiKey,
    };
    
    if (linkedInHandle) {
      params.linkedin_handle = linkedInHandle;
    }
    
    if (firstName) params.first_name = firstName;
    if (lastName) params.last_name = lastName;
    if (company) params.company = company;

    const searchParams = new URLSearchParams(params);
    const response = await fetch(
      `https://api.hunter.io/v2/email-finder?${searchParams.toString()}`
    );

    if (!response.ok) {
      console.error('[Hunter] API error:', response.status);
      return generateDemoEmail(firstName || '', lastName || '', company || '');
    }

    const data: HunterEmailResponse = await response.json();

    const email = data.data?.email || data.data?.person?.email;
    const confidence = data.data?.confidence || 0;
    const type = data.data?.type || null;

    console.log(`[Hunter] Found email via LinkedIn: ${email} (${confidence}% confidence)`);

    return {
      email: email || null,
      confidence,
      type,
      verified: confidence >= 80,
      source: 'hunter',
    };
  } catch (error) {
    console.error('[Hunter] Request failed:', error);
    return generateDemoEmail(firstName || '', lastName || '', company || '');
  }
}

function extractLinkedInHandle(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function generateDemoEmail(
  firstName: string,
  lastName: string,
  company: string
): EnrichmentResult {
  if (!firstName || !lastName || !company) {
    return { email: null, confidence: 0, type: null, verified: false, source: 'demo' };
  }

  const cleanCompany = company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

  const patterns = [
    `${cleanFirst}.${cleanLast}@${cleanCompany}.com`,
    `${cleanFirst[0]}${cleanLast}@${cleanCompany}.com`,
    `${cleanFirst}@${cleanCompany}.com`,
  ];

  const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
  const confidence = 60 + Math.floor(Math.random() * 30);

  return {
    email: randomPattern,
    confidence,
    type: 'personal',
    verified: false,
    source: 'demo',
  };
}

export async function enrichContacts(
  contacts: Array<{
    firstName: string;
    lastName: string;
    company: string;
    linkedInUrl?: string;
  }>
): Promise<Map<string, EnrichmentResult>> {
  const results = new Map<string, EnrichmentResult>();
  
  for (const contact of contacts) {
    const key = `${contact.firstName}-${contact.lastName}-${contact.company}`;
    
    let result: EnrichmentResult;
    
    if (contact.linkedInUrl) {
      result = await findEmailByLinkedIn(
        contact.linkedInUrl,
        contact.firstName,
        contact.lastName,
        contact.company
      );
    } else {
      result = await findEmailByName(
        contact.firstName,
        contact.lastName,
        contact.company
      );
    }
    
    results.set(key, result);
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
