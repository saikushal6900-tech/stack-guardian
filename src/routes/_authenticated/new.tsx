import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeScan } from "@/lib/scan.functions";
import { SAMPLE_DIFF, STACK_OPTIONS } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({
    meta: [
      { title: "New review · SentinelPR" },
      {
        name: "description",
        content: "Paste a pull request diff and get security findings mapped to DPDP and RBI rules.",
      },
      { property: "og:title", content: "New review · SentinelPR" },
      {
        property: "og:description",
        content: "Paste a pull request diff and get security findings mapped to DPDP and RBI rules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewReview,
});

function NewReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const runAnalysis = useServerFn(analyzeScan);

  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("");
  const [prRef, setPrRef] = useState("");
  const [stack, setStack] = useState<string>("auto");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || code.trim().length < 20) {
      toast.error("Paste a bit more code to review.");
      return;
    }
    setBusy(true);
    try {
      const { data: scan, error } = await supabase
        .from("scans")
        .insert({
          user_id: user.id,
          title: title.trim() || "Untitled review",
          repo: repo.trim() || null,
          pr_ref: prRef.trim() || null,
          stack,
          source_code: code,
          status: "running",
        })
        .select()
        .single();

      if (error || !scan) throw new Error(error?.message ?? "Could not start the review.");

      await runAnalysis({ data: { scanId: scan.id } });
      navigate({ to: "/reviews/$scanId", params: { scanId: scan.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="mono-label">New review</p>
        <h1 className="mt-2 text-2xl font-semibold">Review a pull request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste the diff or the changed files. Findings come back with the DPDP or RBI clause they
          touch, a fix, and a test.
        </p>
      </div>

      <form onSubmit={submit} className="panel space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Review title</Label>
            <Input
              id="title"
              placeholder="Payouts API hardening"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stack">Stack</Label>
            <Select value={stack} onValueChange={setStack}>
              <SelectTrigger id="stack">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STACK_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repo">Repository</Label>
            <Input
              id="repo"
              placeholder="acme-fintech/payouts-service"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr">Pull request</Label>
            <Input
              id="pr"
              placeholder="PR #412"
              value={prRef}
              onChange={(e) => setPrRef(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="code">Diff or changed files</Label>
            <button
              type="button"
              className="font-mono text-xs text-primary hover:underline"
              onClick={() => setCode(SAMPLE_DIFF)}
            >
              use example diff
            </button>
          </div>
          <Textarea
            id="code"
            rows={16}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder="Paste your diff here…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5" />
            Deep reviews take up to a minute.
          </p>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Reviewing…" : "Run security review"}
          </Button>
        </div>
      </form>
    </div>
  );
}
