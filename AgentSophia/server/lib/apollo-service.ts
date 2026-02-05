interface ApolloPersonMatch {
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url: string;
    title: string;
    email: string;
    email_status: string;
    organization_id: string;
    organization: {
      id: string;
      name: string;
      website_url: string;
      linkedin_url: string;
      primary_domain: string;
    };
    phone_numbers?: Array<{
      raw_number: string;
      sanitized_number: string;
      type: string;
    }>;
  };
  status?: string;
}

interface ApolloEnrichmentResult {
  email: string | null;
  confidence: number;
  verified: boolean;
  source: 'apollo' | 'apollo-demo';
  phoneNumber?: string;
  linkedInUrl?: string;
}

export async function findEmailWithApollo(
  firstName: string,
  lastName: string,
  company: string,
  linkedInUrl?: string
): Promise<ApolloEnrichmentResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  
  if (!apiKey) {
    console.log('[Apollo] No API key configured, using demo mode');
    return generateApolloDemoEmail(firstName, lastName, company);
  }

  try {
    const params: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      organization_name: company,
      reveal_personal_emails: 'false',
    };
    
    if (linkedInUrl) {
      params.linkedin_url = linkedInUrl;
    }

    const queryString = new URLSearchParams(params).toString();
    
    const response = await fetch(
      `https://api.apollo.io/api/v1/people/match?${queryString}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Apollo] API error:', response.status, errorText);
      
      if (response.status === 401 || response.status === 403) {
        console.log('[Apollo] Invalid API key, falling back to demo mode');
        return generateApolloDemoEmail(firstName, lastName, company);
      }
      
      return { email: null, confidence: 0, verified: false, source: 'apollo' };
    }

    const data: ApolloPersonMatch = await response.json();

    if (!data.person || !data.person.email) {
      console.log(`[Apollo] No email found for ${firstName} ${lastName}`);
      return { email: null, confidence: 0, verified: false, source: 'apollo' };
    }

    const email = data.person.email;
    const emailStatus = data.person.email_status || '';
    
    const confidence = emailStatus === 'verified' ? 95 :
                       emailStatus === 'guessed' ? 70 :
                       emailStatus === 'unavailable' ? 0 : 60;
    
    const verified = emailStatus === 'verified';

    console.log(`[Apollo] Found email for ${firstName} ${lastName}: ${email} (${emailStatus}, ${confidence}%)`);

    return {
      email,
      confidence,
      verified,
      source: 'apollo',
      phoneNumber: data.person.phone_numbers?.[0]?.sanitized_number,
      linkedInUrl: data.person.linkedin_url,
    };
  } catch (error) {
    console.error('[Apollo] Request failed:', error);
    return generateApolloDemoEmail(firstName, lastName, company);
  }
}

interface ContactInput {
  firstName: string;
  lastName: string;
  company: string;
  linkedInUrl?: string;
  email?: string;
}

export async function bulkEnrichWithApollo(
  contacts: ContactInput[]
): Promise<Map<string, ApolloEnrichmentResult>> {
  const apiKey = process.env.APOLLO_API_KEY;
  const results = new Map<string, ApolloEnrichmentResult>();
  
  if (!apiKey) {
    console.log('[Apollo] No API key configured, using demo mode for bulk');
    for (const contact of contacts) {
      const key = `${contact.firstName}-${contact.lastName}-${contact.company}`;
      results.set(key, generateApolloDemoEmail(contact.firstName, contact.lastName, contact.company));
    }
    return results;
  }

  const chunks: ContactInput[][] = [];
  for (let i = 0; i < contacts.length; i += 10) {
    chunks.push(contacts.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const details = chunk.map((contact, index) => ({
        id: `contact_${index}`,
        first_name: contact.firstName,
        last_name: contact.lastName,
        organization_name: contact.company,
        linkedin_url: contact.linkedInUrl,
      }));

      const response = await fetch(
        'https://api.apollo.io/api/v1/people/bulk_match?reveal_personal_emails=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ details }),
        }
      );

      if (!response.ok) {
        console.error('[Apollo] Bulk API error:', response.status);
        for (const contact of chunk) {
          const key = `${contact.firstName}-${contact.lastName}-${contact.company}`;
          results.set(key, { email: null, confidence: 0, verified: false, source: 'apollo' });
        }
        continue;
      }

      const data = await response.json();
      const matches = data.matches || [];

      chunk.forEach((contact, index) => {
        const key = `${contact.firstName}-${contact.lastName}-${contact.company}`;
        const match = matches[index];
        
        if (match?.person?.email) {
          const emailStatus = match.person.email_status || '';
          const confidence = emailStatus === 'verified' ? 95 :
                           emailStatus === 'guessed' ? 70 : 60;
          
          results.set(key, {
            email: match.person.email,
            confidence,
            verified: emailStatus === 'verified',
            source: 'apollo',
            phoneNumber: match.person.phone_numbers?.[0]?.sanitized_number,
            linkedInUrl: match.person.linkedin_url,
          });
        } else {
          results.set(key, { email: null, confidence: 0, verified: false, source: 'apollo' });
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('[Apollo] Bulk request failed:', error);
      for (const contact of chunk) {
        const key = `${contact.firstName}-${contact.lastName}-${contact.company}`;
        results.set(key, { email: null, confidence: 0, verified: false, source: 'apollo' });
      }
    }
  }

  return results;
}

function generateApolloDemoEmail(
  firstName: string,
  lastName: string,
  company: string
): ApolloEnrichmentResult {
  if (!firstName || !lastName || !company) {
    return { email: null, confidence: 0, verified: false, source: 'apollo-demo' };
  }

  const cleanCompany = company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

  const patterns = [
    `${cleanFirst}.${cleanLast}@${cleanCompany}.com`,
    `${cleanFirst}${cleanLast}@${cleanCompany}.com`,
    `${cleanFirst[0]}${cleanLast}@${cleanCompany}.com`,
  ];

  const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
  const confidence = 55 + Math.floor(Math.random() * 35);

  return {
    email: randomPattern,
    confidence,
    verified: false,
    source: 'apollo-demo',
  };
}
