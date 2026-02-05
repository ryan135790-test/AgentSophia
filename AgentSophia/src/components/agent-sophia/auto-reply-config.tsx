import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AutoReplyRule {
  id: string;
  name: string;
  intent_keywords: string[];
  response_template: string;
  enabled: boolean;
  requires_approval: boolean;
  channels: string[];
}

interface AutoReplyConfigProps {
  workspaceId: string;
}

export function AutoReplyConfig({ workspaceId }: AutoReplyConfigProps) {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    intent_keywords: '',
    response_template: '',
    requires_approval: false,
    channels: ['email']
  });

  useEffect(() => {
    fetchRules();
  }, [workspaceId]);

  const fetchRules = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/auto-reply-rules`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load auto-reply rules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!formData.name.trim() || !formData.intent_keywords.trim() || !formData.response_template.trim()) {
      toast({ title: 'Error', description: 'Fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/auto-reply-rules`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          name: formData.name,
          intent_keywords: formData.intent_keywords.split(',').map(k => k.trim()),
          response_template: formData.response_template,
          requires_approval: formData.requires_approval,
          channels: formData.channels
        })
      });

      if (!response.ok) throw new Error('Failed to create rule');

      const newRule = await response.json();
      setRules([...rules, newRule]);
      setFormData({ name: '', intent_keywords: '', response_template: '', requires_approval: false, channels: ['email'] });
      setShowForm(false);
      toast({ title: 'Success', description: 'Auto-reply rule created' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create rule', variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/auto-reply-rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete rule');

      setRules(rules.filter(r => r.id !== ruleId));
      toast({ title: 'Success', description: 'Rule deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Auto-Reply Rules
          </CardTitle>
          <CardDescription>
            Automatically respond to messages matching specific intents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
              <Input
                placeholder="Rule name (e.g., 'Greeting Response')"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-rule-name"
              />
              <Input
                placeholder="Intent keywords (comma-separated, e.g., 'hello, hi, greetings')"
                value={formData.intent_keywords}
                onChange={(e) => setFormData({ ...formData, intent_keywords: e.target.value })}
                data-testid="input-keywords"
              />
              <textarea
                placeholder="Response template (use {name} for contact name, {company} for company)"
                value={formData.response_template}
                onChange={(e) => setFormData({ ...formData, response_template: e.target.value })}
                className="w-full p-2 border rounded-lg bg-background text-foreground"
                rows={3}
                data-testid="textarea-response"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.requires_approval}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: Boolean(checked) })}
                  data-testid="checkbox-requires-approval"
                />
                <label className="text-sm cursor-pointer">Require approval before sending</label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddRule} size="sm" data-testid="button-create-rule">
                  Create Rule
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No auto-reply rules yet</p>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-3 flex justify-between items-start" data-testid={`rule-${rule.id}`}>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{rule.name}</p>
                    <div className="flex gap-1 flex-wrap">
                      {rule.intent_keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{rule.response_template.substring(0, 80)}...</p>
                    <div className="flex gap-2 text-xs">
                      {rule.requires_approval && <Badge variant="outline">Needs Approval</Badge>}
                      {!rule.requires_approval && <Badge variant="outline" className="bg-green-50">Fully Autonomous</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                    data-testid={`button-delete-${rule.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="w-full" data-testid="button-add-rule">
              <Plus className="h-4 w-4 mr-2" />
              Add Auto-Reply Rule
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
