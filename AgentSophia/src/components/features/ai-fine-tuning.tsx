import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, Upload, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function AIFineTuning() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [modelName, setModelName] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);

  const createSession = async () => {
    if (!modelName.trim() || !currentWorkspace?.id) {
      toast({ title: 'Error', description: 'Model name required', variant: 'destructive' });
      return;
    }

    const response = await fetch(`/api/workspaces/${currentWorkspace.id}/fine-tuning-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName, data_category: 'conversation_style' })
    });

    if (response.ok) {
      const data = await response.json();
      setSessions([...sessions, data]);
      setModelName('');
      toast({ title: 'Success', description: 'Fine-tuning session created' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Custom AI Fine-tuning
          </CardTitle>
          <CardDescription>Train models on your company data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2" data-testid="input-model-name">
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Model name (e.g., sophia-sales-v1)"
              onKeyPress={(e) => e.key === 'Enter' && createSession()}
            />
            <Button onClick={createSession} data-testid="button-create-session">
              <Upload className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </div>
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((session, i) => (
              <div key={i} className="border rounded p-3" data-testid={`card-session-${i}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">{session.model_name}</p>
                    <p className="text-xs text-muted-foreground">{session.data_category}</p>
                  </div>
                  <Badge variant="secondary">{session.status}</Badge>
                </div>
                <div className="flex gap-1 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  0 training samples (100+ needed)
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
