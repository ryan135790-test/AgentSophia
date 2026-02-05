-- Create campaigns table for marketing campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('email', 'linkedin', 'multi-channel')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  target_audience JSONB,
  settings JSONB NOT NULL DEFAULT '{}',
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for campaigns
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can view their own campaigns" 
  ON public.campaigns 
  FOR SELECT 
  USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can create their own campaigns" 
  ON public.campaigns 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can update their own campaigns" 
  ON public.campaigns 
  FOR UPDATE 
  USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can delete their own campaigns" 
  ON public.campaigns 
  FOR DELETE 
  USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
  CREATE POLICY "Admins can view all campaigns" 
  ON public.campaigns 
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
END $$;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
