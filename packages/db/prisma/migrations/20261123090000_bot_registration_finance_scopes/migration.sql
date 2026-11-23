-- Allow read-only registration and revenue permissions for bot keys.
ALTER TABLE public.api_integrations DROP CONSTRAINT api_integrations_scopes_allowed;
ALTER TABLE public.api_integration_keys DROP CONSTRAINT api_integration_keys_scopes_allowed;
ALTER TABLE public.api_integrations ADD CONSTRAINT api_integrations_scopes_allowed CHECK (
 cardinality(scopes)>0 AND scopes <@ ARRAY['papers:read','authors:read','authors:contacts:read','reviewers:read','reviewers:identity:read','reviewers:contacts:read','assignments:read','assignments:write','invitations:read','invitations:write','invitations:responses:read','analytics:read','finance:read','registrations:read']::text[]);
ALTER TABLE public.api_integration_keys ADD CONSTRAINT api_integration_keys_scopes_allowed CHECK (
 cardinality(scopes)>0 AND scopes <@ ARRAY['papers:read','authors:read','authors:contacts:read','reviewers:read','reviewers:identity:read','reviewers:contacts:read','assignments:read','assignments:write','invitations:read','invitations:write','invitations:responses:read','analytics:read','finance:read','registrations:read']::text[]);
