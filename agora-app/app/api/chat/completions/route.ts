import { NextRequest, NextResponse } from 'next/server';
import { jsonSchema, streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';
import { checkEscalation, getCase, updateCaseField } from '@/lib/caseStore';
import { createTicket } from '@/lib/ticketStore';
import { CaseFieldKey } from '@/types/case';
import { extractSpokenDigits, normalizePhoneNumber } from '@/lib/phoneUtils';

type ChatBody = {
  messages?: Array<{ role: string; content: unknown }>;
  model?: string;
  stream?: boolean;
  user?: string;
  session_id?: string;
  channel_name?: string;
  channel?: string;
  [key: string]: unknown;
};

type ChatCompletionsDeps = {
  createOpenAIClient: typeof createOpenAI;
  streamTextImpl: typeof streamText;
};

/**
 * OpenAI-compatible Chat Completions endpoint backed by Vercel AI SDK.
 *
 * Agora's Conversational AI Engine calls this as its "custom LLM" — sending
 * standard OpenAI chat completion requests and expecting OpenAI SSE chunks back.
 *
 * Tool calling for EchoCare:
 * - update_case_field(field, value, confidence)
 * - create_ticket(summary)
 */
export function createChatCompletionsHandler({
  createOpenAIClient,
  streamTextImpl,
}: ChatCompletionsDeps) {
  return async function POST(request: NextRequest) {
    // ── Config ────────────────────────────────────────────────────────────────
    const apiKey = process.env.NEXT_LLM_API_KEY;
    const llmUrl = process.env.NEXT_LLM_URL;
    // Model is pinned here — change this to switch models without other config changes.
    // Never use body.model; that would allow callers to route to arbitrary models.
    const modelId = 'gpt-4o';

    if (!apiKey || !llmUrl) {
      return NextResponse.json(
        { error: 'NEXT_LLM_API_KEY and NEXT_LLM_URL must be set' },
        { status: 500 },
      );
    }

    // @ai-sdk/openai needs a base URL, not the full /chat/completions path
    const baseURL = llmUrl.replace(/\/chat\/completions\/?$/, '');

    let body: ChatBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const openai = createOpenAIClient({ apiKey, baseURL });

    const sessionId =
      (typeof body.session_id === 'string' && body.session_id) ||
      (typeof body.channel_name === 'string' && body.channel_name) ||
      (typeof body.channel === 'string' && body.channel) ||
      (typeof body.user === 'string' && body.user) ||
      request.headers.get('x-session-id') ||
      request.headers.get('x-channel-name') ||
      'default-session';

    const currentCase = getCase(sessionId);
    const escalation = checkEscalation(sessionId);

    const caseStateSummary = `You are the intake assistant for EchoCare municipal helpline.

[CURRENT CASE STATE (In-Memory Store)]:
- category: "${currentCase.category.value || '(not provided)'}" [status: ${currentCase.category.status}, reaskCount: ${currentCase.category.reaskCount}]
- location: "${currentCase.location.value || '(not provided)'}" [status: ${currentCase.location.status}, reaskCount: ${currentCase.location.reaskCount}]
- description: "${currentCase.description.value || '(not provided)'}" [status: ${currentCase.description.status}, reaskCount: ${currentCase.description.reaskCount}]
- contactNumber: "${currentCase.contactNumber.value || '(not provided)'}" [status: ${currentCase.contactNumber.status}, reaskCount: ${currentCase.contactNumber.reaskCount}]
- contradictionDetected: ${currentCase.contradictionDetected ? 'YES' : 'NO'}
- escalated: ${escalation.shouldEscalate ? `YES (${escalation.reason})` : 'NO'}

CRITICAL RULES:
1. FEMALE VOICE PERSONA & HINDI GRAMMATICAL GENDER AGREEMENT:
   - You are speaking as a female voice assistant (voice: hindi_female_2_v1).
   - All Hindi self-referential verb forms must use feminine conjugation — करूंगी (not करूंगा), दूंगी (not दूंगा), समझ गयी (not समझ गया), समझ सकती हूँ (not समझ सकता हूँ), लूंगी (not लूंगा), बताऊंगी (not बताऊंगा), जोड़ रही हूँ (not जोड़ रहा हूँ), आदि।
   - Never use masculine verb endings when referring to yourself.
   - Examples: Say "मैं समझ सकती हूँ" (NOT "मैं समझ सकता हूँ"), "मैं जोड़ रही हूँ" (NOT "मैं जोड़ रहा हूँ"), "मैं दर्ज करूंगी" (NOT "मैं दर्ज करूंगा").
2. STRICT LANGUAGE MIRRORING:
   - If the caller speaks Hindi, respond in PURE HINDI in DEVANAGARI script. Never use Romanized Hindi / Hinglish.
   - If the caller speaks English, respond in PURE ENGLISH.
   - If the caller switches languages mid-conversation, switch immediately on your next response.
   - NEVER mix Hindi and English in the same reply (no code-switching in agent speech).
3. SPOKEN DIGIT EXTRACTION & CONTACT NUMBER VALIDATION:
   - Callers often speak phone numbers as words (e.g. "nine eight seven six five four three two one zero" or "नौ आठ सात छह पाँच चार तीन दो एक शून्य").
   - Always convert spoken number words into numeric digits (9876543210) before calling update_case_field.
   - An Indian contact number must have exactly 10 digits. If a number does not have exactly 10 digits, its confidence is capped at 0.3, it is marked rejected, and it increments reaskCount.
4. NEVER re-ask for any field that already has a value in [CURRENT CASE STATE]. If caller already described the problem earlier, DESCRIPTION IS RECORDED. Never ask for it again.
5. CATEGORY & FIELD ROUTING SAFETY: Never confuse a grievance description (e.g. garbage, smell, sewage, road, water) with a location. Do NOT overwrite a confirmed location with issue descriptions.
6. Every time the caller rejects a confirmation (e.g. says "no", "that's not correct", "incorrect"), you MUST call update_case_field with confirmationRejected: true, even if you don't have a new value yet.
7. ESCALATION & HARD CAP:
   - When checkEscalation is true or escalated is YES, you MUST immediately acknowledge it, deliver the calm handoff line ("connecting you to a municipal officer" / "मैं आपकी कॉल तुरंत हमारे नगर पालिका अधिकारी से जोड़ रही हूँ"), and call create_ticket with a summary.
   - HARD SAFETY NET: If the caller fails validation or rejects contact number 3 times, escalate immediately without asking again.
8. STRICT POST-ESCALATION HOLDING INVARIANT: Once escalation has been announced, you must NEVER answer any further questions or give any new information (such as resolution timelines or estimates) to anything further the caller says. Respond ONLY with the short holding line: "Please hold, an officer will assist you shortly." (or in Hindi: "कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।") to anything the caller says afterward, no matter what they ask.
9. NEVER call update_case_field with a bare confirmation word like 'yes', 'no', 'haan', 'sahi hai' as the value itself — these are answers to your own confirmation questions, not new field data. When the caller confirms a previously stated value, do NOT overwrite the field value. When the caller rejects, call update_case_field with confirmationRejected: true.`;

    const tools = {
      update_case_field: tool({
        description:
          'Update a field in the municipal civic grievance case state. Call this whenever the citizen provides or clarifies any detail OR rejects a confirmation. NEVER pass bare confirmation words like "yes", "no", "haan", "sahi hai" as value.',
        inputSchema: jsonSchema<{
          field: string;
          value?: string;
          confidence?: number;
          confirmationRejected?: boolean;
        }>({
          type: 'object',
          properties: {
            field: {
              type: 'string',
              enum: ['category', 'location', 'description', 'contactNumber'],
              description:
                'The field to update: category, location, description, or contactNumber',
            },
            value: {
              type: 'string',
              description:
                'The extracted actual value for the field (e.g. street address or phone number). NEVER pass bare confirmation words like "yes", "no", "haan", "sahi hai" here.',
            },
            confidence: {
              type: 'number',
              description:
                'Confidence score between 0.0 and 1.0 based on clarity and certainty',
            },
            confirmationRejected: {
              type: 'boolean',
              description:
                'Set to true if the caller rejected a confirmation (e.g. said "no", "incorrect", "wrong number/location")',
            },
          },
          required: ['field'],
        }),
        execute: async ({
          field,
          value,
          confidence,
          confirmationRejected,
        }: {
          field: string;
          value?: string;
          confidence?: number;
          confirmationRejected?: boolean;
        }) => {
          try {
            console.log(`\n================== [TOOL_CALL: update_case_field] ==================`);
            console.log(`[PHONE_DEBUG][LLM_TOOL_RECEIVED] field: "${field}"`);
            console.log(`[PHONE_DEBUG][LLM_TOOL_RECEIVED] EXACT raw value: ${JSON.stringify(value)} (type: ${typeof value})`);
            console.log(`[PHONE_DEBUG][LLM_TOOL_RECEIVED] confidence: ${confidence}`);
            console.log(`[PHONE_DEBUG][LLM_TOOL_RECEIVED] confirmationRejected: ${confirmationRejected}`);

            if (field === 'contactNumber' && value !== undefined) {
              const spoken = extractSpokenDigits(value);
              const norm = normalizePhoneNumber(value);
              console.log(`[PHONE_DEBUG][LLM_TOOL_VALIDATION] Breakdown:`, {
                rawStringReceived: value,
                extractSpokenDigitsOutput: spoken,
                normalizePhoneNumberDigits: norm.digits,
                resultingDigitCount: norm.digits.length,
                isValid10: norm.isValid10,
              });
            }
            console.log(`====================================================================\n`);

            const updatedCase = updateCaseField(
              sessionId,
              field as CaseFieldKey,
              value,
              confidence,
              confirmationRejected,
            );
            const esc = checkEscalation(sessionId);
            return {
              success: true,
              field,
              reaskCount: updatedCase[field as CaseFieldKey].reaskCount,
              shouldEscalate: esc.shouldEscalate,
              escalationReason: esc.reason,
            };
          } catch (err) {
            console.error('[tool:update_case_field] Error executing tool:', err);
            return { success: false, error: 'Internal tool error' };
          }
        },
      }),
      create_ticket: tool({
        description:
          'Create and record an official municipal civic grievance ticket snapshot.',
        inputSchema: jsonSchema<{
          summary: string;
        }>({
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description:
                'A concise summary of the civic grievance, citizen contact, location, and issue',
            },
          },
          required: ['summary'],
        }),
        execute: async ({ summary }: { summary: string }) => {
          try {
            const ticket = createTicket(sessionId, summary);
            return { success: true, ticketId: ticket.ticketId };
          } catch (err) {
            console.error('[tool:create_ticket] Error executing tool:', err);
            return { success: false, error: 'Internal tool error' };
          }
        },
      }),
    };

    const result = streamTextImpl({
      // modelId is always sourced from the environment — body.model is ignored
      model: openai(modelId),
      system: caseStateSummary,
      messages: (body.messages ?? []) as NonNullable<
        Parameters<typeof streamText>[0]['messages']
      >,
      tools,
    });

    const encoder = new TextEncoder();
    const id = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = body.model ?? modelId;

    const sseChunk = (
      delta: Record<string, unknown>,
      finishReason: string | null = null,
    ) =>
      encoder.encode(
        `data: ${JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{ index: 0, delta, finish_reason: finishReason }],
        })}\n\n`,
      );

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Role-only first chunk (OpenAI convention)
          controller.enqueue(sseChunk({ role: 'assistant', content: '' }));

          const fullStream = (
            result as unknown as {
              fullStream?: AsyncIterable<{ type: string; text?: string }>;
            }
          ).fullStream;

          if (
            fullStream &&
            typeof fullStream[Symbol.asyncIterator] === 'function'
          ) {
            for await (const part of fullStream) {
              if (part.type === 'text-delta' && typeof part.text === 'string') {
                controller.enqueue(sseChunk({ content: part.text }));
              }
            }
          } else if (result.textStream) {
            for await (const chunk of result.textStream) {
              controller.enqueue(sseChunk({ content: chunk }));
            }
          }

          controller.enqueue(sseChunk({}, 'stop'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('[custom-llm] Stream error:', err);
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  };
}

export const POST = createChatCompletionsHandler({
  createOpenAIClient: createOpenAI,
  streamTextImpl: streamText,
});
