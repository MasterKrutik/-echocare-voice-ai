import assert from 'assert';
import { NextRequest } from 'next/server';
import { POST as updateInstructionsHandler } from '../app/api/updateInstructions/route';
import { POST as updateInstructionsAliasHandler } from '../app/api/update-instructions/route';
import { createChatCompletionsHandler } from '../app/api/chat/completions/route';
import {
  registerAgentSession,
  unregisterAgentSession,
  updateAgentInstructions,
  resolveAgentId,
} from '../lib/agentRegistry';
import { POST_ESCALATION_HOLD_PROMPT } from '../lib/prompts';
import { updateCaseField, getCase, resetCaseStore } from '../lib/caseStore';
import { resetTicketStore } from '../lib/ticketStore';

async function runTests() {
  console.log('======================================================');
  console.log('Testing Dynamic Instructions & Post-Escalation Hold Mode');
  console.log('======================================================\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: API Endpoint Shape & Validation (Agora Dynamic Instructions Recipe)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Test 1: Endpoint Shape & Recipe Validation ---');

  // 1a. Missing identifier
  const reqNoId = new NextRequest('http://localhost:3000/api/updateInstructions', {
    method: 'POST',
    body: JSON.stringify({ instructions: 'Some prompt' }),
  });
  const resNoId = await updateInstructionsHandler(reqNoId);
  assert.strictEqual(resNoId.status, 400, 'Should reject missing agentId / channel');
  const jsonNoId = await resNoId.json();
  assert(jsonNoId.error.includes('agentId'), 'Error message should mention agentId');
  console.log('✓ Rejected request missing agentId / channel_name (400)');

  // 1b. Missing instructions
  const reqNoInst = new NextRequest('http://localhost:3000/api/updateInstructions', {
    method: 'POST',
    body: JSON.stringify({ agentId: 'agent-123' }),
  });
  const resNoInst = await updateInstructionsHandler(reqNoInst);
  assert.strictEqual(resNoInst.status, 400, 'Should reject missing instructions');
  console.log('✓ Rejected request missing instructions (400)');

  // 1c. Successfully handles instructions: 'hold' or mode: 'hold'
  const mockAgentId = `test-agent-${Date.now()}`;
  const mockChannel = `test-channel-${Date.now()}`;
  let sessionUpdateCalledWith: any = null;

  const mockSession: any = {
    update: async (config: any) => {
      sessionUpdateCalledWith = config;
    },
  };

  registerAgentSession(mockChannel, mockAgentId, mockSession);
  assert.strictEqual(resolveAgentId(mockChannel), mockAgentId, 'Should resolve agentId from channel');

  const reqHold = new NextRequest('http://localhost:3000/api/updateInstructions', {
    method: 'POST',
    body: JSON.stringify({
      agentId: mockAgentId,
      instructions: 'hold',
    }),
  });
  const resHold = await updateInstructionsHandler(reqHold);
  assert.strictEqual(resHold.status, 200, 'Should return 200 on successful instructions update');
  const jsonHold = await resHold.json();
  assert.strictEqual(jsonHold.success, true);
  assert.strictEqual(jsonHold.method, 'session_sdk');
  assert.strictEqual(jsonHold.agentId, mockAgentId);
  assert(sessionUpdateCalledWith?.llm?.system_messages?.[0]?.content.includes('STRICT HOLD MODE'), 'Must update session with hold prompt');
  console.log('✓ Successfully called session.update SDK method with strict hold persona');

  // 1d. Test alias route /api/update-instructions
  sessionUpdateCalledWith = null;
  const reqAlias = new NextRequest('http://localhost:3000/api/update-instructions', {
    method: 'POST',
    body: JSON.stringify({
      channel_name: mockChannel,
      instructions: POST_ESCALATION_HOLD_PROMPT,
    }),
  });
  const resAlias = await updateInstructionsAliasHandler(reqAlias);
  assert.strictEqual(resAlias.status, 200, 'Alias /api/update-instructions must return 200');
  const jsonAlias = await resAlias.json();
  assert.strictEqual(jsonAlias.success, true);
  assert.strictEqual(jsonAlias.agentId, mockAgentId);
  console.log('✓ Verified alias /api/update-instructions works identically');

  unregisterAgentSession(mockAgentId);
  console.log('✓ Successfully unregistered agent session');

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Trigger Escalation and Ask Several Different Follow-up Questions
  // Confirm EVERY single response is only the holding line in caller language
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Multi-Turn Post-Escalation Strict Hold Invariant ---');

  resetCaseStore();
  resetTicketStore();

  process.env.NEXT_LLM_API_KEY = 'mock-key';
  process.env.NEXT_LLM_URL = 'https://mock.test/v1/chat/completions';

  const sessionId = `test-escalation-hold-${Date.now()}`;

  let capturedSystemPrompt = '';
  let capturedTools: any = null;

  const mockOpenAIClient = () => (modelId: string) => ({
    modelId,
  });

  const mockStreamTextImpl = ((config: any) => {
    capturedSystemPrompt = config.system;
    capturedTools = config.tools;
    const messages = config.messages || [];
    const lastMsg = messages[messages.length - 1];
    const userText = String(lastMsg?.content || '');

    // Strict Hold Persona Behavior:
    // When in hold mode, responds ONLY with the single holding line matching language
    const isHindi = /[\u0900-\u097F]|hindi|kripya|kab|aayega|batao|karenge/i.test(userText);
    const holdLine = isHindi
      ? 'कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।'
      : 'Please hold, an officer will assist you shortly.';

    return {
      textStream: (async function* () {
        yield holdLine;
      })(),
      fullStream: (async function* () {
        yield { type: 'text-delta', text: holdLine };
      })(),
    };
  }) as any;

  const chatHandler = createChatCompletionsHandler({
    createOpenAIClient: mockOpenAIClient as any,
    streamTextImpl: mockStreamTextImpl,
  });

  // Step 1: Initial grievance intake
  updateCaseField(sessionId, 'category', 'water_supply', 0.95);
  updateCaseField(sessionId, 'location', 'Sector 15 Noida', 0.95);
  updateCaseField(sessionId, 'contactNumber', '9876543210', 0.95);

  // Step 2: Confirmation rejected 1st time
  updateCaseField(sessionId, 'contactNumber', undefined, undefined, true);

  // Step 3: Confirmation rejected 2nd time -> Triggers escalation threshold
  updateCaseField(sessionId, 'contactNumber', undefined, undefined, true);

  const cCase = getCase(sessionId);
  assert.strictEqual(cCase.escalated, true, 'Case must be marked escalated after 2 rejections');
  console.log(`✓ Escalation triggered on case '${sessionId}': ${cCase.escalationReason}`);

  // Helper to extract SSE text from Response
  async function readSseText(res: Response): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices?.[0]?.delta?.content) {
              result += data.choices[0].delta.content;
            }
          } catch {}
        }
      }
    }
    return result;
  }

  // Conversation history up to handoff
  const conversationHistory = [
    { role: 'assistant', content: 'Namaste and welcome to EchoCare. How may I assist you today?' },
    { role: 'user', content: 'There is dirty water coming from the tap in Sector 15 Noida.' },
    { role: 'assistant', content: 'I have recorded your location as Sector 15 Noida and contact number as 9876543210. Could you please confirm if this is correct?' },
    { role: 'user', content: 'No, that phone number is wrong.' },
    { role: 'assistant', content: 'I apologize for the trouble. Could you please share your correct number?' },
    { role: 'user', content: 'No, that is completely incorrect again!' },
    { role: 'assistant', content: 'I apologize for the trouble. I am connecting you directly to a municipal officer who will assist you.' },
  ];

  // Now test 5 different follow-up questions in a row
  const followUpQueries = [
    {
      query: 'How long will it take for an officer to call me back?',
      expected: 'Please hold, an officer will assist you shortly.',
      language: 'English',
    },
    {
      query: 'Can I get a reference ticket number right now? Who is working on it?',
      expected: 'Please hold, an officer will assist you shortly.',
      language: 'English',
    },
    {
      query: 'Where is your municipal office located? I can visit directly.',
      expected: 'Please hold, an officer will assist you shortly.',
      language: 'English',
    },
    {
      query: 'क्या आज शाम तक कोई कर्मचारी समस्या देखने आएगा?',
      expected: 'कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।',
      language: 'Hindi',
    },
    {
      query: 'अधिकारी कब तक बात करेंगे? मुझे अभी बात करनी है।',
      expected: 'कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।',
      language: 'Hindi',
    },
  ];

  for (let i = 0; i < followUpQueries.length; i++) {
    const { query, expected, language } = followUpQueries[i];
    console.log(`\nTesting Follow-up #${i + 1} (${language}): "${query}"`);

    conversationHistory.push({ role: 'user', content: query });

    const req = new NextRequest('http://localhost:3000/api/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        messages: conversationHistory,
      }),
    });

    const res = await chatHandler(req);
    assert.strictEqual(res.status, 200, `Turn ${i + 1} should return 200`);

    // Verify system prompt was swapped to strict hold-only persona
    assert(capturedSystemPrompt.includes('STRICT HOLD MODE'), `Turn ${i + 1} system prompt must be STRICT HOLD MODE`);
    assert(capturedSystemPrompt.includes('You must NOT answer any questions'), `Turn ${i + 1} must prohibit answering questions`);
    assert.strictEqual(capturedTools, undefined, `Turn ${i + 1} should disable tools in hold mode`);

    const reply = await readSseText(res);
    console.log(`  Agent Response: "${reply}"`);
    assert.strictEqual(reply.trim(), expected, `Response must match exact holding line for turn ${i + 1}`);

    conversationHistory.push({ role: 'assistant', content: reply });
  }

  console.log('\n======================================================');
  console.log('All Dynamic Instructions & Post-Escalation Hold Tests PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
