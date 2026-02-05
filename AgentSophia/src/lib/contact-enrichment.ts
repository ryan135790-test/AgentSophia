import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface ContactData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
}

interface EnrichedContact {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
  enrichmentScore: number;
  validations: {
    emailValid: boolean;
    phoneValid: boolean;
    nameConfidence: number;
  };
  suggestions?: {
    possibleEmail?: string;
    possiblePhone?: string;
    possibleTitle?: string;
  };
}

export async function enrichContact(contact: ContactData): Promise<EnrichedContact> {
  try {
    const prompt = `You are a contact data validation and enrichment expert. Analyze this contact information and provide validation results and suggestions.

Contact Data:
- First Name: ${contact.firstName || 'Not provided'}
- Last Name: ${contact.lastName || 'Not provided'}
- Email: ${contact.email || 'Not provided'}
- Phone: ${contact.phone || 'Not provided'}
- Company: ${contact.company || 'Not provided'}
- Title: ${contact.title || 'Not provided'}
- LinkedIn: ${contact.linkedinUrl || 'Not provided'}

Tasks:
1. Validate email format (check if it's a valid email pattern)
2. Validate phone number (check if it follows international format patterns)
3. Assess name confidence (0-100 score based on how complete and realistic the name is)
4. Suggest corrections or improvements if data seems incorrect
5. If email is missing but we have name and company, suggest a possible email format
6. Calculate overall enrichment score (0-100)

Return a JSON object with this exact structure:
{
  "emailValid": boolean,
  "phoneValid": boolean,
  "nameConfidence": number (0-100),
  "enrichmentScore": number (0-100),
  "possibleEmail": string or null,
  "possiblePhone": string or null,
  "possibleTitle": string or null,
  "correctedFirstName": string or null,
  "correctedLastName": string or null
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a data validation expert. Return only valid JSON, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    let enrichmentData;
    
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      enrichmentData = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse enrichment response:', content);
      enrichmentData = {
        emailValid: false,
        phoneValid: false,
        nameConfidence: 50,
        enrichmentScore: 50
      };
    }

    // Build enriched contact
    const enriched: EnrichedContact = {
      firstName: enrichmentData.correctedFirstName || contact.firstName || '',
      lastName: enrichmentData.correctedLastName || contact.lastName || '',
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      title: contact.title,
      linkedinUrl: contact.linkedinUrl,
      enrichmentScore: enrichmentData.enrichmentScore || 50,
      validations: {
        emailValid: enrichmentData.emailValid || false,
        phoneValid: enrichmentData.phoneValid || false,
        nameConfidence: enrichmentData.nameConfidence || 50
      },
      suggestions: {
        possibleEmail: enrichmentData.possibleEmail,
        possiblePhone: enrichmentData.possiblePhone,
        possibleTitle: enrichmentData.possibleTitle
      }
    };

    return enriched;

  } catch (error) {
    console.error('Error enriching contact:', error);
    
    // Return basic validation without AI
    return {
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      title: contact.title,
      linkedinUrl: contact.linkedinUrl,
      enrichmentScore: 50,
      validations: {
        emailValid: validateEmail(contact.email || ''),
        phoneValid: validatePhone(contact.phone || ''),
        nameConfidence: (contact.firstName && contact.lastName) ? 80 : 40
      }
    };
  }
}

export async function enrichContactBatch(contacts: ContactData[]): Promise<EnrichedContact[]> {
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  const results: EnrichedContact[] = [];
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(contact => enrichContact(contact))
    );
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// Fallback validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  // Valid if it has 10-15 digits
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}
