import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Mic, MicOff, MessageSquare, ShieldCheck, Sparkles, Square, Volume2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createThread } from "@/lib/ai.functions";
import { useStore } from "@/lib/store";
import { memberById } from "@/lib/selectors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playNaturalVoice } from "./natural-voice";
import { transcribeClip } from "./transcribe";

/* Free, key-less voice: the browser's built-in speech recognition + speech synthesis.
   Answers come from the same Nexus AI agent (live workspace data, same permissions). */

type Phase = "idle" | "listening" | "thinking" | "speaking";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;

const FEMALE_HINTS = ["female", "samantha", "zira", "aria", "jenny", "google uk english female", "victoria", "karen", "moira", "tessa", "serena", "susan", "heera", "veena", "libby", "sonia", "natasha", "michelle", "ava", "allison"];

function pickVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  const en = vs.filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const h of FEMALE_HINTS) { const v = en.find((x) => x.name.toLowerCase().includes(h)); if (v) return v; }
  return en[0] ?? vs[0] ?? null;
}

function speakable(md: string) {
  return md.replace(/```[\s\S]*?```/g, "").replace(/[*_#>`|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/^\s*[-•]\s+/gm, "").replace(/\n{2,}/g, ". ").replace(/\n/g, ", ").trim();
}

function extractText(m: { role: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (!m.parts) return "";
  return m.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join(" ")
    .trim();
}

export function voiceSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(navigator.mediaDevices && typeof MediaRecorder !== "undefined");
}

export function VoiceAgent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useServerFn(createThread);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open || threadId) return;
    create().then((t) => setThreadId(t.id)).catch((e) => setErr((e as Error).message));
  }, [open, threadId, create]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 p-4 sm:p-6 backdrop-blur-xl" role="dialog" aria-label="Nexus voice assistant">
      {threadId ? <VoiceSession threadId={threadId} onClose={onClose} /> : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Orb level={0.1} phase="thinking" compact={false} />
          <p className="text-sm text-muted-foreground">{err ?? "Getting ready…"}</p>
          <Button variant="outline" className="rounded-full" onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  );
}

function VoiceSession({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const { state, refresh } = useStore();
  const qc = useQueryClient();
  const firstName = memberById(state, state.meId)?.name.split(" ")[0] ?? "there";
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [greeting, setGreeting] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);
  const [muted, setMuted] = useState(false);
  const supported = voiceSupported();

  const recRef = useRef<Rec>(null);
  const activeRef = useRef(true);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const audio = useRef<{ stream: MediaStream; ctx: AudioContext; an: AnalyserNode } | null>(null);
  const raf = useRef(0);
  const ttsAbort = useRef<AbortController | null>(null);
  const ttsLevel = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stopSpeech = () => { ttsAbort.current?.abort(); ttsAbort.current = null; window.speechSynthesis?.cancel(); };

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
    body: () => ({ threadId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, projectId: null }),
  }), [threadId]);

  const listenRef = useRef<() => void>(() => {});

  const browserSpeak = useCallback((clean: string, then?: () => void) => {
    const synth = window.speechSynthesis;
    if (!synth) { setPhase("idle"); then?.(); return; }
    const parts = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
    const voice = pickVoice();
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      if (voice) u.voice = voice;
      u.rate = 1.05; u.pitch = 1.15;
      u.onboundary = () => { ttsLevel.current = 0.55 + Math.random() * 0.45; };
      if (i === parts.length - 1) u.onend = () => { if (!activeRef.current) return; setPhase("idle"); then?.(); };
      synth.speak(u);
    });
  }, []);

  const speak = useCallback((text: string, then?: () => void) => {
    stopSpeech();
    const clean = speakable(text);
    if (!clean) { then?.(); return; }
    setReply(text);
    setPhase("speaking");
    const ac = new AbortController();
    ttsAbort.current = ac;
    playNaturalVoice(clean, ac.signal, (l) => { ttsLevel.current = l; })
      .then(() => { if (!activeRef.current || ac.signal.aborted) return; setPhase("idle"); then?.(); })
      .catch(() => { if (!activeRef.current || ac.signal.aborted) return; browserSpeak(clean, then); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserSpeak]);

  const { sendMessage, stop, messages } = useChat({
    id: `voice-${threadId}`, transport,
    onFinish: ({ message }) => {
      void refresh(); void qc.invalidateQueries({ queryKey: ["ai-threads"] });
      const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
      speak(text || "Done. Anything else?", () => listenRef.current());
    },
    onError: (e) => speak(`Sorry, I couldn't get that. ${e.message ?? ""}`, () => listenRef.current()),
  });

  // Auto-scroll chat box when conversation updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, heard, reply, phase, greeting]);

  // Records from the mic, detects when you stop talking, then transcribes on the server.
  const listen = useCallback(() => {
    if (!activeRef.current || mutedRef.current || !supported) return;
    const a = audio.current;
    if (!a) { setPhase("idle"); setReply("Microphone access is blocked. Allow it in your browser to talk to me."); return; }
    try { recRef.current?.abort(); } catch { /* noop */ }
    stopSpeech();
    if (a.ctx.state === "suspended") void a.ctx.resume();
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(a.stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    let cancelled = false;
    const buf = new Uint8Array(256);
    const started = Date.now();
    let spoke = false, lastLoud = started;
    const finish = () => { clearInterval(iv); if (mr.state !== "inactive") mr.stop(); };
    const cancel = () => { cancelled = true; finish(); };
    const iv = setInterval(() => {
      a.an.getByteTimeDomainData(buf);
      let s = 0; for (const v of buf) s += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(s / buf.length);
      const now = Date.now();
      if (rms > 0.03) { spoke = true; lastLoud = now; }
      if (spoke && now - lastLoud > 1300) finish();
      else if (!spoke && now - started > 15000) { cancel(); setPhase("idle"); }
      else if (now - started > 30000) finish();
    }, 100);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      if (recRef.current?.mr === mr) recRef.current = null;
      if (cancelled || !activeRef.current || !spoke || !chunks.length) return;
      setPhase("thinking"); setReply(""); setHeard("…");
      transcribeClip(new Blob(chunks, { type: mr.mimeType || "audio/webm" }), new AbortController().signal)
        .then((t) => {
          if (!activeRef.current) return;
          if (!t) { setHeard(""); setPhase("idle"); setReply("I didn't catch that — tap the orb and try again."); return; }
          setHeard(t); void sendMessage({ text: t });
        })
        .catch(() => { if (!activeRef.current) return; setHeard(""); setPhase("idle"); setReply("I couldn't hear that clearly. Tap the orb to try again."); });
    };
    recRef.current = { mr, stop: finish, abort: cancel };
    setHeard(""); setPhase("listening");
    mr.start(250);
  }, [sendMessage, supported]);
  listenRef.current = listen;

  // Mic level meter for the orb + greeting + AEC/Noise suppression filter
  useEffect(() => {
    activeRef.current = true;
    (async () => {
      try {
        // Professional Audio Constraints: Acoustic Echo Cancellation (AEC), Noise Suppression, AGC
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
              channelCount: 1,
              sampleRate: { ideal: 48000 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        const ctx = new AudioContext();

        // Web Audio DSP Chain: High-pass filter cuts sub-85Hz rumble/fan noise, notch cuts 60Hz hum
        const highPass = ctx.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 85;
        highPass.Q.value = 0.7;

        const notch = ctx.createBiquadFilter();
        notch.type = "notch";
        notch.frequency.value = 60;
        notch.Q.value = 4.0;

        const an = ctx.createAnalyser();
        an.fftSize = 512;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(highPass);
        highPass.connect(notch);
        notch.connect(an);

        audio.current = { stream, ctx, an };
      } catch { /* meter optional */ }

      const buf = new Uint8Array(256);
      const tick = () => {
        const p = phaseRef.current;
        if (p === "listening" && audio.current) {
          audio.current.an.getByteTimeDomainData(buf);
          let s = 0; for (const v of buf) s += ((v - 128) / 128) ** 2;
          setLevel((l) => l * 0.6 + Math.min(1, Math.sqrt(s / buf.length) * 6) * 0.4);
        } else if (p === "speaking") setLevel((l) => l * 0.5 + ttsLevel.current * 0.5);
        else if (p === "thinking") setLevel(0.25 + Math.sin(Date.now() / 250) * 0.1);
        else setLevel((l) => l * 0.9);
        raf.current = requestAnimationFrame(tick);
      };
      tick();

      const h = new Date().getHours();
      const hi = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
      if (!supported) { setReply("Voice needs microphone access, which this browser does not support."); return; }
      const initialGreeting = `${hi} ${firstName}! I'm Nova, your Nexus assistant. Ask me about your projects, deadlines or who's free, or tell me to create a task.`;
      setGreeting(initialGreeting);
      speak(initialGreeting, () => listenRef.current());
    })();

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(raf.current);
      try { recRef.current?.abort(); } catch { /* noop */ }
      stopSpeech();
      audio.current?.stream.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapOrb = () => {
    if (phase === "speaking") { stopSpeech(); listen(); }
    else if (phase === "thinking") { void stop(); listen(); }
    else if (phase === "listening") { try { recRef.current?.stop(); } catch { /* noop */ } }
    else listen();
  };

  const toggleMute = () => {
    const m = !muted; setMuted(m); mutedRef.current = m;
    if (m) { try { recRef.current?.abort(); } catch { /* noop */ } setPhase("idle"); } else listen();
  };

  const label = { idle: muted ? "Microphone off" : "Tap the orb to talk", listening: "Listening…", thinking: "Checking your workspace…", speaking: "Nova is speaking" }[phase];
  const suggestions = ["What should I focus on today?", "Who has nothing assigned?", "Any overdue tasks?", "Summarize my projects"];

  const handleSuggestion = (s: string) => {
    stopSpeech();
    try { recRef.current?.abort(); } catch { /* noop */ }
    setHeard(s);
    setPhase("thinking");
    void sendMessage({ text: s });
  };

  return (
    <>
      {/* Top Header Bar */}
      <div className="flex w-full max-w-3xl items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Nova · Voice</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3" />
              AEC & Noise Filter
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Live voice & real-time chat transcript</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 rounded-full px-3 text-xs gap-1.5", showTranscript ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            onClick={() => setShowTranscript((v) => !v)}
            aria-label="Toggle chat transcript"
          >
            <MessageSquare className="size-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Close voice assistant" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Center Area: Animated Orb + Live Chat Box */}
      <div className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center gap-4 py-2 min-h-0">
        {/* Glowing Voice Orb */}
        <button
          onClick={tapOrb}
          aria-label={label}
          className="group relative rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 transition-transform active:scale-95"
        >
          <Orb level={level} phase={phase} compact={showTranscript} />
        </button>

        {/* Phase Status Label */}
        <div className="text-center">
          <p className={cn(
            "text-xs font-semibold uppercase tracking-widest transition-colors",
            phase === "listening" && "text-primary animate-pulse",
            phase === "thinking" && "text-amber-500 animate-pulse",
            phase === "speaking" && "text-emerald-500",
            phase === "idle" && "text-muted-foreground"
          )}>
            {label}
          </p>
        </div>

        {/* Chat Box: Conversation History */}
        {showTranscript ? (
          <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-lg backdrop-blur-md max-h-[38vh] min-h-[160px]">
            <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-1.5 bg-muted/30">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="size-3 text-primary" />
                <span>Conversation</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Hands-free</span>
            </div>

            {/* Scrollable Message List */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-sm">
              {/* Nova's Initial Greeting */}
              {greeting && (
                <div className="flex items-start gap-2.5 mr-auto max-w-[90%]">
                  <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-muted/60 px-3.5 py-2 text-foreground border border-border/30">
                    <p className="text-xs font-semibold text-primary mb-0.5">Nova</p>
                    <p className="text-xs leading-relaxed">{greeting}</p>
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                const text = extractText(m);
                const isLatest = idx === messages.length - 1;
                if (!text) return null;

                return (
                  <div
                    key={m.id || idx}
                    className={cn(
                      "flex items-start gap-2.5",
                      isUser ? "ml-auto max-w-[85%] justify-end" : "mr-auto max-w-[90%]"
                    )}
                  >
                    {!isUser && (
                      <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary mt-0.5">
                        <Sparkles className="size-3.5" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm",
                        isUser
                          ? "rounded-tr-xs bg-primary text-primary-foreground font-medium"
                          : "rounded-tl-xs bg-muted/60 text-foreground border border-border/30"
                      )}
                    >
                      {!isUser && (
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold text-primary">Nova</span>
                          {isLatest && phase === "speaking" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                              <Volume2 className="size-3 animate-pulse" />
                              Speaking
                            </span>
                          )}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{speakable(text)}</p>
                    </div>
                  </div>
                );
              })}

              {/* Live Speech In-Progress (When user is heard or AI is thinking) */}
              {phase === "thinking" && heard && (
                <div className="flex items-start gap-2.5 ml-auto max-w-[85%] justify-end animate-fadeIn">
                  <div className="rounded-2xl rounded-tr-xs bg-primary/80 text-primary-foreground px-3.5 py-2 text-xs font-medium">
                    <p>“{heard}”</p>
                  </div>
                </div>
              )}

              {phase === "thinking" && (
                <div className="flex items-start gap-2.5 mr-auto max-w-[90%]">
                  <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary animate-spin">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-muted/60 px-3.5 py-2 text-xs text-muted-foreground border border-border/30">
                    <span className="inline-flex items-center gap-1.5">
                      Checking your workspace…
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          /* Minimal View (When Chat Transcript is collapsed) */
          <div className="min-h-20 max-w-xl space-y-2 text-center">
            {heard && <p className="text-base font-medium">“{heard}”</p>}
            {reply && phase !== "listening" && <p className="line-clamp-4 text-xs text-muted-foreground">{speakable(reply)}</p>}
          </div>
        )}

        {/* Suggestion Chips */}
        {phase !== "thinking" && (
          <div className="flex max-w-xl flex-wrap justify-center gap-1.5 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary hover:text-foreground hover:bg-card"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-full border-border/60 bg-card/80 backdrop-blur"
          aria-label={muted ? "Turn microphone on" : "Mute microphone"}
          onClick={toggleMute}
        >
          {muted ? <MicOff className="size-5 text-destructive" /> : <Mic className="size-5 text-primary" />}
        </Button>
        <Button variant="destructive" className="h-12 rounded-full px-6 shadow-md" onClick={onClose}>
          <Square className="size-4 mr-1.5" />
          End
        </Button>
      </div>
    </>
  );
}

function Orb({ level, phase, compact = false }: { level: number; phase: Phase; compact?: boolean }) {
  const s = 1 + level * 0.35;
  const spin = phase === "thinking" ? "animate-spin [animation-duration:3s]" : "animate-spin [animation-duration:12s]";
  const outerSize = compact ? "size-36 sm:size-44" : "size-56 sm:size-64";
  const glowSize = compact ? "size-28 sm:size-36" : "size-40 sm:size-48";
  const innerSize = compact ? "size-24 sm:size-28" : "size-32 sm:size-40";
  const barMax = compact ? 26 : 40;

  return (
    <div className={cn("relative grid place-items-center", outerSize)}>
      <div className="absolute inset-0 rounded-full bg-chart-1/20 blur-3xl transition-transform duration-100" style={{ transform: `scale(${1 + level * 0.6})` }} />
      <div className={cn("absolute transition-transform duration-100", glowSize, spin)} style={{ transform: `scale(${s})` }}>
        <span className="absolute left-0 top-3 size-3/4 rounded-full bg-chart-1 opacity-80 mix-blend-multiply blur-2xl" />
        <span className="absolute right-0 top-4 size-3/4 rounded-full bg-chart-5 opacity-80 mix-blend-multiply blur-2xl" />
        <span className="absolute bottom-0 left-6 size-3/4 rounded-full bg-chart-2 opacity-80 mix-blend-multiply blur-2xl" />
        <span className="absolute bottom-3 right-4 size-2/3 rounded-full bg-chart-4 opacity-70 mix-blend-multiply blur-2xl" />
      </div>
      <div className={cn("relative rounded-full border border-background/60 bg-background/30 shadow-2xl backdrop-blur-md transition-transform duration-100", innerSize)} style={{ transform: `scale(${1 + level * 0.15})` }} />
      <div className="absolute flex items-end gap-1">
        {[0.6, 1, 0.8, 1, 0.6].map((m, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-foreground/70 transition-all duration-100"
            style={{ height: `${6 + level * barMax * m * (phase === "idle" ? 0.2 : 1)}px` }}
          />
        ))}
      </div>
    </div>
  );
}

