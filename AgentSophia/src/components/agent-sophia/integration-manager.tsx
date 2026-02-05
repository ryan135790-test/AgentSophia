import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Twitter, Facebook, Instagram, Music, Youtube, Linkedin, Mail, Send, 
  Zap, BarChart3, Contact, Plus, Trash2, CheckCircle2, AlertCircle, 
  Clock, Eye, Heart, MessageCircle, Share2, TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const platforms = [
  { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'text-black', bgColor: 'bg-black/10' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-100' },
  { id: 'tiktok', name: 'TikTok', icon: Music, color: 'text-black', bgColor: 'bg-black/10' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-100' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { id: 'smartreach', name: 'SmartReach', icon: Mail, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { id: 'email_outreach', name: 'Email Outreach', icon: Mail, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { id: 'reply_io', name: 'Reply.io', icon: Send, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
];

export function IntegrationManager() {
  const { toast } = useToast();
  // All system integrations are pre-configured by admin and available to all users
  const [systemIntegrationsAvailable] = useState<Record<string, boolean>>({
    'smartreach': true,
    'email_outreach': true,
    'reply_io': true,
    'sendgrid': true,
    'resend': true,
    'hubspot': true,
    'pipedrive': true,
    'salesforce': true,
    'twitter': true,
    'facebook': true,
    'instagram': true,
    'linkedin': true,
    'tiktok': true,
    'youtube': true,
  });
  
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState({ platform: '', content: '', scheduledAt: '' });
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const handlePostContent = () => {
    if (!newPost.platform || !newPost.content) {
      toast({
        title: 'Error',
        description: 'Please select a platform and add content',
        variant: 'destructive'
      });
      return;
    }

    const post = {
      id: Date.now().toString(),
      ...newPost,
      status: newPost.scheduledAt ? 'scheduled' : 'published',
      createdAt: new Date().toISOString(),
      engagement: { likes: 0, comments: 0, shares: 0, views: 0 }
    };

    setPosts(prev => [post, ...prev]);
    setNewPost({ platform: '', content: '', scheduledAt: '' });
    setIsCreatingPost(false);
    
    toast({
      title: 'Success',
      description: `Post ${newPost.scheduledAt ? 'scheduled' : 'published'} to ${platforms.find(p => p.id === newPost.platform)?.name}`
    });
  };

  return (
    <div className="space-y-6 w-full">
      {/* Available Integrations (System-configured by Admin) */}
      <Card>
        <CardHeader>
          <CardTitle>Available Integrations</CardTitle>
          <CardDescription>System-configured integrations. Use any of these platforms to create campaigns and posts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platforms.map(platform => {
              const Icon = platform.icon;
              const isAvailable = systemIntegrationsAvailable[platform.id];
              return (
                <Button
                  key={platform.id}
                  variant={isAvailable ? 'default' : 'outline'}
                  disabled={!isAvailable}
                  className={`h-24 flex flex-col items-center justify-center gap-2 ${isAvailable ? platform.bgColor : ''}`}
                  data-testid={`button-integration-${platform.id}`}
                >
                  <Icon className={`h-6 w-6 ${isAvailable ? platform.color : 'text-muted-foreground'}`} />
                  <span className="text-xs text-center">{platform.name}</span>
                  {isAvailable && <CheckCircle2 className="h-4 w-4 absolute top-2 right-2 text-green-600" />}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            All integrations are managed by your administrator. Contact them to enable additional platforms.
          </p>
        </CardContent>
      </Card>

      {/* Multi-Channel Post Creator */}
      <Card>
        <CardHeader>
          <CardTitle>Create & Manage Posts</CardTitle>
          <CardDescription>Post to multiple channels simultaneously</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isCreatingPost} onOpenChange={setIsCreatingPost}>
            <DialogTrigger asChild>
              <Button className="mb-4">
                <Plus className="h-4 w-4 mr-2" />
                Create New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Multi-Channel Post</DialogTitle>
                <DialogDescription>Create and schedule posts for multiple platforms</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Platforms</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {platforms.map(platform => {
                      const Icon = platform.icon;
                      return (
                        <Button
                          key={platform.id}
                          variant={newPost.platform === platform.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNewPost(prev => ({ ...prev, platform: platform.id }))}
                          data-testid={`select-platform-${platform.id}`}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                <div>
                  <Label>Content</Label>
                  <Textarea
                    placeholder="Write your post content..."
                    value={newPost.content}
                    onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                    data-testid="input-post-content"
                    className="min-h-24"
                  />
                </div>

                <div>
                  <Label>Schedule (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={newPost.scheduledAt}
                    onChange={(e) => setNewPost(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    data-testid="input-schedule-time"
                  />
                </div>

                <Button onClick={handlePostContent} className="w-full" data-testid="button-publish-post">
                  {newPost.scheduledAt ? 'Schedule Post' : 'Publish Now'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Posted Content Feed */}
          <ScrollArea className="h-96 border rounded-lg p-4">
            {posts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No posts yet. Create your first multi-channel post!
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => {
                  const platform = platforms.find(p => p.id === post.platform);
                  const Icon = platform?.icon;
                  return (
                    <Card key={post.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 flex-1">
                          {Icon && <Icon className={`h-5 w-5 mt-1 ${platform?.color}`} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{platform?.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 my-1">{post.content}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {post.engagement.views}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" /> {post.engagement.likes}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" /> {post.engagement.comments}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                            {post.status === 'scheduled' ? <Clock className="h-3 w-3 mr-1" /> : null}
                            {post.status}
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => setPosts(p => p.filter(x => x.id !== post.id))} data-testid={`button-delete-post-${post.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* System Configuration Info */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-sm">System-Configured Integrations</CardTitle>
          <CardDescription>All email automation and CRM integrations are managed by your administrator</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>Email Automation:</strong> SmartReach, Reply.io, SendGrid, Resend</p>
          <p><strong>CRM Platforms:</strong> HubSpot, Pipedrive, Salesforce</p>
          <p className="text-xs text-muted-foreground">To configure new API keys or manage integrations, contact your administrator.</p>
        </CardContent>
      </Card>
    </div>
  );
}