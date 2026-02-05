import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Mail, Linkedin, MessageSquare, Phone, Send, CheckCircle2, ArrowRight, Zap, Loader2 
} from 'lucide-react';

interface MultiChannelOutboundInterfaceProps {
  isActive: boolean;
  isLoading?: boolean;
  onWorkflowCreate: (workflowData: any) => void;
  onDismiss: () => void;
}

export function MultiChannelOutboundInterface({
  isActive,
  isLoading = false,
  onWorkflowCreate,
  onDismiss
}: MultiChannelOutboundInterfaceProps) {
  const [campaignName, setCampaignName] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);

  const channels = [
    { id: 'email', name: 'Email', icon: Mail },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin },
    { id: 'sms', name: 'SMS', icon: MessageSquare },
    { id: 'phone', name: 'Phone', icon: Phone },
    { id: 'whatsapp', name: 'WhatsApp', icon: Send },
  ];

  if (!isActive) return null;

  const handleChannelToggle = (channelId: string) => {
    if (isLoading) return;
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleCreate = () => {
    if (!campaignName.trim() || selectedChannels.length === 0 || isLoading) return;

    onWorkflowCreate({
      name: campaignName,
      channels: selectedChannels,
      type: 'multichannel-outbound',
    });
  };

  // Loading state while workflow is being created
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1">Creating Campaign...</h3>
            <p className="text-sm text-muted-foreground">
              Sophia is generating your "{campaignName}" workflow with AI
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Channels Selected
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedChannels.map((channelId) => {
                const channel = channels.find(c => c.id === channelId);
                const Icon = channel?.icon || Mail;
                return (
                  <div key={channelId} className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-sm">
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{channel?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Zap className="h-3 w-3 text-white" />
          </div>
          <h3 className="font-semibold">Multichannel Campaign</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select channels and we'll create your outbound workflow
        </p>
      </div>

      {/* Campaign Name */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Campaign Name
        </label>
        <Input
          placeholder="e.g., Q1 Enterprise Outreach"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          data-testid="input-campaign-name"
          autoFocus
          className="text-sm"
        />
      </div>

      {/* Channel Selection */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Channels ({selectedChannels.length} selected)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {channels.map(channel => {
            const Icon = channel.icon;
            const isSelected = selectedChannels.includes(channel.id);
            return (
              <button
                key={channel.id}
                onClick={() => handleChannelToggle(channel.id)}
                className={`relative group p-3 rounded-lg transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary/10 border border-primary'
                    : 'bg-muted/50 border border-transparent hover:bg-muted hover:border-muted-foreground/20'
                }`}
                data-testid={`button-channel-${channel.id}`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium leading-tight text-center">
                    {channel.name}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute -top-2 -right-2">
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                      <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleCreate}
          disabled={!campaignName.trim() || selectedChannels.length === 0}
          className="flex-1"
          size="sm"
          data-testid="button-create-workflow"
        >
          Create Workflow
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <Button
          variant="ghost"
          onClick={onDismiss}
          size="sm"
          data-testid="button-dismiss-outbound"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
