import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, User, Mail, Phone, Building2, Briefcase, Linkedin, Twitter,
  Calendar, Clock, Plus, Edit2, Check, X, Star, StarOff, Tag, 
  MessageSquare, Video, PhoneCall, FileText, CheckCircle2, Circle,
  AlertCircle, Flame, Zap, Snowflake, MoreHorizontal, Trash2, Send,
  Activity, ClipboardList, StickyNote, Users, DollarSign, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import type { Contact, ContactTask, ContactNote, ContactActivity, ContactMeeting } from '../../shared/schema';

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>({});
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'medium', task_type: 'other' });
  const [newNote, setNewNote] = useState({ content: '', note_type: 'general' });
  const [newMeeting, setNewMeeting] = useState({ title: '', description: '', start_time: '', end_time: '', meeting_type: 'video', location: '' });

  const { data: contact, isLoading: contactLoading, error: contactError, refetch: refetchContact } = useQuery<Contact>({
    queryKey: ['/api/contacts', id],
    queryFn: async () => {
      console.log('[ContactDetail] Fetching contact:', id);
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[ContactDetail] Session:', session ? 'present' : 'missing');
      const res = await fetch(`/api/contacts/${id}`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      console.log('[ContactDetail] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ContactDetail] Error:', errorText);
        throw new Error('Contact not found');
      }
      const data = await res.json();
      console.log('[ContactDetail] Contact data:', data);
      return data;
    },
    enabled: !!id,
  });

  const { data: tasks = [], refetch: refetchTasks } = useQuery<ContactTask[]>({
    queryKey: ['/api/contacts', id, 'tasks'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/tasks`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.tasks || [];
    },
    enabled: !!id,
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery<ContactNote[]>({
    queryKey: ['/api/contacts', id, 'notes'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/notes`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.notes || [];
    },
    enabled: !!id,
  });

  const { data: activities = [], refetch: refetchActivities } = useQuery<ContactActivity[]>({
    queryKey: ['/api/contacts', id, 'activities'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/activities`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.activities || [];
    },
    enabled: !!id,
  });

  const { data: meetings = [], refetch: refetchMeetings } = useQuery<ContactMeeting[]>({
    queryKey: ['/api/contacts', id, 'meetings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/meetings`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.meetings || [];
    },
    enabled: !!id,
  });

  const { data: deals = [] } = useQuery<any[]>({
    queryKey: ['/api/contacts', id, 'deals'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/deals`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.deals || [];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (contact) {
      setEditData(contact);
    }
  }, [contact]);

  const updateContactMutation = useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update contact');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Contact updated successfully' });
      setIsEditing(false);
      refetchContact();
    },
    onError: () => {
      toast({ title: 'Failed to update contact', variant: 'destructive' });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ ...data, contact_id: id })
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Task created successfully' });
      setNewTaskOpen(false);
      setNewTask({ title: '', description: '', due_date: '', priority: 'medium', task_type: 'other' });
      refetchTasks();
      refetchActivities();
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: typeof newNote) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ ...data, contact_id: id })
      });
      if (!res.ok) throw new Error('Failed to create note');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Note added successfully' });
      setNewNoteOpen(false);
      setNewNote({ content: '', note_type: 'general' });
      refetchNotes();
      refetchActivities();
    }
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: typeof newMeeting) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ ...data, contact_id: id })
      });
      if (!res.ok) throw new Error('Failed to schedule meeting');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Meeting scheduled successfully' });
      setNewMeetingOpen(false);
      setNewMeeting({ title: '', description: '', start_time: '', end_time: '', meeting_type: 'video', location: '' });
      refetchMeetings();
      refetchActivities();
    }
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/contacts/${id}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to complete task');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Task completed' });
      refetchTasks();
      refetchActivities();
    }
  });

  const getScoreBadge = (score: number | null) => {
    if (!score) return { color: 'bg-slate-100 text-slate-600', label: 'Not Scored', icon: Circle };
    if (score >= 70) return { color: 'bg-red-100 text-red-700', label: 'Hot', icon: Flame };
    if (score >= 30) return { color: 'bg-amber-100 text-amber-700', label: 'Warm', icon: Zap };
    return { color: 'bg-blue-100 text-blue-700', label: 'Cold', icon: Snowflake };
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return colors[priority] || 'bg-slate-100 text-slate-600';
  };

  const getTaskTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      call: PhoneCall,
      email: Mail,
      meeting: Video,
      follow_up: MessageSquare,
      other: FileText
    };
    return icons[type] || FileText;
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, any> = {
      email_sent: Send,
      email_opened: Mail,
      email_replied: MessageSquare,
      call: PhoneCall,
      meeting: Video,
      linkedin_message: Linkedin,
      linkedin_connection: Users,
      note_added: StickyNote,
      task_completed: CheckCircle2,
      deal_created: DollarSign,
      deal_updated: DollarSign,
      stage_changed: Activity,
      other: Circle
    };
    return icons[type] || Circle;
  };

  if (contactLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Contact not found</h2>
          <Button onClick={() => navigate('/contacts')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contacts
          </Button>
        </div>
      </div>
    );
  }

  const scoreBadge = getScoreBadge(contact.score);
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed Contact';
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/contacts')} className="mb-4" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contacts
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {contactName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-xl" data-testid="text-contact-name">{contactName}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge className={`${scoreBadge.color} text-xs`}>
                        <scoreBadge.icon className="h-3 w-3 mr-1" />
                        {scoreBadge.label}
                      </Badge>
                      {contact.score && <span className="text-sm text-slate-500">Score: {contact.score}</span>}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} data-testid="button-edit-contact">
                  {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="First Name"
                      value={editData.first_name || ''}
                      onChange={e => setEditData({ ...editData, first_name: e.target.value })}
                      data-testid="input-first-name"
                    />
                    <Input
                      placeholder="Last Name"
                      value={editData.last_name || ''}
                      onChange={e => setEditData({ ...editData, last_name: e.target.value })}
                      data-testid="input-last-name"
                    />
                  </div>
                  <Input
                    placeholder="Email"
                    value={editData.email || ''}
                    onChange={e => setEditData({ ...editData, email: e.target.value })}
                    data-testid="input-email"
                  />
                  <Input
                    placeholder="Phone"
                    value={editData.phone || ''}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                  <Input
                    placeholder="Company"
                    value={editData.company || ''}
                    onChange={e => setEditData({ ...editData, company: e.target.value })}
                    data-testid="input-company"
                  />
                  <Input
                    placeholder="Job Title"
                    value={editData.job_title || ''}
                    onChange={e => setEditData({ ...editData, job_title: e.target.value })}
                    data-testid="input-job-title"
                  />
                  <Input
                    placeholder="LinkedIn URL"
                    value={editData.linkedin_url || ''}
                    onChange={e => setEditData({ ...editData, linkedin_url: e.target.value })}
                    data-testid="input-linkedin"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => updateContactMutation.mutate(editData)}
                      disabled={updateContactMutation.isPending}
                      data-testid="button-save-contact"
                    >
                      <Check className="h-4 w-4 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditData(contact); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700" data-testid="text-email">{contact.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700" data-testid="text-phone">{contact.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700" data-testid="text-company">{contact.company || 'No company'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700" data-testid="text-job-title">{contact.job_title || contact.position || 'No title'}</span>
                  </div>
                  {contact.linkedin_url && (
                    <div className="flex items-center gap-3 text-sm">
                      <Linkedin className="h-4 w-4 text-blue-600" />
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Last contacted:</span>
                  <span className="text-slate-700">
                    {contact.last_contacted ? formatDistanceToNow(parseISO(contact.last_contacted), { addSuffix: true }) : 'Never'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Created:</span>
                  <span className="text-slate-700">{format(parseISO(contact.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>

              {contact.tags && contact.tags.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-blue-600">{pendingTasks.length}</p>
                    <p className="text-xs text-slate-500">Tasks</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-purple-600">{upcomingMeetings.length}</p>
                    <p className="text-xs text-slate-500">Meetings</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-600">{deals.length}</p>
                    <p className="text-xs text-slate-500">Deals</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <Tabs defaultValue="activity" className="w-full">
              <CardHeader className="pb-2">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="activity" className="text-xs" data-testid="tab-activity">
                    <History className="h-3 w-3 mr-1" /> Activity
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs" data-testid="tab-tasks">
                    <ClipboardList className="h-3 w-3 mr-1" /> Tasks
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs" data-testid="tab-notes">
                    <StickyNote className="h-3 w-3 mr-1" /> Notes
                  </TabsTrigger>
                  <TabsTrigger value="meetings" className="text-xs" data-testid="tab-meetings">
                    <Video className="h-3 w-3 mr-1" /> Meetings
                  </TabsTrigger>
                  <TabsTrigger value="deals" className="text-xs" data-testid="tab-deals">
                    <DollarSign className="h-3 w-3 mr-1" /> Deals
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-4">
                <TabsContent value="activity" className="mt-0">
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {activities.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No activity yet</p>
                    ) : (
                      activities.map((activity) => {
                        const ActivityIcon = getActivityIcon(activity.activity_type);
                        return (
                          <div key={activity.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg" data-testid={`activity-${activity.id}`}>
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <ActivityIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                              {activity.description && <p className="text-xs text-slate-500 mt-0.5">{activity.description}</p>}
                              <p className="text-xs text-slate-400 mt-1">
                                {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="mt-0">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Tasks & Reminders</h3>
                    <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-task">
                          <Plus className="h-4 w-4 mr-1" /> Add Task
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Task</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <Input
                            placeholder="Task title"
                            value={newTask.title}
                            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                            data-testid="input-task-title"
                          />
                          <Textarea
                            placeholder="Description (optional)"
                            value={newTask.description}
                            onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                            data-testid="input-task-description"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm text-slate-500 mb-1 block">Due Date</label>
                              <Input
                                type="datetime-local"
                                value={newTask.due_date}
                                onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                                data-testid="input-task-due-date"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-slate-500 mb-1 block">Priority</label>
                              <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                                <SelectTrigger data-testid="select-task-priority">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-slate-500 mb-1 block">Task Type</label>
                            <Select value={newTask.task_type} onValueChange={v => setNewTask({ ...newTask, task_type: v })}>
                              <SelectTrigger data-testid="select-task-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call">Call</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="meeting">Meeting</SelectItem>
                                <SelectItem value="follow_up">Follow-up</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            onClick={() => createTaskMutation.mutate(newTask)}
                            disabled={!newTask.title || createTaskMutation.isPending}
                            className="w-full"
                            data-testid="button-create-task"
                          >
                            Create Task
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {tasks.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No tasks yet</p>
                    ) : (
                      tasks.map((task) => {
                        const TaskIcon = getTaskTypeIcon(task.task_type);
                        const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'completed';
                        return (
                          <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border ${task.status === 'completed' ? 'bg-slate-50 opacity-60' : 'bg-white'}`} data-testid={`task-${task.id}`}>
                            <button
                              onClick={() => task.status !== 'completed' && completeTaskMutation.mutate(task.id)}
                              className={`mt-0.5 ${task.status === 'completed' ? 'text-green-600' : 'text-slate-400 hover:text-green-600'}`}
                              data-testid={`button-complete-task-${task.id}`}
                            >
                              {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <TaskIcon className="h-4 w-4 text-slate-400" />
                                <span className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                  {task.title}
                                </span>
                                <Badge className={`text-xs ${getPriorityBadge(task.priority)}`}>{task.priority}</Badge>
                              </div>
                              {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                              {task.due_date && (
                                <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                                  {isOverdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                                  Due: {format(parseISO(task.due_date), 'MMM d, yyyy h:mm a')}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Notes</h3>
                    <Dialog open={newNoteOpen} onOpenChange={setNewNoteOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-note">
                          <Plus className="h-4 w-4 mr-1" /> Add Note
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Note</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <Textarea
                            placeholder="Write your note here..."
                            value={newNote.content}
                            onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                            rows={5}
                            data-testid="input-note-content"
                          />
                          <Select value={newNote.note_type} onValueChange={v => setNewNote({ ...newNote, note_type: v })}>
                            <SelectTrigger data-testid="select-note-type">
                              <SelectValue placeholder="Note type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="call">Call Notes</SelectItem>
                              <SelectItem value="meeting">Meeting Notes</SelectItem>
                              <SelectItem value="email">Email Notes</SelectItem>
                              <SelectItem value="important">Important</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            onClick={() => createNoteMutation.mutate(newNote)}
                            disabled={!newNote.content || createNoteMutation.isPending}
                            className="w-full"
                            data-testid="button-create-note"
                          >
                            Save Note
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {notes.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No notes yet</p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="p-4 bg-white rounded-lg border" data-testid={`note-${note.id}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs capitalize">{note.note_type}</Badge>
                            <span className="text-xs text-slate-400">
                              {formatDistanceToNow(parseISO(note.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="meetings" className="mt-0">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Meetings</h3>
                    <Dialog open={newMeetingOpen} onOpenChange={setNewMeetingOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-meeting">
                          <Plus className="h-4 w-4 mr-1" /> Schedule Meeting
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Schedule Meeting</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <Input
                            placeholder="Meeting title"
                            value={newMeeting.title}
                            onChange={e => setNewMeeting({ ...newMeeting, title: e.target.value })}
                            data-testid="input-meeting-title"
                          />
                          <Textarea
                            placeholder="Description (optional)"
                            value={newMeeting.description}
                            onChange={e => setNewMeeting({ ...newMeeting, description: e.target.value })}
                            data-testid="input-meeting-description"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm text-slate-500 mb-1 block">Start Time</label>
                              <Input
                                type="datetime-local"
                                value={newMeeting.start_time}
                                onChange={e => setNewMeeting({ ...newMeeting, start_time: e.target.value })}
                                data-testid="input-meeting-start"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-slate-500 mb-1 block">End Time</label>
                              <Input
                                type="datetime-local"
                                value={newMeeting.end_time}
                                onChange={e => setNewMeeting({ ...newMeeting, end_time: e.target.value })}
                                data-testid="input-meeting-end"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm text-slate-500 mb-1 block">Type</label>
                              <Select value={newMeeting.meeting_type} onValueChange={v => setNewMeeting({ ...newMeeting, meeting_type: v })}>
                                <SelectTrigger data-testid="select-meeting-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="call">Phone Call</SelectItem>
                                  <SelectItem value="video">Video Call</SelectItem>
                                  <SelectItem value="in_person">In Person</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm text-slate-500 mb-1 block">Location/Link</label>
                              <Input
                                placeholder="Zoom link, address, etc."
                                value={newMeeting.location}
                                onChange={e => setNewMeeting({ ...newMeeting, location: e.target.value })}
                                data-testid="input-meeting-location"
                              />
                            </div>
                          </div>
                          <Button 
                            onClick={() => createMeetingMutation.mutate(newMeeting)}
                            disabled={!newMeeting.title || !newMeeting.start_time || !newMeeting.end_time || createMeetingMutation.isPending}
                            className="w-full"
                            data-testid="button-create-meeting"
                          >
                            Schedule Meeting
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {meetings.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No meetings scheduled</p>
                    ) : (
                      meetings.map((meeting) => {
                        const isPastMeeting = isPast(parseISO(meeting.end_time));
                        return (
                          <div key={meeting.id} className={`p-4 rounded-lg border ${isPastMeeting ? 'bg-slate-50 opacity-60' : 'bg-white'}`} data-testid={`meeting-${meeting.id}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium text-slate-900">{meeting.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs capitalize">{meeting.meeting_type}</Badge>
                                  <Badge variant={meeting.status === 'scheduled' ? 'default' : 'secondary'} className="text-xs">{meeting.status}</Badge>
                                </div>
                              </div>
                              <div className="text-right text-sm">
                                <p className="font-medium text-slate-900">{format(parseISO(meeting.start_time), 'MMM d, yyyy')}</p>
                                <p className="text-slate-500">
                                  {format(parseISO(meeting.start_time), 'h:mm a')} - {format(parseISO(meeting.end_time), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                            {meeting.location && (
                              <p className="text-sm text-slate-500 mt-2">{meeting.location}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="deals" className="mt-0">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Associated Deals</h3>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {deals.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No deals associated with this contact</p>
                    ) : (
                      deals.map((deal) => (
                        <div key={deal.id} className="p-4 bg-white rounded-lg border" data-testid={`deal-${deal.id}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-slate-900">{deal.title}</h4>
                              <Badge variant="outline" className="text-xs mt-1">{deal.stage}</Badge>
                            </div>
                            <p className="text-lg font-bold text-green-600">${(deal.value || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}