-- ============================================
-- O365 CONTACT SYNC SUPPORT
-- ============================================

-- Add o365_contact_id to contacts table to track synced contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS o365_contact_id TEXT,
ADD COLUMN IF NOT EXISTS o365_synced_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_o365_contact_id 
ON public.contacts(o365_contact_id) 
WHERE o365_contact_id IS NOT NULL;

-- Add contact sync settings to agent_configs
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS sync_o365_contacts BOOLEAN NOT NULL DEFAULT TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.o365_contact_id IS 'Microsoft Graph Contact ID for O365 sync';
COMMENT ON COLUMN public.contacts.o365_synced_at IS 'Last time contact was synced to O365';
COMMENT ON COLUMN public.agent_configs.sync_o365_contacts IS 'Enable automatic O365 contact sync when processing emails';
