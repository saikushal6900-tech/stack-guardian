import { createOpenAI } from "@ai-sdk/openai";

/**
 * Captures and resends the gateway run id header across requests
 * within a single server-side operation.
 */
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId;

  const wrapped: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    const response = await fetch(input as RequestInfo, { ...init, headers });
    const returned = response.headers.get("X-Lovable-AIG-Run-ID");
    if (returned) runId = returned;
    return response;
  };

  return {
    fetch: wrapped,
    get runId() {
      return runId;
    },
  };
}

export function createResponsesProvider() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new Error("AI is not configured for this project yet.");
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch();

  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
}
