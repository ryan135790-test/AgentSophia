-- ============================================
-- VISUAL WORKFLOW SYSTEM
-- ============================================
-- This migration adds comprehensive workflow/sequence builder functionality
-- with step-level tracking, contact management, and analytics

-- ============================================
-- WORKFLOWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  type TEXT NOT NULL DEFAULT 'multi-channel' CHECK (type IN ('email', 'linkedin', 'sms', 'multi-channel')),
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  ai_generated BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own workflows"
ON public.workflows
FOR ALL
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON public.workflows(type);

-- ============================================
-- WORKFLOW NODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('email', 'linkedin_connect', 'linkedin_message', 'sms', 'wait', 'condition', 'webhook')),
  label TEXT NOT NULL,
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  ai_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage nodes in their workflows"
ON public.workflow_nodes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_nodes.workflow_id
    AND workflows.user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_id ON public.workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_type ON public.workflow_nodes(node_type);

-- ============================================
-- WORKFLOW EDGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  condition JSONB,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_edges ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage edges in their workflows"
ON public.workflow_edges
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_edges.workflow_id
    AND workflows.user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow_id ON public.workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON public.workflow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON public.workflow_edges(target_node_id);

-- ============================================
-- WORKFLOW RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed')),
  current_node_id UUID REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their workflow runs"
ON public.workflow_runs
FOR ALL
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_contact_id ON public.workflow_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON public.workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_current_node ON public.workflow_runs(current_node_id);

-- ============================================
-- CONTACT WORKFLOW STEPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.contact_workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
  entered_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  edge_id UUID REFERENCES public.workflow_edges(id) ON DELETE SET NULL,
  condition_result JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workflow_run_id, node_id)
);

-- Enable RLS
ALTER TABLE public.contact_workflow_steps ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view workflow steps for their contacts"
ON public.contact_workflow_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workflow_runs
    WHERE workflow_runs.id = contact_workflow_steps.workflow_run_id
    AND workflow_runs.user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_workflow_steps_run_id ON public.contact_workflow_steps(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_contact_workflow_steps_node_id ON public.contact_workflow_steps(node_id);
CREATE INDEX IF NOT EXISTS idx_contact_workflow_steps_contact_id ON public.contact_workflow_steps(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_workflow_steps_status ON public.contact_workflow_steps(status);

-- Composite index for finding contacts at specific steps
CREATE INDEX IF NOT EXISTS idx_contact_steps_node_status ON public.contact_workflow_steps(node_id, status);

-- ============================================
-- WORKFLOW ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('entered', 'completed', 'skipped', 'failed', 'opened', 'clicked', 'replied')),
  count INTEGER DEFAULT 1,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view analytics for their workflows"
ON public.workflow_analytics
FOR ALL
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_workflow_id ON public.workflow_analytics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_node_id ON public.workflow_analytics(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_date ON public.workflow_analytics(date);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_metric_type ON public.workflow_analytics(metric_type);

-- Composite index for time-series queries
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_node_date ON public.workflow_analytics(node_id, date);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get contacts at a specific workflow step
CREATE OR REPLACE FUNCTION public.get_contacts_at_step(
  p_node_id UUID,
  p_status TEXT DEFAULT 'in_progress'
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  contact_email TEXT,
  step_status TEXT,
  entered_at TIMESTAMP WITH TIME ZONE,
  workflow_run_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    c.id AS contact_id,
    CONCAT(c.first_name, ' ', c.last_name) AS contact_name,
    c.email AS contact_email,
    cws.status AS step_status,
    cws.entered_at,
    cws.workflow_run_id
  FROM public.contact_workflow_steps cws
  JOIN public.contacts c ON c.id = cws.contact_id
  WHERE cws.node_id = p_node_id
    AND (p_status IS NULL OR cws.status = p_status)
    AND EXISTS (
      SELECT 1 FROM public.workflow_runs wr
      WHERE wr.id = cws.workflow_run_id
      AND wr.user_id = auth.uid()
    )
  ORDER BY cws.entered_at DESC;
$$;

-- Function to move contact to different workflow step
CREATE OR REPLACE FUNCTION public.move_contact_to_step(
  p_contact_id UUID,
  p_workflow_run_id UUID,
  p_target_node_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_step_id UUID;
BEGIN
  -- Verify user owns this workflow run
  IF NOT EXISTS (
    SELECT 1 FROM public.workflow_runs
    WHERE id = p_workflow_run_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized or workflow run not found';
  END IF;

  -- Complete current step
  UPDATE public.contact_workflow_steps
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE workflow_run_id = p_workflow_run_id
    AND contact_id = p_contact_id
    AND status = 'in_progress';

  -- Create or update new step
  INSERT INTO public.contact_workflow_steps (
    workflow_run_id,
    node_id,
    contact_id,
    status,
    entered_at,
    created_at,
    updated_at
  )
  VALUES (
    p_workflow_run_id,
    p_target_node_id,
    p_contact_id,
    'in_progress',
    now(),
    now(),
    now()
  )
  ON CONFLICT (workflow_run_id, node_id, contact_id)
  DO UPDATE SET
    status = 'in_progress',
    entered_at = now(),
    updated_at = now();

  -- Update workflow run current node
  UPDATE public.workflow_runs
  SET current_node_id = p_target_node_id,
      updated_at = now()
  WHERE id = p_workflow_run_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- UPDATED AT TRIGGERS
-- ============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_nodes_updated_at BEFORE UPDATE ON public.workflow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_runs_updated_at BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_workflow_steps_updated_at BEFORE UPDATE ON public.contact_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON public.workflows TO authenticated;
GRANT ALL ON public.workflow_nodes TO authenticated;
GRANT ALL ON public.workflow_edges TO authenticated;
GRANT ALL ON public.workflow_runs TO authenticated;
GRANT ALL ON public.contact_workflow_steps TO authenticated;
GRANT ALL ON public.workflow_analytics TO authenticated;
