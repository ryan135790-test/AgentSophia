import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function ContentGenerator() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [channel, setChannel] = useState('email');
  const [category, setCategory] = useState('outreach');
  const [context, setContext] = useState('');
  const [generated, setGenerated] = useState('');

  const generateContent = async () => {
    if (!context.trim() || !currentWorkspace?.id) {
      toast({ title: 'Error', description: 'Please provide context', variant: 'destructive' });
      return;
    }

    const response = await fetch(`/api/workspaces/${currentWorkspace.id}/generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, category, context })
    });

    if (response.ok) {
      const data = await response.json();
      setGenerated(data.generated_content);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Content Generation Hub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div data-testid="select-channel">
              <label className="text-sm font-medium">Channel</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div data-testid="select-category">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outreach">Outreach</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="objection_handling">Objection Handling</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div data-testid="textarea-context">
            <label className="text-sm font-medium">Context</label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe what you want to send..."
              className="mt-1"
            />
          </div>

          <Button onClick={generateContent} className="w-full" data-testid="button-generate">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Content
          </Button>

          {generated && (
            <div className="border rounded p-3 bg-gray-50" data-testid="card-generated">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium mb-2">Generated Content</p>
                  <p className="text-sm">{generated}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(generated);
                    toast({ title: 'Copied!' });
                  }}
                  data-testid="button-copy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
