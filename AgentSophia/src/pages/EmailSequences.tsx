import { useState, useEffect } from 'react';
import { Mail, Plus, Play, Pause, BarChart3, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Sequence {
  id: string;
  name: string;
  description: string;
  step_count: number;
  status: 'active' | 'paused' | 'draft';
  contacts_enrolled: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  created_at: string;
  updated_at: string;
  performance: { opens: number; clicks: number; replies: number };
}

const DEMO_SEQUENCES: Sequence[] = [
  {
    id: 'seq_1',
    name: 'Enterprise Sales Flow',
    description: 'Multi-touch sequence for enterprise decision makers',
    step_count: 5,
    status: 'active',
    contacts_enrolled: 847,
    open_rate: 62,
    click_rate: 18,
    reply_rate: 24,
    created_at: '2024-01-15',
    updated_at: '2024-01-20',
    performance: { opens: 525, clicks: 153, replies: 203 }
  },
  {
    id: 'seq_2',
    name: 'SMB Quick Nurture',
    description: 'Fast-paced sequence for small business leads',
    step_count: 3,
    status: 'active',
    contacts_enrolled: 1243,
    open_rate: 58,
    click_rate: 15,
    reply_rate: 19,
    created_at: '2024-01-10',
    updated_at: '2024-01-18',
    performance: { opens: 721, clicks: 187, replies: 236 }
  },
  {
    id: 'seq_3',
    name: 'Re-engagement Campaign',
    description: 'Win back cold leads with fresh messaging',
    step_count: 4,
    status: 'paused',
    contacts_enrolled: 456,
    open_rate: 45,
    click_rate: 12,
    reply_rate: 15,
    created_at: '2024-01-05',
    updated_at: '2024-01-12',
    performance: { opens: 205, clicks: 55, replies: 68 }
  }
];

export default function EmailSequences() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  if (!workspaceId) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setSequences(DEMO_SEQUENCES);
      setLoading(false);
      return;
    }
    
    const fetchSequences = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/email-sequences`);
        if (res.ok) {
          const data = await res.json();
          setSequences(Array.isArray(data) ? data : data.sequences || []);
        }
      } catch (error) {
        console.error('Error fetching sequences:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSequences();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading email sequences...</div>;

  const hasNoData = sequences.length === 0 && !isDemo;

  if (hasNoData) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Mail className="h-8 w-8 text-blue-600" />
                Email Sequences
              </h1>
              <p className="text-slate-600 mt-2">Create & automate drip campaigns with Sophia insights</p>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Sequence
            </Button>
          </div>
          <Card className="p-12 text-center">
            <Mail className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Email Sequences Yet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
              Create your first email sequence to automate your outreach and nurture leads.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Sequence
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const activeCount = sequences.filter(s => s.status === 'active').length;
  const totalEnrolled = sequences.reduce((sum, s) => sum + s.contacts_enrolled, 0);
  const avgOpenRate = sequences.length > 0 
    ? Math.round(sequences.reduce((sum, s) => sum + s.open_rate, 0) / sequences.length) 
    : 0;
  const avgReplyRate = sequences.length > 0 
    ? Math.round(sequences.reduce((sum, s) => sum + s.reply_rate, 0) / sequences.length) 
    : 0;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              Email Sequences
            </h1>
            <p className="text-slate-600 mt-2">Create & automate drip campaigns with Sophia insights</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Sequence
          </Button>
        </div>

        {showCreate && (
          <Card className="p-6 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Sequence Name</label>
                <input type="text" placeholder="e.g., Enterprise Sales Flow" className="w-full p-2 rounded border border-slate-300 dark:border-slate-600" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea placeholder="What is this sequence for?" className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 h-20" />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1">+ Add Email Step</Button>
                <Button className="flex-1">🤖 Sophia Auto-Generate</Button>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button>Create Sequence</Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Active Sequences</span>
            </div>
            <p className="text-2xl font-bold">{activeCount}</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Avg Open Rate</span>
            </div>
            <p className="text-2xl font-bold">{avgOpenRate}%</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Total Enrolled</span>
            </div>
            <p className="text-2xl font-bold">{totalEnrolled.toLocaleString()}</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Avg Reply Rate</span>
            </div>
            <p className="text-2xl font-bold">{avgReplyRate}%</p>
          </Card>
        </div>

        <div className="space-y-4">
          {sequences.map((seq) => (
            <Card key={seq.id} className="p-6 hover:shadow-lg transition border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    {seq.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{seq.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={seq.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-800'}>
                    {seq.status === 'active' ? '🟢 Active' : '⏸️ Paused'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 bg-slate-50 dark:bg-slate-900/30 p-3 rounded">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Steps</p>
                  <p className="text-lg font-bold">{seq.step_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Enrolled</p>
                  <p className="text-lg font-bold">{seq.contacts_enrolled}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Open Rate</p>
                  <p className="text-lg font-bold text-blue-600">{seq.open_rate}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Click Rate</p>
                  <p className="text-lg font-bold text-green-600">{seq.click_rate}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Reply Rate</p>
                  <p className="text-lg font-bold text-purple-600">{seq.reply_rate}%</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  {seq.status === 'active' ? (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Resume
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Button>
                <Button size="sm" className="flex-1 gap-2">
                  ✏️ Edit
                </Button>
              </div>

              {isDemo && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    💡 <span>Sophia's Insight:</span>
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-400 mt-1">
                    Reply rate could improve by 15% if you move step 3 (ask for meeting) to after step 2 instead of step 4. {seq.status === 'active' && '✨ Sophia can auto-optimize this.'}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
