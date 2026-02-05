import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  FlaskConical, 
  Play, 
  Pause, 
  Trophy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  CheckCircle
} from 'lucide-react';

interface ABTestVariant {
  id: string;
  name: string;
  content: string;
  sent: number;
  accepted: number;
  replied: number;
  acceptanceRate: number;
  replyRate: number;
  isWinner: boolean;
  isControl: boolean;
  uplift: number | null;
  isStatisticallySignificant: boolean;
}

interface ABTest {
  id: string;
  name: string;
  testType: 'connection_note' | 'message' | 'inmail_subject';
  status: 'running' | 'paused' | 'completed';
  variants: ABTestVariant[];
  totalSent: number;
  minSampleSize: number;
  confidenceLevel: number;
  recommendation: string;
}

export function LinkedInABTesting() {
  const [tests] = useState<ABTest[]>([
    {
      id: '1',
      name: 'Connection Note - Professional vs Casual',
      testType: 'connection_note',
      status: 'running',
      variants: [
        {
          id: 'v1',
          name: 'Professional (Control)',
          content: 'Hi {{firstName}}, I noticed we share connections in the {{industry}} space. Would love to connect and exchange insights.',
          sent: 245,
          accepted: 127,
          replied: 0,
          acceptanceRate: 51.8,
          replyRate: 0,
          isWinner: false,
          isControl: true,
          uplift: null,
          isStatisticallySignificant: false,
        },
        {
          id: 'v2',
          name: 'Casual & Friendly',
          content: 'Hey {{firstName}}! Came across your profile - love what you\'re doing at {{company}}. Let\'s connect!',
          sent: 238,
          accepted: 152,
          replied: 0,
          acceptanceRate: 63.9,
          replyRate: 0,
          isWinner: false,
          isControl: false,
          uplift: 23.4,
          isStatisticallySignificant: true,
        },
      ],
      totalSent: 483,
      minSampleSize: 200,
      confidenceLevel: 0.95,
      recommendation: 'Variant B (Casual & Friendly) is performing 23.4% better with statistical significance. Consider declaring winner.',
    },
    {
      id: '2',
      name: 'First Message - Value vs Question',
      testType: 'message',
      status: 'completed',
      variants: [
        {
          id: 'v3',
          name: 'Value-First (Control)',
          content: 'Thanks for connecting! I help companies like {{company}} increase revenue by 30%. Would you be open to a quick chat?',
          sent: 312,
          accepted: 0,
          replied: 56,
          acceptanceRate: 0,
          replyRate: 17.9,
          isWinner: false,
          isControl: true,
          uplift: null,
          isStatisticallySignificant: false,
        },
        {
          id: 'v4',
          name: 'Question-Based',
          content: 'Thanks for connecting {{firstName}}! Quick question - how is {{company}} currently handling {{challenge}}?',
          sent: 298,
          accepted: 0,
          replied: 71,
          acceptanceRate: 0,
          replyRate: 23.8,
          isWinner: true,
          isControl: false,
          uplift: 32.9,
          isStatisticallySignificant: true,
        },
      ],
      totalSent: 610,
      minSampleSize: 200,
      confidenceLevel: 0.95,
      recommendation: 'Winner declared: Question-Based approach outperforms by 32.9%.',
    },
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-100 text-green-800">Running</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTestTypeBadge = (type: string) => {
    switch (type) {
      case 'connection_note':
        return <Badge variant="outline">Connection Note</Badge>;
      case 'message':
        return <Badge variant="outline">Message</Badge>;
      case 'inmail_subject':
        return <Badge variant="outline">InMail Subject</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            A/B Testing
          </h2>
          <p className="text-sm text-muted-foreground">
            Test different messages to optimize your acceptance and reply rates
          </p>
        </div>
        <Button data-testid="btn-create-test">
          <Plus className="w-4 h-4 mr-2" />
          Create Test
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Tests</p>
                <p className="text-2xl font-bold">{tests.filter(t => t.status === 'running').length}</p>
              </div>
              <FlaskConical className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Winners Found</p>
                <p className="text-2xl font-bold text-green-600">{tests.filter(t => t.status === 'completed').length}</p>
              </div>
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Improvement</p>
                <p className="text-2xl font-bold text-green-600">+28.2%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {tests.map((test) => (
          <Card key={test.id} data-testid={`ab-test-${test.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    {getStatusBadge(test.status)}
                    {getTestTypeBadge(test.testType)}
                  </div>
                  <CardDescription className="mt-1">
                    {test.totalSent} sends • {test.confidenceLevel * 100}% confidence level
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {test.status === 'running' ? (
                    <>
                      <Button variant="outline" size="sm" data-testid={`btn-pause-${test.id}`}>
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                      <Button size="sm" data-testid={`btn-declare-winner-${test.id}`}>
                        <Trophy className="w-4 h-4 mr-1" />
                        Declare Winner
                      </Button>
                    </>
                  ) : test.status === 'paused' ? (
                    <Button variant="outline" size="sm" data-testid={`btn-resume-${test.id}`}>
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {test.variants.map((variant) => (
                  <div 
                    key={variant.id}
                    className={`p-4 border rounded-lg ${variant.isWinner ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{variant.name}</span>
                        {variant.isControl && (
                          <Badge variant="outline" className="text-xs">Control</Badge>
                        )}
                        {variant.isWinner && (
                          <Badge className="bg-green-100 text-green-800">
                            <Trophy className="w-3 h-3 mr-1" />
                            Winner
                          </Badge>
                        )}
                        {variant.isStatisticallySignificant && !variant.isWinner && (
                          <Badge className="bg-blue-100 text-blue-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Significant
                          </Badge>
                        )}
                      </div>
                      {variant.uplift !== null && (
                        <div className={`flex items-center gap-1 ${variant.uplift > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {variant.uplift > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="font-medium">{variant.uplift > 0 ? '+' : ''}{variant.uplift}%</span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 bg-muted p-2 rounded">
                      "{variant.content}"
                    </p>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Sent</p>
                        <p className="text-lg font-semibold">{variant.sent}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {test.testType === 'connection_note' ? 'Accepted' : 'Replied'}
                        </p>
                        <p className="text-lg font-semibold">
                          {test.testType === 'connection_note' ? variant.accepted : variant.replied}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {test.testType === 'connection_note' ? 'Acceptance Rate' : 'Reply Rate'}
                        </p>
                        <p className="text-lg font-semibold">
                          {test.testType === 'connection_note' ? variant.acceptanceRate : variant.replyRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Progress</p>
                        <Progress 
                          value={(variant.sent / test.minSampleSize) * 100} 
                          className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.min(100, Math.round((variant.sent / test.minSampleSize) * 100))}% of min sample
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-200">Recommendation</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{test.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
