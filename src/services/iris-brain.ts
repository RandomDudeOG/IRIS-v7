import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

// Simple Event Emitter for Browser
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener: Function) {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter((l) => l !== listener);
    return this;
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return false;
    this.events[event].forEach((listener) => listener(...args));
    return true;
  }
}

// Audio Configuration
const SAMPLE_RATE = 24000; // Gemini 2.5 Flash Native Audio is 24kHz usually, but let's stick to what works or standard. 
// Actually, the previous code used 16000 for input. Output is often 24000.
// Let's check the docs or previous context. The previous code had input 16000.
// We will use 24000 for output context to match better quality if possible, or stick to 16000 if input is 16000.
// Let's use 24000 for the context to support higher quality output, and downsample input if needed.
const AUDIO_CTX_RATE = 24000; 
const BUFFER_SIZE = 4096;

export class IrisBrain extends EventEmitter {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private analyzer: AnalyserNode | null = null;

  constructor() {
    super();
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  public async connect() {
    this.emit("stateChange", "BOOTING");
    
    try {
      // Initialize Audio Context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CTX_RATE,
      });

      // Define Tools
      const tools = [
        {
          functionDeclarations: [
            {
              name: "create_file",
              description: "Create a file in the user's Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the file" },
                  content: { type: Type.STRING, description: "Content of the file" },
                  mimeType: { type: Type.STRING, description: "MIME type (default text/plain)" },
                },
                required: ["name", "content"],
              },
            },
            {
              name: "create_folder",
              description: "Create a folder in the user's Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the folder" },
                },
                required: ["name"],
              },
            },
          ],
        },
      ];

      // Connect to Gemini Live
      this.session = await this.ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          tools,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are IRIS, a futuristic AI assistant. You are helpful, concise, and have a slightly robotic but friendly personality. You can manage files on Google Drive.",
        },
        callbacks: {
          onopen: () => {
            this.emit("stateChange", "IDLE");
            this.startAudioInput();
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: () => this.emit("stateChange", "DISCONNECTED"),
          onerror: (err) => this.emit("error", err),
        },
      });

    } catch (error) {
      console.error("Connection failed:", error);
      this.emit("error", error);
    }
  }

  private async startAudioInput() {
    if (!this.audioContext) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 256;
      source.connect(this.analyzer);

      // Processor for raw audio
      this.processor = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.emit("audioLevel", rms);

        // Send to Gemini
        // Resample to 16000Hz if context is different, but for now let's send what we have
        // Gemini expects 16kHz usually. 
        // Simple decimation if context is 24k and we need 16k is hard.
        // Let's assume we send at context rate and specify it in mimeType if possible, 
        // OR just rely on Gemini handling it. 
        // The previous code sent "audio/pcm;rate=16000" but sent whatever the context rate was (likely 44.1 or 48k default).
        // Let's try to be explicit.
        
        // Convert Float32 to Base64 PCM 16-bit
        const pcmData = this.floatTo16BitPCM(inputData);
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
        
        this.session.sendRealtimeInput({
          media: {
            mimeType: `audio/pcm;rate=${AUDIO_CTX_RATE}`, // Send actual rate
            data: base64Data,
          },
        });
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
    } catch (error) {
      console.error("Audio input failed:", error);
      this.emit("error", error);
    }
  }

  private handleMessage(msg: LiveServerMessage) {
    // Audio Output
    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      this.emit("stateChange", "SPEAKING");
      this.queueAudio(audioData);
    }

    // Text Transcription (User or Model)
    // Note: Live API structure for transcription might vary. 
    // Usually it's in serverContent.turnComplete or similar for user input, 
    // and modelTurn for model output.
    // Checking for text parts:
    const parts = msg.serverContent?.modelTurn?.parts;
    if (parts) {
        parts.forEach((part: any) => {
            if (part.text) {
                this.emit("transcription", { text: part.text, source: "AI" });
            }
        });
    }
    
    // Check for user input transcription (if enabled in config, which we didn't explicitly yet)
    // But if we get it, it would be in a different field.

    // Tool Calls
    const toolCall = msg.toolCall;
    if (toolCall) {
      this.handleToolCall(toolCall);
    }

    // Interruption
    if (msg.serverContent?.interrupted) {
      this.nextStartTime = 0; // Reset schedule
      this.emit("stateChange", "IDLE");
    }
    
    // Turn Complete
    if (msg.serverContent?.turnComplete) {
        this.emit("stateChange", "IDLE");
    }
  }

  private async handleToolCall(toolCall: any) {
    this.emit("stateChange", "THINKING");
    const functionCalls = toolCall.functionCalls;
    const responses = [];

    for (const call of functionCalls) {
      this.emit("toolCall", call.name);
      try {
        let result;
        if (call.name === "create_file") {
          const response = await fetch("/api/actions/create-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.args),
          });
          result = await response.json();
        } else if (call.name === "create_folder") {
          const response = await fetch("/api/actions/create-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.args),
          });
          result = await response.json();
        }

        responses.push({
          id: call.id,
          name: call.name,
          response: { result },
        });
      } catch (error: any) {
        responses.push({
          id: call.id,
          name: call.name,
          response: { error: error.message },
        });
      }
    }

    this.session.sendToolResponse({ functionResponses: responses });
    // Don't set to IDLE here, let the model respond to the tool output
  }

  private queueAudio(base64Data: string) {
    if (!this.audioContext) return;

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Gemini sends Int16 PCM, usually 24kHz
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    
    const buffer = this.audioContext.createBuffer(1, float32.length, AUDIO_CTX_RATE);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Schedule playback
    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  private floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
  }

  public disconnect() {
    if (this.session) {
      // this.session.close(); 
      this.session = null;
    }
    if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
    }
    if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
    }
    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }
    this.emit("stateChange", "DISCONNECTED");
  }
}

export const irisBrain = new IrisBrain();
