-- Add brand voices settings to agent_configs (supports multiple brand voices)
-- This enables Sophia to understand the user's brands and ask which one to use

ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS brand_voices JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.agent_configs.brand_voices IS 'Array of brand voice objects. Each has: id, name, companyName, tone, industry, values, writingStyle, avoidWords, keyMessages. Allows users to manage multiple brands and select which to use per campaign.';
