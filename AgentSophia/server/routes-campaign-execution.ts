import type { Express } from "express";
import { z } from "zod";
import { executeCampaignStep } from "./lib/channel-apis";
import { 
  executeCampaignStepWithUserAccounts, 
  validateUserConnectionsForCampaign,
  getUserConnectedChannels 
} from "./lib/user-channel-apis";
import { createClient } from '@supabase/supabase-js';

// Supabase client for authentication - use anon key for JWT verification (safer than service key)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

// Helper to get authenticated user - uses anon key for secure JWT verification
async function getAuthenticatedUser(req: any): Promise<{ id: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.substring(7);
  if (!token || token.length < 20) return null; // Basic validation
  
  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// Schema for campaign execution request
const campaignExecutionSchema = z.object({
  campaignId: z.string(),
  isDemo: z.boolean().optional().default(false),
  contacts: z.array(z.object({
    id: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    linkedinId: z.string().optional(),
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().optional(),
  })),
  steps: z.array(z.object({
    channel: z.enum(['email', 'linkedin', 'sms', 'phone', 'voicemail', 'social']),
    delay: z.number(),
    subject: z.string().optional(),
    content: z.string(),
  })),
  connectorConfigs: z.object({
    email: z.object({
      provider: z.enum(['sendgrid', 'resend', 'smtp']),
      apiKey: z.string(),
      fromEmail: z.string(),
      fromName: z.string(),
    }).optional(),
    sms: z.object({
      provider: z.enum(['twilio', 'vonage']),
      accountSid: z.string(),
      authToken: z.string(),
      fromNumber: z.string(),
    }).optional(),
    phone: z.object({
      provider: z.enum(['twilio', 'elevenlabs']),
      accountSid: z.string(),
      authToken: z.string(),
      voiceId: z.string().optional(),
      fromNumber: z.string().optional(),
    }).optional(),
    linkedin: z.object({
      accessToken: z.string(),
    }).optional(),
  }),
});

// Simulate sending for demo campaigns
async function simulateCampaignStep(
  channel: string,
  recipient: { email?: string; phone?: string; linkedinId?: string },
  content: { subject?: string; body: string }
) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Log simulated action
  console.log(`[DEMO] Simulated ${channel} to ${recipient.email || recipient.phone || recipient.linkedinId}`);
  console.log(`[DEMO] Subject: ${content.subject || 'N/A'}`);
  console.log(`[DEMO] Content preview: ${content.body.substring(0, 100)}...`);
  
  // Return simulated success
  return {
    success: true,
    messageId: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    simulated: true,
  };
}

export function registerCampaignExecutionRoutes(app: Express) {
  
  // Execute a campaign step
  app.post("/api/campaigns/execute", async (req, res) => {
    try {
      const data = campaignExecutionSchema.parse(req.body);
      const isDemo = data.isDemo;
      
      if (isDemo) {
        console.log(`🎭 [DEMO MODE] Executing campaign ${data.campaignId} in demo mode - no real messages will be sent`);
      } else {
        console.log(`🚀 [LIVE MODE] Executing campaign ${data.campaignId} - sending real messages`);
      }
      
      const results: Array<{
        contactId: string;
        channel: string;
        status: string;
        messageId?: string;
        error?: string;
        simulated?: boolean;
      }> = [];
      
      // Execute each step for each contact
      for (const step of data.steps) {
        // Get the appropriate config for this channel (only needed for live mode)
        const config = data.connectorConfigs[step.channel as keyof typeof data.connectorConfigs];
        
        // Only require config for live campaigns
        if (!isDemo && !config) {
          return res.status(400).json({
            error: `No connector configured for channel: ${step.channel}. Configure your ${step.channel} connection in My Connections or use Demo Mode.`
          });
        }
        
        // Process contacts in batches to avoid rate limits
        for (const contact of data.contacts) {
          try {
            // Personalize content with contact data
            let personalizedContent = step.content
              .replace(/\{\{first_name\}\}/g, contact.firstName)
              .replace(/\{\{last_name\}\}/g, contact.lastName)
              .replace(/\{\{company\}\}/g, contact.company || '');
            
            let personalizedSubject = step.subject
              ?.replace(/\{\{first_name\}\}/g, contact.firstName)
              .replace(/\{\{last_name\}\}/g, contact.lastName)
              .replace(/\{\{company\}\}/g, contact.company || '');
            
            let result: any;
            
            if (isDemo) {
              // Demo mode: simulate sending
              result = await simulateCampaignStep(
                step.channel,
                {
                  email: contact.email,
                  phone: contact.phone,
                  linkedinId: contact.linkedinId,
                },
                {
                  subject: personalizedSubject,
                  body: personalizedContent,
                }
              );
            } else {
              // Live mode: actually send
              result = await executeCampaignStep(
                step.channel,
                config,
                {
                  email: contact.email,
                  phone: contact.phone,
                  linkedinId: contact.linkedinId,
                },
                {
                  subject: personalizedSubject,
                  body: personalizedContent,
                }
              );
            }
            
            results.push({
              contactId: contact.id,
              channel: step.channel,
              status: 'sent',
              messageId: (result as any).messageId || (result as any).callId || (result as any).postId,
              simulated: isDemo,
            });
            
            // Add delay to respect rate limits (100ms between messages)
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`Error sending to ${contact.email}:`, error);
            results.push({
              contactId: contact.id,
              channel: step.channel,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        // Wait for the step delay before next step
        if (step.delay > 0) {
          console.log(`Waiting ${step.delay} days before next step (simulated as 1 second for demo)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      res.json({
        success: true,
        isDemo,
        results,
        summary: {
          total: results.length,
          sent: results.filter(r => r.status === 'sent').length,
          failed: results.filter(r => r.status === 'failed').length,
          simulated: isDemo ? results.filter(r => r.simulated).length : 0,
        },
        message: isDemo 
          ? `✅ Demo campaign completed! ${results.filter(r => r.status === 'sent').length} messages simulated (no real emails sent)`
          : `✅ Campaign launched! ${results.filter(r => r.status === 'sent').length} messages sent`
      });
      
    } catch (error) {
      console.error('Campaign execution error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Campaign execution failed'
      });
    }
  });
  
  // Test a specific connector
  app.post("/api/connectors/test", async (req, res) => {
    try {
      const { channel, config, testRecipient } = req.body;
      
      const testMessage = {
        subject: 'Test Message from AI Lead Platform',
        body: 'This is a test message to verify your connector is working correctly.',
      };
      
      const result = await executeCampaignStep(
        channel,
        config,
        testRecipient,
        testMessage
      );
      
      res.json({
        success: true,
        message: `${channel} connector is working correctly`,
        result,
      });
      
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Connector test failed'
      });
    }
  });
  
  // Save connector configuration (in production, this would save to database)
  app.post("/api/connectors/save", async (req, res) => {
    try {
      const { channel, config } = req.body;
      
      // In production, save to database
      // For now, just validate and return success
      
      res.json({
        success: true,
        message: `${channel} connector configuration saved successfully`,
      });
      
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to save connector'
      });
    }
  });

  // =====================================================
  // USER CONNECTIONS-BASED CAMPAIGN EXECUTION
  // These endpoints use the user's connected accounts from My Connections
  // =====================================================

  // Get user's connected channels status
  app.get("/api/campaigns/user-connections", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const connections = await getUserConnectedChannels(user.id);
      
      res.json({
        success: true,
        connections,
        message: 'User connection status retrieved',
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get user connections'
      });
    }
  });

  // Validate that user has required connections before running campaign
  app.post("/api/campaigns/validate-connections", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { channels } = req.body;
      if (!channels || !Array.isArray(channels)) {
        return res.status(400).json({ error: 'channels array is required' });
      }

      const validation = await validateUserConnectionsForCampaign(user.id, channels);
      
      res.json({
        success: true,
        ...validation,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to validate connections'
      });
    }
  });

  // Schema for user-connected campaign execution
  const userCampaignExecutionSchema = z.object({
    campaignId: z.string(),
    contacts: z.array(z.object({
      id: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      linkedinProfileUrl: z.string().optional(),
      linkedinId: z.string().optional(),
      firstName: z.string(),
      lastName: z.string(),
      company: z.string().optional(),
    })),
    steps: z.array(z.object({
      channel: z.enum(['email', 'linkedin', 'linkedin_message', 'linkedin_connection']),
      delay: z.number(),
      subject: z.string().optional(),
      content: z.string(),
      linkedInAction: z.enum(['message', 'connection_request']).optional(),
    })),
    options: z.object({
      emailProvider: z.enum(['gmail', 'office365']).optional(),
    }).optional(),
  });

  // Execute campaign using user's connected accounts
  app.post("/api/campaigns/execute-with-connections", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const data = userCampaignExecutionSchema.parse(req.body);
      
      // Get unique channels from steps
      const channels = [...new Set(data.steps.map(s => s.channel))];
      
      // Validate user has required connections
      const validation = await validateUserConnectionsForCampaign(user.id, channels);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Missing required connections',
          missingConnections: validation.missingConnections,
          message: validation.message,
        });
      }

      const results: Array<{
        contactId: string;
        channel: string;
        status: string;
        messageId?: string;
        error?: string;
      }> = [];
      
      // Execute each step for each contact
      for (const step of data.steps) {
        // Process contacts in batches to avoid rate limits
        for (const contact of data.contacts) {
          try {
            // Personalize content with contact data
            let personalizedContent = step.content
              .replace(/\{\{first_name\}\}/g, contact.firstName)
              .replace(/\{\{last_name\}\}/g, contact.lastName)
              .replace(/\{\{company\}\}/g, contact.company || '');
            
            let personalizedSubject = step.subject
              ?.replace(/\{\{first_name\}\}/g, contact.firstName)
              .replace(/\{\{last_name\}\}/g, contact.lastName)
              .replace(/\{\{company\}\}/g, contact.company || '');
            
            // Execute the step using user's connected accounts
            const result = await executeCampaignStepWithUserAccounts(
              user.id,
              step.channel,
              {
                email: contact.email,
                phone: contact.phone,
                linkedinProfileUrl: contact.linkedinProfileUrl,
                linkedinId: contact.linkedinId,
                firstName: contact.firstName,
                lastName: contact.lastName,
              },
              {
                subject: personalizedSubject,
                body: personalizedContent,
              },
              {
                emailProvider: data.options?.emailProvider,
                linkedInAction: step.linkedInAction,
              }
            );
            
            results.push({
              contactId: contact.id,
              channel: step.channel,
              status: result.success ? 'sent' : 'failed',
              messageId: result.messageId,
              error: result.error,
            });
            
            // Add delay to respect rate limits (100ms between messages)
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`Error sending to ${contact.email || contact.linkedinId}:`, error);
            results.push({
              contactId: contact.id,
              channel: step.channel,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        // Wait for the step delay before next step
        if (step.delay > 0) {
          console.log(`Waiting ${step.delay} days before next step (simulated as 1 second for demo)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          sent: results.filter(r => r.status === 'sent').length,
          failed: results.filter(r => r.status === 'failed').length,
        }
      });
      
    } catch (error) {
      console.error('Campaign execution error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Campaign execution failed'
      });
    }
  });

  // Test a channel using user's connected account
  app.post("/api/campaigns/test-connection", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { channel, testRecipient } = req.body;
      
      if (!channel) {
        return res.status(400).json({ error: 'channel is required' });
      }

      const testMessage = {
        subject: 'Test Message from AI Lead Platform',
        body: 'This is a test message to verify your connected account is working correctly.',
      };
      
      const result = await executeCampaignStepWithUserAccounts(
        user.id,
        channel,
        testRecipient || {},
        testMessage,
      );
      
      if (result.success) {
        res.json({
          success: true,
          message: `${channel} connection is working correctly`,
          messageId: result.messageId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Connection test failed',
        });
      }
      
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Connection test failed'
      });
    }
  });
}
