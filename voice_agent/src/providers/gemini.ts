import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, FunctionResponseScheduling } from "@google/genai";
import { config } from "../config";
import { VoiceProvider, VoiceSession, VoiceProviderCallbacks, ToolDeclaration } from "./base";
import { twilioToGemini, geminiToTwilio } from "../utils/audio";

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

function toGeminiFunctionDeclarations(tools: ToolDeclaration[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export class GeminiProvider implements VoiceProvider {
  readonly name = "gemini";

  async openSession(
    callSid: string,
    systemPrompt: string,
    tools: ToolDeclaration[],
    callbacks: VoiceProviderCallbacks
  ): Promise<VoiceSession> {
    let agentTranscriptAccum = "";
    let userTranscriptAccum = "";

    const liveSession = await ai.live.connect({
      model: config.GEMINI_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        temperature: 0.3,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: config.GEMINI_VOICE } },
          languageCode: "en-US",
        },
        tools: tools.length ? [{ functionDeclarations: toGeminiFunctionDeclarations(tools) }] : [],
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: (config.GEMINI_VAD_START_SENSITIVITY as StartSensitivity) ?? StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: (config.GEMINI_VAD_END_SENSITIVITY as EndSensitivity) ?? EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: config.GEMINI_VAD_PREFIX_PADDING_MS ?? 20,
            silenceDurationMs: config.GEMINI_VAD_SILENCE_DURATION_MS ?? 300,
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onmessage: async (msg) => {
          if (msg.data) {
            callbacks.onAudio({ payload: geminiToTwilio(msg.data) });
          }

          const userChunk = msg.serverContent?.inputTranscription?.text;
          if (userChunk) userTranscriptAccum += userChunk;

          const agentChunk = msg.serverContent?.outputTranscription?.text;
          if (agentChunk) agentTranscriptAccum += agentChunk;

          if (msg.serverContent?.interrupted) {
            callbacks.onBargeIn();
            agentTranscriptAccum = "";
          }

          if (msg.serverContent?.turnComplete) {
            if (userTranscriptAccum.trim()) callbacks.onTranscript("user", userTranscriptAccum.trim());
            if (agentTranscriptAccum.trim()) callbacks.onTranscript("agent", agentTranscriptAccum.trim());
            agentTranscriptAccum = "";
            userTranscriptAccum = "";
          }

          if (msg.toolCall?.functionCalls?.length) {
            const responses = [];

            for (const call of msg.toolCall.functionCalls) {
              const { name, args, id } = call;
              const params = (args ?? {}) as Record<string, unknown>;

              let result: unknown;
              try {
                result = await callbacks.onToolCall(name ?? "", params);
              } catch (err) {
                result = { error: String(err) };
              }

              responses.push({
                id: id ?? "",
                name: name ?? "",
                response: { output: result },
                scheduling: FunctionResponseScheduling.WHEN_IDLE,
              });
            }

            liveSession.sendToolResponse({ functionResponses: responses });
          }
        },
        onerror: (err) => callbacks.onError(err instanceof Error ? err : new Error(String(err))),
        onclose: () => console.log(`[${callSid}] Gemini session closed`),
      },
    });

    liveSession.sendRealtimeInput({
      text: "[Call connected. Start the greeting now.]",
    });

    return {
      sendAudio: (base64Mulaw: string) => {
        liveSession.sendRealtimeInput({
          audio: { data: twilioToGemini(base64Mulaw), mimeType: "audio/pcm;rate=16000" },
        });
      },
      close: () => {
        try { liveSession.close(); } catch { /* ignore */ }
      },
    };
  }
}
