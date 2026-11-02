// Sarvam Voice Agent (Samvaad) real-time voice-to-voice client for browser
import {
  ConversationAgent,
  BrowserAudioInterface,
  InteractionType,
} from "sarvam-conv-ai-sdk/browser";

export interface SarvamVoiceConfig {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  appId: string;
  version?: string;
  userName?: string;
}

export type SarvamAgentCallState =
  | "IDLE"
  | "CONNECTING"
  | "CONNECTED"
  | "LISTENING"
  | "SPEAKING"
  | "ERROR"
  | "DISCONNECTED";

export interface SarvamTranscriptMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

export const DEFAULT_SARVAM_CONFIG: SarvamVoiceConfig = {
  apiKey:
    (import.meta.env["VITE_SARVAM_API_KEY"] as string | undefined) ||
    "sk_samvaad_l3odipe4_MADvuVrxV6XZCxzLqoLgadgG",
  orgId:
    (import.meta.env["VITE_SARVAM_ORG_ID"] as string | undefined) ||
    "019ea821-f3c9-7da2-b0d0-9e4d86acb9ff",
  workspaceId:
    (import.meta.env["VITE_SARVAM_WORKSPACE_ID"] as string | undefined) ||
    "019ea821-f3cf-75f7-a0ab-ee99f8573815",
  appId:
    (import.meta.env["VITE_SARVAM_APP_ID"] as string | undefined) ||
    "Conversatio-dae05367-3a4f",
  version: "1",
};

export class SarvamVoiceCallSession {
  private agent: ConversationAgent | null = null;
  private audioInterface: BrowserAudioInterface | null = null;
  private config: SarvamVoiceConfig;
  private onStateChange: (state: SarvamAgentCallState) => void;
  private onTranscript: (msg: SarvamTranscriptMessage) => void;
  private onAudioLevel: (level: number) => void;

  constructor({
    config = DEFAULT_SARVAM_CONFIG,
    onStateChange,
    onTranscript,
    onAudioLevel,
  }: {
    config?: Partial<SarvamVoiceConfig>;
    onStateChange?: (state: SarvamAgentCallState) => void;
    onTranscript?: (msg: SarvamTranscriptMessage) => void;
    onAudioLevel?: (level: number) => void;
  }) {
    this.config = { ...DEFAULT_SARVAM_CONFIG, ...config };
    this.onStateChange = onStateChange || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onAudioLevel = onAudioLevel || (() => {});
  }

  async startCall(): Promise<void> {
    try {
      this.onStateChange("CONNECTING");

      this.audioInterface = new BrowserAudioInterface(16000, {
        outputLevelCallback: (level) => {
          this.onAudioLevel(level.rms || 0);
        },
      });

      this.agent = new ConversationAgent({
        apiKey: this.config.apiKey,
        config: {
          org_id: this.config.orgId,
          workspace_id: this.config.workspaceId,
          app_id: this.config.appId,
          user_identifier: this.config.userName || "nexus_user",
          user_identifier_type: "custom",
          interaction_type: InteractionType.CALL,
          input_sample_rate: 16000,
          output_sample_rate: 16000,
          version: 1,
          agent_variables: {
            user_name: this.config.userName || "Team Member",
          },
        },
        audioInterface: this.audioInterface,
        transcriptCallback: async (msg: any) => {
          const role = msg.role === "bot" ? "bot" : "user";
          const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2) + Date.now().toString(36);
          this.onTranscript({
            id,
            role,
            content: msg.content || "",
            timestamp: new Date(),
          });
        },
        stateCallback: (state: any) => {
          const s = String(state).toUpperCase();
          if (s.includes("SPEAK")) {
            this.onStateChange("SPEAKING");
          } else if (s.includes("LISTEN")) {
            this.onStateChange("LISTENING");
          } else if (s.includes("CONNECT") && !s.includes("DIS")) {
            this.onStateChange("CONNECTED");
          } else if (s.includes("ERROR")) {
            this.onStateChange("ERROR");
          } else if (s.includes("DISCONNECT") || s.includes("IDLE")) {
            this.onStateChange("DISCONNECTED");
          }
        },
        endCallback: async () => {
          this.onStateChange("DISCONNECTED");
        },
      });

      await this.agent.start();
      await this.agent.waitForConnect(12);
      this.onStateChange("CONNECTED");
    } catch (err) {
      console.error("[Sarvam Agent] connection failed", err);
      this.onStateChange("ERROR");
      throw err;
    }
  }

  async endCall(): Promise<void> {
    try {
      if (this.agent) {
        await this.agent.stop();
      }
    } catch (e) {
      console.warn("[Sarvam Agent] stop error", e);
    } finally {
      this.onStateChange("DISCONNECTED");
      this.agent = null;
      this.audioInterface = null;
    }
  }
}
