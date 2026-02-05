import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Mail, Eye, MousePointer, Reply } from 'lucide-react';
import type { Campaign } from '../../../shared/schema';
import { supabase } from '@/integrations/supabase/client';

interface CampaignAnalyticsProps {
  campaign: Campaign;
}

export function CampaignAnalytics({ campaign }: CampaignAnalyticsProps) {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResponses();
  }, [campaign.id]);

  const loadResponses = async () => {
    try {
      const { data } = await supabase
        .from('campaign_responses')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: true });
      
      setResponses(data || []);
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const sent = campaign.sent_count || 0;
  const opens = campaign.opened_count || 0;
  const clicks = campaign.clicked_count || 0;
  const replies = campaign.replied_count || 0;

  const openRate = sent > 0 ? Math.round((opens / sent) * 100) : 0;
  const clickRate = sent > 0 ? Math.round((clicks / sent) * 100) : 0;
  const replyRate = sent > 0 ? Math.round((replies / sent) * 100) : 0;

  // Group responses by channel
  const byChannel = responses.reduce((acc: any, r: any) => {
    const existing = acc.find((x: any) => x.channel === r.channel);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ channel: r.channel, count: 1 });
    }
    return acc;
  }, []);

  // Group responses by intent
  const byIntent = responses.reduce((acc: any, r: any) => {
    const existing = acc.find((x: any) => x.intent === r.intent_tag);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ intent: r.intent_tag, count: 1 });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sent}</div>
            <p className="text-xs text-muted-foreground">messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              Open Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRate}%</div>
            <p className="text-xs text-muted-foreground">{opens} opens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-orange-500" />
              Click Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-xs text-muted-foreground">{clicks} clicks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Reply className="h-4 w-4 text-purple-500" />
              Reply Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replyRate}%</div>
            <p className="text-xs text-muted-foreground">{replies} replies</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Responses by Channel */}
        {byChannel.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Responses by Channel</CardTitle>
              <CardDescription>Message breakdown by communication channel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byChannel}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Responses by Intent */}
        {byIntent.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Response Intent</CardTitle>
              <CardDescription>AI-classified response sentiments</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byIntent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="intent" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>Campaign engagement metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Total Sent</span>
              <span className="text-lg font-bold">{sent}</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Total Responses</span>
              <span className="text-lg font-bold">{responses.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <span className="text-sm font-medium">Overall Response Rate</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {sent > 0 ? Math.round((responses.length / sent) * 100) : 0}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
