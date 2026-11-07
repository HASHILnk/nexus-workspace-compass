// Speech recognition (STT) and voice synthesis (TTS) helper for Nexus AI
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface VoiceLanguage {
  code: string;
  name: string;
  sarvamCode: string;
}

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: "en-IN", name: "English (India)", sarvamCode: "en-IN" },
  { code: "en-US", name: "English (US)", sarvamCode: "en-IN" },
  { code: "ml-IN", name: "Malayalam (മലയാളം)", sarvamCode: "ml-IN" },
  { code: "hi-IN", name: "Hindi (हिन्दी)", sarvamCode: "hi-IN" },
  { code: "ta-IN", name: "Tamil (தமிழ்)", sarvamCode: "ta-IN" },
  { code: "te-IN", name: "Telugu (తెలుగు)", sarvamCode: "te-IN" },
  { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)", sarvamCode: "kn-IN" },
  { code: "bn-IN", name: "Bengali (বাংলা)", sarvamCode: "bn-IN" },
];

/** Cleans markdown syntax, tool calls, and URLs for spoken audio */
export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "Code block omitted.") // remove code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/[#*_~>]/g, "") // markdown formatting symbols
    .replace(/\n+/g, " ") // newlines
    .trim();
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as unknown as WindowWithSpeechRecognition;
  return win.SpeechRecognition || win.webkitSpeechRecognition;
}

/** Hook for speech-to-text using Browser Web Speech API */
export function useSpeechToText({
  onTranscript,
  onAutoSubmit,
}: {
  onTranscript?: (text: string) => void;
  onAutoSubmit?: (text: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en-IN");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isActiveRef = useRef<boolean>(false);
  const isSupported = typeof window !== "undefined" && Boolean(getSpeechRecognitionConstructor());

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
    setTranscript("");
  }, []);

  const startListening = useCallback(
    (langOverride?: string) => {
      const SpeechRecognition = getSpeechRecognitionConstructor();
      if (!isSupported || !SpeechRecognition) {
        toast.error("Voice input is not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langOverride || selectedLanguage;

      let finalSoFar = "";

      recognition.onstart = () => {
        isActiveRef.current = true;
        setIsListening(true);
        setTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!isActiveRef.current) return;
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          if (res.isFinal) {
            finalSoFar += res[0].transcript + " ";
          } else {
            interim += res[0].transcript;
          }
        }
        const full = (finalSoFar + interim).trim();
        if (!isActiveRef.current) return;
        setTranscript(full);
        onTranscript?.(full);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== "aborted") {
          console.warn("[Voice] recognition error", event.error);
        }
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. Please allow microphone permissions.");
        }
        isActiveRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        isActiveRef.current = false;
        setIsListening(false);
      };

      try {
        isActiveRef.current = true;
        recognition.start();
      } catch (e) {
        console.error("[Voice] start failed", e);
        isActiveRef.current = false;
        setIsListening(false);
      }
    },
    [isSupported, selectedLanguage, onTranscript],
  );

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    selectedLanguage,
    setSelectedLanguage,
    startListening,
    stopListening,
    resetTranscript,
    toggleListening,
  };
}

/** Hook for text-to-speech */
export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nexus_ai_voice_autoplay") === "true";
  });

  const toggleAutoPlay = () => {
    setAutoPlay((prev) => {
      const next = !prev;
      localStorage.setItem("nexus_ai_voice_autoplay", String(next));
      return next;
    });
  };

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setCurrentSpeakingId(null);
  }, []);

  const speak = useCallback(
    (text: string, messageId?: string, lang = "en-IN") => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        toast.error("Text to speech is not supported in this browser.");
        return;
      }

      stop();
      const clean = cleanTextForSpeech(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select natural voice matching language if available
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find((v) => v.lang.startsWith(lang.slice(0, 2)) || v.lang === lang);
      if (matched) utterance.voice = matched;

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (messageId) setCurrentSpeakingId(messageId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    currentSpeakingId,
    autoPlay,
    toggleAutoPlay,
    speak,
    stop,
  };
}
