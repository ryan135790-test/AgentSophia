import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, AlertCircle } from 'lucide-react';

export function ConversationAnalyzer() {
  const analysisExample = {
    sentiment: 'positive',
    sentiment_score: 0.82,
    intent: 'interested',
    tone: 'professional',
    urgency_score: 75,
    buying_signals: ['expressed interest', 'asked about pricing', 'mentioned timeline'],
    key_topics: ['ROI', 'implementation', 'support']
  };

  const getSentimentColor = (sentiment: string) => {
    return sentiment === 'positive' ? 'bg-green-100 text-green-800' : 
           sentiment === 'negative' ? 'bg-red-100 text-red-800' : 
           'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversation Analysis
          </CardTitle>
          <CardDescription>AI-powered message insights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div data-testid="card-sentiment">
              <p className="text-sm font-medium">Sentiment</p>
              <Badge className={`mt-2 ${getSentimentColor(analysisExample.sentiment)}`}>
                {analysisExample.sentiment} ({Math.round(analysisExample.sentiment_score * 100)}%)
              </Badge>
            </div>
            <div data-testid="card-intent">
              <p className="text-sm font-medium">Intent</p>
              <Badge variant="secondary" className="mt-2">{analysisExample.intent}</Badge>
            </div>
            <div data-testid="card-tone">
              <p className="text-sm font-medium">Tone</p>
              <Badge variant="outline" className="mt-2">{analysisExample.tone}</Badge>
            </div>
            <div data-testid="card-urgency">
              <p className="text-sm font-medium">Urgency</p>
              <Badge variant="outline" className="mt-2">{analysisExample.urgency_score}%</Badge>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Buying Signals
            </p>
            <div className="flex gap-2 flex-wrap mt-2">
              {analysisExample.buying_signals.map((signal) => (
                <Badge key={signal} variant="secondary" className="text-xs">{signal}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Key Topics</p>
            <div className="flex gap-2 flex-wrap mt-2">
              {analysisExample.key_topics.map((topic) => (
                <Badge key={topic} variant="outline" className="text-xs">{topic}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
