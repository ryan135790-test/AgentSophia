import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';

export function DealForecasting() {
  const forecast = {
    deal_probability: 78,
    estimated_close_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    estimated_deal_value: 45000,
    pipeline_stage: 'negotiation',
    forecast_confidence: 85,
    risk_factors: [],
    growth_trajectory: 'increasing'
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Deal Forecast
          </CardTitle>
          <CardDescription>Revenue intelligence predictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2" data-testid="text-probability">
              <span className="text-sm font-medium">Deal Probability</span>
              <span className="text-sm font-bold">{forecast.deal_probability}%</span>
            </div>
            <Progress value={forecast.deal_probability} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded p-3 bg-white" data-testid="card-close-date">
              <p className="text-xs text-muted-foreground">Estimated Close</p>
              <p className="text-sm font-semibold flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {forecast.estimated_close_date}
              </p>
            </div>
            <div className="border rounded p-3 bg-white" data-testid="card-deal-value">
              <p className="text-xs text-muted-foreground">Deal Value</p>
              <p className="text-sm font-semibold flex items-center gap-1 mt-1">
                <DollarSign className="h-3 w-3" />
                ${forecast.estimated_deal_value.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between" data-testid="card-stage-confidence">
            <div>
              <p className="text-xs text-muted-foreground">Pipeline Stage</p>
              <Badge className="mt-1">{forecast.pipeline_stage}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <Badge variant="secondary" className="mt-1">{forecast.forecast_confidence}%</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
