import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ResponseTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (template: any) => void;
}

const INTENTS = ['interested', 'question', 'objection', 'meeting_request', 'approval', 'rejection'];

export function ResponseTemplateForm({ open, onOpenChange, onSubmit }: ResponseTemplateFormProps) {
  const { currentWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  const handleAddIntent = (intent: string) => {
    if (!selectedIntents.includes(intent)) {
      setSelectedIntents([...selectedIntents, intent]);
    }
  };

  const handleRemoveIntent = (intent: string) => {
    setSelectedIntents(selectedIntents.filter(i => i !== intent));
  };

  const handleSubmit = async () => {
    if (!name || !template || selectedIntents.length === 0) {
      alert('Please fill in all fields');
      return;
    }

    if (!workspaceId) {
      alert('No workspace selected');
      return;
    }

    if (isDemo) {
      alert('This is demo data. Create a real workspace to use this feature.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/response-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          template,
          intent_tags: selectedIntents,
          requires_approval: requiresApproval,
        })
      });

      if (res.ok) {
        const data = await res.json();
        onSubmit?.(data);
        onOpenChange(false);
        setName('');
        setTemplate('');
        setSelectedIntents([]);
        setRequiresApproval(false);
      }
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Response Template</DialogTitle>
          <DialogDescription>
            Create a template that Sophia will suggest for specific message intents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quick Meeting Offer"
            />
          </div>

          {/* Intent Selection */}
          <div className="space-y-2">
            <Label>Apply to Intents</Label>
            <div className="grid grid-cols-2 gap-2">
              {INTENTS.map(intent => (
                <button
                  key={intent}
                  onClick={() => handleAddIntent(intent)}
                  disabled={selectedIntents.includes(intent)}
                  className={`p-2 rounded border text-sm text-left transition ${
                    selectedIntents.includes(intent)
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500'
                      : 'hover:border-blue-400'
                  }`}
                >
                  {intent.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedIntents.map(intent => (
                <Badge key={intent} variant="secondary" className="flex items-center gap-1">
                  {intent}
                  <button onClick={() => handleRemoveIntent(intent)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Template Content */}
          <div className="space-y-2">
            <Label htmlFor="template">Response Template</Label>
            <Textarea
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Enter your template. Use {{name}} for contact name, {{company}} for company..."
              className="min-h-40"
            />
            <p className="text-xs text-slate-500">
              Available variables: {'{{name}}, {{company}}, {{email}}, {{title}}'}
            </p>
          </div>

          {/* Approval Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="approval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="approval" className="cursor-pointer">
              Require approval before sending
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
