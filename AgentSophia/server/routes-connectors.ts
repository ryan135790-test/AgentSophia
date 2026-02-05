import type { Express } from "express";
import { connectorConfigSchema } from "../shared/connector-schema";

// In-memory storage for connectors (in production, use database)
const connectorConfigs = new Map<string, any>();
const systemConnectorConfig: any = {};

export function registerConnectorRoutes(app: Express) {
  
  // Get system-wide connector configuration (admin only)
  app.get("/api/connectors/system", async (req, res) => {
    try {
      // In production, check if user is admin
      res.json({
        success: true,
        config: systemConnectorConfig,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get system connectors'
      });
    }
  });

  // Save system-wide connector configuration (admin only)
  app.post("/api/connectors/system", async (req, res) => {
    try {
      const config = connectorConfigSchema.parse({
        ...req.body,
        isSystemWide: true,
      });
      
      // Save to system config
      Object.assign(systemConnectorConfig, config);
      
      res.json({
        success: true,
        message: 'System connectors configured successfully',
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to save system connectors'
      });
    }
  });

  // Get user-specific connector configuration
  app.get("/api/connectors/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const userConfig = connectorConfigs.get(userId);
      
      res.json({
        success: true,
        config: userConfig || {},
        systemConfig: systemConnectorConfig, // Also return system config as fallback
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get user connectors'
      });
    }
  });

  // Save user-specific connector configuration
  app.post("/api/connectors/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const config = connectorConfigSchema.parse({
        ...req.body,
        userId,
        isSystemWide: false,
      });
      
      connectorConfigs.set(userId, config);
      
      res.json({
        success: true,
        message: 'User connectors configured successfully',
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to save user connectors'
      });
    }
  });

  // Test a specific connector
  app.post("/api/connectors/test", async (req, res) => {
    try {
      const { channel, config, testRecipient } = req.body;
      
      // Import the channel APIs
      const { executeCampaignStep } = await import('./lib/channel-apis');
      
      const testMessage = {
        subject: 'Test Message from AI Lead Platform',
        body: 'This is a test message to verify your connector is working correctly.',
      };
      
      const result = await executeCampaignStep(
        channel,
        config,
        testRecipient || { email: 'test@example.com' },
        testMessage
      );
      
      res.json({
        success: true,
        message: `${channel} connector is working correctly`,
        result,
      });
      
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Connector test failed'
      });
    }
  });

  // Get effective connector config (user config with system fallback)
  app.get("/api/connectors/effective/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const userConfig = connectorConfigs.get(userId) || {};
      
      // Merge system and user configs (user config takes precedence)
      const effectiveConfig = {
        email: userConfig.email || systemConnectorConfig.email,
        sms: userConfig.sms || systemConnectorConfig.sms,
        phone: userConfig.phone || systemConnectorConfig.phone,
        linkedin: userConfig.linkedin || systemConnectorConfig.linkedin,
        social: userConfig.social || systemConnectorConfig.social,
      };
      
      res.json({
        success: true,
        config: effectiveConfig,
        source: {
          email: userConfig.email ? 'user' : 'system',
          sms: userConfig.sms ? 'user' : 'system',
          phone: userConfig.phone ? 'user' : 'system',
          linkedin: userConfig.linkedin ? 'user' : 'system',
          social: userConfig.social ? 'user' : 'system',
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get effective connectors'
      });
    }
  });
}
