CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  org_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled review',
  stack TEXT NOT NULL DEFAULT 'auto',
  repo TEXT,
  pr_ref TEXT,
  source_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  ai_generated_likelihood INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scans select" ON public.scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own scans insert" ON public.scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own scans update" ON public.scans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own scans delete" ON public.scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  location TEXT,
  description TEXT NOT NULL,
  ai_pattern TEXT,
  compliance JSONB NOT NULL DEFAULT '[]'::jsonb,
  fix_suggestion TEXT NOT NULL DEFAULT '',
  test_suggestion TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO authenticated;
GRANT ALL ON public.findings TO service_role;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own findings select" ON public.findings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own findings insert" ON public.findings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own findings update" ON public.findings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own findings delete" ON public.findings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX findings_scan_id_idx ON public.findings(scan_id);
CREATE INDEX scans_user_created_idx ON public.scans(user_id, created_at DESC);