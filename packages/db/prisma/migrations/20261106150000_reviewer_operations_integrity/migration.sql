-- Preserve the key-integrity checks when extending the scope allowlist.
ALTER TABLE public.api_integration_keys ADD CONSTRAINT api_integration_keys_secret_expiry_valid
 CHECK ("secretHash" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt");
ALTER TABLE public.reviewer_invitation_batches ADD CONSTRAINT reviewer_batch_credential_scope_fkey
 FOREIGN KEY ("keyId","integrationId","conferenceId","organizationId")
 REFERENCES public.api_integration_keys(id,"integrationId","conferenceId","organizationId") ON DELETE RESTRICT;
CREATE INDEX "reviewer_invitation_batches_keyId_idx" ON public.reviewer_invitation_batches("keyId");
