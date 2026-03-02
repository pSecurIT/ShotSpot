-- Allow storing multiple Twizzit credentials with the same organization name.
-- Previous behavior enforced uniqueness and caused inserts to overwrite existing credentials.
ALTER TABLE IF EXISTS public.twizzit_credentials
DROP CONSTRAINT IF EXISTS twizzit_credentials_organization_name_key;