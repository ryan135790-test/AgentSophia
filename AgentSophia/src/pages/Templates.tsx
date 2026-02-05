import { useEffect, useState } from 'react';
import { FileText, Star, Eye, Copy, BarChart3, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponseTemplateForm } from '@/components/agent-sophia/response-template-form';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Template {
  id: string;
  name: string;
  category: string;
  channel: string;
  content: string;
  usage_count: number;
  conversion_rate: number;
  quality_score: number;
  industry_tags: string[];
  intent_tags: string[];
}

export default function Templates() {
  const { currentWorkspace } = useWorkspace();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!currentWorkspace?.id) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/workspaces/${currentWorkspace.id}/content-templates`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(Array.isArray(data) ? data : data.templates || []);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [currentWorkspace?.id]);

  const channels = [...new Set(templates.map((t) => t.channel))];

  const filteredTemplates = filterChannel
    ? templates.filter((t) => t.channel === filterChannel)
    : templates;

  const getChannelColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'email':
        return 'bg-blue-100 text-blue-700';
      case 'linkedin':
        return 'bg-blue-900 text-white';
      case 'sms':
        return 'bg-green-100 text-green-700';
      case 'phone':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading templates...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Content Templates Library</h1>
            <p className="text-slate-600 mt-2">{templates.length} professional templates ready to use</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
        
        <ResponseTemplateForm open={showForm} onOpenChange={setShowForm} onSubmit={() => setShowForm(false)} />

        {/* Channel Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterChannel(null)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                !filterChannel
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-testid="button-filter-all"
            >
              All Channels
            </button>
            {channels.map((channel) => (
              <button
                key={channel}
                onClick={() => setFilterChannel(channel)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filterChannel === channel
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                data-testid={`button-filter-${channel}`}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No templates found for this channel
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer p-6 ${
                  selectedTemplate === template.id ? 'ring-2 ring-blue-600' : ''
                }`}
                data-testid={`card-template-${template.id}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getChannelColor(template.channel)}`}>
                        {template.channel}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-slate-900">{template.quality_score}/100</span>
                    </div>
                    <p className="text-xs text-slate-600">Quality</p>
                  </div>
                </div>

                {/* Category & Tags */}
                <div className="mb-4">
                  <p className="text-xs text-slate-600 mb-2">{template.category}</p>
                  <div className="flex flex-wrap gap-1">
                    {(template.intent_tags || []).slice(0, 2).map((tag) => (
                      <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                    {(template.industry_tags || []).slice(0, 1).map((tag) => (
                      <span key={tag} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Content Preview */}
                <p className="text-sm text-slate-700 mb-4 line-clamp-3">{template.content}</p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600">Used</p>
                    <p className="font-semibold text-slate-900">{template.usage_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Conversion</p>
                    <p className="font-semibold text-slate-900">{template.conversion_rate.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2 transition"
                    data-testid={`button-copy-${template.id}`}
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium flex items-center justify-center gap-2 transition"
                    data-testid={`button-preview-${template.id}`}
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats Footer */}
        {selectedTemplate && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Performance Insights</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-600">Avg Quality Score</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(templates.reduce((sum, t) => sum + t.quality_score, 0) / templates.length).toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Uses</p>
                <p className="text-2xl font-bold text-slate-900">
                  {templates.reduce((sum, t) => sum + t.usage_count, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Avg Conversion</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(templates.reduce((sum, t) => sum + t.conversion_rate, 0) / templates.length).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Best Performer</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Math.max(...templates.map((t) => t.conversion_rate)).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
