export interface AudioChunk {
  payload: string; // base64 mulaw
}

export interface VoiceProviderCallbacks {
  onAudio: (chunk: AudioChunk) => void;
  onTranscript: (role: "user" | "agent", text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onError: (err: Error) => void;
  onBargeIn: () => void;
}

export interface VoiceSession {
  sendAudio: (base64Mulaw: string) => void;
  close: () => void;
}

export interface VoiceProvider {
  readonly name: string;
  openSession(
    callSid: string,
    systemPrompt: string,
    tools: ToolDeclaration[],
    callbacks: VoiceProviderCallbacks
  ): Promise<VoiceSession>;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}
