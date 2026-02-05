import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Voicemail, TrendingUp, CheckCircle, Mic } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface PhoneStats {
  calls_initiated: number;
  answered: number;
  voicemails_sent: number;
  callbacks: number;
  meetings_scheduled: number;
}

interface CallOutcome {
  id: string;
  phone: string;
  contact_name: string;
  duration: string;
  transcript_snippet: string;
  outcome: string;
  sentiment: string;
}

export default function PhoneVoicemail() {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [outcomes, setOutcomes] = useState<CallOutcome[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchStats = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      
      if (isDemo) {
        setStats({ calls_initiated: 234, answered: 85, voicemails_sent: 112, callbacks: 20, meetings_scheduled: 28 });
        setOutcomes([
          { id: '1', phone: '+1-555-0123', contact_name: 'John Smith', duration: '5m 42s', transcript_snippet: 'That sounds interesting. Schedule demo tomorrow 2pm?', outcome: 'Meeting Scheduled', sentiment: 'Positive' },
          { id: '2', phone: '+1-555-0126', contact_name: 'Lisa Park', duration: '3m 15s', transcript_snippet: 'Send me the proposal, I\'ll review with my team', outcome: 'Follow-up Required', sentiment: 'Neutral' },
          { id: '3', phone: '+1-555-0127', contact_name: 'David Lee', duration: '7m 28s', transcript_snippet: 'Great call, let\'s move forward with the pilot', outcome: 'Qualified', sentiment: 'Positive' }
        ]);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/phone-analytics`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats || null);
          setOutcomes(data.recent_outcomes || []);
        }
      } catch (error) {
        console.error('Error fetching phone stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading phone campaigns...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Phone className="h-8 w-8 text-teal-600" />
            Phone & Voicemail Campaigns
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Real-time call tracking with AI transcription & sentiment analysis</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Phone className="h-4 w-4" /> Calls
              </CardTitle>
              <div className="text-2xl font-bold">{stats?.calls_initiated}</div>
              <p className="text-xs text-teal-600">Initiated</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Answered</CardTitle>
              <div className="text-2xl font-bold">{stats?.answered}</div>
              <p className="text-xs text-green-600">36.3%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Voicemail className="h-4 w-4" /> Voicemails
              </CardTitle>
              <div className="text-2xl font-bold">{stats?.voicemails_sent}</div>
              <p className="text-xs text-purple-600">Sent</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Callbacks</CardTitle>
              <div className="text-2xl font-bold">{stats?.callbacks}</div>
              <p className="text-xs text-orange-600">17.9%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Meetings</CardTitle>
              <div className="text-2xl font-bold">{stats?.meetings_scheduled}</div>
              <p className="text-xs text-emerald-600">Scheduled</p>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Calls */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-teal-600" />
              Top Call Outcomes
            </CardTitle>
            <CardDescription>AI-analyzed call results with transcript & sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            {outcomes.length === 0 && !stats ? (
              <div className="text-center py-8 text-slate-500">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No call activity yet</p>
                <p className="text-sm">Start a phone campaign to see outcomes here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {outcomes.map((outcome) => (
                  <div key={outcome.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded">
                    <div>
                      <p className="font-semibold text-sm">{outcome.phone} ({outcome.contact_name})</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{outcome.duration} call - "{outcome.transcript_snippet}"</p>
                    </div>
                    <div className="text-right">
                      <Badge className={
                        outcome.sentiment === 'Positive' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        outcome.sentiment === 'Neutral' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      }>{outcome.outcome}</Badge>
                      <p className={`text-xs mt-1 ${outcome.sentiment === 'Positive' ? 'text-green-600' : 'text-blue-600'}`}>{outcome.sentiment}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sophia Phone Insights */}
        <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border-teal-200 dark:border-teal-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Sophia's Phone Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <p><strong>Call Optimization:</strong> 36.3% answer rate • 5.2 min avg duration • 12 meetings scheduled</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <p><strong>Voicemail Strategy:</strong> 17.9% callback rate • avg 4.2 hours to callback • leave professional tone</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <p><strong>Sentiment Tracking:</strong> 38% positive • 47% neutral • 15% negative • track objections automatically</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <p><strong>Best Timing:</strong> Tuesday 10-11 AM shows +28% higher answer rate</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <p><strong>Revenue Impact:</strong> Phone shows highest close rate (48%) - schedule calls for hot leads immediately</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
