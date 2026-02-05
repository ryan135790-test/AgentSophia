import { z } from 'zod';

// Connector configuration schemas
export const emailConnectorSchema = z.object({
  provider: z.enum(['sendgrid', 'resend', 'smtp', 'gmail', 'outlook']),
  // API key fields (for SendGrid, Resend)
  apiKey: z.string().optional(),
  fromEmail: z.string().email('Valid email required').optional(),
  fromName: z.string().optional(),
  // SMTP fields
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  // OAuth fields (for Gmail, Outlook)
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiry: z.number().optional(),
  userEmail: z.string().email().optional(), // The connected email account
});

export const smsConnectorSchema = z.object({
  provider: z.enum(['twilio', 'vonage']),
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth token is required'),
  fromNumber: z.string().min(1, 'From number is required'),
});

export const phoneConnectorSchema = z.object({
  provider: z.enum(['twilio', 'elevenlabs']),
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth token is required'),
  voiceId: z.string().optional(),
  fromNumber: z.string().optional(),
});

export const linkedinConnectorSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

export const socialConnectorSchema = z.object({
  platform: z.enum(['twitter', 'facebook', 'instagram']),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
});

export const connectorConfigSchema = z.object({
  userId: z.string().optional(), // If user-level, otherwise system-wide
  isSystemWide: z.boolean().default(false),
  email: emailConnectorSchema.optional(),
  sms: smsConnectorSchema.optional(),
  phone: phoneConnectorSchema.optional(),
  linkedin: linkedinConnectorSchema.optional(),
  social: z.array(socialConnectorSchema).optional(),
});

export type EmailConnector = z.infer<typeof emailConnectorSchema>;
export type SMSConnector = z.infer<typeof smsConnectorSchema>;
export type PhoneConnector = z.infer<typeof phoneConnectorSchema>;
export type LinkedInConnector = z.infer<typeof linkedinConnectorSchema>;
export type SocialConnector = z.infer<typeof socialConnectorSchema>;
export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;
