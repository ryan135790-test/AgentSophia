import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Zap,
  ArrowRight,
  Brain
} from 'lucide-react';

interface LeadPrediction {
  leadId: string;
  conversionProbability: number;
  predictedCloseDate: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  buyingStage: 'awareness' | 'consideration' | 'decision' | 'ready_to_buy';
  nextBestAction: string;
  confidenceScore: number;
  factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; description: string }[];
}

interface LeadScores {
  engagement: number;
  fit: number;
  intent: number;
  overall: number;
  intentSignals: string[];
  hotness: string;
}

interface SophiaPredictivePanelProps {
  leadId?: string;
  leadName?: string;
  engagement?: {
    emailOpens?: number;
    emailClicks?: number;
    emailReplies?: number;
    linkedinReplies?: number;
    meetingsBooked?: number;
    lastActivityDaysAgo?: number;
    totalTouchpoints?: number;
    responseRate?: number;
  };
  fit?: {
    title?: string;
    companySize?: 'startup' | 'smb' | 'mid_market' | 'enterprise';
    decisionMaker?: boolean;
    budget?: number;
  };
}

export function SophiaPredictivePanel({ leadId, leadName, engagement, fit }: SophiaPredictivePanelProps) {
  const { toast } = useToast();
  const [prediction, setPrediction] = useState<LeadPrediction | null>(null);
  const [scores, setScores] = useState<LeadScores | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPrediction = async () => {
    if (!leadId) return;
    
    setLoading(true);
    try {
      const [predRes, scoresRes] = await Promise.all([
        fetch('/api/sophia/predictive/predict-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, engagement: engagement || {}, fit: fit || {} })
        }),
        fetch('/api/sophia/predictive/calculate-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engagement: engagement || {}, fit: fit || {} })
        })
      ]);
      
      const [predData, scoresData] = await Promise.all([predRes.json(), scoresRes.json()]);
      
      if (predData.success) setPrediction(predData.prediction);
      if (scoresData.success) setScores(scoresData.scores);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch prediction', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getBuyingStageColor = (stage: string) => {
    switch (stage) {
      case 'ready_to_buy': return 'bg-green-500';
      case 'decision': return 'bg-blue-500';
      case 'consideration': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-500 bg-red-50';
      case 'medium': return 'text-amber-500 bg-amber-50';
      default: return 'text-green-500 bg-green-50';
    }
  };

  const demoEngagement = {
    emailOpens: 5,
    emailClicks: 3,
    emailReplies: 1,
    linkedinReplies: 1,
    meetingsBooked: 0,
    lastActivityDaysAgo: 2,
    totalTouchpoints: 8,
    responseRate: 25
  };

  const demoFit = {
    title: 'VP Sales',
    companySize: 'mid_market' as const,
    decisionMaker: true,
    budget: 50000
  };

  const runDemoPrediction = async () => {
    setLoading(true);
    try {
      const [predRes, scoresRes] = await Promise.all([
        fetch('/api/sophia/predictive/predict-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            leadId: 'demo_lead_001', 
            engagement: demoEngagement, 
            fit: demoFit 
          })
        }),
        fetch('/api/sophia/predictive/calculate-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engagement: demoEngagement, fit: demoFit })
        })
      ]);
      
      const [predData, scoresData] = await Promise.all([predRes.json(), scoresRes.json()]);
      
      if (predData.success) setPrediction(predData.prediction);
      if (scoresData.success) {
        setScores({
          ...scoresData.scores,
          intentSignals: scoresData.intentSignals,
          hotness: scoresData.hotness
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to run prediction', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="predictive-title">
          <Brain className="h-5 w-5 text-purple-500" />
          Predictive Lead Scoring
        </CardTitle>
        <CardDescription>
          AI-powered conversion predictions based on engagement and fit signals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!prediction && !scores ? (
          <div className="text-center py-6">
            <Target className="h-12 w-12 mx-auto mb-3 text-purple-500 opacity-50" />
            <p className="text-muted-foreground mb-4">
              {leadId ? 'Click to analyze this lead' : 'Run a demo prediction to see Sophia\'s AI scoring'}
            </p>
            <Button 
              onClick={leadId ? fetchPrediction : runDemoPrediction}
              disabled={loading}
              data-testid="btn-run-prediction"
            >
              {loading ? 'Analyzing...' : leadId ? 'Analyze Lead' : 'Run Demo Prediction'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {scores && (
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{scores.engagement}</div>
                  <div className="text-xs text-muted-foreground">Engagement</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{scores.fit}</div>
                  <div className="text-xs text-muted-foreground">Fit Score</div>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">{scores.intent}</div>
                  <div className="text-xs text-muted-foreground">Intent</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{scores.overall}</div>
                  <div className="text-xs text-muted-foreground">Overall</div>
                </div>
              </div>
            )}

            {prediction && (
              <>
                <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Conversion Probability</p>
                      <p className="text-4xl font-bold">{prediction.conversionProbability}%</p>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getBuyingStageColor(prediction.buyingStage)} text-white`}>
                        {prediction.buyingStage.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      {prediction.predictedCloseDate && (
                        <p className="text-sm mt-2 flex items-center justify-end gap-1">
                          <Calendar className="h-4 w-4" />
                          Est. Close: {prediction.predictedCloseDate}
                        </p>
                      )}
                    </div>
                  </div>
                  <Progress 
                    value={prediction.conversionProbability} 
                    className="mt-3 bg-white/30"
                  />
                </div>

                <div className={`p-3 rounded-lg flex items-center gap-3 ${getRiskColor(prediction.riskLevel)}`}>
                  {prediction.riskLevel === 'high' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : prediction.riskLevel === 'medium' ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : (
                    <TrendingUp className="h-5 w-5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {prediction.riskLevel === 'high' ? 'High Risk' : 
                       prediction.riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk'}
                    </p>
                    <p className="text-sm opacity-80">Confidence: {prediction.confidenceScore}%</p>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/10">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Next Best Action
                  </p>
                  <p className="mt-1 font-medium flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    {prediction.nextBestAction}
                  </p>
                </div>

                {prediction.factors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Key Factors</p>
                    <div className="space-y-1">
                      {prediction.factors.map((factor, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center gap-2 text-sm p-2 rounded ${
                            factor.impact === 'positive' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                            factor.impact === 'negative' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                            'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {factor.impact === 'positive' ? (
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          ) : factor.impact === 'negative' ? (
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <Target className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="font-medium">{factor.name}:</span>
                          <span className="opacity-80">{factor.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scores?.intentSignals && scores.intentSignals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Intent Signals Detected</p>
                    <div className="flex flex-wrap gap-2">
                      {scores.intentSignals.map((signal, idx) => (
                        <Badge key={idx} variant="secondary">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={leadId ? fetchPrediction : runDemoPrediction}
                  disabled={loading}
                  data-testid="btn-refresh-prediction"
                >
                  Refresh Prediction
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
