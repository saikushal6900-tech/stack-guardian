import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const TITLE = "Compliance policy · SentinelPR";
const DESCRIPTION =
  "How SentinelPR's pull-request security findings map to the DPDP Act 2023 and RBI IT and Cyber Security Framework requirements.";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PolicyPage,
});

const DPDP = [
  {
    clause: "S.5 — Notice and consent",
    what: "Personal data may only be processed for a purpose the data principal was told about and consented to.",
    how: "Findings flag new endpoints, exports and third-party calls that move personal data outside the purpose declared for the feature.",
  },
  {
    clause: "S.6 — Purpose limitation and minimisation",
    what: "Only the personal data necessary for the stated purpose may be collected or returned.",
    how: "Over-broad SELECT *, unscoped ORM queries and API responses returning full customer records are raised as minimisation defects.",
  },
  {
    clause: "S.8(2) — Processor obligations",
    what: "A fiduciary stays accountable for processors acting on its behalf.",
    how: "New vendor SDKs, webhooks and outbound integrations introduced in a diff are reported with the data they receive.",
  },
  {
    clause: "S.8(5) — Reasonable security safeguards",
    what: "Technical and organisational safeguards must prevent personal data breaches.",
    how: "Injection, broken access control, hardcoded secrets, disabled TLS verification and public storage buckets map here, each with a patch and a regression test.",
  },
  {
    clause: "S.8(6) — Breach notification",
    what: "Breaches must be reported to the Board and affected principals.",
    how: "Findings that would constitute a reportable breach if merged are marked critical so they block the pull request.",
  },
  {
    clause: "S.9 — Children's data",
    what: "Processing children's data requires verifiable parental consent and no tracking.",
    how: "Age-gating gaps and analytics or advertising SDKs added to flows that can include minors are flagged.",
  },
  {
    clause: "S.11–13 — Data principal rights",
    what: "Principals may access, correct, and erase their data, and nominate.",
    how: "Schema changes that add personal data without a deletion or export path are raised as a rights gap.",
  },
];

const RBI = [
  {
    clause: "Cyber Security Framework — Access control",
    what: "Least-privilege access to customer and card data, with periodic review.",
    how: "Missing authorisation checks, over-broad IAM policies, wildcard CORS and 0.0.0.0/0 security groups are reported against this control.",
  },
  {
    clause: "Cyber Security Framework — Secure application development",
    what: "Applications must be tested against common flaws before release.",
    how: "SentinelPR runs on the pull request itself, so the check happens before merge, and every finding ships with a test that keeps it fixed.",
  },
  {
    clause: "IT Framework — Audit trails and logging",
    what: "Security-relevant events must be logged, and logs must not themselves leak sensitive data.",
    how: "Missing audit logging on privileged actions, and PAN, Aadhaar, card or KYC values written to logs, are both flagged.",
  },
  {
    clause: "Storage of Payment System Data",
    what: "Payment system data must be stored in India.",
    how: "Infrastructure changes that place buckets, databases or queues in non-Indian regions are raised as a localisation finding.",
  },
  {
    clause: "Outsourcing and vendor risk",
    what: "Risk from service providers handling regulated data must be assessed and controlled.",
    how: "New third-party dependencies and outbound data flows introduced by a diff are surfaced with what they can read.",
  },
  {
    clause: "Incident reporting",
    what: "Material incidents must be reported to RBI within six hours of detection.",
    how: "Critical findings carry the reporting expectation in the finding text so on-call engineers escalate rather than patch quietly.",
  },
];

function Table({
  heading,
  intro,
  rows,
}: {
  heading: string;
  intro: string;
  rows: { clause: string; what: string; how: string }[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
      </div>
      <div className="panel divide-y divide-border">
        {rows.map((r) => (
          <div key={r.clause} className="grid gap-3 p-5 md:grid-cols-[minmax(0,14rem)_1fr]">
            <p className="font-mono text-xs text-primary">{r.clause}</p>
            <div className="space-y-2 text-sm">
              <p>{r.what}</p>
              <p className="text-muted-foreground">{r.how}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PolicyPage() {
  return (
    <div className="grid-backdrop min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <span className="font-mono text-sm font-semibold tracking-tight">SentinelPR</span>
          </Link>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-12">
        <div>
          <p className="mono-label">Compliance policy</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            How SentinelPR findings align with DPDP and RBI guidelines
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            This page states the mapping SentinelPR applies when it reviews a pull request. It is
            written so that you can attach it to a client proposal, a vendor security questionnaire
            or an internal secure-SDLC document. SentinelPR is a code review tool: it evidences
            engineering diligence against these obligations, and does not by itself make an
            organisation compliant or replace legal advice.
          </p>
        </div>

        <section className="panel space-y-3 p-6">
          <h2 className="text-base font-medium">Review principles</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              Every finding names the regulation, the specific clause, and what that clause
              requires — no generic "may be a compliance risk" language.
            </li>
            <li>
              A clause is cited only when it genuinely applies to the code in the diff. Issues with
              no India-specific obligation are mapped to PCI DSS or OWASP instead.
            </li>
            <li>
              Every finding carries a concrete patch and a regression test, so remediation is
              evidenced in version control.
            </li>
            <li>
              Reviews run on the pull request before merge, which is the control point the RBI
              secure-development expectations describe.
            </li>
            <li>
              Source code is analysed to produce the review and the diff is stored against your
              account only; findings are visible to your account alone.
            </li>
          </ul>
        </section>

        <Table
          heading="Digital Personal Data Protection Act, 2023"
          intro="Obligations that apply to a Data Fiduciary building and shipping software that handles personal data."
          rows={DPDP}
        />

        <Table
          heading="RBI IT Framework, Cyber Security Framework and related directions"
          intro="Controls expected of regulated entities and their technology service providers."
          rows={RBI}
        />

        <section className="panel space-y-3 p-6">
          <h2 className="text-base font-medium">Scope and limitations</h2>
          <p className="text-sm text-muted-foreground">
            SentinelPR reviews the code and infrastructure definitions you submit. It does not audit
            running systems, review contracts or consent artefacts, assess physical and
            organisational controls, or file regulatory notifications on your behalf. Findings are
            advisory and should be reviewed by your engineering and compliance owners before they
            are relied on in a regulatory filing.
          </p>
        </section>
      </main>
    </div>
  );
}
