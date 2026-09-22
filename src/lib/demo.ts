import { supabase } from "@/integrations/supabase/client";
import { SAMPLE_DIFF } from "./security";

const DEMO_FINDINGS = [
  {
    severity: "critical",
    title: "SQL injection via interpolated PAN lookup",
    category: "injection",
    location: "src/routes/api/payouts.ts:7",
    description:
      "The customer lookup builds SQL with template interpolation of `body.pan`, letting any caller read or destroy the customers table. This is the single most common defect in AI-generated data-access code.",
    ai_pattern:
      "Assistant-written query built with a template literal instead of the parameterised client the rest of the repo uses.",
    compliance: [
      {
        framework: "DPDP Act 2023",
        clause: "S.8(5) — Reasonable security safeguards",
        requirement:
          "A Data Fiduciary must implement technical safeguards to prevent personal data breaches; an injectable query fails this duty.",
      },
      {
        framework: "RBI Cyber Security Framework",
        clause: "Annex I — Secure application development",
        requirement: "Applications handling customer data must be tested against injection flaws before release.",
      },
    ],
    fix_suggestion:
      "```ts\nconst { rows } = await db.query(\n  'SELECT id, name, status FROM customers WHERE pan = $1',\n  [body.pan],\n);\n```\nAlso validate `body.pan` against `/^[A-Z]{5}\\d{4}[A-Z]$/` before the query.",
    test_suggestion:
      "```ts\nit(\"rejects injected PAN payloads\", async () => {\n  const res = await post('/api/payouts', { pan: \"' OR '1'='1\" });\n  expect(res.status).toBe(400);\n});\n```",
  },
  {
    severity: "critical",
    title: "KYC documents written to a public-read S3 bucket",
    category: "access-control",
    location: "src/routes/api/payouts.ts:14",
    description:
      "`ACL: \"public-read\"` publishes full KYC records to the internet. The bucket also has no residency guarantee in the diff.",
    ai_pattern: "Default ACL copied from a public-website example rather than the private upload path.",
    compliance: [
      {
        framework: "DPDP Act 2023",
        clause: "S.8(6) — Breach notification",
        requirement: "Public exposure of KYC data is a reportable personal data breach to the Board and affected principals.",
      },
      {
        framework: "RBI IT Framework",
        clause: "Storage of Payment System Data",
        requirement: "Payment and KYC data of Indian customers must be stored in India with restricted access.",
      },
    ],
    fix_suggestion:
      "Drop the ACL, enable bucket-level `BlockPublicAcls`, use SSE-KMS, and pin the bucket to `ap-south-1`:\n```ts\nawait s3.putObject({ Bucket: KYC_BUCKET, Key: key, Body: body, ServerSideEncryption: 'aws:kms' });\n```",
    test_suggestion:
      "Add a CDK/Terraform assertion that the bucket has `blockPublicAccess: BLOCK_ALL` and `region == ap-south-1`.",
  },
  {
    severity: "high",
    title: "PAN and Aadhaar written to application logs",
    category: "logging",
    location: "src/routes/api/payouts.ts:11",
    description:
      "Identifiers are logged in clear text, so every log sink and third-party log processor now holds sensitive personal data.",
    ai_pattern: "Debug console.log of the whole request body, left in the generated handler.",
    compliance: [
      {
        framework: "DPDP Act 2023",
        clause: "S.6 — Purpose limitation & data minimisation",
        requirement: "Personal data may only be processed for the stated purpose; logging identifiers is out of purpose.",
      },
      {
        framework: "RBI IT Framework",
        clause: "Audit logging controls",
        requirement: "Audit trails must avoid storing sensitive authentication and identity data in clear text.",
      },
    ],
    fix_suggestion:
      "```ts\nlogger.info('payout request', { panHash: sha256(body.pan), customerId: rows[0].id });\n```",
    test_suggestion:
      "Assert the log transport receives no value matching the PAN or Aadhaar regexes for a sample request.",
  },
  {
    severity: "high",
    title: "Hardcoded JWT signing secret",
    category: "secrets",
    location: "src/routes/api/payouts.ts:20",
    description:
      "`'dev-secret-123'` is committed, so anyone with repo access can mint valid payout tokens in production.",
    ai_pattern: "Placeholder secret generated to make the snippet runnable.",
    compliance: [
      {
        framework: "RBI Cyber Security Framework",
        clause: "Access control & key management",
        requirement: "Cryptographic keys must be generated, stored and rotated outside application source code.",
      },
    ],
    fix_suggestion:
      "```ts\nconst token = jwt.sign({ uid: rows[0].id }, process.env.JWT_SIGNING_KEY!, { expiresIn: '10m' });\n```\nStore the key in AWS Secrets Manager and rotate it after this leak.",
    test_suggestion:
      "Add a CI check that fails when `jwt.sign` is called with a string literal secret.",
  },
] as const;

export async function seedDemoReview(userId: string) {
  const { data: scan, error } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      title: "Demo · payouts API hardening",
      stack: "node-ts-aws",
      repo: "acme-fintech/payouts-service",
      pr_ref: "PR #412",
      source_code: SAMPLE_DIFF,
      status: "complete",
      summary:
        "Four blocking issues in an AI-generated payout handler: an injectable KYC lookup, KYC documents published to a public S3 bucket, PAN/Aadhaar in logs and a hardcoded signing secret. Two of these are reportable breaches under the DPDP Act if shipped.",
      risk_score: 88,
      ai_generated_likelihood: 92,
    })
    .select()
    .single();

  if (error || !scan) throw new Error(error?.message ?? "Could not create the demo review.");

  const { error: findingsError } = await supabase.from("findings").insert(
    DEMO_FINDINGS.map((f) => ({ ...f, scan_id: scan.id, user_id: userId })),
  );
  if (findingsError) throw new Error(findingsError.message);

  return scan.id;
}
