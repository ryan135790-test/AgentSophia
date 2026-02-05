import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Linkedin, MessageCircle, Phone, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CampaignMessage {
  channel: string;
  version: number;
  subject?: string;
  content: string;
}

interface SophiaCampaignResponseProps {
  messages: CampaignMessage[];
  campaign?: {
    product?: string;
    audience?: string;
    goal?: string;
  };
}

export function SophiaCampaignResponse({ messages, campaign }: SophiaCampaignResponseProps) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'linkedin':
        return <Linkedin className="h-4 w-4" />;
      case 'sms':
      case 'sms message':
        return <MessageCircle className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'email':
        return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-700';
      case 'linkedin':
        return 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-600';
      case 'sms':
      case 'sms message':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-700';
      case 'phone':
        return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-700';
      default:
        return 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';
    }
  };

  const copyToClipboard = (text: string, index: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({
      title: 'Copied!',
      description: 'Message copied to clipboard',
      duration: 2000,
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const groupedMessages = messages.reduce(
    (acc, msg, idx) => {
      const channel = msg.channel.toLowerCase();
      if (!acc[channel]) {
        acc[channel] = [];
      }
      acc[channel].push({ ...msg, originalIndex: idx });
      return acc;
    },
    {} as Record<string, (CampaignMessage & { originalIndex: number })[]>
  );

  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto">
      {/* Header */}
      {campaign && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-700">
          <CardContent className="pt-6">
            <div className="space-y-2">
              {campaign.product && (
                <div className="text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Product:</span>
                  <span className="ml-2 text-slate-600 dark:text-slate-400">{campaign.product}</span>
                </div>
              )}
              {campaign.audience && (
                <div className="text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Audience:</span>
                  <span className="ml-2 text-slate-600 dark:text-slate-400">{campaign.audience}</span>
                </div>
              )}
              {campaign.goal && (
                <div className="text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Goal:</span>
                  <span className="ml-2 text-slate-600 dark:text-slate-400">{campaign.goal}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages by Channel */}
      {Object.entries(groupedMessages).map(([channel, channelMessages]) => (
        <div key={channel} className="space-y-3">
          <div className="flex items-center gap-2">
            {getChannelIcon(channel)}
            <h3 className="font-semibold capitalize text-lg">{channel}</h3>
            <Badge variant="secondary" className="text-xs">
              {channelMessages.length} version{channelMessages.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="space-y-3 ml-6">
            {channelMessages.map((msg, vIdx) => (
              <Card key={`${channel}-${vIdx}`} className={`border ${getChannelColor(channel)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        Version {msg.version}
                        {msg.version === 1 && (
                          <Badge variant="outline" className="text-xs">Direct Approach</Badge>
                        )}
                        {msg.version === 2 && (
                          <Badge variant="outline" className="text-xs">Curiosity-Based</Badge>
                        )}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        msg.subject ? `${msg.subject}\n\n${msg.content}` : msg.content,
                        `${channel}-${vIdx}`
                      )}
                      className="h-8 w-8 p-0"
                    >
                      {copiedIndex === `${channel}-${vIdx}` ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {msg.subject && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        Subject Line
                      </p>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {msg.subject}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      {msg.subject ? 'Message Body' : 'Message'}
                    </p>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => copyToClipboard(
                        msg.subject ? `${msg.subject}\n\n${msg.content}` : msg.content,
                        `${channel}-${vIdx}`
                      )}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Message
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Use This
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {messages.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">No campaign messages generated yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
