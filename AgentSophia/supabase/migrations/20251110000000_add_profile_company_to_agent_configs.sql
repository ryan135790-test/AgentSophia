-- Add user profile and company information to agent_configs
-- This enables personalized email generation with real user details

-- Add user_profile JSONB column
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS user_profile JSONB DEFAULT '{}'::jsonb;

-- Add company_info JSONB column
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS company_info JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.agent_configs.user_profile IS 'User profile information: full_name, title, email, phone';
COMMENT ON COLUMN public.agent_configs.company_info IS 'Company information: company_name, industry, website, services_description, value_propositions';
