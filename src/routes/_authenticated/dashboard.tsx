import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seedDemoReview } from "@/lib/demo";
import { riskLabel } from "@/lib/security";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Reviews · SentinelPR" },
      {
        name: "description",
        content: "All your pull-request security reviews, risk scores and DPDP/RBI findings.",
      },
      { property: "og:title", content: "Reviews · SentinelPR" },
      {
        property: "og:description",
        content: "All your pull-request security reviews, risk scores and DPDP/RBI findings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["finding-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("findings").select("severity, scan_id");
      if (error) throw error;
      return data;
    },
  });

  async function loadDemo() {
    if (!user) return;
    setSeeding(true);
    try {
      const id = await seedDemoReview(user.id);
      await queryClient.invalidateQueries();
      navigate({ to: "/reviews/$scanId", params: { scanId: id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the demo.");
    } finally {
      setSeeding(false);
    }
  }

  const openFindings = counts?.length ?? 0;
  const criticals = counts?.filter((c) => c.severity === "critical").length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">Security reviews</p>
          <h1 className="mt-2 text-2xl font-semibold">Pull request findings</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDemo} disabled={seeding}>
            {seeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Load demo review
          </Button>
          <Button asChild>
            <Link to="/new">
              <ScanLine className="size-4" />
              New review
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Reviews run" value={scans?.length ?? 0} />
        <Stat label="Findings" value={openFindings} />
        <Stat label="Critical" value={criticals} tone="critical" />
      </div>

      <div className="panel divide-y divide-border">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading reviews…
          </div>
        ) : !scans || scans.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-base font-medium">No reviews yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Paste a diff from your next pull request, or load the worked example to see how
              findings map to DPDP and RBI clauses.
            </p>
          </div>
        ) : (
          scans.map((scan) => {
            const scanFindings = counts?.filter((c) => c.scan_id === scan.id) ?? [];
            return (
              <Link
                key={scan.id}
                to="/reviews/$scanId"
                params={{ scanId: scan.id }}
                className="flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{scan.title}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {[scan.repo, scan.pr_ref, scan.stack].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {scanFindings.length} findings
                </div>
                <RiskPill score={scan.risk_score} status={scan.status} />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical";
}) {
  return (
    <div className="panel p-5">
      <p className="mono-label">{label}</p>
      <p
        className={
          "mt-2 font-mono text-3xl font-semibold " +
          (tone === "critical" ? "text-critical" : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}

function RiskPill({ score, status }: { score: number; status: string }) {
  if (status !== "complete") {
    return (
      <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs text-muted-foreground">
        {status}
      </span>
    );
  }
  const tone =
    score >= 75
      ? "border-critical/40 bg-critical/15 text-critical"
      : score >= 45
        ? "border-high/40 bg-high/15 text-high"
        : score >= 20
          ? "border-medium/40 bg-medium/15 text-medium"
          : "border-primary/40 bg-primary/10 text-primary";
  return (
    <span className={`rounded-full border px-3 py-1 font-mono text-xs ${tone}`}>
      {score} · {riskLabel(score)}
    </span>
  );
}
