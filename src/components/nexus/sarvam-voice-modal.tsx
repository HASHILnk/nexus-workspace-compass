import { useState, useEffect, useRef } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Bot,
  User,
  Clock,
  Radio,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SarvamVoiceCallSession,
  type SarvamAgentCallState,
  type SarvamTranscriptMessage,
} from "@/lib/ai/sarvam-agent";
import { useStore } from "@/lib/store";
import { memberById } from "@/lib/selectors";
import { cn } from "@/lib/utils";

interface SarvamVoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SarvamVoiceModal({ open, onOpenChange }: SarvamVoiceModalProps) {
  const { state } = useStore();
  const me = memberById(state, state.meId);
  const [callState, setCallState] = useState<SarvamAgentCallState>("IDLE");
  const [transcripts, setTranscripts] = useState<SarvamTranscriptMessage[]>([]);
  const [callSeconds, setCallSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const sessionRef = useRef<SarvamVoiceCallSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Call timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === "CONNECTED" || callState === "LISTENING" || callState === "SPEAKING") {
      timer = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Scroll to latest transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Clean up call on dialog close
  useEffect(() => {
    if (!open && sessionRef.current) {
      void sessionRef.current.endCall();
      setCallState("IDLE");
      setCallSeconds(0);
    }
  }, [open]);

  const handleStartCall = async () => {
    try {
      setTranscripts([]);
      setCallSeconds(0);
      const session = new SarvamVoiceCallSession({
        config: {
          userName: me?.name || "Team Member",
        },
        onStateChange: (newState) => {
          setCallState(newState);
          if (newState === "ERROR") {
            toast.error("Call disconnected with an error. Please verify microphone permission.");
          }
        },
        onTranscript: (msg) => {
          setTranscripts((prev) => [...prev, msg]);
        },
        onAudioLevel: (lvl) => {
          setAudioLevel(lvl);
        },
      });

      sessionRef.current = session;
      await session.startCall();
    } catch (err: any) {
      toast.error(err?.message || "Failed to start Sarvam voice call.");
      setCallState("IDLE");
    }
  };

  const handleEndCall = async () => {
    if (sessionRef.current) {
      await sessionRef.current.endCall();
      sessionRef.current = null;
    }
    setCallState("DISCONNECTED");
    setTimeout(() => {
      setCallState("IDLE");
    }, 1200);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isCallActive =
    callState === "CONNECTING" ||
    callState === "CONNECTED" ||
    callState === "LISTENING" ||
    callState === "SPEAKING";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <span>Nexus Voice</span>
                  <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal border-primary/30 text-primary">
                    Sarvam AI (Bulbul V4)
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground">
                  Continuous real-time Malayalam & English voice conversation
                </DialogDescription>
              </div>
            </div>

            {isCallActive && (
              <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                <Clock className="size-3" />
                <span>{formatTimer(callSeconds)}</span>
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Visualizer & Call Status Area */}
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-muted/20 border-b">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring indicators */}
            {isCallActive && (
              <span
                className={cn(
                  "absolute inline-flex rounded-full transition-all duration-300",
                  callState === "SPEAKING"
                    ? "size-28 bg-primary/20 animate-ping"
                    : callState === "LISTENING"
                    ? "size-24 bg-emerald-500/20 animate-pulse"
                    : "size-20 bg-amber-500/20"
                )}
              />
            )}

            {/* Central Call Avatar */}
            <div
              className={cn(
                "relative flex size-20 items-center justify-center rounded-full shadow-lg transition-all duration-300",
                callState === "SPEAKING"
                  ? "bg-gradient-to-tr from-primary to-emerald-400 text-primary-foreground scale-105"
                  : callState === "LISTENING"
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white"
                  : callState === "CONNECTING"
                  ? "bg-muted text-muted-foreground animate-pulse"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {callState === "SPEAKING" ? (
                <Volume2 className="size-9 animate-bounce" />
              ) : callState === "LISTENING" ? (
                <Mic className="size-9 animate-pulse" />
              ) : (
                <Bot className="size-9" />
              )}
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs font-semibold text-foreground">
              {callState === "SPEAKING"
                ? "Agent is speaking…"
                : callState === "LISTENING"
                ? "Listening to you… (Speak anytime)"
                : callState === "CONNECTING"
                ? "Connecting to Sarvam voice pipeline…"
                : callState === "DISCONNECTED"
                ? "Call ended"
                : "Ready to start voice conversation"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Caller: {me?.name || "Team Member"} · Malayalam & English supported
            </p>
          </div>
        </div>

        {/* Live Transcript Stream */}
        <div className="h-44 overflow-y-auto p-4 space-y-2 text-xs" ref={scrollRef}>
          {transcripts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-[11px] px-6">
              <Sparkles className="size-4 mb-1 text-primary opacity-60" />
              <p>Click "Start Call" to begin speaking live with Nexus Voice.</p>
              <p className="text-[10px] mt-1 text-muted-foreground/80">
                You can ask questions, assign tasks, or check project status in natural Malayalam or English.
              </p>
            </div>
          ) : (
            transcripts.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex gap-2 max-w-[88%]",
                  t.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"
                )}
              >
                {t.role === "bot" && (
                  <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="size-3" />
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs shadow-xs",
                    t.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-muted/70 text-foreground rounded-bl-xs"
                  )}
                >
                  <p className="whitespace-pre-wrap">{t.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Call Action Bar */}
        <div className="flex items-center justify-center gap-3 p-4 border-t bg-card">
          {!isCallActive ? (
            <Button
              type="button"
              onClick={handleStartCall}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-md"
            >
              <PhoneCall className="size-4" />
              <span>Start Voice Call</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleEndCall}
              className="gap-2 rounded-full px-6 shadow-md"
            >
              <PhoneOff className="size-4" />
              <span>End Call</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
