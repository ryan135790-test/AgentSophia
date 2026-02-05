import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const contactTasks = new Map<string, any[]>();
const contactNotes = new Map<string, any[]>();
const contactActivities = new Map<string, any[]>();
const contactMeetings = new Map<string, any[]>();

const demoContacts: Record<string, any> = {
  'c1': { id: 'c1', first_name: 'Sarah', last_name: 'Chen', email: 'sarah@techcorp.com', phone: '+1-555-0101', company: 'TechCorp Inc', position: 'VP Sales', job_title: 'VP Sales', score: 85, stage: 'deal', status: 'active', tags: ['hot_lead', 'priority'], last_contacted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), linkedin_url: 'https://linkedin.com/in/sarahchen', workspace_id: 'demo', created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), is_favorite: false },
  'c2': { id: 'c2', first_name: 'Michael', last_name: 'Rodriguez', email: 'michael@innovate.io', phone: '+1-555-0102', company: 'Innovate.io', position: 'Sales Director', job_title: 'Sales Director', score: 72, stage: 'proposal', status: 'active', tags: ['warm_lead', 'email_engaged'], last_contacted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), linkedin_url: 'https://linkedin.com/in/michaelrodriguez', workspace_id: 'demo', created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), is_favorite: false },
  'c3': { id: 'c3', first_name: 'Emily', last_name: 'Johnson', email: 'emily@growth.co', phone: '+1-555-0103', company: 'Growth Co', position: 'Marketing Manager', job_title: 'Marketing Manager', score: 65, stage: 'qualified', status: 'active', tags: ['warm_lead', 'opened_email'], last_contacted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), linkedin_url: 'https://linkedin.com/in/emilyjohnson', workspace_id: 'demo', created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), is_favorite: false },
  'c4': { id: 'c4', first_name: 'James', last_name: 'Wilson', email: 'james@enterprise.com', phone: '+1-555-0104', company: 'Enterprise Solutions', position: 'CTO', job_title: 'CTO', score: 78, stage: 'proposal', status: 'active', tags: ['hot_lead', 'high_engagement'], last_contacted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), linkedin_url: 'https://linkedin.com/in/jameswilson', workspace_id: 'demo', created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), is_favorite: true },
  'c5': { id: 'c5', first_name: 'Lisa', last_name: 'Anderson', email: 'lisa@startups.ai', phone: '+1-555-0105', company: 'StartupAI', position: 'Founder', job_title: 'Founder & CEO', score: 45, stage: 'lead', status: 'active', tags: ['warm_lead', 'viewed_content'], last_contacted: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), linkedin_url: 'https://linkedin.com/in/lisaanderson', workspace_id: 'demo', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), is_favorite: false },
  'c6': { id: 'c6', first_name: 'David', last_name: 'Thompson', email: 'david@retailpro.com', phone: '+1-555-0106', company: 'RetailPro', position: 'Operations Head', job_title: 'Head of Operations', score: 32, stage: 'lead', status: 'active', tags: ['cold_lead'], last_contacted: null, linkedin_url: null, workspace_id: 'demo', created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), is_favorite: false }
};

const isDemoContact = (id: string) => id.startsWith('c') && id.length <= 3;

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isDemoContact(id) && demoContacts[id]) {
      return res.json(demoContacts[id]);
    }
    
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (isDemoContact(id) && demoContacts[id]) {
      demoContacts[id] = { ...demoContacts[id], ...updates, updated_at: new Date().toISOString() };
      return res.json(demoContacts[id]);
    }
    
    const { data, error } = await supabase
      .from('contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: 'Failed to update contact' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.get('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = contactTasks.get(id) || [];
    res.json({ tasks: tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const task = {
      id: `task_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      ...req.body,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null
    };
    
    const tasks = contactTasks.get(id) || [];
    tasks.push(task);
    contactTasks.set(id, tasks);
    
    const activities = contactActivities.get(id) || [];
    activities.unshift({
      id: `act_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      activity_type: 'task_completed',
      title: `Task created: ${task.title}`,
      description: task.description || null,
      metadata: { task_id: task.id, priority: task.priority },
      workspace_id: null,
      created_at: new Date().toISOString()
    });
    contactActivities.set(id, activities);
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.post('/:id/tasks/:taskId/complete', async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const tasks = contactTasks.get(id) || [];
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    contactTasks.set(id, tasks);
    
    const activities = contactActivities.get(id) || [];
    activities.unshift({
      id: `act_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      activity_type: 'task_completed',
      title: `Task completed: ${tasks[taskIndex].title}`,
      description: null,
      metadata: { task_id: taskId },
      workspace_id: null,
      created_at: new Date().toISOString()
    });
    contactActivities.set(id, activities);
    
    res.json(tasks[taskIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

router.get('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const notes = contactNotes.get(id) || [];
    res.json({ notes: notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const note = {
      id: `note_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      ...req.body,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const notes = contactNotes.get(id) || [];
    notes.push(note);
    contactNotes.set(id, notes);
    
    const activities = contactActivities.get(id) || [];
    activities.unshift({
      id: `act_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      activity_type: 'note_added',
      title: 'Note added',
      description: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
      metadata: { note_id: note.id, note_type: note.note_type },
      workspace_id: null,
      created_at: new Date().toISOString()
    });
    contactActivities.set(id, activities);
    
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.get('/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    let activities = contactActivities.get(id) || [];
    
    if (activities.length === 0 && isDemoContact(id)) {
      const contact = demoContacts[id];
      const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Contact';
      const defaultActivities = [
        {
          id: `act_${id}_1`,
          contact_id: id,
          user_id: 'demo-user',
          activity_type: 'email_sent',
          title: 'Email sent',
          description: `Sent initial outreach email to ${contactName}`,
          metadata: { channel: 'email' },
          workspace_id: null,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `act_${id}_2`,
          contact_id: id,
          user_id: 'demo-user',
          activity_type: 'email_opened',
          title: 'Email opened',
          description: `${contactName} opened the outreach email`,
          metadata: { channel: 'email' },
          workspace_id: null,
          created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `act_${id}_3`,
          contact_id: id,
          user_id: 'demo-user',
          activity_type: 'linkedin_connection',
          title: 'LinkedIn connection sent',
          description: 'Connection request sent via LinkedIn',
          metadata: { channel: 'linkedin' },
          workspace_id: null,
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `act_${id}_4`,
          contact_id: id,
          user_id: 'demo-user',
          activity_type: 'stage_changed',
          title: 'Stage updated',
          description: `Contact moved to ${contact?.stage || 'lead'} stage`,
          metadata: {},
          workspace_id: null,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `act_${id}_0`,
          contact_id: id,
          user_id: 'demo-user',
          activity_type: 'other',
          title: 'Contact created',
          description: 'Contact was added to the CRM',
          metadata: {},
          workspace_id: null,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      contactActivities.set(id, defaultActivities);
      activities = defaultActivities;
    }
    
    res.json({ activities: activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.get('/:id/meetings', async (req, res) => {
  try {
    const { id } = req.params;
    const meetings = contactMeetings.get(id) || [];
    res.json({ meetings: meetings.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

router.post('/:id/meetings', async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = {
      id: `meeting_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      ...req.body,
      status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const meetings = contactMeetings.get(id) || [];
    meetings.push(meeting);
    contactMeetings.set(id, meetings);
    
    const activities = contactActivities.get(id) || [];
    activities.unshift({
      id: `act_${Date.now()}`,
      contact_id: id,
      user_id: 'demo-user',
      activity_type: 'meeting',
      title: `Meeting scheduled: ${meeting.title}`,
      description: `${meeting.meeting_type} meeting on ${new Date(meeting.start_time).toLocaleDateString()}`,
      metadata: { meeting_id: meeting.id, meeting_type: meeting.meeting_type },
      workspace_id: null,
      created_at: new Date().toISOString()
    });
    contactActivities.set(id, activities);
    
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

router.get('/:id/deals', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('contact_id', id);
    
    if (error) {
      return res.json({ deals: [] });
    }
    res.json({ deals: data || [] });
  } catch (error) {
    res.json({ deals: [] });
  }
});

export default router;