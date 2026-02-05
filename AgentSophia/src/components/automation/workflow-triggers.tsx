import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowTrigger {
  id: string;
  name: string;
  trigger_condition: string;
  condition_value: string | null;
  action_type: string;
  action_details: Record<string, any>;
  enabled: boolean;
}

interface WorkflowTriggersProps {
  workspaceId: string;
}

const triggerConditions = [
  { value: 'no_reply_days', label: 'No reply for X days' },
  { value: 'email_opened', label: 'Email opened' },
  { value: 'lead_score_hot', label: 'Lead score becomes hot' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'tag_added', label: 'Tag added' },
];

const actionTypes = [
  { value: 'send_email', label: 'Send follow-up email' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'move_to_stage', label: 'Move to stage' },
  { value: 'add_tag', label: 'Add tag' },
  { value: 'send_followup', label: 'Send follow-up' },
];

export function WorkflowTriggers({ workspaceId }: WorkflowTriggersProps) {
  const { toast } = useToast();
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    trigger_condition: 'no_reply_days',
    condition_value: '3',
    action_type: 'send_email',
    action_details: { message: '' }
  });

  useEffect(() => {
    fetchTriggers();
  }, [workspaceId]);

  const fetchTriggers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/workflow-triggers`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      if (!response.ok) throw new Error('Failed to fetch triggers');
      const data = await response.json();
      setTriggers(data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load workflow triggers', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrigger = async () => {
    if (!formData.name.trim() || !formData.action_details.message?.trim()) {
      toast({ title: 'Error', description: 'Fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/workflow-triggers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to create trigger');

      const newTrigger = await response.json();
      setTriggers([...triggers, newTrigger]);
      setFormData({ 
        name: '', 
        trigger_condition: 'no_reply_days', 
        condition_value: '3',
        action_type: 'send_email',
        action_details: { message: '' }
      });
      setShowForm(false);
      toast({ title: 'Success', description: 'Workflow trigger created' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create trigger', variant: 'destructive' });
    }
  };

  const handleDeleteTrigger = async (triggerId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/workflow-triggers/${triggerId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete trigger');

      setTriggers(triggers.filter(t => t.id !== triggerId));
      toast({ title: 'Success', description: 'Trigger deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete trigger', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Workflow Triggers & Automation
          </CardTitle>
          <CardDescription>
            Automate actions based on contact behavior (e.g., "if no reply in 3 days → send follow-up")
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
              <Input
                placeholder="Trigger name (e.g., 'Follow-up After 3 Days')"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-trigger-name"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">When</label>
                  <Select value={formData.trigger_condition} onValueChange={(v) => setFormData({ ...formData, trigger_condition: v })}>
                    <SelectTrigger data-testid="select-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerConditions.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Value</label>
                  <Input
                    placeholder="3"
                    value={formData.condition_value || ''}
                    onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                    data-testid="input-condition-value"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Then</label>
                <Select value={formData.action_type} onValueChange={(v) => setFormData({ ...formData, action_type: v })}>
                  <SelectTrigger data-testid="select-action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <textarea
                placeholder="Message or action details"
                value={formData.action_details.message}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  action_details: { ...formData.action_details, message: e.target.value }
                })}
                className="w-full p-2 border rounded-lg bg-background text-foreground text-sm"
                rows={2}
                data-testid="textarea-action-message"
              />

              <div className="flex gap-2">
                <Button onClick={handleAddTrigger} size="sm" data-testid="button-create-trigger">
                  Create Trigger
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {triggers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No workflow triggers yet</p>
            ) : (
              triggers.map((trigger) => (
                <div key={trigger.id} className="border rounded-lg p-3 flex justify-between items-start" data-testid={`trigger-${trigger.id}`}>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{trigger.name}</p>
                    <p className="text-xs text-muted-foreground">
                      If <Badge variant="outline" className="text-xs">{trigger.trigger_condition}</Badge>
                      {trigger.condition_value && ` (${trigger.condition_value})`}
                      {' → '}
                      <Badge variant="outline" className="text-xs">{trigger.action_type}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">{trigger.action_details.message}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTrigger(trigger.id)}
                    data-testid={`button-delete-${trigger.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="w-full" data-testid="button-add-trigger">
              <Plus className="h-4 w-4 mr-2" />
              Add Workflow Trigger
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
