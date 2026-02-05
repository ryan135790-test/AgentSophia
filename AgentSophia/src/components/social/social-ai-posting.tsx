import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSocialConnections } from '@/hooks/use-social-connections';
import { 
  Sparkles, 
  Facebook, 
  Linkedin, 
  Twitter, 
  Instagram,
  Send,
  Calendar,
  Wand2,
  Copy,
  RefreshCw,
  Share2,
  Image as ImageIcon,
  Settings,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SiTiktok } from 'react-icons/si';
import OpenAI from 'openai';
import { SocialConnectionsManager } from './social-connections-manager';

interface SocialPlatform {
  id: string;
  name: string;
  icon: any;
  color: string;
  charLimit: number;
  bgColor: string;
}

interface PostVariation {
  content: string;
  hashtags: string[];
  platform: string;
}

export function SocialAIPosting() {
  const { toast } = useToast();
  const { connections, isLoading: isLoadingConnections } = useSocialConnections();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin']);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<PostVariation[]>([]);
  const [customizePerPlatform, setCustomizePerPlatform] = useState(false);
  
  // Guided form fields
  const [coreMessage, setCoreMessage] = useState('');
  const [contentGoal, setContentGoal] = useState('engagement');
  const [brandVoice, setBrandVoice] = useState('professional');
  const [keywords, setKeywords] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Filter active connections for selected platforms
  const availableAccounts = connections.filter(
    c => c.is_active && selectedPlatforms.includes(c.platform)
  );
  
  const platforms: SocialPlatform[] = [
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', charLimit: 3000, bgColor: 'bg-blue-50 dark:bg-blue-950' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-700', charLimit: 5000, bgColor: 'bg-blue-100 dark:bg-blue-900' },
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'text-black dark:text-white', charLimit: 280, bgColor: 'bg-gray-100 dark:bg-gray-800' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600', charLimit: 2200, bgColor: 'bg-pink-50 dark:bg-pink-950' },
    { id: 'tiktok', name: 'TikTok', icon: SiTiktok, color: 'text-black dark:text-white', charLimit: 2200, bgColor: 'bg-gray-50 dark:bg-gray-900' },
  ];

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const generateWithAI = async () => {
    if (!coreMessage.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a core message for your post',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: 'No Platform Selected',
        description: 'Please select at least one social media platform',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        // Fallback to smart template
        const fallbackPost = generateFallbackPost();
        setGeneratedPosts(fallbackPost);
        toast({
          title: 'Posts Generated!',
          description: `Created ${fallbackPost.length} post variations using smart templates`,
        });
        return;
      }

      // Use OpenAI
      const openai = new OpenAI({ 
        apiKey,
        dangerouslyAllowBrowser: true
      });

      const platformNames = selectedPlatforms
        .map(id => platforms.find(p => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      const prompt = `You are a social media content expert. Create ${customizePerPlatform ? 'platform-specific' : 'multi-platform'} social media posts.

REQUIREMENTS:
Core Message: ${coreMessage}
Content Goal: ${contentGoal}
Brand Voice: ${brandVoice}
Keywords: ${keywords || 'N/A'}
Call to Action: ${callToAction || 'N/A'}
Target Audience: ${targetAudience || 'General audience'}
Platforms: ${platformNames}

Create ${customizePerPlatform ? selectedPlatforms.length : 3} post variations in JSON format:
{
  "posts": [
    {
      "content": "Post text optimized for the platform",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "platform": "${customizePerPlatform ? 'platform name' : 'all'}"
    }
  ]
}

Guidelines:
- Match the ${brandVoice} brand voice
- Focus on ${contentGoal} as the primary goal
- Include ${keywords ? 'these keywords: ' + keywords : 'relevant keywords'}
- ${callToAction ? 'End with this CTA: ' + callToAction : 'Include a clear call-to-action'}
- Keep within character limits (LinkedIn: 3000, Facebook: 5000, Twitter: 280, Instagram/TikTok: 2200)
- Use 3-5 relevant hashtags
- Make content engaging and authentic
- For Twitter: Be concise and punchy
- For LinkedIn: Professional and insightful
- For Instagram/TikTok: Visual and trendy
- For Facebook: Community-focused

Return ONLY valid JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a social media expert. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      setGeneratedPosts(result.posts || []);
      
      toast({
        title: 'Posts Generated! ✨',
        description: `Created ${result.posts?.length || 0} AI-powered post variations`,
      });

    } catch (error: any) {
      console.warn('OpenAI failed, using fallback templates:', error?.message);
      const fallbackPost = generateFallbackPost();
      setGeneratedPosts(fallbackPost);
      
      toast({
        title: 'Posts Generated',
        description: `Created ${fallbackPost.length} post variations using smart templates`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackPost = (): PostVariation[] => {
    const posts: PostVariation[] = [];
    
    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
    const hashtagsFromKeywords = keywordList.slice(0, 3).map(k => k.replace(/\s+/g, ''));
    
    if (customizePerPlatform) {
      selectedPlatforms.forEach(platformId => {
        const platform = platforms.find(p => p.id === platformId);
        if (!platform) return;

        let content = '';
        
        if (platformId === 'twitter') {
          content = `${coreMessage.slice(0, 200)}\n\n${callToAction || 'Learn more!'} 🚀`;
        } else if (platformId === 'linkedin') {
          content = `${coreMessage}\n\nKey points:\n✓ ${keywordList[0] || 'Innovation'}\n✓ ${keywordList[1] || 'Growth'}\n✓ ${keywordList[2] || 'Success'}\n\n${callToAction || 'Let\'s connect!'}`;
        } else if (platformId === 'instagram' || platformId === 'tiktok') {
          content = `✨ ${coreMessage} ✨\n\n${callToAction || 'Tap the link in bio!'} 💫`;
        } else {
          content = `${coreMessage}\n\n${callToAction || 'Join the conversation!'}`;
        }

        posts.push({
          content,
          hashtags: hashtagsFromKeywords.length ? hashtagsFromKeywords : ['Marketing', 'Business', 'Growth'],
          platform: platform.name
        });
      });
    } else {
      // 3 general variations
      posts.push({
        content: `${coreMessage}\n\n${callToAction || 'Learn more today!'}`,
        hashtags: hashtagsFromKeywords.length ? hashtagsFromKeywords : ['Marketing', 'Business'],
        platform: 'all'
      });
      
      posts.push({
        content: `🎯 ${coreMessage}\n\nReady to take action? ${callToAction || 'Let\'s go!'}`,
        hashtags: hashtagsFromKeywords.length ? hashtagsFromKeywords : ['Growth', 'Success'],
        platform: 'all'
      });
      
      posts.push({
        content: `${coreMessage}\n\nWhat do you think? ${callToAction || 'Share your thoughts below!'}`,
        hashtags: hashtagsFromKeywords.length ? hashtagsFromKeywords : ['Community', 'Engagement'],
        platform: 'all'
      });
    }

    return posts;
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'Post content copied to clipboard',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Social AI Posting</h2>
          <p className="text-muted-foreground">
            Generate and customize social media posts with AI - powered by Content AI
          </p>
        </div>
        <Sparkles className="h-8 w-8 text-purple-500" />
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" data-testid="tab-create-post">
            <Sparkles className="h-4 w-4 mr-2" />
            Create Post
          </TabsTrigger>
          <TabsTrigger value="accounts" data-testid="tab-manage-accounts">
            <Settings className="h-4 w-4 mr-2" />
            Manage Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">

      <Card className="border-purple-200 dark:border-purple-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            Content AI Generator
          </CardTitle>
          <CardDescription>
            Answer guided questions to generate optimized social media content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform Selection */}
          <div className="space-y-3">
            <Label>Select Platforms</Label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);
                
                return (
                  <div
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={`
                      cursor-pointer p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }
                    `}
                    data-testid={`social-platform-${platform.id}`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className={`p-3 rounded-full ${isSelected ? platform.bgColor : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Icon className={`h-6 w-6 ${isSelected ? platform.color : 'text-gray-400'}`} />
                      </div>
                      <span className="text-sm font-medium text-center">{platform.name}</span>
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customize Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="customize"
              checked={customizePerPlatform}
              onCheckedChange={(checked) => setCustomizePerPlatform(checked as boolean)}
              data-testid="checkbox-customize-per-platform"
            />
            <label
              htmlFor="customize"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Customize content for each platform
            </label>
          </div>

          {/* Connected Accounts */}
          {availableAccounts.length > 0 && (
            <div className="space-y-3">
              <Label>Post to Connected Accounts</Label>
              <div className="space-y-2">
                {availableAccounts.map((account) => {
                  const platform = platforms.find(p => p.id === account.platform);
                  if (!platform) return null;
                  const Icon = platform.icon;
                  const isSelected = selectedAccounts.includes(account.id);
                  
                  return (
                    <div
                      key={account.id}
                      onClick={() => {
                        setSelectedAccounts(prev =>
                          prev.includes(account.id)
                            ? prev.filter(id => id !== account.id)
                            : [...prev, account.id]
                        );
                      }}
                      className={`
                        cursor-pointer p-3 rounded-lg border-2 transition-all flex items-center justify-between
                        ${isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                        }
                      `}
                      data-testid={`account-${account.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${platform.bgColor}`}>
                          <Icon className={`h-4 w-4 ${platform.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{account.account_name}</p>
                          <p className="text-xs text-muted-foreground">{platform.name}</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Connected Accounts Alert */}
          {selectedPlatforms.length > 0 && availableAccounts.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No connected accounts for selected platforms. Go to{' '}
                <span className="font-semibold">Manage Accounts</span> tab to connect your social media accounts.
              </AlertDescription>
            </Alert>
          )}

          {/* Guided Questions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="core-message">Core Message *</Label>
              <Textarea
                id="core-message"
                placeholder="What's the main message you want to share? (e.g., Announcing our new product launch that helps businesses save 10 hours per week)"
                value={coreMessage}
                onChange={(e) => setCoreMessage(e.target.value)}
                rows={3}
                data-testid="input-core-message"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-goal">Content Goal</Label>
              <Select value={contentGoal} onValueChange={setContentGoal}>
                <SelectTrigger id="content-goal" data-testid="select-content-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="awareness">Brand Awareness</SelectItem>
                  <SelectItem value="traffic">Drive Traffic</SelectItem>
                  <SelectItem value="leads">Generate Leads</SelectItem>
                  <SelectItem value="education">Educate Audience</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand-voice">Brand Voice</Label>
              <Select value={brandVoice} onValueChange={setBrandVoice}>
                <SelectTrigger id="brand-voice" data-testid="select-brand-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual & Friendly</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                placeholder="AI, automation, productivity"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                data-testid="input-keywords"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta">Call to Action</Label>
              <Input
                id="cta"
                placeholder="Visit our website, Sign up now, Learn more"
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                data-testid="input-cta"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="target-audience">Target Audience (optional)</Label>
              <Input
                id="target-audience"
                placeholder="Marketing professionals, Small business owners, Tech enthusiasts"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                data-testid="input-target-audience"
              />
            </div>
          </div>

          <Button
            onClick={generateWithAI}
            disabled={isGenerating || !coreMessage.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
            data-testid="button-generate-posts"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate Posts with AI'}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Posts */}
      {generatedPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Generated Posts
            </CardTitle>
            <CardDescription>
              Review, edit, and schedule your AI-generated content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedPosts.map((post, index) => (
              <Card key={index} className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Variation {index + 1}
                      </Badge>
                      {post.platform !== 'all' && (
                        <Badge className="bg-primary/10">
                          {post.platform}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(post.content + '\n\n' + post.hashtags.map(h => '#' + h).join(' '))}
                        data-testid={`button-copy-post-${index}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap">
                    {post.content}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.hashtags.map((hashtag, i) => (
                      <Badge key={i} variant="secondary">
                        #{hashtag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-schedule-${index}`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule
                    </Button>
                    <Button size="sm" className="flex-1" data-testid={`button-post-now-${index}`}>
                      <Send className="h-4 w-4 mr-2" />
                      Post Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <SocialConnectionsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
