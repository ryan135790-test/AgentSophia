import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, 
  Plus, 
  Settings, 
  Linkedin, 
  Mail, 
  Twitter, 
  MessageSquare,
  Zap,
  Edit,
  Trash2,
  Play,
  Pause
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkflowEditor } from './workflow-editor';

interface AIConfiguration {
  id: string;
  name: string;
  description: string;
  channels: string[];
  config_data: any;
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_CHANNELS = [
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
  { id: 'email', name: 'Email', icon: Mail, color: 'text-green-600' },
  { id: 'twitter', name: 'Twitter', icon: Twitter, color: 'text-blue-400' },
  { id: 'sms', name: 'SMS', icon: MessageSquare, color: 'text-purple-600' },
];

const AI_TEMPLATES = [
  {
    id: 'lead_nurturing',
    name: 'Lead Nurturing Campaign',
    description: 'Automated sequence to nurture leads through the sales funnel',
    channels: ['email', 'linkedin'],
    config: {
      trigger: 'new_lead',
      sequence: [
        { delay: '0', action: 'welcome_message' },
        { delay: '2d', action: 'value_content' },
        { delay: '1w', action: 'case_study' },
        { delay: '2w', action: 'demo_offer' }
      ]
    }
  },
  {
    id: 'linkedin_outreach',
    name: 'LinkedIn Connection Campaign',
    description: 'Personalized LinkedIn outreach with AI-generated messages',
    channels: ['linkedin'],
    config: {
      trigger: 'manual',
      targeting: {
        job_titles: [],
        industries: [],
        company_size: 'any'
      },
      message_template: 'personalized'
    }
  },
  {
    id: 'email_sequences',
    name: 'Email Sequence Campaign',
    description: 'Multi-touch email campaign with AI optimization',
    channels: ['email'],
    config: {
      trigger: 'form_submission',
      optimization: {
        subject_lines: true,
        send_times: true,
        content_personalization: true
      }
    }
  }
];

export function MultiChannelBuilder({ onOpenAIChat }: { onOpenAIChat?: (type: 'workflow' | 'campaign' | 'analysis') => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configurations, setConfigurations] = useState<AIConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channels: [] as string[],
    config_data: {}
  });

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createConfiguration = async () => {
    if (!formData.name || formData.channels.length === 0) {
      toast({
        title: 'Error',
        description: 'Please provide a name and select at least one channel',
        variant: 'destructive',
      });
      return;
    }

    try {
      const template = AI_TEMPLATES.find(t => t.id === selectedTemplate);
      const config_data = template ? template.config : formData.config_data;

      const { error } = await supabase
        .from('ai_configurations')
        .insert({
          user_id: user?.id,
          name: formData.name,
          description: formData.description,
          channels: formData.channels,
          config_data,
          is_active: false
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'AI configuration created successfully',
      });

      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', channels: [], config_data: {} });
      setSelectedTemplate('');
      fetchConfigurations();
    } catch (error) {
      console.error('Error creating configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to create AI configuration',
        variant: 'destructive',
      });
    }
  };

  const toggleConfiguration = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_configurations')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Configuration ${!isActive ? 'activated' : 'deactivated'}`,
      });

      fetchConfigurations();
    } catch (error) {
      console.error('Error toggling configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to update configuration',
        variant: 'destructive',
      });
    }
  };

  const deleteConfiguration = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Configuration deleted successfully',
      });

      fetchConfigurations();
    } catch (error) {
      console.error('Error deleting configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete configuration',
        variant: 'destructive',
      });
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = AI_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        channels: template.channels,
        config_data: template.config
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Bot className="h-8 w-8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Multi-Channel AI Builder</h2>
          <p className="text-muted-foreground">Create and manage AI-powered automation workflows</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create AI Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create AI Workflow</DialogTitle>
              <DialogDescription>
                Build a multi-channel AI automation workflow to engage leads across platforms
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">Use Template</TabsTrigger>
                <TabsTrigger value="custom">Custom Build</TabsTrigger>
              </TabsList>
              
              <TabsContent value="template" className="space-y-4">
                <div className="space-y-4">
                  <Label>Choose a Template</Label>
                  <div className="grid gap-3">
                    {AI_TEMPLATES.map((template) => (
                      <Card 
                        key={template.id}
                        className={`cursor-pointer transition-all ${
                          selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          applyTemplate(template.id);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                            <div className="flex space-x-1">
                              {template.channels.map((channel) => {
                                const channelInfo = AVAILABLE_CHANNELS.find(c => c.id === channel);
                                if (!channelInfo) return null;
                                const Icon = channelInfo.icon;
                                return (
                                  <Icon key={channel} className={`h-4 w-4 ${channelInfo.color}`} />
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="custom" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Workflow Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter workflow name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe your workflow"
                    />
                  </div>
                  
                  <div>
                    <Label>Select Channels</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {AVAILABLE_CHANNELS.map((channel) => {
                        const Icon = channel.icon;
                        return (
                          <Card 
                            key={channel.id}
                            className={`cursor-pointer transition-all ${
                              formData.channels.includes(channel.id) ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => {
                              const channels = formData.channels.includes(channel.id)
                                ? formData.channels.filter(c => c !== channel.id)
                                : [...formData.channels, channel.id];
                              setFormData({ ...formData, channels });
                            }}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center space-x-2">
                                <Icon className={`h-4 w-4 ${channel.color}`} />
                                <span className="text-sm font-medium">{channel.name}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {(selectedTemplate || formData.name) && (
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-gradient-primary" onClick={createConfiguration}>
                  Create Workflow
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {configurations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No AI workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first multi-channel AI automation workflow to start engaging leads
            </p>
            <Button 
              className="bg-gradient-primary"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {configurations.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <span>{config.name}</span>
                      <Badge variant={config.is_active ? 'default' : 'secondary'}>
                        {config.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleConfiguration(config.id, config.is_active)}
                    >
                      {config.is_active ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setEditingConfigId(config.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => deleteConfiguration(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Channels</Label>
                    <div className="flex space-x-2 mt-1">
                      {config.channels.map((channelId) => {
                        const channel = AVAILABLE_CHANNELS.find(c => c.id === channelId);
                        if (!channel) return null;
                        const Icon = channel.icon;
                        return (
                          <Badge key={channelId} variant="outline">
                            <Icon className={`h-3 w-3 mr-1 ${channel.color}`} />
                            {channel.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Configuration</Label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-lg">
                      <pre className="text-xs text-muted-foreground">
                        {JSON.stringify(config.config_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(config.created_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingConfigId && (
        <WorkflowEditor
          configurationId={editingConfigId}
          isOpen={!!editingConfigId}
          onClose={() => setEditingConfigId(null)}
          onSave={fetchConfigurations}
        />
      )}
    </div>
  );
}