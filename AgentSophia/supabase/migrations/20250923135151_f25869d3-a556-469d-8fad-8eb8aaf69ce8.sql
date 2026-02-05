-- Create workspaces table for LinkedIn accounts
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  linkedin_connection_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own workspaces" 
ON public.workspaces 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for timestamps
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key constraint to link workspaces with LinkedIn connections
ALTER TABLE public.workspaces 
ADD CONSTRAINT fk_workspace_linkedin_connection 
FOREIGN KEY (linkedin_connection_id) 
REFERENCES public.linkedin_connections(id) 
ON DELETE SET NULL;

-- Add workspace_id to existing tables to support multi-workspace functionality
ALTER TABLE public.contacts ADD COLUMN workspace_id UUID;
ALTER TABLE public.ai_configurations ADD COLUMN workspace_id UUID;
ALTER TABLE public.ai_chat_sessions ADD COLUMN workspace_id UUID;

-- Add foreign key constraints
ALTER TABLE public.contacts 
ADD CONSTRAINT fk_contact_workspace 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

ALTER TABLE public.ai_configurations 
ADD CONSTRAINT fk_ai_config_workspace 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

ALTER TABLE public.ai_chat_sessions 
ADD CONSTRAINT fk_ai_chat_workspace 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_workspaces_user_id ON public.workspaces(user_id);
CREATE INDEX idx_workspaces_linkedin_connection ON public.workspaces(linkedin_connection_id);
CREATE INDEX idx_contacts_workspace_id ON public.contacts(workspace_id);
CREATE INDEX idx_ai_configurations_workspace_id ON public.ai_configurations(workspace_id);
CREATE INDEX idx_ai_chat_sessions_workspace_id ON public.ai_chat_sessions(workspace_id);