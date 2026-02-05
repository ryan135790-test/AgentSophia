import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Settings, 
  Plus, 
  Trash2, 
  Clock, 
  MessageSquare,
  Linkedin,
  Mail,
  Twitter,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowStep {
  id: string;
  type: 'message' | 'delay' | 'condition' | 'action';
  channel: string;
  content: string;
  delay?: string;
  conditions?: any[];
}

interface WorkflowEditorProps {
  configurationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CHANNEL_ICONS = {
  linkedin: Linkedin,
  email: Mail,
  twitter: Twitter,
  sms: MessageSquare
};

const STEP_TYPES = [
  { value: 'message', label: 'Send Message', icon: MessageSquare },
  { value: 'delay', label: 'Wait/Delay', icon: Clock },
  { value: 'condition', label: 'Conditional Logic', icon: Settings },
  { value: 'action', label: 'Custom Action', icon: Zap }
];

const DELAY_OPTIONS = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '2d', label: '2 Days' },
  { value: '1w', label: '1 Week' },
  { value: '2w', label: '2 Weeks' },
  { value: '1m', label: '1 Month' }
];

export function WorkflowEditor({ configurationId, isOpen, onClose, onSave }: WorkflowEditorProps) {
  const { toast } = useToast();
  const [configuration, setConfiguration] = useState<any>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && configurationId) {
      fetchConfiguration();
    }
  }, [isOpen, configurationId]);

  const fetchConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('id', configurationId)
        .single();

      if (error) throw error;
      
      setConfiguration(data);
      
      // Extract workflow steps from config_data
      const configData = data.config_data as any;
      const workflowSteps = configData?.sequence || [];
      setSteps(workflowSteps.map((step: any, index: number) => ({
        id: `step-${index}`,
        type: step.action ? 'action' : 'message',
        channel: data.channels[0] || 'email',
        content: step.content || '',
        delay: step.delay || '0',
        ...step
      })));
    } catch (error) {
      console.error('Error fetching configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflow configuration',
        variant: 'destructive',
      });
    }
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type: 'message',
      channel: configuration?.channels[0] || 'email',
      content: '',
      delay: '0'
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const deleteStep = (stepId: string) => {
    setSteps(steps.filter(step => step.id !== stepId));
  };

  const saveWorkflow = async () => {
    setLoading(true);
    try {
      const updatedConfig = {
        ...configuration.config_data,
        sequence: steps.map(step => ({
          type: step.type,
          channel: step.channel,
          content: step.content,
          delay: step.delay,
          action: step.type === 'action' ? step.content : undefined
        }))
      };

      const { error } = await supabase
        .from('ai_configurations')
        .update({ 
          config_data: updatedConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', configurationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Workflow saved successfully',
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to save workflow',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedStep = steps.find(step => step.id === selectedStepId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Edit Workflow: {configuration?.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
          {/* Workflow Steps */}
          <div className="lg:col-span-2 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Workflow Steps</h3>
              <Button size="sm" onClick={addStep} className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const StepIcon = STEP_TYPES.find(t => t.value === step.type)?.icon || MessageSquare;
                const ChannelIcon = CHANNEL_ICONS[step.channel as keyof typeof CHANNEL_ICONS] || MessageSquare;
                
                return (
                  <Card 
                    key={step.id}
                    className={`cursor-pointer transition-all ${
                      selectedStepId === step.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedStepId(step.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <StepIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium capitalize">{step.type}</span>
                              {step.channel && (
                                <Badge variant="outline" className="text-xs">
                                  <ChannelIcon className="h-3 w-3 mr-1" />
                                  {step.channel}
                                </Badge>
                              )}
                              {step.delay && step.delay !== '0' && (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Wait {step.delay}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate max-w-md">
                              {step.content || 'No content specified'}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(step.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {steps.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No workflow steps yet. Add your first step to get started.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Step Editor */}
          <div className="space-y-4 overflow-y-auto">
            <h3 className="font-medium">Step Configuration</h3>
            
            {selectedStep ? (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label>Step Type</Label>
                    <Select 
                      value={selectedStep.type} 
                      onValueChange={(value) => updateStep(selectedStep.id, { type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STEP_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedStep.type !== 'delay' && (
                    <div>
                      <Label>Channel</Label>
                      <Select 
                        value={selectedStep.channel} 
                        onValueChange={(value) => updateStep(selectedStep.id, { channel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {configuration?.channels.map((channel: string) => (
                            <SelectItem key={channel} value={channel}>
                              {channel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedStep.type === 'delay' && (
                    <div>
                      <Label>Delay Duration</Label>
                      <Select 
                        value={selectedStep.delay} 
                        onValueChange={(value) => updateStep(selectedStep.id, { delay: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELAY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedStep.type !== 'delay' && (
                    <div>
                      <Label>
                        {selectedStep.type === 'message' ? 'Message Content' : 'Configuration'}
                      </Label>
                      <Textarea
                        value={selectedStep.content}
                        onChange={(e) => updateStep(selectedStep.id, { content: e.target.value })}
                        placeholder={
                          selectedStep.type === 'message' 
                            ? 'Enter your message content...' 
                            : 'Enter configuration details...'
                        }
                        rows={6}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Pre-step Delay</Label>
                    <Select 
                      value={selectedStep.delay || '0'} 
                      onValueChange={(value) => updateStep(selectedStep.id, { delay: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No delay</SelectItem>
                        {DELAY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Settings className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a step to configure its settings</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={saveWorkflow} disabled={loading} className="bg-gradient-primary">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Workflow'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}