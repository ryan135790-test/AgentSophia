-- ============================================
-- WORKFLOWS SCHEMA FOR SUPABASE
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  type TEXT NOT NULL DEFAULT 'multi-channel' CHECK (type IN ('email', 'linkedin', 'sms', 'multi-channel')),
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}',
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create workflow_nodes table
CREATE TABLE IF NOT EXISTS public.workflow_nodes (
  id TEXT PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('trigger', 'email', 'linkedin_connect', 'linkedin_message', 'sms', 'wait', 'condition', 'webhook', 'phone', 'whatsapp')),
  label TEXT NOT NULL,
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  ai_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create workflow_edges table
CREATE TABLE IF NOT EXISTS public.workflow_edges (
  id TEXT PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  condition JSONB,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create workflow_runs table
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed')),
  current_node_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workflows
CREATE POLICY "Users can view their own workflows"
  ON public.workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows"
  ON public.workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows"
  ON public.workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for workflow_nodes
CREATE POLICY "Users can view workflow nodes"
  ON public.workflow_nodes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_nodes.workflow_id
    AND workflows.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert workflow nodes"
  ON public.workflow_nodes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_nodes.workflow_id
    AND workflows.user_id = auth.uid()
  ));

CREATE POLICY "Users can update workflow nodes"
  ON public.workflow_nodes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_nodes.workflow_id
    AND workflows.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete workflow nodes"
  ON public.workflow_nodes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_nodes.workflow_id
    AND workflows.user_id = auth.uid()
  ));

-- Create RLS policies for workflow_edges
CREATE POLICY "Users can view workflow edges"
  ON public.workflow_edges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_edges.workflow_id
    AND workflows.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert workflow edges"
  ON public.workflow_edges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_edges.workflow_id
    AND workflows.user_id = auth.uid()
  ));

CREATE POLICY "Users can update workflow edges"
  ON public.workflow_edges FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_edges.workflow_id
    AND workflows.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete workflow edges"
  ON public.workflow_edges FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.workflows
    WHERE workflows.id = workflow_edges.workflow_id
    AND workflows.user_id = auth.uid()
  ));

-- Create RLS policies for workflow_runs
CREATE POLICY "Users can view their workflow runs"
  ON public.workflow_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their workflow runs"
  ON public.workflow_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their workflow runs"
  ON public.workflow_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their workflow runs"
  ON public.workflow_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_id ON public.workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow_id ON public.workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_contact_id ON public.workflow_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON public.workflow_runs(user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS handle_workflows_updated_at ON public.workflows;
CREATE TRIGGER handle_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_workflow_nodes_updated_at ON public.workflow_nodes;
CREATE TRIGGER handle_workflow_nodes_updated_at
  BEFORE UPDATE ON public.workflow_nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_workflow_runs_updated_at ON public.workflow_runs;
CREATE TRIGGER handle_workflow_runs_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
