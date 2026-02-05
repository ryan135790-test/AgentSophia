interface SpintaxResult {
  original: string;
  processed: string;
  variationsCount: number;
  tokensUsed: string[];
}

interface SpintaxValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variationsCount: number;
}

export function processSpintax(text: string, seed?: number): SpintaxResult {
  const tokensUsed: string[] = [];
  let variationsCount = 1;

  const random = seed !== undefined ? seededRandom(seed) : Math.random;

  function replaceSpintax(match: string): string {
    const content = match.slice(1, -1);
    const options = parseSpintaxOptions(content);
    
    if (options.length === 0) return '';
    
    variationsCount *= options.length;
    const selectedIndex = Math.floor(random() * options.length);
    const selected = options[selectedIndex];
    
    tokensUsed.push(`{${content}} → "${selected}"`);
    
    return selected;
  }

  let processed = text;
  let maxIterations = 100;
  
  while (maxIterations-- > 0) {
    const newProcessed = processed.replace(/\{([^{}]+)\}/g, replaceSpintax);
    if (newProcessed === processed) break;
    processed = newProcessed;
  }

  return {
    original: text,
    processed,
    variationsCount,
    tokensUsed
  };
}

function parseSpintaxOptions(content: string): string[] {
  const options: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of content) {
    if (char === '{') {
      depth++;
      current += char;
    } else if (char === '}') {
      depth--;
      current += char;
    } else if (char === '|' && depth === 0) {
      options.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    options.push(current.trim());
  }

  return options;
}

export function generateAllVariations(text: string, maxVariations: number = 100): string[] {
  const variations: Set<string> = new Set();
  
  for (let i = 0; i < maxVariations * 2 && variations.size < maxVariations; i++) {
    const result = processSpintax(text, i);
    variations.add(result.processed);
  }

  return Array.from(variations);
}

export function validateSpintax(text: string): SpintaxValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let variationsCount = 1;

  let openBraces = 0;
  let position = 0;

  for (const char of text) {
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    
    if (openBraces < 0) {
      errors.push(`Unmatched closing brace at position ${position}`);
      openBraces = 0;
    }
    position++;
  }

  if (openBraces > 0) {
    errors.push(`${openBraces} unclosed brace(s) found`);
  }

  const spintaxPattern = /\{([^{}]+)\}/g;
  let match;
  
  while ((match = spintaxPattern.exec(text)) !== null) {
    const content = match[1];
    const options = parseSpintaxOptions(content);
    
    if (options.length === 0) {
      errors.push(`Empty spintax block at position ${match.index}`);
    } else if (options.length === 1) {
      warnings.push(`Single option spintax at position ${match.index} - no variation`);
    } else {
      variationsCount *= options.length;
    }

    for (const option of options) {
      if (option.length === 0) {
        warnings.push(`Empty option in spintax at position ${match.index}`);
      }
    }
  }

  if (variationsCount > 10000) {
    warnings.push(`Very high variation count (${variationsCount}) may affect performance`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variationsCount
  };
}

export function previewSpintax(text: string, count: number = 5): string[] {
  const previews: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const result = processSpintax(text, i * 12345);
    previews.push(result.processed);
  }

  return [...new Set(previews)];
}

export function countVariations(text: string): number {
  let count = 1;
  const spintaxPattern = /\{([^{}]+)\}/g;
  let match;

  while ((match = spintaxPattern.exec(text)) !== null) {
    const options = parseSpintaxOptions(match[1]);
    count *= options.length;
  }

  return count;
}

export function highlightSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (match, content) => {
    const options = parseSpintaxOptions(content);
    return `<span class="spintax" data-options="${options.length}">${match}</span>`;
  });
}

export function convertToSpintax(variations: string[]): string {
  if (variations.length === 0) return '';
  if (variations.length === 1) return variations[0];
  
  return `{${variations.join('|')}}`;
}

interface SpintaxTemplate {
  name: string;
  category: string;
  template: string;
  description: string;
}

export const SPINTAX_TEMPLATES: SpintaxTemplate[] = [
  {
    name: 'Greeting',
    category: 'opening',
    template: '{Hi|Hello|Hey} {there|{firstName}}',
    description: 'Casual greeting with name personalization'
  },
  {
    name: 'Professional Greeting',
    category: 'opening',
    template: '{Dear|Hello} {firstName},',
    description: 'Formal greeting for business emails'
  },
  {
    name: 'Introduction',
    category: 'opening',
    template: "{I'm reaching out|I wanted to connect|I'm contacting you} {because|as|since}",
    description: 'Opening line for cold outreach'
  },
  {
    name: 'Value Proposition',
    category: 'body',
    template: '{help|assist|support} {companies|teams|businesses} like yours to {achieve|reach|accomplish}',
    description: 'Highlight your value'
  },
  {
    name: 'Social Proof',
    category: 'body',
    template: "{We've helped|Our clients have seen|Companies using our solution have experienced} {significant|notable|impressive} {results|improvements|growth}",
    description: 'Build credibility'
  },
  {
    name: 'Call to Action',
    category: 'closing',
    template: '{Would you be open to|Are you available for|Could we schedule} a {quick|brief|short} {call|chat|meeting}?',
    description: 'Request a meeting'
  },
  {
    name: 'Soft CTA',
    category: 'closing',
    template: "{Let me know if you'd like to|I'd love to|Happy to} {learn more|discuss further|share more details}",
    description: 'Low-pressure follow-up'
  },
  {
    name: 'Sign Off',
    category: 'closing',
    template: '{Best|Cheers|Thanks|Regards|Best regards},',
    description: 'Email closing'
  },
  {
    name: 'Urgency',
    category: 'body',
    template: "{This week|Currently|Right now|For a limited time}, we're {offering|providing|extending}",
    description: 'Create urgency without being spammy'
  },
  {
    name: 'Follow Up',
    category: 'opening',
    template: "{Just following up|Wanted to check in|Circling back} on my {previous|earlier|last} {email|message|note}",
    description: 'Follow-up email opener'
  }
];

export function getTemplatesByCategory(category: string): SpintaxTemplate[] {
  return SPINTAX_TEMPLATES.filter(t => t.category === category);
}

export function applySpintaxToEmail(
  template: string,
  contactData: Record<string, string>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(contactData)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}|\\{${key}\\}`, 'gi');
    result = result.replace(pattern, value || '');
  }

  const spintaxResult = processSpintax(result);
  
  return spintaxResult.processed;
}

export function generateEmailVariations(
  template: string,
  contacts: Record<string, string>[],
  variationsPerContact: number = 1
): { contact: Record<string, string>; email: string }[] {
  const results: { contact: Record<string, string>; email: string }[] = [];

  for (const contact of contacts) {
    for (let i = 0; i < variationsPerContact; i++) {
      let email = template;
      
      for (const [key, value] of Object.entries(contact)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        email = email.replace(pattern, value || '');
      }

      const spintaxResult = processSpintax(email, results.length);
      
      results.push({
        contact,
        email: spintaxResult.processed
      });
    }
  }

  return results;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return function() {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

export function analyzeSpintaxUsage(text: string): {
  totalBlocks: number;
  totalOptions: number;
  avgOptionsPerBlock: number;
  blocks: { position: number; options: string[] }[];
} {
  const blocks: { position: number; options: string[] }[] = [];
  const pattern = /\{([^{}]+)\}/g;
  let match;
  let totalOptions = 0;

  while ((match = pattern.exec(text)) !== null) {
    const options = parseSpintaxOptions(match[1]);
    blocks.push({
      position: match.index,
      options
    });
    totalOptions += options.length;
  }

  return {
    totalBlocks: blocks.length,
    totalOptions,
    avgOptionsPerBlock: blocks.length > 0 ? totalOptions / blocks.length : 0,
    blocks
  };
}
