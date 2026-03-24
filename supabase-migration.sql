-- Run this on the new Supabase project (faetzkmowpfikxpzbmfk)
-- Either via Supabase MCP apply_migration or the SQL Editor in the dashboard

-- Saved calculator models
CREATE TABLE public.saved_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text UNIQUE NOT NULL,
  email text NOT NULL,
  model_state jsonb NOT NULL,
  tos_accepted boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Installer referral leads
CREATE TABLE public.installer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_model_id uuid REFERENCES public.saved_models(id),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  suburb text,
  region text,
  best_time_to_call text,
  model_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installer_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public calculator, no auth)
CREATE POLICY "Allow anonymous insert" ON public.saved_models
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow read by share_id" ON public.saved_models
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous lead insert" ON public.installer_leads
  FOR INSERT TO anon WITH CHECK (true);

-- Indexes
CREATE INDEX idx_saved_models_share_id ON public.saved_models(share_id);
CREATE INDEX idx_saved_models_email ON public.saved_models(email);
