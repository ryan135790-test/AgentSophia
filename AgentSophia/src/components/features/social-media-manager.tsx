import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Share2, TrendingUp, Linkedin, Loader2, CheckCircle2, AlertCircle, Send, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SocialConnection {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  is_active: boolean;
  profile_data?: {
    email?: string;
    picture?: string;
  };
}

interface SocialPost {
  id: string;
  user_id: string;
  workspace_id: string | null;
  platform: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  linkedin_post_id: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
}

export function SocialMediaManager() {
  const [content, setContent] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const workspaceId = currentWorkspace?.id || 'demo';

  // Get all LinkedIn connections for the user
  const { data: connections } = useQuery<{ connections: SocialConnection[] }>({
    queryKey: ['/api/social-connections', user?.id],
    enabled: !!user?.id,
  });

  const linkedInAccounts = connections?.connections?.filter(
    (c) => c.platform === 'linkedin' && c.is_active
  ) || [];

  const hasLinkedInConnected = linkedInAccounts.length > 0;

  // Auto-select first account if only one exists
  const effectiveConnectionId = selectedConnectionId || (linkedInAccounts.length === 1 ? linkedInAccounts[0].id : '');

  // Fetch posts history
  const { data: postsData, isLoading: postsLoading } = useQuery<{ posts: SocialPost[] }>({
    queryKey: ['/api/social/posts', user?.id, workspaceId],
    enabled: !!user?.id,
  });

  // Post to LinkedIn mutation
  const postMutation = useMutation({
    mutationFn: async ({ postContent, connectionId }: { postContent: string; connectionId?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/social/linkedin/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          content: postContent,
          workspaceId: workspaceId,
          connectionId: connectionId || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to post');
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Posted Successfully!",
        description: "Your post has been published to LinkedIn.",
      });
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['/api/social/posts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Post Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePostNow = () => {
    if (!content.trim()) {
      toast({
        title: "Empty Post",
        description: "Please enter some content to post.",
        variant: "destructive",
      });
      return;
    }

    if (!hasLinkedInConnected) {
      toast({
        title: "LinkedIn Not Connected",
        description: "Please connect your LinkedIn account in the Connections tab first.",
        variant: "destructive",
      });
      return;
    }

    if (linkedInAccounts.length > 1 && !effectiveConnectionId) {
      toast({
        title: "Select Account",
        description: "Please select which LinkedIn account to post from.",
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate({ 
      postContent: content, 
      connectionId: effectiveConnectionId 
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Published</Badge>;
      case 'scheduled':
        return <Badge variant="secondary"><Calendar className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Quick Post to LinkedIn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasLinkedInConnected && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">LinkedIn Not Connected</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Go to the Connections tab to connect your LinkedIn account before posting.
                </p>
              </div>
            </div>
          )}

          {/* Account selector for multiple accounts */}
          {linkedInAccounts.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Post as:</label>
              <Select value={effectiveConnectionId} onValueChange={setSelectedConnectionId}>
                <SelectTrigger className="w-full" data-testid="select-linkedin-account">
                  <SelectValue placeholder="Select LinkedIn account" />
                </SelectTrigger>
                <SelectContent>
                  {linkedInAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id} data-testid={`option-account-${account.id}`}>
                      <div className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4 text-blue-600" />
                        <span>{account.account_name}</span>
                        {account.profile_data?.email && (
                          <span className="text-xs text-muted-foreground">({account.profile_data.email})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Single account indicator */}
          {linkedInAccounts.length === 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Linkedin className="h-4 w-4 text-blue-600" />
              <span>Posting as: <strong>{linkedInAccounts[0].account_name}</strong></span>
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Post Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Share insights, updates, or engage with your network..."
              className="w-full h-32 border rounded-lg p-3 mt-1 text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-slate-800 dark:border-slate-700"
              maxLength={3000}
              data-testid="textarea-post-content"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{content.length}/3000 characters</span>
              {hasLinkedInConnected && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {linkedInAccounts.length} LinkedIn account{linkedInAccounts.length > 1 ? 's' : ''} connected
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handlePostNow} 
              disabled={postMutation.isPending || !content.trim() || !hasLinkedInConnected || (linkedInAccounts.length > 1 && !effectiveConnectionId)}
              data-testid="button-post-now"
            >
              {postMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Post Now</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Recent Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {postsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : postsData?.posts && postsData.posts.length > 0 ? (
            <div className="space-y-3">
              {postsData.posts.map((post) => (
                <div 
                  key={post.id} 
                  className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800"
                  data-testid={`card-post-${post.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Linkedin className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm capitalize">{post.platform}</span>
                        {getStatusBadge(post.status)}
                      </div>
                      <p className="text-sm text-foreground line-clamp-3">{post.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {post.published_at 
                          ? `Published ${format(new Date(post.published_at), 'MMM d, yyyy h:mm a')}`
                          : post.scheduled_for
                            ? `Scheduled for ${format(new Date(post.scheduled_for), 'MMM d, yyyy h:mm a')}`
                            : `Created ${format(new Date(post.created_at), 'MMM d, yyyy h:mm a')}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Share2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No posts yet</p>
              <p className="text-sm">Create your first post above to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
