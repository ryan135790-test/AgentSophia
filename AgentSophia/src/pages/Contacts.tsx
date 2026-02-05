import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Filter, Download, Mail, Linkedin, Plus, X, Flame, Zap, Snowflake, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SophiaInsightsPanel } from '@/components/agent-sophia/sophia-insights-panel';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  title: string;
  lead_score: number;
  segment: string;
  last_contacted: string;
}

type SortField = 'name' | 'company' | 'title' | 'lead_score' | 'last_contacted';
type SortDirection = 'asc' | 'desc';

export default function Contacts() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSegment, setFilterSegment] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('lead_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', title: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sophiaInsights, setSophiaInsights] = useState<any[]>([]);
  const [hotnessSummary, setHotnessSummary] = useState<any>(null);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchContacts = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      if (isDemo) {
        setContacts([
          { id: '1', name: 'Sarah Chen', company: 'TechCorp', email: 'sarah@techcorp.com', title: 'VP Sales', lead_score: 85, segment: 'hot', last_contacted: '2 hours ago' },
          { id: '2', name: 'John Miller', company: 'GrowthCo', email: 'john@growthco.com', title: 'CEO', lead_score: 62, segment: 'warm', last_contacted: '1 day ago' },
          { id: '3', name: 'Emily Watson', company: 'StartupHub', email: 'emily@startuphub.com', title: 'Director', lead_score: 28, segment: 'cold', last_contacted: '1 week ago' }
        ]);
        setSophiaInsights([
          { type: 'opportunity', title: 'High-value prospects to prioritize', description: '8 contacts have C-suite titles in target industries', impact: '+$420k pipeline' },
          { type: 'recommendation', title: 'Segment by buying stage', description: 'Group contacts by decision-making readiness for better personalization', action: 'View all contacts', impact: '+35% response rate' }
        ]);
        setHotnessSummary({
          hot: { count: 12, percentage: 25, total_potential_value: 480000 },
          warm: { count: 20, percentage: 42, total_potential_value: 400000 },
          cold: { count: 16, percentage: 33, total_potential_value: 160000 }
        });
        setLoading(false);
        return;
      }

      try {
        const [contactsRes, insightsRes, summaryRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/contacts`),
          fetch(`/api/workspaces/${workspaceId}/sophia/insights/contacts`).catch(() => null),
          fetch(`/api/workspaces/${workspaceId}/sophia/contacts/hotness-summary`).catch(() => null)
        ]);
        
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          const rawContacts = Array.isArray(data) ? data : data.contacts || [];
          // Transform API response to match expected interface
          const transformedContacts = rawContacts.map((c: any) => ({
            id: c.id,
            name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
            company: c.company || '',
            email: c.email || '',
            title: c.title || c.job_title || '',
            lead_score: c.lead_score ?? c.score ?? 0,
            segment: c.segment || c.status || 'cold',
            last_contacted: c.last_contacted || c.last_activity || c.updated_at || ''
          }));
          setContacts(transformedContacts);
        } else {
          setContacts([]);
        }
        if (insightsRes?.ok) {
          setSophiaInsights(await insightsRes.json());
        } else {
          setSophiaInsights([]);
        }
        if (summaryRes?.ok) {
          const summaryData = await summaryRes.json();
          if (summaryData && (summaryData.hot?.count > 0 || summaryData.warm?.count > 0 || summaryData.cold?.count > 0)) {
            setHotnessSummary(summaryData);
          } else {
            setHotnessSummary(null);
          }
        } else {
          setHotnessSummary(null);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [workspaceId, isDemo]);

  const segments = ['hot', 'warm', 'cold'];

  const getScoreBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-red-100 text-red-700 border-red-200';
    if (score >= 30) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const getSegmentLabel = (score: number) => {
    if (score >= 70) return 'Hot';
    if (score >= 30) return 'Warm';
    return 'Cold';
  };

  const handleAddLead = async () => {
    if (!formData.name || !formData.email) {
      alert('Name and email are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const newContact = await res.json();
        setContacts([...contacts, newContact]);
        setFormData({ name: '', email: '', company: '', title: '' });
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('Error adding lead:', error);
      alert('Failed to add lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const filteredContacts = contacts
    .filter((contact) => {
      if (!contact) return false;
      const matchesSearch =
        contact?.name?.toLowerCase?.().includes(searchTerm.toLowerCase()) ||
        contact?.company?.toLowerCase?.().includes(searchTerm.toLowerCase()) ||
        contact?.email?.toLowerCase?.().includes(searchTerm.toLowerCase());

      const matchesSegment = !filterSegment || getSegmentLabel(contact?.lead_score || 0).toLowerCase() === filterSegment;

      return matchesSearch && matchesSegment;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'company':
          aVal = a.company?.toLowerCase() || '';
          bVal = b.company?.toLowerCase() || '';
          break;
        case 'title':
          aVal = a.title?.toLowerCase() || '';
          bVal = b.title?.toLowerCase() || '';
          break;
        case 'lead_score':
          aVal = a.lead_score || 0;
          bVal = b.lead_score || 0;
          break;
        case 'last_contacted':
          aVal = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
          bVal = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) return <div className="p-8 text-center">Loading contacts...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900">Contact Management</h1>
              <p className="text-slate-600 mt-2">{contacts.length} total contacts</p>
            </div>

        {/* Lead Hotness Summary */}
        {hotnessSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-red-600" />
                  Hot Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{hotnessSummary.hot.count}</p>
                <p className="text-xs text-slate-500 mt-1">{hotnessSummary.hot.percentage}% of total</p>
                <p className="text-sm font-semibold text-slate-700 mt-2">${hotnessSummary.hot.total_potential_value.toLocaleString()}</p>
                <p className="text-xs text-slate-500">potential value</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-orange-600" />
                  Warm Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">{hotnessSummary.warm.count}</p>
                <p className="text-xs text-slate-500 mt-1">{hotnessSummary.warm.percentage}% of total</p>
                <p className="text-sm font-semibold text-slate-700 mt-2">${hotnessSummary.warm.total_potential_value.toLocaleString()}</p>
                <p className="text-xs text-slate-500">potential value</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Snowflake className="h-5 w-5 text-slate-600" />
                  Cold Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-600">{hotnessSummary.cold.count}</p>
                <p className="text-xs text-slate-500 mt-1">{hotnessSummary.cold.percentage}% of total</p>
                <p className="text-sm font-semibold text-slate-700 mt-2">${hotnessSummary.cold.total_potential_value.toLocaleString()}</p>
                <p className="text-xs text-slate-500">potential value</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, company, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                data-testid="input-search-contacts"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <select
                  value={filterSegment || ''}
                  onChange={(e) => setFilterSegment(e.target.value || null)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  data-testid="select-segment-filter"
                >
                  <option value="">All Segments</option>
                  {segments.map((seg) => (
                    <option key={seg} value={seg}>
                      {seg.charAt(0).toUpperCase() + seg.slice(1)} Leads
                    </option>
                  ))}
                </select>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition"
                    data-testid="button-add-lead"
                  >
                    <Plus className="w-4 h-4" />
                    Add Lead
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                      <input
                        type="text"
                        placeholder="Lead name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        data-testid="input-lead-name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        data-testid="input-lead-email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Company</label>
                      <input
                        type="text"
                        placeholder="Company name"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        data-testid="input-lead-company"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Job Title</label>
                      <input
                        type="text"
                        placeholder="Job title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        data-testid="input-lead-title"
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={handleAddLead}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                        data-testid="button-submit-lead"
                      >
                        {isSubmitting ? 'Adding...' : 'Add Lead'}
                      </button>
                      <button
                        onClick={() => setIsDialogOpen(false)}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition"
                        data-testid="button-cancel-lead"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                data-testid="button-bulk-import"
              >
                <Download className="w-4 h-4" />
                Bulk Import
              </button>
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-contacts">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => handleSort('name')}
                    data-testid="sort-name"
                  >
                    <div className="flex items-center gap-1">
                      Contact
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => handleSort('company')}
                    data-testid="sort-company"
                  >
                    <div className="flex items-center gap-1">
                      Company
                      {getSortIcon('company')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => handleSort('title')}
                    data-testid="sort-title"
                  >
                    <div className="flex items-center gap-1">
                      Title
                      {getSortIcon('title')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-center text-xs font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => handleSort('lead_score')}
                    data-testid="sort-lead-score"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Lead Score
                      {getSortIcon('lead_score')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-900">Segment</th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => handleSort('last_contacted')}
                    data-testid="sort-last-contacted"
                  >
                    <div className="flex items-center gap-1">
                      Last Contacted
                      {getSortIcon('last_contacted')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr 
                      key={contact.id} 
                      className="hover:bg-slate-50 transition cursor-pointer" 
                      data-testid={`row-contact-${contact.id}`}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 hover:text-blue-600">{contact.name}</p>
                          <p className="text-sm text-slate-600">{contact.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-900">{contact.company}</td>
                      <td className="px-6 py-4 text-slate-900">{contact.title}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getScoreBadgeColor(contact.lead_score)}`}>
                          {contact.lead_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-slate-700">
                          {getSegmentLabel(contact.lead_score)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{contact.last_contacted}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1 hover:bg-green-100 rounded transition"
                            data-testid={`button-view-${contact.id}`}
                            title="View Contact"
                            onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${contact.id}`); }}
                          >
                            <Eye className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            className="p-1 hover:bg-blue-100 rounded transition"
                            data-testid={`button-email-${contact.id}`}
                            title="Send Email"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            className="p-1 hover:bg-blue-100 rounded transition"
                            data-testid={`button-linkedin-${contact.id}`}
                            title="View on LinkedIn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Linkedin className="w-4 h-4 text-blue-700" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Hot Leads</p>
            <p className="text-2xl font-bold text-red-600">
              {filteredContacts.filter((c) => c.lead_score >= 70).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Warm Leads</p>
            <p className="text-2xl font-bold text-amber-600">
              {filteredContacts.filter((c) => c.lead_score >= 30 && c.lead_score < 70).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Cold Leads</p>
            <p className="text-2xl font-bold text-blue-600">
              {filteredContacts.filter((c) => c.lead_score < 30).length}
            </p>
          </div>
        </div>
          </div>

          {/* Sophia Insights Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="sticky top-6">
              <SophiaInsightsPanel insights={sophiaInsights} context="contacts" isLoading={loading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
