import { createFileRoute } from "@tanstack/react-router";
import { userClient } from "@/lib/ai/agent.server";

// Natural speech for Nova via Lovable AI (Gemini TTS, warm female voice). Signed-in users only.
const MODEL = "google/gemini-3.1-flash-tts-preview";
const VOICE = "Aoede";

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
  let text = "";
  try {
    text = String(((await request.json()) as { text?: unknown }).text ?? "")
      .trim()
      .slice(0, 1500);
  } catch {
    return err(400, "Invalid request.");
  }
  if (!text) return err(400, "Nothing to say.");
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return err(500, "Voice isn’t configured.");
  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    signal: request.signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Say this the way a warm, upbeat, friendly young woman talks to a colleague — natural, relaxed pacing, smiling voice: ${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
      stream_format: "sse",
    }),
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

export const Route = createFileRoute("/api/tts")({
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
