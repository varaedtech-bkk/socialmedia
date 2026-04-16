import type { Post } from "@shared/schema";

type N8nPayload = {
  event: "post_created" | "post_published" | "integration_test";
  post?: Post;
  user?: {
    id: number;
    username: string;
    email: string;
  };
  meta?: Record<string, unknown>;
};

function isN8nEnabled(): boolean {
  return process.env.N8N_ENABLED === "true" && Boolean(process.env.N8N_WEBHOOK_URL);
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const token = process.env.N8N_WEBHOOK_AUTH_TOKEN;
  if (token) {
    const headerName = process.env.N8N_WEBHOOK_AUTH_HEADER || "Authorization";
    headers[headerName] = headerName.toLowerCase() === "authorization" ? `Bearer ${token}` : token;
  }

  return headers;
}

export async function triggerN8nWorkflow(payload: N8nPayload): Promise<void> {
  if (!isN8nEnabled()) return;

  const webhookUrl = process.env.N8N_WEBHOOK_URL!;
  const timeoutMs = Number(process.env.N8N_WEBHOOK_TIMEOUT_MS || "10000");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`n8n webhook failed with status ${response.status}: ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function getN8nIntegrationStatus(): { enabled: boolean; webhookConfigured: boolean } {
  return {
    enabled: process.env.N8N_ENABLED === "true",
    webhookConfigured: Boolean(process.env.N8N_WEBHOOK_URL),
  };
}
