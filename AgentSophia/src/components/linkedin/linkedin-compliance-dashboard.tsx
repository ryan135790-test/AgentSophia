import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LinkedInLiveBrowserDemo from './linkedin-live-browser-demo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileText,
  Bot,
  Target,
  Timer
} from 'lucide-react';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
  executionTime: number;
  overallScore: number;
  recommendations: string[];
}

interface FullTestSuiteResult {
  success: boolean;
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    overallScore: number;
    executionTime: number;
  };
  suites: TestSuiteResult[];
  complianceStatus: 'compliant' | 'warning' | 'non-compliant';
  recommendations: string[];
}

function getComplianceIcon(status: string) {
  switch (status) {
    case 'compliant':
      return <ShieldCheck className="h-6 w-6 text-green-500" />;
    case 'warning':
      return <ShieldAlert className="h-6 w-6 text-yellow-500" />;
    case 'non-compliant':
      return <ShieldX className="h-6 w-6 text-red-500" />;
    default:
      return <Shield className="h-6 w-6 text-gray-500" />;
  }
}

function getComplianceBadge(status: string) {
  switch (status) {
    case 'compliant':
      return <Badge variant="default" className="bg-green-500">Compliant</Badge>;
    case 'warning':
      return <Badge variant="default" className="bg-yellow-500">Warning</Badge>;
    case 'non-compliant':
      return <Badge variant="destructive">Non-Compliant</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}

function getProgressColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 70) return 'bg-yellow-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

function TestResultCard({ result }: { result: TestResult }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
      {result.passed ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm">{result.testName}</p>
          {result.duration && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {result.duration}ms
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
      </div>
    </div>
  );
}

function TestSuiteCard({ suite }: { suite: TestSuiteResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${suite.overallScore >= 80 ? 'bg-green-500/10' : suite.overallScore >= 60 ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
              {suite.suiteName.includes('Safety') && <Shield className={`h-5 w-5 ${getScoreColor(suite.overallScore)}`} />}
              {suite.suiteName.includes('Human') && <Bot className={`h-5 w-5 ${getScoreColor(suite.overallScore)}`} />}
              {suite.suiteName.includes('Rate') && <Zap className={`h-5 w-5 ${getScoreColor(suite.overallScore)}`} />}
            </div>
            <div>
              <CardTitle className="text-base">{suite.suiteName}</CardTitle>
              <CardDescription>
                {suite.passed}/{suite.totalTests} tests passed
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`text-2xl font-bold ${getScoreColor(suite.overallScore)}`}>
                {suite.overallScore}%
              </p>
              <p className="text-xs text-muted-foreground">{suite.executionTime}ms</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-${suite.suiteName.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {expanded ? 'Hide' : 'Show'} Details
            </Button>
          </div>
        </div>
        <Progress 
          value={suite.overallScore} 
          className="h-2 mt-3"
        />
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          <div className="space-y-2">
            {suite.results.map((result, idx) => (
              <TestResultCard key={idx} result={result} />
            ))}
          </div>
          {suite.recommendations.length > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
              <p className="text-sm font-medium text-blue-500 mb-2">Recommendations</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {suite.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Target className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function LinkedInComplianceDashboard() {
  const [lastTestRun, setLastTestRun] = useState<Date | null>(null);

  const { data: testResults, isLoading, refetch, isFetching } = useQuery<FullTestSuiteResult>({
    queryKey: ['/api/linkedin/safety/test/full-suite'],
    enabled: false,
    staleTime: Infinity
  });

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/linkedin/safety/test/full-suite');
      if (!response.ok) throw new Error('Failed to run tests');
      return response.json();
    },
    onSuccess: () => {
      setLastTestRun(new Date());
      refetch();
    }
  });

  const handleRunTests = () => {
    runTestsMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            LinkedIn Compliance Dashboard
          </h2>
          <p className="text-muted-foreground">
            Validate automation safety controls and compliance status
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastTestRun && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last run: {lastTestRun.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={handleRunTests}
            disabled={runTestsMutation.isPending || isFetching}
            data-testid="button-run-compliance-tests"
          >
            {runTestsMutation.isPending || isFetching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Compliance Tests
              </>
            )}
          </Button>
        </div>
      </div>

      {!testResults && !runTestsMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Run the compliance test suite to validate safety controls, human-like behavior patterns, and rate limiting enforcement.
            </p>
            <Button onClick={handleRunTests} data-testid="button-run-initial-tests">
              <PlayCircle className="h-4 w-4 mr-2" />
              Run Initial Tests
            </Button>
          </CardContent>
        </Card>
      )}

      {runTestsMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">Running Compliance Tests</h3>
            <p className="text-muted-foreground text-center">
              Validating safety controls, human behavior patterns, and rate limits...
            </p>
          </CardContent>
        </Card>
      )}

      {testResults && !runTestsMutation.isPending && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {getComplianceIcon(testResults.complianceStatus)}
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getComplianceBadge(testResults.complianceStatus)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${testResults.summary.overallScore >= 80 ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                    {testResults.summary.overallScore >= 80 ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(testResults.summary.overallScore)}`}>
                      {testResults.summary.overallScore}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tests Passed</p>
                    <p className="text-2xl font-bold text-green-500">
                      {testResults.summary.totalPassed}/{testResults.summary.totalTests}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Execution Time</p>
                    <p className="text-2xl font-bold">
                      {testResults.summary.executionTime}ms
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {testResults.complianceStatus === 'compliant' && (
            <Alert className="border-green-500 bg-green-500/10">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">All Compliance Checks Passed</AlertTitle>
              <AlertDescription>
                Your LinkedIn automation configuration is compliant with safety best practices. 
                All rate limits, human-like behavior patterns, and detection avoidance measures are properly configured.
              </AlertDescription>
            </Alert>
          )}

          {testResults.complianceStatus === 'warning' && (
            <Alert className="border-yellow-500 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">Minor Compliance Issues Detected</AlertTitle>
              <AlertDescription>
                Some tests did not pass. Review the failed tests below and consider adjusting your configuration before heavy usage.
              </AlertDescription>
            </Alert>
          )}

          {testResults.complianceStatus === 'non-compliant' && (
            <Alert variant="destructive">
              <ShieldX className="h-4 w-4" />
              <AlertTitle>Critical Compliance Issues</AlertTitle>
              <AlertDescription>
                Multiple safety checks failed. DO NOT use LinkedIn automation until these issues are resolved.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="suites" className="w-full">
            <TabsList>
              <TabsTrigger value="suites" data-testid="tab-test-suites">Test Suites</TabsTrigger>
              <TabsTrigger value="recommendations" data-testid="tab-recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="live-demo" data-testid="tab-live-demo">Live Browser Demo</TabsTrigger>
            </TabsList>

            <TabsContent value="suites" className="mt-4">
              <div className="space-y-4">
                {testResults.suites.map((suite, idx) => (
                  <TestSuiteCard key={idx} suite={suite} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Compliance Recommendations
                  </CardTitle>
                  <CardDescription>
                    Follow these recommendations to maintain LinkedIn account safety
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {testResults.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="live-demo" className="mt-4">
              <LinkedInLiveBrowserDemo />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
