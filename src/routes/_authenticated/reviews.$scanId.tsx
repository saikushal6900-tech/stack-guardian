import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SEVERITY_ORDER,
  SEVERITY_STYLES,
  frameworkStyle,
  riskLabel,
  type ComplianceRef,
  type Severity,
} from "@/lib/security";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/reviews/$scanId")({
  head: () => ({
    meta: [
      { title: "Review detail · SentinelPR" },
      {
        name: "description",
        content:
          "Every finding in this pull-request review with its DPDP or RBI clause, a working fix and a regression test.",
      },
      { property: "og:title", content: "Review detail · SentinelPR" },
      {
        property: "og:description",
        content:
          "Every finding in this pull-request review with its DPDP or RBI clause, a working fix and a regression test.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewDetail,
});

function severityRank(s: string) {
  const i = SEVERITY_ORDER.indexOf(s as Severity);
  return i === -1 ? 99 : i;
}

function ReviewDetail() {
  const { scanId } = Route.useParams();

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").eq("id", scanId).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === "running" ? 3000 : false),
  });

  const { data: findings } = useQuery({
    queryKey: ["findings", scanId],
    queryFn: async () => {
      const { data, error } = await supabase.from("findings").select("*").eq("scan_id", scanId);
      if (error) throw error;
      return data;
    },
    refetchInterval: scan?.status === "running" ? 3000 : false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading review…
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="panel p-10 text-center">
        <h1 className="text-base font-medium">Review not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This review does not exist, or it belongs to another account.
        </p>
        <Button asChild className="mt-6">
          <Link to="/dashboard">Back to reviews</Link>
        </Button>
      </div>
    );
  }

  const sorted = [...(findings ?? [])].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  const counts = SEVERITY_ORDER.map((s) => ({
    severity: s,
    count: sorted.filter((f) => f.severity === s).length,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All reviews
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{scan.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {[scan.repo, scan.pr_ref, scan.stack].filter(Boolean).join(" · ")}
        </p>
      </div>

      {scan.status === "running" || scan.status === "pending" ? (
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Analysing the diff against DPDP and RBI requirements…
        </div>
      ) : null}

      {scan.status === "failed" ? (
        <div className="panel flex items-start gap-3 border-critical/40 p-6 text-sm">
          <TriangleAlert className="mt-0.5 size-4 text-critical" />
          <div>
            <p className="font-medium text-critical">Review failed</p>
            <p className="mt-1 text-muted-foreground">{scan.error_message ?? "Unknown error."}</p>
          </div>
        </div>
      ) : null}

      {scan.status === "complete" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-5">
              <p className="mono-label">Risk score</p>
              <p className="mt-2 font-mono text-3xl font-semibold">{scan.risk_score}</p>
              <p className="mt-1 text-xs text-muted-foreground">{riskLabel(scan.risk_score)}</p>
            </div>
            <div className="panel p-5">
              <p className="mono-label">AI-generated likelihood</p>
              <p className="mt-2 font-mono text-3xl font-semibold">
                {scan.ai_generated_likelihood}%
              </p>
            </div>
            <div className="panel p-5">
              <p className="mono-label">Findings</p>
              <p className="mt-2 font-mono text-3xl font-semibold">{sorted.length}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {counts
                  .filter((c) => c.count > 0)
                  .map((c) => (
                    <span
                      key={c.severity}
                      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${SEVERITY_STYLES[c.severity]}`}
                    >
                      {c.count} {c.severity}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {scan.summary ? (
            <div className="panel p-6">
              <p className="mono-label">Reviewer summary</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{scan.summary}</p>
            </div>
          ) : null}

          {sorted.length === 0 ? (
            <div className="panel flex items-center gap-3 p-8">
              <ShieldCheck className="size-5 text-primary" />
              <p className="text-sm">No security findings in this diff.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {sorted.map((f) => {
                const compliance = (f.compliance as unknown as ComplianceRef[]) ?? [];
                return (
                  <AccordionItem
                    key={f.id}
                    value={f.id}
                    className="panel overflow-hidden border-b px-5"
                  >
                    <AccordionTrigger className="gap-4 py-4 hover:no-underline">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 text-left">
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase ${
                            SEVERITY_STYLES[f.severity as Severity] ??
                            "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          {f.severity}
                        </span>
                        <span className="min-w-0 flex-1 font-medium">{f.title}</span>
                        {f.location ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {f.location}
                          </span>
                        ) : null}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pb-6">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {f.description}
                      </p>

                      {f.ai_pattern && f.ai_pattern !== "not-ai-specific" ? (
                        <Section label="AI-generated pattern">
                          <p className="text-sm text-muted-foreground">{f.ai_pattern}</p>
                        </Section>
                      ) : null}

                      {compliance.length > 0 ? (
                        <Section label="Compliance mapping">
                          <div className="space-y-2">
                            {compliance.map((c, i) => (
                              <div key={i} className="rounded-md border border-border p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded border px-2 py-0.5 font-mono text-[11px] ${frameworkStyle(c.framework)}`}
                                  >
                                    {c.framework}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {c.clause}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {c.requirement}
                                </p>
                              </div>
                            ))}
                          </div>
                        </Section>
                      ) : null}

                      <Section label="Suggested fix">
                        <CodeBlock text={f.fix_suggestion} />
                      </Section>

                      <Section label="Regression test">
                        <CodeBlock text={f.test_suggestion} />
                      </Section>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mono-label">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CodeBlock({ text }: { text: string }) {
  const parts = (text ?? "").split(/```(?:[a-zA-Z]*)\n?/);
  return (
    <div className="space-y-2">
      {parts.map((part, i) =>
        part.trim() === "" ? null : i % 2 === 1 ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-md border border-border bg-secondary/40 p-4 font-mono text-xs leading-relaxed"
          >
            <code>{part.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          <p key={i} className="text-sm text-muted-foreground">
            {part.trim()}
          </p>
        ),
      )}
    </div>
  );
}
