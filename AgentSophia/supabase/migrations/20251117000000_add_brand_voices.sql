-- Add brand_voices and company_info columns to agent_configs table
-- This fixes the "column agent_configs.brand_voices does not exist" error

ALTER TABLE public.agent_configs 
ADD COLUMN IF NOT EXISTS brand_voices JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS company_info JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.agent_configs.brand_voices IS 'Array of brand voice configurations for multichannel campaigns';
COMMENT ON COLUMN public.agent_configs.company_info IS 'General company information for the agent';
