import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  GitPullRequest,
  ScrollText,
  Wrench,
  TerminalSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SentinelPR · AI code security review for Indian SaaS and fintech" },
      {
        name: "description",
        content:
          "SentinelPR reviews every pull request for security flaws in AI-generated code and maps each finding to DPDP Act and RBI requirements, with fixes and tests.",
      },
      { property: "og:title", content: "SentinelPR · PR-native AI security copilot" },
      {
        property: "og:description",
        content:
          "Catch insecure AI-generated code before merge. Every finding mapped to DPDP Act 2023 and RBI IT guidelines, with a fix and a test.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: GitPullRequest,
    title: "PR-native, not another dashboard",
    body: "Paste a diff or wire up a pull request and get a review written for the author — file, line, reason, patch.",
  },
  {
    icon: TerminalSquare,
    title: "Two stacks, understood deeply",
    body: "Node + TypeScript + React on AWS, and Python + Django/FastAPI + React + Postgres. Terraform and CDK included.",
  },
  {
    icon: ScrollText,
    title: "DPDP and RBI on every finding",
    body: "Each issue carries the clause it breaches — DPDP Act 2023 safeguards, RBI cyber security and data localisation directions.",
  },
  {
    icon: Wrench,
    title: "A fix and a test, every time",
    body: "Copy-ready patched code plus the regression test that stops the same pattern coming back next sprint.",
  },
];

const AI_PATTERNS = [
  "String-interpolated SQL from assistant-written data access",
  "Endpoints shipped without permission_classes or authz middleware",
  "Placeholder secrets and dev fallbacks left in the handler",
  "Buckets, CORS and IAM widened to make the sample run",
  "PAN, Aadhaar and card data written straight to logs",
  "Terraform security groups open to 0.0.0.0/0",
];

function Landing() {
  const { session } = useAuth();
  const appHref = session ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <span className="font-mono text-sm font-semibold">SentinelPR</span>
          </div>
          <div className="ml-auto">
            <Button asChild size="sm" variant={session ? "default" : "outline"}>
              <Link to={appHref}>{session ? "Open reviews" : "Sign in"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid-backdrop border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <p className="mono-label">India · DPDP Act 2023 · RBI IT Framework</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Your AI writes the code.
            <span className="block text-primary">We stop it shipping a breach.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A pull-request security copilot for Indian SaaS and fintech teams. It reads your diff,
            finds the flaws AI assistants keep introducing, and maps every one of them to the DPDP
            Act and RBI guidelines — with a patch and a test attached.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={appHref}>
                Review a pull request
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={appHref}>See a worked example</Link>
            </Button>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { k: "2 stacks", v: "Node+TS+AWS and Python+Django/FastAPI, reviewed in depth" },
              { k: "2 regimes", v: "DPDP Act 2023 and RBI IT / cyber security directions" },
              { k: "0 guesswork", v: "Every finding ships with a fix and a regression test" },
            ].map((s) => (
              <div key={s.k} className="panel p-5">
                <div className="font-mono text-2xl font-semibold text-primary">{s.k}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-20 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="panel p-6">
              <p.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="mono-label">What we look for</p>
          <h2 className="mt-4 text-2xl font-semibold">
            The failure patterns of AI-generated code
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {AI_PATTERNS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold">Built for the team that ships on Friday</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            GitHub, GitHub Actions, Terraform or CDK — SentinelPR fits the workflow you already run.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to={appHref}>Start reviewing</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="font-mono text-xs text-muted-foreground">
            SentinelPR — PR-native AI security review · Compliance mapping is guidance, not legal
            advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
