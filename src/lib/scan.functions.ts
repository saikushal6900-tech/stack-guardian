import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createResponsesProvider } from "./ai-gateway.server";
import { streamObject } from "ai";
import { z } from "zod";

const AnalyzeInput = z.object({
  scanId: z.string().uuid(),
});

const ComplianceSchema = z.object({
  framework: z
    .enum(["DPDP Act 2023", "RBI IT Framework", "RBI Cyber Security Framework", "PCI DSS", "OWASP"])
    .describe("Regulation or standard the finding maps to"),
  clause: z.string().describe("Specific section or control reference"),
  requirement: z.string().describe("One sentence on what the regulation requires here"),
});

const FindingSchema = z.object({
  title: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.string().describe("e.g. injection, secrets, access-control, data-residency, logging"),
  location: z.string().describe("File and/or line reference, or 'unknown'"),
  description: z.string(),
  ai_pattern: z
    .string()
    .describe("Why this looks like an AI-generated coding pattern, or 'not-ai-specific'"),
  compliance: z.array(ComplianceSchema),
  fix_suggestion: z.string().describe("Concrete patched code or steps, in markdown"),
  test_suggestion: z.string().describe("A regression test that would catch this, in markdown"),
});

const ReportSchema = z.object({
  summary: z.string().describe("2-4 sentence review summary for the PR author"),
  detected_stack: z.string(),
  risk_score: z.number().describe("0-100 overall risk"),
  ai_generated_likelihood: z.number().describe("0-100 likelihood the code was AI-generated"),
  findings: z.array(FindingSchema),
});

const SYSTEM_PROMPT = `You are SentinelPR, a PR-native application security reviewer for Indian SaaS and fintech engineering teams.

You specialise in exactly two stacks:
A) Node.js + TypeScript + React on AWS (Lambda/ECS/EKS, API Gateway, S3, DynamoDB, RDS, IAM, CDK)
B) Python + Django/FastAPI + React + Postgres on AWS/GCP (plus Terraform)

You are tuned to catch the failure patterns typical of AI-generated code: string-interpolated SQL,
over-broad IAM or CORS, missing authz on new endpoints, secrets and dev fallbacks left inline,
PII in logs, disabled TLS/verification, unscoped ORM queries, missing rate limits, public buckets,
DRF/Django views without permission_classes, and Terraform resources with 0.0.0.0/0 ingress.

For EVERY finding you must map it to India-specific compliance where applicable:
- DPDP Act 2023: notice & consent (S.5), purpose limitation (S.6), data minimisation, reasonable
  security safeguards (S.8(5)), breach notification (S.8(6)), data-principal rights (S.11-13),
  children's data (S.9), processor obligations (S.8(2)).
- RBI IT Framework / Cyber Security Framework (and RBI outsourcing & storage of payment system
  data directions): access control, audit logging, encryption of card/KYC data, data localisation
  in India, vendor risk, incident reporting to RBI within 6 hours, secure SDLC.
Only cite a clause when it genuinely applies. Use PCI DSS or OWASP for non-India-specific items.

Be precise, never invent code that is not in the diff, and always give a working fix and a test.
If the code is clean, return an empty findings array and say so in the summary.`;

export const analyzeScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("*")
      .eq("id", data.scanId)
      .single();

    if (scanError || !scan) throw new Error("Review not found.");

    try {
      const provider = createResponsesProvider();

      const result = streamObject({
        model: provider.responses("openai/gpt-6-astra"),
        schema: ReportSchema,
        system: SYSTEM_PROMPT,
        prompt: [
          `Target stack: ${scan.stack}`,
          scan.repo ? `Repository: ${scan.repo}` : "",
          scan.pr_ref ? `Pull request: ${scan.pr_ref}` : "",
          "",
          "Review the following code / diff:",
          "```",
          scan.source_code.slice(0, 60000),
          "```",
        ]
          .filter(Boolean)
          .join("\n"),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "medium",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      const report = await result.object;

      const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

      const rows = report.findings.map((f) => ({
        scan_id: scan.id,
        user_id: userId,
        severity: f.severity,
        title: f.title,
        category: f.category,
        location: f.location,
        description: f.description,
        ai_pattern: f.ai_pattern,
        compliance: f.compliance,
        fix_suggestion: f.fix_suggestion,
        test_suggestion: f.test_suggestion,
      }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("findings").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }

      await supabase
        .from("scans")
        .update({
          status: "complete",
          summary: report.summary,
          risk_score: clamp(report.risk_score),
          ai_generated_likelihood: clamp(report.ai_generated_likelihood),
          stack: scan.stack === "auto" ? report.detected_stack : scan.stack,
          error_message: null,
        })
        .eq("id", scan.id);

      return { ok: true as const, findings: rows.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Review failed.";
      await supabase
        .from("scans")
        .update({ status: "failed", error_message: message })
        .eq("id", scan.id);
      throw new Error(message);
    }
  });
