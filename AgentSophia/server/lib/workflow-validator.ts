/**
 * Workflow Validator - Sophia checks her own work
 * Validates workflows, data requirements, and field mappings
 */

export interface WorkflowValidationIssue {
  severity: 'error' | 'warning';
  node: string;
  field: string;
  message: string;
  suggestion: string;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  issues: WorkflowValidationIssue[];
  suggestions: string[];
}

/**
 * Validate workflow nodes and their requirements
 */
export function validateWorkflow(
  nodes: any[],
  edges: any[],
  contactData: any[]
): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const suggestions: string[] = [];

  // Check each node for required fields
  for (const node of nodes) {
    switch (node.type) {
      case 'email':
        validateEmailNode(node, contactData, issues);
        break;
      case 'linkedin_message':
        validateLinkedInNode(node, contactData, issues);
        break;
      case 'sms':
        validateSmsNode(node, contactData, issues);
        break;
      case 'condition':
        validateConditionNode(node, issues);
        break;
    }
  }

  // Check workflow connectivity
  validateWorkflowFlow(nodes, edges, issues);

  // Generate smart suggestions
  if (issues.length > 0) {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    
    if (errorCount > 0) {
      suggestions.push(`Found ${errorCount} blocking error${errorCount > 1 ? 's' : ''}. Fix these before launch.`);
    }
    if (warningCount > 0) {
      suggestions.push(`${warningCount} warning${warningCount > 1 ? 's' : ''} detected. Review recommended.`);
    }
  }

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    suggestions
  };
}

function validateEmailNode(node: any, contactData: any[], issues: WorkflowValidationIssue[]) {
  const config = node.data?.config || {};
  
  // Check if template has required placeholders
  const template = config.template || '';
  
  if (!template) {
    issues.push({
      severity: 'error',
      node: node.id,
      field: 'template',
      message: 'Email template is empty',
      suggestion: 'Add email template content with personalization tags like [Name], [Company]'
    });
  }

  // Check if contacts have email field
  if (contactData.length > 0) {
    const missingEmails = contactData.filter(c => !c.email).length;
    if (missingEmails > 0) {
      issues.push({
        severity: 'warning',
        node: node.id,
        field: 'email',
        message: `${missingEmails} contacts missing email addresses`,
        suggestion: 'Remove or update contacts without email addresses before sending'
      });
    }
  }

  // Check for personalization tags
  if (template && !template.includes('[') && !template.includes('{')) {
    issues.push({
      severity: 'warning',
      node: node.id,
      field: 'personalization',
      message: 'No personalization detected',
      suggestion: 'Add tags like [Name], [Company], [Industry] for better engagement'
    });
  }
}

function validateLinkedInNode(node: any, contactData: any[], issues: WorkflowValidationIssue[]) {
  const config = node.data?.config || {};
  
  // Check if contacts have LinkedIn URLs
  if (contactData.length > 0) {
    const missingLinkedIn = contactData.filter(c => !c.linkedin_url).length;
    if (missingLinkedIn > 0) {
      issues.push({
        severity: 'error',
        node: node.id,
        field: 'linkedin_url',
        message: `${missingLinkedIn} contacts missing LinkedIn profiles`,
        suggestion: 'Enrich contact data with LinkedIn URLs. Use LinkedIn search or data provider.'
      });
    }
  }

  // Check message content
  const message = config.template || '';
  if (!message) {
    issues.push({
      severity: 'error',
      node: node.id,
      field: 'message',
      message: 'LinkedIn message is empty',
      suggestion: 'Write a compelling LinkedIn message. Keep under 300 characters for better delivery.'
    });
  }
}

function validateSmsNode(node: any, contactData: any[], issues: WorkflowValidationIssue[]) {
  // Check if contacts have phone numbers
  if (contactData.length > 0) {
    const missingPhones = contactData.filter(c => !c.phone).length;
    if (missingPhones > 0) {
      issues.push({
        severity: 'error',
        node: node.id,
        field: 'phone',
        message: `${missingPhones} contacts missing phone numbers`,
        suggestion: 'Add phone numbers to contacts. Format: +1XXXXXXXXXX or use a data enrichment service.'
      });
    }
  }

  // Check SMS length
  const message = node.data?.config?.message || '';
  if (message.length > 160) {
    issues.push({
      severity: 'warning',
      node: node.id,
      field: 'message_length',
      message: `SMS message is ${message.length} characters (may be split into multiple messages)`,
      suggestion: 'Shorten message to under 160 characters for single SMS delivery and better rates.'
    });
  }
}

function validateConditionNode(node: any, issues: WorkflowValidationIssue[]) {
  const config = node.data?.config || {};
  
  if (!config.condition || !config.condition.trim()) {
    issues.push({
      severity: 'error',
      node: node.id,
      field: 'condition',
      message: 'Condition is empty',
      suggestion: 'Define condition logic: e.g., "if replied" or "if not opened after 3 days"'
    });
  }
}

function validateWorkflowFlow(nodes: any[], edges: any[], issues: WorkflowValidationIssue[]) {
  // Check if any node has no outgoing edges (except final nodes)
  const nodesWithOutEdges = edges.map(e => e.source);
  
  for (const node of nodes) {
    if (node.type !== 'condition' && !nodesWithOutEdges.includes(node.id) && nodes.length > 1) {
      issues.push({
        severity: 'warning',
        node: node.id,
        field: 'connectivity',
        message: 'Node has no outgoing connection',
        suggestion: 'Connect this node to the next step in the workflow, or make it the final node.'
      });
    }
  }
}

/**
 * Check if contact database has required fields
 */
export function validateContactSchema(
  requiredFields: string[],
  availableFields: string[]
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  
  for (const field of requiredFields) {
    if (!availableFields.includes(field)) {
      issues.push({
        severity: 'error',
        node: 'contacts',
        field: field,
        message: `Required field "${field}" not found in contact database`,
        suggestion: `Add "${field}" field to your contact records or import from a data source.`
      });
    }
  }

  return issues;
}

/**
 * Analyze workflow and provide optimization suggestions
 */
export function getWorkflowOptimizations(workflow: any): string[] {
  const suggestions: string[] = [];
  const nodes = workflow.nodes || [];

  // Check for wait nodes between sends
  const hasWaitBetweenSends = nodes.some(n => n.type === 'wait');
  if (!hasWaitBetweenSends && nodes.length > 1) {
    suggestions.push('💡 Add wait nodes between messages to improve response rates (e.g., 3-day wait)');
  }

  // Check for branching logic
  const hasConditions = nodes.some(n => n.type === 'condition');
  if (!hasConditions && nodes.length > 2) {
    suggestions.push('💡 Add conditions to branch based on responses (e.g., different follow-up if replied)');
  }

  // Check sequence complexity
  if (nodes.length === 1) {
    suggestions.push('💡 Consider adding follow-up steps to increase engagement');
  }

  // Check channel diversity
  const channels = new Set(nodes.map(n => n.type));
  if (channels.size === 1) {
    suggestions.push('💡 Try multi-channel approach for better reach');
  }

  return suggestions;
}
