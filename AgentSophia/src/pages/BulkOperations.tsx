import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, CheckCircle } from 'lucide-react';

interface BulkOperation {
  operation_id: string;
  type: string;
  name: string;
  contacts_count: number;
  status: string;
  progress: string;
}

export default function BulkOperations() {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const response = await fetch('/api/contacts/bulk-operations');
        if (response.ok) {
          const data = await response.json();
          setOperations(data.operations);
        }
      } catch (error) {
        console.error('Error fetching operations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOperations();
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bulk_email':
        return '📧';
      case 'bulk_sms':
        return '💬';
      case 'bulk_linkedin':
        return '🔗';
      default:
        return '📤';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading operations...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Zap className="h-8 w-8 text-purple-600" />
            Bulk Operations
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Send campaigns to thousands of contacts at scale</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Active Operations</CardTitle>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-purple-600">In progress</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Messages Today</CardTitle>
              <div className="text-2xl font-bold">3,847</div>
              <p className="text-xs text-green-600">Sent</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Completed Today</CardTitle>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-blue-600">Operations</p>
            </CardHeader>
          </Card>
        </div>

        {/* Active Operations */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Active Campaigns
            </CardTitle>
            <CardDescription>Real-time progress tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {operations.slice(0, 3).map((op) => (
                <div key={op.operation_id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-2">
                        {getTypeIcon(op.type)} {op.name}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{op.contacts_count} contacts</p>
                    </div>
                    <Badge className={getStatusColor(op.status)}>{op.status}</Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: op.progress }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{op.progress} complete</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sophia Bulk Insights */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Sophia's Bulk Campaign Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Performance Today:</strong> 3,847 messages sent • 42% email open rate • 12.7% SMS reply rate</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Best Channel:</strong> SMS outperforming email 3x (12.7% vs 4.2% reply) - scale SMS to warm leads</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>LinkedIn Winner:</strong> Connection campaign 57.7% acceptance - highest performing outreach</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Next Action:</strong> Create email sequence for 172 accepted LinkedIn connections - 3.5x higher engage</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Volume Capacity:</strong> Sophia can scale to 50,000+ messages/day with current rate limits</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
