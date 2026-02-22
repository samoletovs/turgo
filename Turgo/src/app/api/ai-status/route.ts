import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiProviderInfo } from "@/server/services/ai";

/**
 * GET /api/ai-status — Diagnostic endpoint to check AI provider connectivity
 * Only accessible to authenticated users (admin in production)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providerInfo = getAiProviderInfo();

  const azureConfig = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT ? "SET" : "MISSING",
    apiKey: process.env.AZURE_OPENAI_API_KEY ? "SET" : "MISSING",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
  };

  // Test Azure OpenAI connectivity
  let azureStatus = "not_tested";
  let azureError: string | null = null;

  if (
    providerInfo.envProvider === "azure" &&
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY
  ) {
    try {
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const deployment =
        process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini";
      const apiVersion =
        process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

      const response = await fetch(
        `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.AZURE_OPENAI_API_KEY!,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Say 'OK' in one word." }],
            max_tokens: 5,
            temperature: 0,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        azureStatus = "connected";
        azureError = null;
        return NextResponse.json({
          ...providerInfo,
          azureConfig,
          azureStatus,
          azureResponse: data.choices?.[0]?.message?.content,
          azureModel: data.model,
        });
      } else {
        const errorText = await response.text();
        azureStatus = "error";
        azureError = `HTTP ${response.status}: ${errorText.slice(0, 200)}`;
      }
    } catch (e) {
      azureStatus = "unreachable";
      azureError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    ...providerInfo,
    azureConfig,
    azureStatus,
    azureError,
  });
}
