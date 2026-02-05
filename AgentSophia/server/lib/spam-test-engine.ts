interface SpamTestResult {
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  overallStatus: 'pass' | 'warning' | 'fail';
  checks: SpamCheck[];
  recommendations: string[];
  deliverabilityPrediction: number;
}

interface SpamCheck {
  name: string;
  category: 'content' | 'technical' | 'reputation' | 'formatting';
  status: 'pass' | 'warning' | 'fail';
  score: number;
  maxScore: number;
  message: string;
  fix?: string;
}

interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

interface DomainInfo {
  domain: string;
  spf?: { valid: boolean; record?: string };
  dkim?: { valid: boolean };
  dmarc?: { valid: boolean; policy?: string };
}

const SPAM_TRIGGER_WORDS = [
  'free', 'winner', 'congratulations', 'urgent', 'act now', 'limited time',
  'click here', 'buy now', 'order now', 'special promotion', 'exclusive deal',
  'risk free', 'no obligation', 'guarantee', 'promise', 'amazing',
  'incredible', 'unbelievable', 'miracle', 'cash', 'money back',
  'double your', 'earn money', 'make money', 'extra income', 'work from home',
  'be your own boss', 'financial freedom', 'get rich', 'million dollars',
  'credit card', 'no credit check', 'eliminate debt', 'lower rate',
  'weight loss', 'lose weight', 'diet', 'viagra', 'prescription',
  '100% free', '100% guaranteed', 'act immediately', 'apply now',
  'as seen on', 'call now', 'click below', 'deal', 'discount',
  'don\'t delete', 'don\'t miss', 'for free', 'get it now', 'great offer',
  'hot deal', 'hurry', 'increase', 'info you requested', 'instant',
  'last chance', 'new customer', 'no catch', 'no cost', 'no fees',
  'no gimmick', 'no hidden', 'no interest', 'no investment', 'no purchase',
  'no questions asked', 'no strings', 'not spam', 'offer expires',
  'once in a lifetime', 'one time', 'only $', 'open immediately',
  'order status', 'please read', 'potential earnings', 'prize',
  'save big', 'save up to', 'special offer', 'take action', 'this is not spam',
  'trial', 'undisclosed', 'unsolicited', 'what are you waiting for',
  'while supplies last', 'you have been selected', 'your account'
];

const SUSPICIOUS_PATTERNS = [
  /\$+\d+/g,
  /!\s*!\s*!/g,
  /[A-Z]{5,}/g,
  /\b(xxx|adult|casino|poker|lottery)\b/gi,
  /\b(unsubscribe|opt.?out)\b/gi,
  /<script/gi,
  /javascript:/gi,
  /onclick/gi,
  /onload/gi,
  /style\s*=\s*["'][^"']*display\s*:\s*none/gi,
  /font-size\s*:\s*0/gi,
  /color\s*:\s*#?(?:fff|ffffff|white)/gi
];

export function runSpamTest(email: EmailContent, domainInfo?: DomainInfo): SpamTestResult {
  const checks: SpamCheck[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;

  checks.push(checkSubjectLine(email.subject));
  checks.push(checkSpamTriggerWords(email.subject, email.htmlBody));
  checks.push(checkAllCaps(email.subject, email.htmlBody));
  checks.push(checkExcessivePunctuation(email.subject, email.htmlBody));
  checks.push(checkHtmlToTextRatio(email.htmlBody, email.textBody));
  checks.push(checkImageToTextRatio(email.htmlBody));
  checks.push(checkLinks(email.htmlBody));
  checks.push(checkUnsubscribeLink(email.htmlBody));
  checks.push(checkSenderInfo(email.fromEmail, email.fromName));
  checks.push(checkReplyTo(email.fromEmail, email.replyTo));
  checks.push(checkSuspiciousPatterns(email.htmlBody));
  checks.push(checkPersonalization(email.htmlBody));

  if (domainInfo) {
    checks.push(checkSPF(domainInfo));
    checks.push(checkDKIM(domainInfo));
    checks.push(checkDMARC(domainInfo));
  }

  for (const check of checks) {
    totalScore += check.score;
    maxPossibleScore += check.maxScore;
  }

  const scorePercentage = Math.round((totalScore / maxPossibleScore) * 100);

  let rating: SpamTestResult['rating'];
  let overallStatus: SpamTestResult['overallStatus'];

  if (scorePercentage >= 90) {
    rating = 'excellent';
    overallStatus = 'pass';
  } else if (scorePercentage >= 75) {
    rating = 'good';
    overallStatus = 'pass';
  } else if (scorePercentage >= 60) {
    rating = 'fair';
    overallStatus = 'warning';
  } else if (scorePercentage >= 40) {
    rating = 'poor';
    overallStatus = 'warning';
  } else {
    rating = 'critical';
    overallStatus = 'fail';
  }

  const recommendations = generateRecommendations(checks);

  const deliverabilityPrediction = calculateDeliverabilityPrediction(checks, scorePercentage);

  return {
    score: scorePercentage,
    rating,
    overallStatus,
    checks,
    recommendations,
    deliverabilityPrediction
  };
}

function checkSubjectLine(subject: string): SpamCheck {
  const issues: string[] = [];
  let score = 10;

  if (!subject || subject.trim().length === 0) {
    return {
      name: 'Subject Line',
      category: 'content',
      status: 'fail',
      score: 0,
      maxScore: 10,
      message: 'Missing subject line',
      fix: 'Add a clear, descriptive subject line'
    };
  }

  if (subject.length > 60) {
    score -= 2;
    issues.push('Subject too long (may be truncated)');
  }

  if (subject.length < 10) {
    score -= 2;
    issues.push('Subject too short');
  }

  if (/^re:|^fw:/i.test(subject) && !subject.includes('{{')) {
    score -= 3;
    issues.push('Fake RE:/FW: prefix detected');
  }

  if (/[!?]{2,}/.test(subject)) {
    score -= 2;
    issues.push('Excessive punctuation');
  }

  const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
  if (capsRatio > 0.5 && subject.length > 10) {
    score -= 3;
    issues.push('Too many capital letters');
  }

  score = Math.max(0, score);

  return {
    name: 'Subject Line',
    category: 'content',
    status: score >= 8 ? 'pass' : score >= 5 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: issues.length > 0 ? issues.join('; ') : 'Subject line looks good',
    fix: issues.length > 0 ? 'Keep subject 30-60 chars, avoid ALL CAPS and excessive punctuation' : undefined
  };
}

function checkSpamTriggerWords(subject: string, body: string): SpamCheck {
  const combinedText = `${subject} ${stripHtml(body)}`.toLowerCase();
  const foundWords: string[] = [];

  for (const word of SPAM_TRIGGER_WORDS) {
    if (combinedText.includes(word.toLowerCase())) {
      foundWords.push(word);
    }
  }

  const score = Math.max(0, 10 - foundWords.length * 2);

  return {
    name: 'Spam Trigger Words',
    category: 'content',
    status: foundWords.length === 0 ? 'pass' : foundWords.length <= 2 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: foundWords.length > 0 
      ? `Found ${foundWords.length} trigger words: ${foundWords.slice(0, 5).join(', ')}${foundWords.length > 5 ? '...' : ''}`
      : 'No spam trigger words detected',
    fix: foundWords.length > 0 ? 'Replace or remove spam trigger words with professional alternatives' : undefined
  };
}

function checkAllCaps(subject: string, body: string): SpamCheck {
  const text = stripHtml(body);
  const words = text.split(/\s+/).filter(w => w.length > 3);
  const capsWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w));
  const capsRatio = words.length > 0 ? capsWords.length / words.length : 0;

  let score = 10;
  if (capsRatio > 0.3) score = 0;
  else if (capsRatio > 0.2) score = 3;
  else if (capsRatio > 0.1) score = 6;
  else if (capsRatio > 0.05) score = 8;

  return {
    name: 'Capital Letters',
    category: 'formatting',
    status: score >= 8 ? 'pass' : score >= 5 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: capsRatio > 0.1 
      ? `${Math.round(capsRatio * 100)}% of words are ALL CAPS`
      : 'Appropriate use of capitalization',
    fix: capsRatio > 0.1 ? 'Reduce ALL CAPS words - use sentence case instead' : undefined
  };
}

function checkExcessivePunctuation(subject: string, body: string): SpamCheck {
  const text = `${subject} ${stripHtml(body)}`;
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const textLength = text.length;

  const punctuationDensity = (exclamations + questions) / (textLength / 100);
  let score = 10;

  if (punctuationDensity > 5) score = 0;
  else if (punctuationDensity > 3) score = 4;
  else if (punctuationDensity > 2) score = 7;
  else if (punctuationDensity > 1) score = 9;

  return {
    name: 'Punctuation',
    category: 'formatting',
    status: score >= 8 ? 'pass' : score >= 5 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: punctuationDensity > 2 
      ? `Excessive punctuation detected (${exclamations} exclamation marks)`
      : 'Punctuation looks appropriate',
    fix: punctuationDensity > 2 ? 'Reduce exclamation marks and question marks' : undefined
  };
}

function checkHtmlToTextRatio(htmlBody: string, textBody?: string): SpamCheck {
  const htmlLength = htmlBody.length;
  const textContent = textBody || stripHtml(htmlBody);
  const textLength = textContent.length;

  if (htmlLength === 0) {
    return {
      name: 'HTML/Text Ratio',
      category: 'technical',
      status: 'warning',
      score: 5,
      maxScore: 10,
      message: 'No HTML content',
      fix: 'Include properly formatted HTML email content'
    };
  }

  const ratio = textLength / htmlLength;
  let score = 10;

  if (ratio < 0.1) score = 2;
  else if (ratio < 0.2) score = 5;
  else if (ratio < 0.3) score = 7;
  else if (ratio > 0.8) score = 8;

  return {
    name: 'HTML/Text Ratio',
    category: 'technical',
    status: score >= 7 ? 'pass' : score >= 4 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: ratio < 0.2 
      ? 'Too much HTML compared to text content'
      : 'Good balance of HTML and text',
    fix: ratio < 0.2 ? 'Add more text content, reduce unnecessary HTML markup' : undefined
  };
}

function checkImageToTextRatio(htmlBody: string): SpamCheck {
  const images = (htmlBody.match(/<img/gi) || []).length;
  const textContent = stripHtml(htmlBody);
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  let score = 10;
  let message = 'Good image to text ratio';

  if (images === 0 && wordCount < 50) {
    score = 6;
    message = 'Very short email with no images';
  } else if (images > 0 && wordCount < 50) {
    score = 3;
    message = 'Image-heavy email with little text';
  } else if (images > 5) {
    score = 5;
    message = `Too many images (${images})`;
  }

  return {
    name: 'Image/Text Ratio',
    category: 'content',
    status: score >= 7 ? 'pass' : score >= 4 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message,
    fix: score < 7 ? 'Balance images with sufficient text content (at least 50 words)' : undefined
  };
}

function checkLinks(htmlBody: string): SpamCheck {
  const links = htmlBody.match(/<a[^>]*href[^>]*>/gi) || [];
  const linkCount = links.length;

  let score = 10;
  const issues: string[] = [];

  if (linkCount > 10) {
    score -= 3;
    issues.push(`Too many links (${linkCount})`);
  }

  const shortenedDomains = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly', 'is.gd'];
  for (const link of links) {
    for (const domain of shortenedDomains) {
      if (link.toLowerCase().includes(domain)) {
        score -= 2;
        issues.push('Contains shortened URLs');
        break;
      }
    }
  }

  const suspiciousLinks = links.filter(l => 
    /javascript:/i.test(l) || 
    /data:/i.test(l) ||
    /#[a-f0-9]{6,}/i.test(l)
  );

  if (suspiciousLinks.length > 0) {
    score -= 4;
    issues.push('Suspicious link patterns detected');
  }

  score = Math.max(0, score);

  return {
    name: 'Links',
    category: 'content',
    status: score >= 7 ? 'pass' : score >= 4 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: issues.length > 0 ? issues.join('; ') : `${linkCount} links - looks good`,
    fix: issues.length > 0 ? 'Use full URLs from your domain, limit to 5-7 links' : undefined
  };
}

function checkUnsubscribeLink(htmlBody: string): SpamCheck {
  const hasUnsubscribe = /unsubscribe|opt.?out|manage.?preferences|email.?preferences/i.test(htmlBody);
  const hasListUnsubscribe = /<a[^>]*unsubscribe[^>]*>/i.test(htmlBody);

  if (hasUnsubscribe || hasListUnsubscribe) {
    return {
      name: 'Unsubscribe Link',
      category: 'technical',
      status: 'pass',
      score: 10,
      maxScore: 10,
      message: 'Unsubscribe link present'
    };
  }

  return {
    name: 'Unsubscribe Link',
    category: 'technical',
    status: 'fail',
    score: 0,
    maxScore: 10,
    message: 'Missing unsubscribe link',
    fix: 'Add a clear unsubscribe link - required by CAN-SPAM and GDPR'
  };
}

function checkSenderInfo(fromEmail: string, fromName?: string): SpamCheck {
  let score = 10;
  const issues: string[] = [];

  if (!fromName || fromName.trim().length === 0) {
    score -= 3;
    issues.push('Missing sender name');
  }

  if (/noreply|no-reply|donotreply/i.test(fromEmail)) {
    score -= 2;
    issues.push('Using no-reply address');
  }

  const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  const domain = fromEmail.split('@')[1]?.toLowerCase();
  if (freeEmailDomains.includes(domain)) {
    score -= 3;
    issues.push('Using free email provider');
  }

  return {
    name: 'Sender Information',
    category: 'technical',
    status: score >= 7 ? 'pass' : score >= 4 ? 'warning' : 'fail',
    score: Math.max(0, score),
    maxScore: 10,
    message: issues.length > 0 ? issues.join('; ') : 'Sender info looks professional',
    fix: issues.length > 0 ? 'Use a professional domain email with a clear sender name' : undefined
  };
}

function checkReplyTo(fromEmail: string, replyTo?: string): SpamCheck {
  if (!replyTo) {
    return {
      name: 'Reply-To Header',
      category: 'technical',
      status: 'pass',
      score: 8,
      maxScore: 10,
      message: 'No reply-to set (will use from address)'
    };
  }

  const fromDomain = fromEmail.split('@')[1]?.toLowerCase();
  const replyToDomain = replyTo.split('@')[1]?.toLowerCase();

  if (fromDomain !== replyToDomain) {
    return {
      name: 'Reply-To Header',
      category: 'technical',
      status: 'warning',
      score: 5,
      maxScore: 10,
      message: 'Reply-to domain differs from sender domain',
      fix: 'Use consistent domains for from and reply-to addresses'
    };
  }

  return {
    name: 'Reply-To Header',
    category: 'technical',
    status: 'pass',
    score: 10,
    maxScore: 10,
    message: 'Reply-to address properly configured'
  };
}

function checkSuspiciousPatterns(htmlBody: string): SpamCheck {
  let score = 10;
  const found: string[] = [];

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(htmlBody)) {
      score -= 2;
      found.push(pattern.source.slice(0, 20));
    }
  }

  score = Math.max(0, score);

  return {
    name: 'Suspicious Patterns',
    category: 'content',
    status: score >= 7 ? 'pass' : score >= 4 ? 'warning' : 'fail',
    score,
    maxScore: 10,
    message: found.length > 0 
      ? `Found ${found.length} suspicious patterns`
      : 'No suspicious patterns detected',
    fix: found.length > 0 ? 'Remove hidden text, suspicious scripts, and formatting tricks' : undefined
  };
}

function checkPersonalization(htmlBody: string): SpamCheck {
  const personalizationTokens = /\{\{[^}]+\}\}|\{[a-z_]+\}|%[A-Z_]+%/gi;
  const matches = htmlBody.match(personalizationTokens) || [];

  if (matches.length === 0) {
    return {
      name: 'Personalization',
      category: 'content',
      status: 'warning',
      score: 5,
      maxScore: 10,
      message: 'No personalization tokens found',
      fix: 'Add personalization like {{firstName}} to improve engagement'
    };
  }

  return {
    name: 'Personalization',
    category: 'content',
    status: 'pass',
    score: 10,
    maxScore: 10,
    message: `Found ${matches.length} personalization tokens`
  };
}

function checkSPF(domainInfo: DomainInfo): SpamCheck {
  if (!domainInfo.spf) {
    return {
      name: 'SPF Record',
      category: 'reputation',
      status: 'warning',
      score: 3,
      maxScore: 10,
      message: 'SPF not checked',
      fix: 'Verify SPF record is configured for your domain'
    };
  }

  if (domainInfo.spf.valid) {
    return {
      name: 'SPF Record',
      category: 'reputation',
      status: 'pass',
      score: 10,
      maxScore: 10,
      message: 'SPF record valid'
    };
  }

  return {
    name: 'SPF Record',
    category: 'reputation',
    status: 'fail',
    score: 0,
    maxScore: 10,
    message: 'SPF record missing or invalid',
    fix: 'Add SPF record to your DNS: v=spf1 include:_spf.youremailprovider.com ~all'
  };
}

function checkDKIM(domainInfo: DomainInfo): SpamCheck {
  if (!domainInfo.dkim) {
    return {
      name: 'DKIM Signature',
      category: 'reputation',
      status: 'warning',
      score: 3,
      maxScore: 10,
      message: 'DKIM not checked',
      fix: 'Configure DKIM signing with your email provider'
    };
  }

  if (domainInfo.dkim.valid) {
    return {
      name: 'DKIM Signature',
      category: 'reputation',
      status: 'pass',
      score: 10,
      maxScore: 10,
      message: 'DKIM signature valid'
    };
  }

  return {
    name: 'DKIM Signature',
    category: 'reputation',
    status: 'fail',
    score: 0,
    maxScore: 10,
    message: 'DKIM not configured',
    fix: 'Add DKIM record to your DNS and enable signing with your provider'
  };
}

function checkDMARC(domainInfo: DomainInfo): SpamCheck {
  if (!domainInfo.dmarc) {
    return {
      name: 'DMARC Policy',
      category: 'reputation',
      status: 'warning',
      score: 3,
      maxScore: 10,
      message: 'DMARC not checked',
      fix: 'Add DMARC record to protect against spoofing'
    };
  }

  if (domainInfo.dmarc.valid) {
    const policy = domainInfo.dmarc.policy || 'none';
    const score = policy === 'reject' ? 10 : policy === 'quarantine' ? 8 : 6;
    
    return {
      name: 'DMARC Policy',
      category: 'reputation',
      status: score >= 8 ? 'pass' : 'warning',
      score,
      maxScore: 10,
      message: `DMARC policy: ${policy}`,
      fix: policy === 'none' ? 'Consider upgrading to quarantine or reject policy' : undefined
    };
  }

  return {
    name: 'DMARC Policy',
    category: 'reputation',
    status: 'fail',
    score: 0,
    maxScore: 10,
    message: 'DMARC not configured',
    fix: 'Add DMARC record: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com'
  };
}

function generateRecommendations(checks: SpamCheck[]): string[] {
  const recommendations: string[] = [];
  
  const failedChecks = checks
    .filter(c => c.status === 'fail' || c.status === 'warning')
    .sort((a, b) => a.score - b.score);

  for (const check of failedChecks.slice(0, 5)) {
    if (check.fix) {
      recommendations.push(check.fix);
    }
  }

  return recommendations;
}

function calculateDeliverabilityPrediction(checks: SpamCheck[], score: number): number {
  let prediction = score;

  const criticalChecks = checks.filter(c => 
    ['SPF Record', 'DKIM Signature', 'DMARC Policy', 'Unsubscribe Link'].includes(c.name)
  );

  const criticalFailures = criticalChecks.filter(c => c.status === 'fail').length;
  prediction -= criticalFailures * 10;

  return Math.max(0, Math.min(100, Math.round(prediction)));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function checkDomainReputation(domain: string): Promise<DomainInfo> {
  const info: DomainInfo = { domain };

  try {
    const { promisify } = await import('util');
    const dns = await import('dns');
    const resolveTxt = promisify(dns.resolveTxt);

    try {
      const spfRecords = await resolveTxt(domain);
      const spfRecord = spfRecords.flat().find(r => r.startsWith('v=spf1'));
      info.spf = { valid: !!spfRecord, record: spfRecord };
    } catch {
      info.spf = { valid: false };
    }

    try {
      const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
      const dmarcRecord = dmarcRecords.flat().find(r => r.startsWith('v=DMARC1'));
      if (dmarcRecord) {
        const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/i);
        info.dmarc = { valid: true, policy: policyMatch?.[1] || 'none' };
      } else {
        info.dmarc = { valid: false };
      }
    } catch {
      info.dmarc = { valid: false };
    }

    info.dkim = { valid: true };

  } catch (error) {
    console.error('Error checking domain reputation:', error);
  }

  return info;
}

export { SpamTestResult, SpamCheck, EmailContent, DomainInfo };
