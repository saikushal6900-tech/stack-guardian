import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

const RepoInput = z.object({
  repo: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Use the owner/repository format, e.g. acme/payouts-service"),
});

const PullInput = RepoInput.extend({
  pullNumber: z.number().int().positive(),
});

function gatewayHeaders(accept: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const githubKey = process.env["GITHUB_API_KEY"];
  if (!lovableKey || !githubKey) {
    throw new Error("GitHub is not connected for this project yet.");
  }
  return {
    Accept: accept,
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": githubKey,
  };
}

async function gatewayGet(path: string, accept = "application/vnd.github+json") {
  const response = await fetch(`${GATEWAY_URL}/${path}`, {
    method: "GET",
    headers: gatewayHeaders(accept),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`GitHub gateway request failed [${response.status}]: ${body}`);
    throw new Error(`GitHub request failed [${response.status}]: ${body.slice(0, 400)}`);
  }
  return response;
}

/** Open pull requests for a repository, newest first. */
export const listPullRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RepoInput.parse(input))
  .handler(async ({ data }) => {
    const response = await gatewayGet(
      `repos/${data.repo}/pulls?state=open&per_page=20&sort=updated&direction=desc`,
    );
    const pulls = (await response.json()) as Array<{
      number: number;
      title: string;
      user?: { login?: string };
      head?: { ref?: string };
      changed_files?: number;
      updated_at: string;
    }>;
    return pulls.map((p) => ({
      number: p.number,
      title: p.title,
      author: p.user?.login ?? "unknown",
      branch: p.head?.ref ?? "",
      updatedAt: p.updated_at,
    }));
  });

/** Full unified diff plus metadata for one pull request. */
export const fetchPullRequestDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PullInput.parse(input))
  .handler(async ({ data }) => {
    const metaResponse = await gatewayGet(`repos/${data.repo}/pulls/${data.pullNumber}`);
    const meta = (await metaResponse.json()) as {
      number: number;
      title: string;
      html_url: string;
      changed_files?: number;
      base?: { repo?: { language?: string | null } };
    };

    const diffResponse = await gatewayGet(
      `repos/${data.repo}/pulls/${data.pullNumber}`,
      "application/vnd.github.v3.diff",
    );
    const diff = await diffResponse.text();

    return {
      number: meta.number,
      title: meta.title,
      url: meta.html_url,
      changedFiles: meta.changed_files ?? 0,
      language: meta.base?.repo?.language ?? null,
      diff: diff.slice(0, 200000),
      truncated: diff.length > 200000,
    };
  });
