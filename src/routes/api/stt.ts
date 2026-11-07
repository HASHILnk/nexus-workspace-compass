import { createFileRoute } from "@tanstack/react-router";
import { userClient } from "@/lib/ai/agent.server";

// Transcribes what the user says to Nova (Groq Whisper Free or Lovable AI). Signed-in users only.
const MAX_BYTES = 10 * 1024 * 1024;

const err = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function handle(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return err(401, "Please sign in.");
  const { data, error } = await userClient(token).auth.getClaims(token);
  if (error || !data?.claims?.sub) return err(401, "Session expired.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES)
    return err(400, "Invalid audio.");

  const groqKey = process.env["GROQ_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];

  // 1. If Free Groq API Key is configured, use lightning-fast Whisper Large V3 Turbo
  if (groqKey) {
    const body = new FormData();
    body.append("model", "whisper-large-v3-turbo");
    body.append(
      "file",
      new File([await file.arrayBuffer()], "speech.webm", {
        type: file.type.startsWith("audio/") ? file.type : "audio/webm",
      }),
    );
    body.append("response_format", "verbose_json");

    const upstream = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      signal: request.signal,
      headers: { Authorization: `Bearer ${groqKey}` },
      body,
    });

    if (!upstream.ok)
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    const resData = (await upstream.json()) as { text?: string };
    const text = (resData.text ?? "").trim();
    const sse = `data: ${JSON.stringify({ type: "transcript.text.done", text })}\n\ndata: [DONE]\n\n`;
    return new Response(sse, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // 2. Otherwise fallback to Lovable AI Gateway if configured
  if (lovableKey) {
    const body = new FormData();
    body.append("model", "openai/gpt-transcribe");
    body.append(
      "file",
      new File([await file.arrayBuffer()], "speech.webm", {
        type: file.type.startsWith("audio/") ? file.type : "audio/webm",
      }),
    );
    body.append("response_format", "json");
    body.append("stream", "true");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      signal: request.signal,
      headers: { Authorization: `Bearer ${lovableKey}` },
      body,
    });
    if (!upstream.ok || !upstream.body)
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    return new Response(upstream.body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  return err(
    500,
    "Voice transcription is not configured. Please add GROQ_API_KEY (free) or LOVABLE_API_KEY to your .env file.",
  );
}

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handle(request).catch((e) =>
          request.signal.aborted
            ? new Response(null, { status: 499 })
            : err(502, (e as Error).message),
        ),
    },
  },
});
