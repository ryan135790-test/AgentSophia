/**
 * Agent Sophia With Workspace Learning Context
 * Injects performance data into Sophia's system prompt
 */

import { SOPHIA_SYSTEM_PROMPT } from './sophia-system-prompt';
import { generateSophiaContextForWorkspace } from './workspace-learning';

export function getSophiaSystemPromptWithContext(workspaceId: string): string {
  const learningContext = generateSophiaContextForWorkspace(workspaceId);
  
  return `${SOPHIA_SYSTEM_PROMPT}

## Workspace-Specific Intelligence
This is your workspace's performance data. Use it to make smarter decisions:

${learningContext}

## How to Use This Context
- When deciding which channel to prioritize: Choose high-performing channels
- When suggesting messaging: Apply lessons learned from successful campaigns
- When timing outreach: Use the best times identified in your workspace
- When analyzing responses: Compare against your workspace baselines

Remember: These recommendations are based on YOUR workspace's real results.
Apply your learning to every decision you make.`;
}

export function getSophiaContextSummary(workspaceId: string): {
  context: string;
  performanceSummary: string;
} {
  const context = generateSophiaContextForWorkspace(workspaceId);
  const performanceSummary = context
    .split('\n')
    .slice(0, 15) // First 15 lines for quick summary
    .join('\n');

  return {
    context,
    performanceSummary
  };
}
