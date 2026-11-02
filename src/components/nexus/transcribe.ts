import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";

/** Sends a recorded clip to the server and returns the full transcript. */
export async function transcribeClip(blob: Blob, signal: AbortSignal): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const form = new FormData();
  const type = blob.type.startsWith("audio/") ? (blob.type.split(";")[0] ?? "audio/webm") : "audio/webm";
  form.append("file", new File([blob], type.includes("mp4") ? "speech.mp4" : "speech.webm", { type }));
  const res = await fetch("/api/stt", {
    method: "POST", signal, body: form,
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
  });
  if (!res.ok || !res.body) throw new Error(`Couldn't hear that (${res.status})`);
  let text = "", final: string | null = null;
  const parser = createParser({
    onEvent(ev) {
      if (ev.data === "[DONE]") return;
      const p = JSON.parse(ev.data) as { type?: string; delta?: string; text?: string; error?: unknown };
      if (p.error || p.type === "error") throw new Error("Couldn't hear that");
      if (p.type === "transcript.text.delta" && p.delta) text += p.delta;
      if (p.type === "transcript.text.done") final = p.text ?? text;
    },
  });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) { const n = await reader.read(); if (n.done) break; parser.feed(n.value); }
  return (final ?? text).trim();
}
