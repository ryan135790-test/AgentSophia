import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Sparkles, 
  Lightbulb, 
  Copy, 
  Check,
  TrendingUp,
  AlertTriangle,
  Wand2,
  Mail,
  MousePointer,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Suggestion {
  id: string;
  type: string;
  content: string;
  confidence: number;
  reasoning: string;
  predictedPerformance: {
    openRate?: string;
    clickRate?: string;
    replyRate?: string;
  };
  basedOn?: string;
}

interface ContentImprovement {
  issue: string;
  suggestion: string;
  impact: string;
}

interface SmartContentSuggestionsProps {
  currentContent?: string;
  contentType: 'subject' | 'cta' | 'body';
  channel?: string;
  campaignType?: string;
  step?: number;
  onApplySuggestion: (content: string) => void;
}

export function SmartContentSuggestions({
  currentContent = '',
  contentType,
  channel = 'email',
  campaignType = 'cold_outreach',
  step = 1,
  onApplySuggestion
}: SmartContentSuggestionsProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('suggestions');

  const suggestionsMutation = useMutation({
    mutationFn: async (type: string) => {
      return apiRequest('/api/sophia/content-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          type,
          context: { channel, purpose: campaignType, sequenceStep: step }
        })
      });
    }
  });

  const variationsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/sophia/content-variations', {
        method: 'POST',
        body: JSON.stringify({
          content: currentContent,
          type: contentType
        })
      });
    }
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/sophia/analyze-content', {
        method: 'POST',
        body: JSON.stringify({
          content: currentContent,
          campaignType,
          channel,
          step
        })
      });
    }
  });

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const handleApply = (content: string) => {
    onApplySuggestion(content);
    toast({ title: 'Content applied', description: 'The suggestion has been applied to your message.' });
  };

  const suggestions: Suggestion[] = suggestionsMutation.data?.suggestions || [];
  const variations: Suggestion[] = variationsMutation.data?.variations || [];
  const analysis = analyzeMutation.data;

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Sophia's Smart Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggestions" className="text-xs" data-testid="tab-suggestions">
              <Lightbulb className="h-3 w-3 mr-1" />
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="variations" className="text-xs" data-testid="tab-variations">
              <Wand2 className="h-3 w-3 mr-1" />
              Variations
            </TabsTrigger>
            <TabsTrigger value="analyze" className="text-xs" data-testid="tab-analyze">
              <TrendingUp className="h-3 w-3 mr-1" />
              Analyze
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-3">
            {suggestions.length === 0 ? (
              <div className="text-center py-4">
                <Button 
                  onClick={() => suggestionsMutation.mutate(contentType)}
                  disabled={suggestionsMutation.isPending}
                  className="gap-2"
                  data-testid="button-get-suggestions"
                >
                  {suggestionsMutation.isPending ? (
                    <>Loading...</>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Get AI Suggestions
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Get {contentType === 'subject' ? 'subject line' : contentType === 'cta' ? 'call-to-action' : 'opening line'} ideas
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <div 
                      key={suggestion.id}
                      className="p-3 bg-muted/50 rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{suggestion.content}</p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleCopy(suggestion.content, suggestion.id)}
                            data-testid={`button-copy-${suggestion.id}`}
                          >
                            {copiedId === suggestion.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleApply(suggestion.content)}
                            data-testid={`button-apply-${suggestion.id}`}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-xs">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </Badge>
                        {suggestion.predictedPerformance.openRate && (
                          <span className="text-green-600 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {suggestion.predictedPerformance.openRate}
                          </span>
                        )}
                        {suggestion.predictedPerformance.replyRate && (
                          <span className="text-blue-600 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {suggestion.predictedPerformance.replyRate}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="variations" className="mt-3">
            {!currentContent ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Enter some content first to generate variations
              </p>
            ) : variations.length === 0 ? (
              <div className="text-center py-4">
                <Button 
                  onClick={() => variationsMutation.mutate()}
                  disabled={variationsMutation.isPending}
                  className="gap-2"
                  data-testid="button-generate-variations"
                >
                  {variationsMutation.isPending ? (
                    <>Loading...</>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Variations
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Create A/B test variations of your content
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {variations.map((variation) => (
                    <div 
                      key={variation.id}
                      className="p-3 bg-muted/50 rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{variation.content}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleApply(variation.content)}
                          data-testid={`button-apply-variation-${variation.id}`}
                        >
                          Apply
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{variation.reasoning}</p>
                      {variation.predictedPerformance && (
                        <Badge variant="outline" className="text-xs">
                          Predicted impact: {variation.predictedPerformance.openRate || variation.predictedPerformance.replyRate}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="analyze" className="mt-3">
            {!currentContent ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Enter some content first to analyze it
              </p>
            ) : !analysis ? (
              <div className="text-center py-4">
                <Button 
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                  className="gap-2"
                  data-testid="button-analyze-content"
                >
                  {analyzeMutation.isPending ? (
                    <>Analyzing...</>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4" />
                      Analyze My Content
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Get feedback and improvement suggestions
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {analysis.recommendation && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Sophia's Recommendation</div>
                          <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">{analysis.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {analysis.improvements?.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Suggested Improvements</h4>
                      {analysis.improvements.map((improvement: ContentImprovement, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <div>
                              <div className="text-sm font-medium">{improvement.issue}</div>
                              <p className="text-xs text-muted-foreground mt-1">{improvement.suggestion}</p>
                              <Badge variant="outline" className="text-xs mt-2 text-green-600">
                                {improvement.impact}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Check className="h-8 w-8 text-green-600 mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Your content looks great! No major improvements needed.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
