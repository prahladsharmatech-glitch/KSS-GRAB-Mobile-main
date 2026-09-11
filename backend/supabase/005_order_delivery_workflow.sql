-- Durable rider delivery workflow and proof-of-delivery fields.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS workflow_step text,
  ADD COLUMN IF NOT EXISTS otp_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_photo_url text;

CREATE INDEX IF NOT EXISTS idx_orders_workflow_step
  ON public.orders(workflow_step);