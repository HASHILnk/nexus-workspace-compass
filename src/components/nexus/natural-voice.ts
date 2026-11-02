import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";

/** Streams Nova's natural voice (24 kHz PCM over SSE) and reports a live loudness level. */
export async function playNaturalVoice(text: string, signal: AbortSignal, onLevel: (l: number) => void): Promise<void> {
  const ctx = new AudioContext({ sampleRate: 24000 });
  const an = ctx.createAnalyser(); an.fftSize = 512; an.connect(ctx.destination);
  const sources = new Set<AudioBufferSourceNode>();
  const kill = () => { for (const s of sources) { try { s.stop(); } catch { /* noop */ } } };
  signal.addEventListener("abort", kill, { once: true });
  const buf = new Uint8Array(256);
  let raf = 0;
  const meter = () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += ((v - 128) / 128) ** 2; onLevel(Math.min(1, Math.sqrt(s / buf.length) * 5)); raf = requestAnimationFrame(meter); };
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/tts", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || !res.body) throw new Error(`Voice failed (${res.status})`);
    meter();
    let pending = new Uint8Array(0), playhead = 0, done = false, played = 0;
    let last: Promise<void> = Promise.resolve();
    const parser = createParser({
      onEvent(ev) {
        const p = JSON.parse(ev.data) as { type: string; audio?: string; error?: unknown };
        if (p.type === "error" || p.error) throw new Error("Voice failed");
        if (p.type === "speech.audio.done") { done = true; return; }
        if (p.type !== "speech.audio.delta" || !p.audio) return;
        const inc = Uint8Array.from(atob(p.audio), (c) => c.charCodeAt(0));
        const bytes = new Uint8Array(pending.length + inc.length); bytes.set(pending); bytes.set(inc, pending.length);
        const usable = bytes.length - (bytes.length % 2);
        const view = new DataView(bytes.buffer);
        const samples = new Float32Array(usable / 2);
        for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
        pending = bytes.slice(usable);
        if (!samples.length) return;
        played += samples.length;
        const ab = ctx.createBuffer(1, samples.length, 24000); ab.copyToChannel(samples, 0);
        const src = ctx.createBufferSource(); src.buffer = ab; src.connect(an); sources.add(src);
        last = new Promise((r) => { src.onended = () => { sources.delete(src); r(); }; });
        playhead = Math.max(playhead, ctx.currentTime + 0.05); src.start(playhead); playhead += ab.duration;
      },
    });
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) { const n = await reader.read(); if (n.done) break; parser.feed(n.value); }
    if (!done || !played) throw new Error("Voice stream was incomplete");
    await last;
    signal.throwIfAborted();
  } finally {
    cancelAnimationFrame(raf); onLevel(0);
    signal.removeEventListener("abort", kill); kill(); void ctx.close();
  }
}
