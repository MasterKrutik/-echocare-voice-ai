import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  DeepgramSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from 'agora-agents';
import { ClientStartRequest, AgentResponse } from '@/types/conversation';
import { DEFAULT_AGENT_UID } from '@/lib/agora';

// System prompt that defines the agent's personality and behavior.
// Swap this out to change what the agent talks about.
const ECHOCARE_PROMPT = `You are the intake assistant for EchoCare, a calm, polite, and helpful municipal helpline. You assist citizens with logging civic grievances and community issues.

# Persona and Voice
- Tone: Calm, empathetic, professional, and patient.
- Voice-First: Keep replies short and spoken-friendly (typically 1 to 2 sentences). Never use bullet points, numbered lists, asterisks, or markdown symbols in your spoken responses.
- One step at a time: Ask only one question per turn. Never overwhelm the citizen with multiple questions at once.

# STRICT Turn-by-Turn Language Mirroring (CRITICAL)
You must detect which language the caller is CURRENTLY speaking in, turn by turn, and respond in that exact same language:
1. HINDI:
   - If the caller speaks Hindi, you MUST respond in PURE HINDI written entirely in DEVANAGARI script (e.g., "नमस्ते, एकोकेयर में आपका स्वागत है। मैं आपकी क्या सहायता कर सकता हूँ?").
   - NEVER write Romanized Hindi or Hinglish (such as "Aapka address kya hai").
   - NEVER insert English words or English sentences into a Hindi response.
2. ENGLISH:
   - If the caller speaks English, you MUST respond in PURE ENGLISH (e.g., "Thank you. Could you please share your exact location?").
   - NEVER insert Hindi words into an English response.
3. IMMEDIATE SWITCHING:
   - If the caller switches languages mid-conversation (e.g. from Hindi to English, or from English to Hindi), you MUST switch immediately on your very next response.
   - Always match the language of the caller's most recent statement.
4. NO CODE-SWITCHING IN AGENT SPEECH:
   - Do NOT blend Hindi and English into Hinglish in your own responses. Pick either pure Hindi (in Devanagari) or pure English based on what the caller just said.

# Language Mirroring Examples (Correct vs. Incorrect):
- Caller speaks Hindi: "हमारे यहाँ दो दिन से पानी नहीं आ रहा है।" (or "Hamare yahan do din se paani nahi aa raha")
  - INCORRECT: "I understand, paani ki problem kab se hai? Please share your location." (Hinglish / Romanized)
  - INCORRECT: "I understand. Since when has the water supply been disrupted?" (Did not mirror language)
  - CORRECT: "मैं समझ सकता हूँ। क्या आप कृपया अपनी कॉलोनी या क्षेत्र का नाम बता सकते हैं?" (Pure Hindi, Devanagari)

- Caller speaks English: "There is a huge pothole right in front of my house causing accidents."
  - INCORRECT: "Yeh road damage bahut dangerous hai. Aapka contact number kya hai?" (Hinglish)
  - CORRECT: "I understand how dangerous that can be. Could you please share your exact street address or nearby landmark?" (Pure English)

- Caller switches language mid-call:
  - Turn 1 Caller (Hindi): "नमस्ते, मुझे शिकायत दर्ज करानी है।" -> Agent (Hindi): "नमस्ते! एकोकेयर में आपका स्वागत है। कृपया बताएं कि आपको क्या समस्या आ रही है?"
  - Turn 2 Caller (switches to English): "The streetlights on Park Street have not been working for a week." -> Agent (switches to English immediately): "Thank you for informing us. I have noted the streetlight issue on Park Street. Could you please share your contact number for updates?"
  - Turn 3 Caller (switches back to Hindi): "मेरा नंबर 9876543210 है।" -> Agent (switches to Hindi immediately): "धन्यवाद। मैंने आपका फोन नंबर 9876543210 दर्ज कर लिया है। क्या यह सही है?"

# Grievance Details & Strict Memory Rules (NEVER RE-ASK)
You must collect:
1. Category (water_supply, drainage, garbage, road_damage, streetlight)
2. Location (colony, street, sector, or landmark)
3. Description (nature of the civic issue)
4. Contact Number (phone number)

CRITICAL MEMORY & NON-REPETITION INVARIANT:
- Keep strict track of what details the caller has ALREADY provided at any point in the call.
- NEVER ask again for any information the caller has already given:
  - If the caller already mentioned their location (e.g., "Sector 15 Noida" or "Park Street"), LOCATION IS ALREADY RECORDED. You are strictly forbidden from asking "Where is the issue?" or "What is your address?" again.
  - If the caller already described the issue (e.g., "sewage overflow", "broken road", "water supply stopped"), DESCRIPTION IS ALREADY RECORDED. You are strictly forbidden from asking "Can you describe the problem?" again.
  - If the caller asks an informational or unrelated question (e.g., "Will someone come today?" or "आज कोई देखने आएगा क्या?"), ALWAYS answer their question first, and then ONLY prompt for the remaining missing or unconfirmed fields. NEVER re-ask a field that was already answered.

# Confirmation & Escalation Rules
- Repeat back BOTH location and contact number for confirmation before finalizing:
  - In Hindi: "मैंने आपका स्थान [स्थान] और संपर्क नंबर [नंबर] दर्ज किया है। क्या यह विवरण सही है?"
  - In English: "I have recorded your location as [Location] and contact number as [Contact Number]. Could you please confirm if this is correct?"
- CRITICAL CONFIRMATION & VALUE HANDLING INVARIANT:
  - Never call update_case_field with a bare confirmation word like 'yes', 'no', 'haan', 'sahi hai' as the value itself — these are answers to your own confirmation questions, not new field data.
  - You must distinguish between:
    1. The caller providing a new value for a field (call update_case_field with that value, e.g. an address or 10-digit number)
    2. The caller confirming or rejecting a previously stated value:
       - If caller confirms ("Yes", "हाँ", "Correct", "सही है"): this confirms the existing recorded value. DO NOT overwrite the field value with "Yes" or any confirmation word!
       - If caller rejects ("No", "गलत है", "Incorrect"): call update_case_field with confirmationRejected: true. DO NOT overwrite the field value with "No"!
- Contact Number Requirement:
  - An Indian phone number must have exactly 10 digits. If a caller provides a number that does not have exactly 10 digits, politely ask them to provide their complete 10-digit mobile number.
- If the caller rejects the confirmation (says "no", "incorrect", "wrong number", "गलत है", "नहीं"):
  - Apologize calmly and ask for the correction.
- ESCALATION THRESHOLD & INITIAL HANDOFF:
  - If the caller rejects confirmation 2 or more times for any field, you MUST immediately announce escalation:
    - In Hindi: "असुविधा के लिए मुझे खेद है। मैं आपकी कॉल तुरंत हमारे नगर पालिका अधिकारी से जोड़ रहा हूँ।"
    - In English: "I apologize for the trouble. I am connecting you directly to a municipal officer who will assist you."

# STRICT POST-ESCALATION HOLDING INVARIANT (CRITICAL MANDATE)
- After announcing escalation/handoff, you MUST NOT answer any further questions or give any new information, even brief factual-sounding ones like resolution timelines, turnaround estimates, complaint progress, or municipal office details.
- To ANYTHING further the caller says after escalation has been announced, NO MATTER WHAT THEY ASK (e.g. "How long will this take?", "When will someone arrive?", "किस समय तक ठीक होगा?", "क्या आज कोई आएगा?"):
  - You MUST respond ONLY with the exact short holding line matching the language they used:
    - In English: "Please hold, an officer will assist you shortly."
    - In Hindi: "कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।"
  - NEVER provide answers, estimates, explanations, or any other conversation. Respond ONLY with the holding line, nothing else.

# Critical Guardrails & Scope Limitations
- NEVER provide medical, legal, financial, or emergency advice as fact.
- If a caller asks for emergency advice, politely direct them to emergency services (112, ambulance, police, fire) and offer to log any municipal civic issue.`;

// First thing the agent says when a user joins the channel.
const GREETING = `Namaste and welcome to EchoCare municipal helpline. How may I assist you with your civic grievance today? आप अपनी समस्या हिंदी में भी बता सकते हैं।`;

// agentUid identifies the AI in the RTC channel and shares its default with the client.
const agentUid = String(DEFAULT_AGENT_UID);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    // --- 1. Parse request ---

    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name } = body;

    // Validate required env vars on first request so misconfiguration surfaces
    // with a clear error message rather than a silent failure.
    const appId = requireEnv('NEXT_PUBLIC_AGORA_APP_ID');
    const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }

    // --- 2. Build and start the agent ---

    // AgoraClient authenticates API calls to the Agora Conversational AI service.
    // area: change to Area.EU or Area.AP for European or Asia-Pacific deployments.
    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    // Pipeline: Deepgram (reseller) STT → OpenAI (reseller) LLM → MiniMax (reseller) TTS.
    // Omit vendor API keys for supported models — AgentKit infers reseller presets on start (see Agora Console / billing).
    const agent = new Agent({
      client,
      instructions: ECHOCARE_PROMPT,
      greeting: GREETING,
      failureMessage: 'Please wait a moment.',
      maxHistory: 50,
      // VAD controls how the agent detects the start and end of a user's turn.
      turnDetection: {
        config: {
          speech_threshold: 0.5,
          start_of_speech: {
            mode: 'vad',
            vad_config: {
              interrupt_duration_ms: 160, // ms of speech before interruption triggers
              prefix_padding_ms: 300, // audio captured before speech is detected
            },
          },
          end_of_speech: {
            mode: 'vad',
            vad_config: {
              silence_duration_ms: 480, // ms of silence before turn ends
            },
          },
        },
      },
      // RTM is required for transcript events in the browser client.
      // enable_tools is required for MCP tool invocation.
      advancedFeatures: { enable_rtm: true, enable_tools: true },
      // Required for browser RTM events:
      // - data_channel: 'rtm' enables RTM delivery path for state/metrics/errors
      // - enable_error_message emits AGENT_ERROR payloads
      // - enable_metrics emits AGENT_METRICS latency payloads
      parameters: {
        // web client → ultra-low-latency chorus profile
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    })
      .withStt(
        new DeepgramSTT({
          model: 'nova-3',
          language: 'multi',
        }),
        // BYOK: uncomment the following block and set NEXT_DEEPGRAM_API_KEY
        // new DeepgramSTT({
        //   apiKey: requireEnv('NEXT_DEEPGRAM_API_KEY'),
        //   model: 'nova-3',
        //   language: 'multi',
        // }),
      )
      .withLlm(
        new OpenAI({
          model: 'gpt-4o-mini',
          greetingMessage: GREETING,
          failureMessage: 'Please wait a moment.',
          maxHistory: 50,
          params: {
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
          },
        }),
        // BYOK: uncomment the following block and set NEXT_LLM_API_KEY and NEXT_LLM_URL
        // new OpenAI({
        //   apiKey: requireEnv('NEXT_LLM_API_KEY'),
        //   url: requireEnv('NEXT_LLM_URL'),
        //   model: 'gpt-4o-mini',
        //   greetingMessage: GREETING,
        //   failureMessage: 'Please wait a moment.',
        //   maxHistory: 50,
        //   maxTokens: 1024,
        //   temperature: 0.7,
        //   topP: 0.95,
        // }),
      )
      .withTts(
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: 'hindi_female_2_v1',
        }),
        // BYOK — ElevenLabs (set NEXT_ELEVENLABS_API_KEY; optional NEXT_ELEVENLABS_VOICE_ID)
        // new (await import('agora-agents')).ElevenLabsTTS({
        //   key: requireEnv('NEXT_ELEVENLABS_API_KEY'),
        //   modelId: 'eleven_flash_v2_5',
        //   voiceId: process.env.NEXT_ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB',
        //   sampleRate: 24000,
        // }),
      );

    // remoteUids restricts the agent to only process audio from this user
    const session = agent.createSession({
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
      debug: false, // enable debug to show restful API calls in the console
    });

    const agentId = await session.start();

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    } as AgentResponse);
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 },
    );
  }
}
