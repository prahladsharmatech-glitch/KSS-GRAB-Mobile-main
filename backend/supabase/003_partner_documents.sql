-- ==============================================================================
-- GrabIt Partner Verification Documents Migration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text NOT NULL,
  document_type text NOT NULL, -- 'driving_license' | 'insurance' | 'puc' | 'background_check'
  document_url text,           -- Cloudinary or storage URL (null for background_check)
  fields jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING', -- 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
  rejection_reason text,
  submitted_at timestamptz DEFAULT now(),
  verified_by text,
  verified_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_documents_partner_doc_idx 
ON public.partner_documents(partner_id, document_type);

CREATE INDEX IF NOT EXISTS partner_documents_partner_id_idx 
ON public.partner_documents(partner_id);

CREATE INDEX IF NOT EXISTS partner_documents_status_idx 
ON public.partner_documents(status);
