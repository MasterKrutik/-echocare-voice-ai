import assert from 'assert';
import { createChatCompletionsHandler } from '../app/api/chat/completions/route';
import { NextRequest } from 'next/server';
import { updateCaseField, resetCaseStore } from '../lib/caseStore';
import { resetTicketStore } from '../lib/ticketStore';

async function testPostEscalationHolding() {
  console.log('======================================================');
  console.log('Testing Post-Escalation Holding Invariant');
  console.log('======================================================');

  resetCaseStore();
  resetTicketStore();

  process.env.NEXT_LLM_API_KEY = 'mock-key';
  process.env.NEXT_LLM_URL = 'https://mock.test/v1/chat/completions';

  const sessionId = `test-escalate-holding-${Date.now()}`;

  let capturedSystemPrompt = '';
  let capturedUserQuestion = '';

  const mockOpenAIClient = () => (modelId: string) => ({
    modelId,
  });

  const mockStreamTextImpl = ((config: any) => {
    capturedSystemPrompt = config.system;
    const messages = config.messages || [];
    const lastMsg = messages[messages.length - 1];
    capturedUserQuestion = lastMsg?.content || '';

    const isEscalated = capturedSystemPrompt.includes('escalated: YES');
    const conversationHistory = messages.map((m: any) => String(m.content)).join(' ');
    const isPostEscalationTurn =
      conversationHistory.includes('connecting you') ||
      conversationHistory.includes('अधिकारी');

    let reply = '';
    if (isEscalated && isPostEscalationTurn) {
      if (/hindi|कृपया|कब|समय|हल/i.test(capturedUserQuestion)) {
        reply = 'कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।';
      } else {
        reply = 'Please hold, an officer will assist you shortly.';
      }
    } else if (isEscalated) {
      reply = 'I apologize for the trouble. I am connecting you directly to a municipal officer who will assist you.';
    } else {
      reply = 'Could you please confirm your phone number?';
    }

    return {
      textStream: (async function* () {
        yield reply;
      })(),
      fullStream: (async function* () {
        yield { type: 'text-delta', text: reply };
      })(),
    };
  }) as any;

  const handler = createChatCompletionsHandler({
    createOpenAIClient: mockOpenAIClient as any,
    streamTextImpl: mockStreamTextImpl,
  });

  // Step 1: Provide initial fields
  updateCaseField(sessionId, 'location', 'Sector 15 Noida', 0.95);
  updateCaseField(sessionId, 'contactNumber', '9876543210', 0.95);

  // Step 2: Caller rejects confirmation 1st time
  updateCaseField(sessionId, 'contactNumber', undefined, undefined, true);

  // Step 3: Caller rejects confirmation 2nd time -> Escalation triggers
  updateCaseField(sessionId, 'contactNumber', undefined, undefined, true);

  // Send request right when escalation is triggered
  const escReq = new NextRequest('http://localhost:3000/api/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      messages: [
        { role: 'assistant', content: 'I have recorded your location as Sector 15 Noida and contact number as 9876543210. Is this correct?' },
        { role: 'user', content: 'No, that is wrong.' },
        { role: 'assistant', content: 'I apologize. Could you please state your correct number?' },
        { role: 'user', content: 'Incorrect again.' },
      ],
    }),
  });

  const escRes = await handler(escReq);
  assert(escRes.status === 200, 'Escalation turn should return 200');

  // Verify that system prompt instructed handoff and holding rule
  assert(capturedSystemPrompt.includes('STRICT POST-ESCALATION HOLDING INVARIANT'), 'Prompt must contain holding rule');
  assert(capturedSystemPrompt.includes('Please hold, an officer will assist you shortly'), 'Prompt must specify English holding line');
  assert(capturedSystemPrompt.includes('कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।'), 'Prompt must specify Hindi holding line');
  console.log('Prompt contains mandatory post-escalation holding rules.');

  async function readSseText(res: Response): Promise<string> {
    const raw = await res.text();
    let full = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) full += delta;
        } catch {}
      }
    }
    return full;
  }

  // Step 4: Caller asks a question AFTER escalation has been announced
  console.log('\n--- Turn: Caller asks for resolution timeline after escalation ---');
  const postEscReq = new NextRequest('http://localhost:3000/api/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      messages: [
        { role: 'assistant', content: 'I have recorded your location as Sector 15 Noida and contact number as 9876543210. Is this correct?' },
        { role: 'user', content: 'No, that is wrong.' },
        { role: 'assistant', content: 'I apologize. Could you please state your correct number?' },
        { role: 'user', content: 'Incorrect again.' },
        { role: 'assistant', content: 'I apologize for the trouble. I am connecting you directly to a municipal officer who will assist you.' },
        { role: 'user', content: 'Wait, how long will this take? What is the resolution timeline?' },
      ],
    }),
  });

  const postEscRes = await handler(postEscReq);
  const replyText = await readSseText(postEscRes);
  console.log('Caller asked: "Wait, how long will this take? What is the resolution timeline?"');
  console.log('Agent replied:', replyText);

  assert.strictEqual(
    replyText.trim(),
    'Please hold, an officer will assist you shortly.',
    'Agent must ONLY respond with the exact holding line and give no factual timelines or information'
  );

  // Step 5: Test in Hindi as well
  console.log('\n--- Turn: Caller asks question in Hindi after escalation ---');
  const postEscReqHindi = new NextRequest('http://localhost:3000/api/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      messages: [
        { role: 'assistant', content: 'असुविधा के लिए मुझे खेद है। मैं आपकी कॉल तुरंत हमारे नगर पालिका अधिकारी से जोड़ रहा हूँ।' },
        { role: 'user', content: 'किस समय तक अधिकारी बात करेंगे? क्या आज समस्या हल होगी?' },
      ],
    }),
  });

  const postEscResHindi = await handler(postEscReqHindi);
  const replyHindi = await readSseText(postEscResHindi);
  console.log('Caller asked (Hindi): "किस समय तक अधिकारी बात करेंगे? क्या आज समस्या हल होगी?"');
  console.log('Agent replied (Hindi):', replyHindi);

  assert.strictEqual(
    replyHindi.trim(),
    'कृपया प्रतीक्षा करें, हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।',
    'Agent must respond in Hindi with ONLY the holding line'
  );

  console.log('\n>>> POST-ESCALATION HOLDING INVARIANT TEST PASSED! <<<');
}

testPostEscalationHolding().catch((err) => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
