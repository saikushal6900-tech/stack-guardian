import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Circle, Clock, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEVERITY_ORDER, SEVERITY_STYLES, type Severity } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Remediation board · SentinelPR" },
      {
        name: "description",
        content:
          "Track every security fix: assign an owner, move it through in-progress and done, and keep a timeline of the work.",
      },
      { property: "og:title", content: "Remediation board · SentinelPR" },
      {
        property: "og:description",
        content:
          "Track every security fix: assign an owner, move it through in-progress and done, and keep a timeline of the work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Board,
});

const COLUMNS = [
  { key: "open", label: "Open", icon: Circle },
  { key: "in_progress", label: "In progress", icon: Clock },
  { key: "done", label: "Done", icon: CheckCircle2 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function severityRank(s: string) {
  const i = SEVERITY_ORDER.indexOf(s as Severity);
  return i === -1 ? 99 : i;
}

function Board() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assigneeDraft, setAssigneeDraft] = useState("");

  const { data: findings, isLoading } = useQuery({
    queryKey: ["board-findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select("id, title, severity, status, assignee, scan_id, location, updated_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["board-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finding_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      title,
      patch,
      event,
    }: {
      id: string;
      title: string;
      patch: { status?: string; assignee?: string | null };
      event: string;
    }) => {
      if (!user) throw new Error("Not signed in.");
      const { error } = await supabase
        .from("findings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      const { error: eventError } = await supabase.from("finding_events").insert({
        finding_id: id,
        user_id: user.id,
        kind: patch.status ? "status" : "assignment",
        detail: `${title} — ${event}`,
      });
      if (eventError) throw eventError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-findings"] });
      queryClient.invalidateQueries({ queryKey: ["board-events"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update the fix."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading the board…
      </div>
    );
  }

  const all = findings ?? [];
  const byColumn = (key: ColumnKey) =>
    all
      .filter((f) => (f.status === "in_progress" || f.status === "done" ? f.status : "open") === key)
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  function move(f: { id: string; title: string; status: string }, to: ColumnKey) {
    update.mutate({
      id: f.id,
      title: f.title,
      patch: { status: to },
      event: `moved to ${COLUMNS.find((c) => c.key === to)?.label.toLowerCase()}`,
    });
  }

  function saveAssignee(f: { id: string; title: string }) {
    const name = assigneeDraft.trim();
    update.mutate({
      id: f.id,
      title: f.title,
      patch: { assignee: name || null },
      event: name ? `assigned to ${name}` : "unassigned",
    });
    setAssigning(null);
    setAssigneeDraft("");
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mono-label">Remediation</p>
        <h1 className="mt-2 text-2xl font-semibold">Fix board</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every finding across your reviews, with an owner and a state. Moves are recorded in the
          timeline below as evidence of remediation.
        </p>
      </div>

      {all.length === 0 ? (
        <div className="panel p-10 text-center">
          <h2 className="text-base font-medium">Nothing to remediate yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Run a review and its findings will appear here as fixes you can assign and close.
          </p>
          <Button asChild className="mt-6">
            <Link to="/new">Run a review</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = byColumn(col.key);
            return (
              <div key={col.key} className="panel flex flex-col">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <col.icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 p-3">
                  {items.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">Empty</p>
                  ) : (
                    items.map((f) => (
                      <div key={f.id} className="rounded-md border border-border bg-secondary/30 p-3">
                        <div className="flex items-start gap-2">
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
                              SEVERITY_STYLES[f.severity as Severity] ??
                              "border-border bg-secondary text-muted-foreground"
                            }`}
                          >
                            {f.severity}
                          </span>
                        </div>
                        <Link
                          to="/reviews/$scanId"
                          params={{ scanId: f.scan_id }}
                          className="mt-2 block text-sm font-medium hover:text-primary"
                        >
                          {f.title}
                        </Link>
                        {f.location ? (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {f.location}
                          </p>
                        ) : null}

                        {assigning === f.id ? (
                          <div className="mt-3 flex gap-2">
                            <Input
                              autoFocus
                              value={assigneeDraft}
                              placeholder="Team member"
                              className="h-8 text-xs"
                              onChange={(e) => setAssigneeDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveAssignee(f);
                                if (e.key === "Escape") setAssigning(null);
                              }}
                            />
                            <Button size="sm" className="h-8" onClick={() => saveAssignee(f)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setAssigning(f.id);
                              setAssigneeDraft(f.assignee ?? "");
                            }}
                          >
                            <UserRound className="size-3.5" />
                            {f.assignee ?? "assign"}
                          </button>
                        )}

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              onClick={() => move({ ...f, status: f.status }, c.key)}
                            >
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="panel p-6">
        <p className="mono-label">Timeline</p>
        {!events || events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Assignments and status changes will appear here.
          </p>
        ) : (
          <ol className="mt-4 space-y-0">
            {events.map((e, i) => (
              <li key={e.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-2 rounded-full bg-primary" />
                  {i < events.length - 1 ? (
                    <span className="w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className="pb-5">
                  <p className="text-sm">{e.detail}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
