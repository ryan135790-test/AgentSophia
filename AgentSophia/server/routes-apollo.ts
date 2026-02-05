import { Router } from 'express';
import { findEmailWithApollo, bulkEnrichWithApollo } from './lib/apollo-service';
import { encryptToken, decryptToken } from './lib/encryption';

const router = Router();

let encryptedApolloApiKey: string | null = null;

function getDecryptedApiKey(): string | null {
  if (encryptedApolloApiKey) {
    return decryptToken(encryptedApolloApiKey);
  }
  return process.env.APOLLO_API_KEY || null;
}

interface ApolloSearchParams {
  person_titles?: string[];
  person_locations?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  q_organization_domains?: string[];
  q_keywords?: string;
  page?: number;
  per_page?: number;
}

router.get('/status', async (req, res) => {
  try {
    const apiKey = getDecryptedApiKey();
    const isConnected = !!apiKey;
    
    if (isConnected) {
      const testResponse = await fetch('https://api.apollo.io/api/v1/auth/health', {
        headers: { 'x-api-key': apiKey! }
      });
      
      if (testResponse.ok) {
        res.json({ 
          connected: true, 
          verified: true,
          message: 'Apollo.io API connected and verified'
        });
      } else {
        res.json({ 
          connected: true, 
          verified: false,
          message: 'API key configured but verification failed'
        });
      }
    } else {
      res.json({ connected: false, verified: false });
    }
  } catch (error) {
    console.error('Apollo status error:', error);
    res.json({ connected: false, verified: false, error: 'Failed to check status' });
  }
});

router.post('/connect', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const testResponse = await fetch('https://api.apollo.io/api/v1/auth/health', {
      headers: { 'x-api-key': apiKey }
    });

    if (!testResponse.ok) {
      return res.status(400).json({ 
        error: 'Invalid API key - verification failed',
        details: `Status: ${testResponse.status}`
      });
    }

    encryptedApolloApiKey = encryptToken(apiKey);
    process.env.APOLLO_API_KEY = apiKey;

    console.log('✅ Apollo.io API connected successfully');

    res.json({ 
      success: true, 
      message: 'Apollo.io connected successfully',
      verified: true
    });
  } catch (error: any) {
    console.error('Apollo connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect Apollo.io' });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    encryptedApolloApiKey = null;
    delete process.env.APOLLO_API_KEY;
    console.log('Apollo.io disconnected');
    res.json({ success: true, message: 'Apollo.io disconnected' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
});

router.post('/search/people', async (req, res) => {
  try {
    const apiKey = getDecryptedApiKey();
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Apollo.io not configured' });
    }

    const {
      person_titles,
      person_locations,
      person_seniorities,
      organization_locations,
      organization_num_employees_ranges,
      q_organization_domains,
      q_keywords,
      page = 1,
      per_page = 25
    } = req.body as ApolloSearchParams;

    const searchParams: any = {
      page,
      per_page,
    };

    if (person_titles?.length) searchParams.person_titles = person_titles;
    if (person_locations?.length) searchParams.person_locations = person_locations;
    if (person_seniorities?.length) searchParams.person_seniorities = person_seniorities;
    if (organization_locations?.length) searchParams.organization_locations = organization_locations;
    if (organization_num_employees_ranges?.length) searchParams.organization_num_employees_ranges = organization_num_employees_ranges;
    if (q_organization_domains?.length) searchParams.q_organization_domains = q_organization_domains;
    if (q_keywords) searchParams.q_keywords = q_keywords;

    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(searchParams)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo search error:', errorText);
      return res.status(response.status).json({ error: 'Apollo search failed', details: errorText });
    }

    const data = await response.json();
    
    const prospects = (data.people || []).map((person: any) => ({
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      name: person.name,
      title: person.title,
      email: person.email,
      email_status: person.email_status,
      linkedin_url: person.linkedin_url,
      phone_number: person.phone_numbers?.[0]?.sanitized_number,
      company: person.organization?.name,
      company_website: person.organization?.website_url,
      company_linkedin: person.organization?.linkedin_url,
      company_size: person.organization?.estimated_num_employees,
      location: person.city ? `${person.city}, ${person.state || person.country}` : person.country,
      seniority: person.seniority,
      departments: person.departments,
    }));

    res.json({
      prospects,
      pagination: {
        page: data.pagination?.page || page,
        per_page: data.pagination?.per_page || per_page,
        total_entries: data.pagination?.total_entries || 0,
        total_pages: data.pagination?.total_pages || 0
      }
    });
  } catch (error: any) {
    console.error('Apollo search error:', error);
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

router.post('/enrich', async (req, res) => {
  try {
    const { firstName, lastName, company, linkedInUrl } = req.body;

    if (!firstName || !lastName || !company) {
      return res.status(400).json({ error: 'firstName, lastName, and company are required' });
    }

    const result = await findEmailWithApollo(firstName, lastName, company, linkedInUrl);
    
    res.json(result);
  } catch (error: any) {
    console.error('Apollo enrich error:', error);
    res.status(500).json({ error: error.message || 'Enrichment failed' });
  }
});

router.post('/enrich/bulk', async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts array is required' });
    }

    if (contacts.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 contacts per bulk request' });
    }

    const results = await bulkEnrichWithApollo(contacts.map(c => ({
      firstName: c.firstName || c.first_name,
      lastName: c.lastName || c.last_name,
      company: c.company,
      linkedInUrl: c.linkedInUrl || c.linkedin_url,
      email: c.email
    })));

    const enrichedContacts = contacts.map(contact => {
      const key = `${contact.firstName || contact.first_name}-${contact.lastName || contact.last_name}-${contact.company}`;
      const enrichment = results.get(key);
      return {
        ...contact,
        enriched_email: enrichment?.email,
        email_confidence: enrichment?.confidence,
        email_verified: enrichment?.verified,
        enrichment_source: enrichment?.source,
        enriched_phone: enrichment?.phoneNumber,
        enriched_linkedin: enrichment?.linkedInUrl
      };
    });

    res.json({ 
      enrichedContacts,
      stats: {
        total: contacts.length,
        enriched: enrichedContacts.filter(c => c.enriched_email).length,
        verified: enrichedContacts.filter(c => c.email_verified).length
      }
    });
  } catch (error: any) {
    console.error('Apollo bulk enrich error:', error);
    res.status(500).json({ error: error.message || 'Bulk enrichment failed' });
  }
});

router.post('/linkedin-campaign/build', async (req, res) => {
  try {
    const apiKey = getDecryptedApiKey();
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Apollo.io not configured' });
    }

    const {
      campaign_name,
      target_criteria,
      max_prospects = 100
    } = req.body;

    if (!campaign_name || !target_criteria) {
      return res.status(400).json({ error: 'campaign_name and target_criteria are required' });
    }

    const searchParams: any = {
      page: 1,
      per_page: Math.min(max_prospects, 100),
    };

    if (target_criteria.titles?.length) searchParams.person_titles = target_criteria.titles;
    if (target_criteria.locations?.length) searchParams.person_locations = target_criteria.locations;
    if (target_criteria.seniorities?.length) searchParams.person_seniorities = target_criteria.seniorities;
    if (target_criteria.company_sizes?.length) searchParams.organization_num_employees_ranges = target_criteria.company_sizes;
    if (target_criteria.industries?.length) searchParams.organization_industry_tag_ids = target_criteria.industries;
    if (target_criteria.keywords) searchParams.q_keywords = target_criteria.keywords;

    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(searchParams)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'Failed to search prospects', details: errorText });
    }

    const data = await response.json();
    
    const prospects = (data.people || [])
      .filter((p: any) => p.linkedin_url)
      .map((person: any) => ({
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        name: person.name,
        title: person.title,
        email: person.email,
        linkedin_url: person.linkedin_url,
        company: person.organization?.name,
        company_size: person.organization?.estimated_num_employees,
        location: person.city ? `${person.city}, ${person.state || ''}` : '',
        seniority: person.seniority,
        ready_for_linkedin: true
      }));

    res.json({
      campaign_name,
      prospects,
      stats: {
        total_found: data.pagination?.total_entries || 0,
        with_linkedin: prospects.length,
        ready_for_outreach: prospects.length
      },
      target_criteria
    });
  } catch (error: any) {
    console.error('LinkedIn campaign build error:', error);
    res.status(500).json({ error: error.message || 'Failed to build campaign' });
  }
});

export default router;

export function getApolloApiKey(): string | null {
  return getDecryptedApiKey();
}
