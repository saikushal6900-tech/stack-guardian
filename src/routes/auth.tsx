import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search['redirect'] === "string" ? (search['redirect'] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Sign in · SentinelPR" },
      {
        name: "description",
        content: "Sign in to SentinelPR to review pull requests for security and DPDP/RBI compliance.",
      },
      { property: "og:title", content: "Sign in · SentinelPR" },
      {
        property: "og:description",
        content: "Sign in to SentinelPR to review pull requests for security and DPDP/RBI compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  const target = safePath(redirect || "/dashboard");

  useEffect(() => {
    if (session) navigate({ to: target, replace: true });
  }, [session, target, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + target,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentConfirmation(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try email instead.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: target, replace: true });
  }

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <span className="font-mono text-sm font-semibold">SentinelPR</span>
        </Link>

        <div className="panel p-6">
          {sentConfirmation ? (
            <div className="space-y-3 text-center">
              <h1 className="text-lg font-semibold">Check your inbox</h1>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to {email}. Open it to activate your account.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold">
                {mode === "signin" ? "Sign in" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Secure your pull requests in minutes.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="mono-label">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
                Continue with Google
              </Button>

              <button
                type="button"
                className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "No account yet? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
