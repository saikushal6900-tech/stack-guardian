ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS assignee TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.finding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finding_events TO authenticated;
GRANT ALL ON public.finding_events TO service_role;

ALTER TABLE public.finding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own finding events select" ON public.finding_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own finding events insert" ON public.finding_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own finding events update" ON public.finding_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own finding events delete" ON public.finding_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS finding_events_finding_id_idx ON public.finding_events (finding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS finding_events_user_id_idx ON public.finding_events (user_id, created_at DESC);