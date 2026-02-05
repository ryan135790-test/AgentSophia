import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Separator
} from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bot, Target, CheckCircle2, XCircle, Users, Building2, 
  Mail, Sparkles, ThumbsUp, ThumbsDown, Zap, Clock,
  ChevronRight, Filter, Loader2
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface CampaignMatch {
  id: string;
  lead_contact_id: string;
  campaign_id: string;
  match_score: number;
  rationale: string;
  match_factors: {
    job_title_match?: number;
    industry_match?: number;
    engagement_potential?: number;
  };
  autonomy_mode: string;
  status: string;
  lead_first_name: string;
  lead_last_name: string;
  lead_email: string;
  lead_company: string;
  lead_job_title: string;
  campaign_name: string;
  campaign_goal: string;
  created_at: string;
}

export function SophiaCampaignSuggestions() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [matchToReject, setMatchToReject] = useState<string | null>(null);

  const { data: matchesData, isLoading } = useQuery<{ success: boolean; matches: CampaignMatch[] }>({
    queryKey: ['/api/sophia/campaign-matches', currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
  });

  const approveMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest(`/api/sophia/campaign-matches/${matchId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentWorkspace?.owner_id }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Lead Assigned', description: 'Lead has been added to the campaign.' });
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaign-matches'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ matchId, reason }: { matchId: string; reason?: string }) => {
      return apiRequest(`/api/sophia/campaign-matches/${matchId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentWorkspace?.owner_id, reason }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Suggestion Dismissed', description: 'Sophia will learn from this feedback.' });
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaign-matches'] });
      setRejectDialogOpen(false);
      setRejectReason('');
      setMatchToReject(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (matchIds: string[]) => {
      return apiRequest('/api/sophia/campaign-matches/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ matchIds, userId: currentWorkspace?.owner_id }),
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Leads Assigned', 
        description: `${data.approved} leads added to campaigns.` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaign-matches'] });
      setSelectedMatches([]);
    },
  });

  const matches = matchesData?.matches || [];

  const toggleMatch = (matchId: string) => {
    setSelectedMatches(prev => 
      prev.includes(matchId) 
        ? prev.filter(id => id !== matchId)
        : [...prev, matchId]
    );
  };

  const selectAll = () => {
    setSelectedMatches(matches.map(m => m.id));
  };

  const handleReject = (matchId: string) => {
    setMatchToReject(matchId);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (matchToReject) {
      rejectMutation.mutate({ matchId: matchToReject, reason: rejectReason });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-2">No Pending Suggestions</h3>
          <p className="text-sm text-muted-foreground">
            Sophia will suggest campaign assignments when new leads are imported.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Sophia's Campaign Suggestions
              </CardTitle>
              <CardDescription>
                {matches.length} leads ready for campaign assignment
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedMatches.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => bulkApproveMutation.mutate(selectedMatches)}
                  disabled={bulkApproveMutation.isPending}
                  data-testid="button-bulk-approve"
                >
                  {bulkApproveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Approve {selectedMatches.length}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              {matches.map(match => (
                <div
                  key={match.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    selectedMatches.includes(match.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                  }`}
                  data-testid={`campaign-match-${match.id}`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedMatches.includes(match.id)}
                      onCheckedChange={() => toggleMatch(match.id)}
                      data-testid={`checkbox-match-${match.id}`}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">
                              {match.lead_first_name} {match.lead_last_name}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {match.lead_job_title && (
                                <span>{match.lead_job_title}</span>
                              )}
                              {match.lead_company && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {match.lead_company}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge className={`${getScoreColor(match.match_score)}`}>
                          {match.match_score}% match
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm mb-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Target className="h-4 w-4 text-primary" />
                        <span className="font-medium">{match.campaign_name}</span>
                        {match.campaign_goal && (
                          <span className="text-muted-foreground">- {match.campaign_goal}</span>
                        )}
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                          <p className="text-sm text-muted-foreground">
                            {match.rationale}
                          </p>
                        </div>
                      </div>

                      {match.match_factors && (
                        <div className="flex gap-4 mb-3">
                          {match.match_factors.job_title_match && (
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Title Match</span>
                                <span>{match.match_factors.job_title_match}%</span>
                              </div>
                              <Progress value={match.match_factors.job_title_match} className="h-1.5" />
                            </div>
                          )}
                          {match.match_factors.engagement_potential && (
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Engagement</span>
                                <span>{match.match_factors.engagement_potential}%</span>
                              </div>
                              <Progress value={match.match_factors.engagement_potential} className="h-1.5" />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(match.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${match.id}`}
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(match.id)}
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-${match.id}`}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(match.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Suggestion</DialogTitle>
            <DialogDescription>
              Help Sophia learn by sharing why this suggestion wasn't a good fit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional: Why isn't this lead a good fit for this campaign?"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            data-testid="textarea-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Dismiss Suggestion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
