import { Router, Request, Response } from "express";
import { pool } from "./db";
import { 
  sophiaConversationSchema, 
  sophiaMessageSchema,
  sophiaMemorySchema,
  sophiaContactMemorySchema 
} from "../shared/schema";

const router = Router();

// ============================================
// CONVERSATIONS
// ============================================

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const workspaceId = req.query.workspace_id as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const result = await pool.query(
      `SELECT * FROM sophia_conversations 
       WHERE user_id = $1 
       ${workspaceId ? 'AND workspace_id = $2' : ''} 
       AND is_archived = false
       ORDER BY last_message_at DESC NULLS LAST, created_at DESC 
       LIMIT $${workspaceId ? 3 : 2}`,
      workspaceId ? [userId, workspaceId, limit] : [userId, limit]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const data = sophiaConversationSchema.parse(req.body);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        workspace_id UUID,
        title TEXT,
        context TEXT,
        summary TEXT,
        message_count INTEGER DEFAULT 0,
        last_message_at TIMESTAMPTZ,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `INSERT INTO sophia_conversations (user_id, workspace_id, title, context, summary, message_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.user_id, data.workspace_id, data.title, data.context, data.summary, data.message_count || 0]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM sophia_conversations WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, summary, is_archived } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (summary !== undefined) {
      updates.push(`summary = $${paramIndex++}`);
      values.push(summary);
    }
    if (is_archived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`);
      values.push(is_archived);
    }
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE sophia_conversations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MESSAGES
// ============================================

router.get("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT * FROM sophia_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/messages", async (req: Request, res: Response) => {
  try {
    const data = sophiaMessageSchema.parse(req.body);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES sophia_conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        context_page TEXT,
        contact_id UUID,
        campaign_id UUID,
        model_used TEXT,
        tokens_used INTEGER,
        confidence_score REAL,
        was_helpful BOOLEAN,
        feedback_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `INSERT INTO sophia_messages 
       (conversation_id, user_id, role, content, context_page, contact_id, campaign_id, model_used, tokens_used, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.conversation_id, data.user_id, data.role, data.content,
        data.context_page, data.contact_id, data.campaign_id,
        data.model_used, data.tokens_used, data.confidence_score
      ]
    );

    await pool.query(
      `UPDATE sophia_conversations 
       SET message_count = message_count + 1, 
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [data.conversation_id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/messages/:id/feedback", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { was_helpful, feedback_notes } = req.body;

    const result = await pool.query(
      `UPDATE sophia_messages 
       SET was_helpful = $1, feedback_notes = $2 
       WHERE id = $3 
       RETURNING *`,
      [was_helpful, feedback_notes, id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating message feedback:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MEMORY (User preferences and facts)
// ============================================

router.get("/memory", async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const workspaceId = req.query.workspace_id as string;
    const memoryType = req.query.memory_type as string;
    const category = req.query.category as string;

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    let query = `SELECT * FROM sophia_memory WHERE user_id = $1 AND is_active = true`;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (workspaceId) {
      query += ` AND workspace_id = $${paramIndex++}`;
      params.push(workspaceId);
    }
    if (memoryType) {
      query += ` AND memory_type = $${paramIndex++}`;
      params.push(memoryType);
    }
    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    query += ` ORDER BY confidence DESC, updated_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching memory:", error);
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/memory", async (req: Request, res: Response) => {
  try {
    const data = sophiaMemorySchema.parse(req.body);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        workspace_id UUID,
        memory_type TEXT NOT NULL,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 70,
        source_conversation_id UUID,
        source_message_id UUID,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMPTZ,
        last_validated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const existing = await pool.query(
      `SELECT id, confidence FROM sophia_memory 
       WHERE user_id = $1 AND category = $2 AND key = $3 AND is_active = true`,
      [data.user_id, data.category, data.key]
    );

    let result;
    if (existing.rows.length > 0) {
      const newConfidence = Math.min(100, (existing.rows[0].confidence + (data.confidence || 70)) / 2 + 5);
      result = await pool.query(
        `UPDATE sophia_memory 
         SET value = $1, confidence = $2, last_validated_at = NOW(), updated_at = NOW()
         WHERE id = $3 
         RETURNING *`,
        [data.value, newConfidence, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sophia_memory 
         (user_id, workspace_id, memory_type, category, key, value, confidence, source_conversation_id, source_message_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.user_id, data.workspace_id, data.memory_type, data.category,
          data.key, data.value, data.confidence || 70,
          data.source_conversation_id, data.source_message_id
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error saving memory:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/memory/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE sophia_memory SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting memory:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONTACT MEMORY
// ============================================

router.get("/contact-memory/:contactId", async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const result = await pool.query(
      `SELECT * FROM sophia_contact_memory 
       WHERE contact_id = $1 AND user_id = $2 AND is_active = true
       ORDER BY confidence DESC, updated_at DESC`,
      [contactId, userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching contact memory:", error);
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/contact-memory", async (req: Request, res: Response) => {
  try {
    const data = sophiaContactMemorySchema.parse(req.body);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_contact_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        contact_id UUID NOT NULL,
        workspace_id UUID,
        memory_type TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 70,
        is_active BOOLEAN DEFAULT true,
        source_type TEXT,
        source_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `INSERT INTO sophia_contact_memory 
       (user_id, contact_id, workspace_id, memory_type, key, value, confidence, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.user_id, data.contact_id, data.workspace_id, data.memory_type,
        data.key, data.value, data.confidence || 70, data.source_type, data.source_id
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error saving contact memory:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MEMORY CONTEXT FOR AI PROMPTS
// ============================================

router.get("/context/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const workspaceId = req.query.workspace_id as string;
    const contactId = req.query.contact_id as string;

    const context: any = {
      userMemories: [],
      recentConversations: [],
      contactMemories: []
    };

    try {
      const memoriesResult = await pool.query(
        `SELECT memory_type, category, key, value, confidence 
         FROM sophia_memory 
         WHERE user_id = $1 AND is_active = true
         ORDER BY confidence DESC 
         LIMIT 20`,
        [userId]
      );
      context.userMemories = memoriesResult.rows;
    } catch (e) { }

    try {
      const convResult = await pool.query(
        `SELECT id, title, summary, context, last_message_at 
         FROM sophia_conversations 
         WHERE user_id = $1 AND is_archived = false
         ORDER BY last_message_at DESC NULLS LAST 
         LIMIT 5`,
        [userId]
      );
      context.recentConversations = convResult.rows;
    } catch (e) { }

    if (contactId) {
      try {
        const contactMemResult = await pool.query(
          `SELECT memory_type, key, value, confidence 
           FROM sophia_contact_memory 
           WHERE user_id = $1 AND contact_id = $2 AND is_active = true
           ORDER BY confidence DESC 
           LIMIT 10`,
          [userId, contactId]
        );
        context.contactMemories = contactMemResult.rows;
      } catch (e) { }
    }

    res.json(context);
  } catch (error: any) {
    console.error("Error fetching memory context:", error);
    res.status(500).json({ error: error.message });
  }
});

// Build memory context string for AI prompts
router.get("/context-prompt/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const contactId = req.query.contact_id as string;

    let memoryPrompt = "";

    try {
      const memories = await pool.query(
        `SELECT memory_type, category, key, value 
         FROM sophia_memory 
         WHERE user_id = $1 AND is_active = true AND confidence >= 60
         ORDER BY confidence DESC 
         LIMIT 15`,
        [userId]
      );

      if (memories.rows.length > 0) {
        memoryPrompt += "\n\n## What I Remember About You:\n";
        const grouped: Record<string, string[]> = {};
        for (const mem of memories.rows) {
          if (!grouped[mem.category]) grouped[mem.category] = [];
          grouped[mem.category].push(`- ${mem.key}: ${mem.value}`);
        }
        for (const [cat, items] of Object.entries(grouped)) {
          memoryPrompt += `\n**${cat}:**\n${items.join('\n')}`;
        }
      }
    } catch (e) { }

    try {
      const recentConv = await pool.query(
        `SELECT title, summary FROM sophia_conversations 
         WHERE user_id = $1 AND summary IS NOT NULL AND is_archived = false
         ORDER BY last_message_at DESC NULLS LAST 
         LIMIT 3`,
        [userId]
      );

      if (recentConv.rows.length > 0) {
        memoryPrompt += "\n\n## Recent Conversations:\n";
        for (const conv of recentConv.rows) {
          memoryPrompt += `- ${conv.title || 'Chat'}: ${conv.summary}\n`;
        }
      }
    } catch (e) { }

    if (contactId) {
      try {
        const contactMem = await pool.query(
          `SELECT memory_type, key, value FROM sophia_contact_memory 
           WHERE user_id = $1 AND contact_id = $2 AND is_active = true
           ORDER BY confidence DESC 
           LIMIT 8`,
          [userId, contactId]
        );

        if (contactMem.rows.length > 0) {
          memoryPrompt += "\n\n## About This Contact:\n";
          for (const mem of contactMem.rows) {
            memoryPrompt += `- ${mem.key}: ${mem.value}\n`;
          }
        }
      } catch (e) { }
    }

    res.json({ memoryPrompt });
  } catch (error: any) {
    console.error("Error building memory prompt:", error);
    res.json({ memoryPrompt: "" });
  }
});

export default router;
