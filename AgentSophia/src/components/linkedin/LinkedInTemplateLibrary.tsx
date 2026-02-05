import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Search, 
  Copy, 
  Star,
  Plus,
  TrendingUp,
  MessageSquare,
  UserPlus,
  Mail,
  Calendar
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MessageTemplate {
  id: string;
  name: string;
  category: 'connection_note' | 'first_message' | 'follow_up' | 'inmail' | 'meeting_request';
  content: string;
  variables: string[];
  usageCount: number;
  avgAcceptanceRate: number | null;
  avgReplyRate: number | null;
  tags: string[];
  isPublic: boolean;
}

export function LinkedInTemplateLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [templates] = useState<MessageTemplate[]>([
    {
      id: '1',
      name: 'Professional Introduction',
      category: 'connection_note',
      content: 'Hi {{firstName}}, I noticed we\'re both in the {{industry}} space. Would love to connect and exchange ideas on {{topic}}.',
      variables: ['firstName', 'industry', 'topic'],
      usageCount: 1234,
      avgAcceptanceRate: 52,
      avgReplyRate: null,
      tags: ['professional', 'networking'],
      isPublic: true,
    },
    {
      id: '2',
      name: 'Mutual Connection',
      category: 'connection_note',
      content: 'Hi {{firstName}}, I see we\'re both connected with {{mutualConnection}}. I\'d love to add you to my network!',
      variables: ['firstName', 'mutualConnection'],
      usageCount: 892,
      avgAcceptanceRate: 68,
      avgReplyRate: null,
      tags: ['mutual-connection', 'warm-intro'],
      isPublic: true,
    },
    {
      id: '3',
      name: 'Value-First Opener',
      category: 'first_message',
      content: 'Hey {{firstName}}, thanks for connecting! I noticed {{company}} is in the {{industry}} space. I recently helped a similar company {{result}}. Would you be open to a quick chat?',
      variables: ['firstName', 'company', 'industry', 'result'],
      usageCount: 567,
      avgAcceptanceRate: null,
      avgReplyRate: 18,
      tags: ['value-first', 'sales'],
      isPublic: true,
    },
    {
      id: '4',
      name: 'Quick Question Follow-Up',
      category: 'follow_up',
      content: 'Hey {{firstName}}, just wanted to bump this up. Quick question - is {{challenge}} something that\'s on your radar right now?',
      variables: ['firstName', 'challenge'],
      usageCount: 445,
      avgAcceptanceRate: null,
      avgReplyRate: 12,
      tags: ['follow-up', 'question'],
      isPublic: true,
    },
    {
      id: '5',
      name: 'InMail Cold Outreach',
      category: 'inmail',
      content: 'Hi {{firstName}},\n\nI came across {{company}} while researching {{industry}} leaders.\n\nI help companies like yours {{value_prop}}. Would you be open to a brief 15-minute call?\n\nBest,\n{{senderName}}',
      variables: ['firstName', 'company', 'industry', 'value_prop', 'senderName'],
      usageCount: 234,
      avgAcceptanceRate: null,
      avgReplyRate: 8,
      tags: ['inmail', 'cold-outreach'],
      isPublic: true,
    },
    {
      id: '6',
      name: 'Meeting Request',
      category: 'meeting_request',
      content: 'Hey {{firstName}}, based on our conversation, I think it would be valuable to hop on a quick call. Would {{proposedTime}} work for a 15-minute chat?',
      variables: ['firstName', 'proposedTime'],
      usageCount: 389,
      avgAcceptanceRate: null,
      avgReplyRate: 35,
      tags: ['meeting', 'calendar'],
      isPublic: true,
    },
  ]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'connection_note':
        return <UserPlus className="w-4 h-4" />;
      case 'first_message':
        return <MessageSquare className="w-4 h-4" />;
      case 'follow_up':
        return <Mail className="w-4 h-4" />;
      case 'inmail':
        return <Mail className="w-4 h-4" />;
      case 'meeting_request':
        return <Calendar className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'connection_note':
        return 'Connection Note';
      case 'first_message':
        return 'First Message';
      case 'follow_up':
        return 'Follow-up';
      case 'inmail':
        return 'InMail';
      case 'meeting_request':
        return 'Meeting Request';
      default:
        return category;
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !t.content.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    return true;
  });

  const getTopPerformers = () => {
    return [...templates]
      .filter(t => t.usageCount >= 100)
      .sort((a, b) => {
        const aRate = a.avgAcceptanceRate || a.avgReplyRate || 0;
        const bRate = b.avgAcceptanceRate || b.avgReplyRate || 0;
        return bRate - aRate;
      })
      .slice(0, 3);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Template Library
          </h2>
          <p className="text-sm text-muted-foreground">
            Save, reuse, and share high-performing message templates
          </p>
        </div>
        <Button data-testid="btn-create-template">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <Card data-testid="card-top-performers">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            Top Performing Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {getTopPerformers().map((template, index) => (
              <div 
                key={template.id}
                className="p-4 border rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium text-sm truncate">{template.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {template.avgAcceptanceRate ? `${template.avgAcceptanceRate}% accept` : `${template.avgReplyRate}% reply`}
                  </span>
                  <span className="text-muted-foreground">{template.usageCount} uses</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search templates..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-templates"
          />
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="connection_note">Connection Notes</TabsTrigger>
          <TabsTrigger value="first_message">First Messages</TabsTrigger>
          <TabsTrigger value="follow_up">Follow-ups</TabsTrigger>
          <TabsTrigger value="inmail">InMails</TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} data-testid={`template-${template.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {getCategoryIcon(template.category)}
                        {template.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(template.category)}
                        </Badge>
                        {template.isPublic && (
                          <Badge variant="secondary" className="text-xs">System</Badge>
                        )}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" data-testid={`btn-copy-${template.id}`}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {template.content.length > 150 
                        ? template.content.substring(0, 150) + '...' 
                        : template.content
                      }
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {template.variables.slice(0, 3).map((variable) => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 3} more
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{template.usageCount.toLocaleString()} uses</span>
                        {template.avgAcceptanceRate && (
                          <span className="flex items-center gap-1 text-green-600">
                            <TrendingUp className="w-3 h-3" />
                            {template.avgAcceptanceRate}% accept
                          </span>
                        )}
                        {template.avgReplyRate && (
                          <span className="flex items-center gap-1 text-green-600">
                            <TrendingUp className="w-3 h-3" />
                            {template.avgReplyRate}% reply
                          </span>
                        )}
                      </div>
                      <Button size="sm" variant="outline" data-testid={`btn-use-${template.id}`}>
                        Use Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
