import assert from 'node:assert';
import { updateCaseField, getCase, resetCaseStore, checkEscalation } from '../lib/caseStore';

async function runValidationSafeguardTests() {
  console.log('=====================================================');
  console.log('TEST SUITE: Validation Safeguards & Confirmation Bug Fix');
  console.log('=====================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Wrong-length Contact Number (deliberately short/long numbers)
  // -------------------------------------------------------------------------
  console.log('Test 1: Deliberately short/wrong-length contact number validation');
  resetCaseStore();
  const sessionPhone = 'test-session-phone';

  // 1a: Short 5-digit number with LLM claiming 0.95 confidence
  let caseState = updateCaseField(sessionPhone, 'contactNumber', '98765', 0.95);
  assert.strictEqual(
    caseState.contactNumber.value,
    '98765',
    'Value should be recorded',
  );
  assert.strictEqual(
    caseState.contactNumber.confidence,
    0.3,
    'Confidence must be capped at 0.3 for a 5-digit number regardless of LLM report',
  );
  assert.strictEqual(
    caseState.contactNumber.status,
    'unverified',
    'Status must remain unverified for wrong-length number',
  );

  let esc = checkEscalation(sessionPhone);
  // Capping at 0.3 should flag low-confidence field risk factor (< 0.6)
  assert.strictEqual(
    caseState.contactNumber.confidence < 0.6,
    true,
    'Confidence < 0.6 triggers low-confidence risk factor',
  );
  console.log('✓ 5-digit number correctly capped at 0.3 confidence and marked unverified');

  // 1b: 8-digit number with LLM claiming 0.99 confidence
  caseState = updateCaseField(sessionPhone, 'contactNumber', '98765432', 0.99);
  assert.strictEqual(
    caseState.contactNumber.confidence,
    0.3,
    'Confidence must be capped at 0.3 for an 8-digit number',
  );
  assert.strictEqual(
    caseState.contactNumber.status,
    'unverified',
    'Status must remain unverified for 8-digit number',
  );
  console.log('✓ 8-digit number correctly capped at 0.3 confidence and marked unverified');

  // 1c: 11-digit invalid number (e.g. 98765432109)
  caseState = updateCaseField(sessionPhone, 'contactNumber', '98765432109', 0.9);
  assert.strictEqual(
    caseState.contactNumber.confidence,
    0.3,
    'Confidence must be capped at 0.3 for an 11-digit number',
  );
  console.log('✓ 11-digit number correctly capped at 0.3 confidence');

  // 1d: Valid 10-digit number (e.g. 9876543210)
  caseState = updateCaseField(sessionPhone, 'contactNumber', '9876543210', 0.95);
  assert.strictEqual(
    caseState.contactNumber.confidence,
    0.95,
    'Valid 10-digit number preserves high confidence',
  );
  assert.strictEqual(
    caseState.contactNumber.status,
    'confirmed',
    'Valid 10-digit number with high confidence is confirmed',
  );
  console.log('✓ Valid 10-digit number retains 0.95 confidence and confirmed status\n');

  // -------------------------------------------------------------------------
  // TEST 2: Location Field Confirmation Bug ("Yes." overwrite protection)
  // -------------------------------------------------------------------------
  console.log('Test 2: Location field confirmation overwrite protection ("Yes." bug fix)');
  resetCaseStore();
  const sessionLoc = 'test-session-location';

  // Step 1: Citizen provides real location
  caseState = updateCaseField(sessionLoc, 'location', 'Sector 15, Near Apollo Hospital, Noida', 0.95);
  assert.strictEqual(
    caseState.location.value,
    'Sector 15, Near Apollo Hospital, Noida',
    'Initial location recorded',
  );
  assert.strictEqual(caseState.location.status, 'confirmed');

  // Step 2: Agent repeats back: "I have recorded your location as Sector 15... Is this correct?"
  // Citizen replies: "Yes."
  // LLM mistakenly calls update_case_field(location, "Yes.", 0.95)
  caseState = updateCaseField(sessionLoc, 'location', 'Yes.', 0.95);
  assert.strictEqual(
    caseState.location.value,
    'Sector 15, Near Apollo Hospital, Noida',
    'CRITICAL: Location field must NOT be overwritten with "Yes."',
  );
  assert.strictEqual(
    caseState.location.status,
    'confirmed',
    'Location remains confirmed',
  );
  console.log('✓ Calling update_case_field with "Yes." did NOT overwrite the location field!');

  // Step 3: Test other confirmation words: "haan", "sahi hai", "correct"
  caseState = updateCaseField(sessionLoc, 'location', 'haan', 0.9);
  assert.strictEqual(
    caseState.location.value,
    'Sector 15, Near Apollo Hospital, Noida',
    'Location must NOT be overwritten with "haan"',
  );

  caseState = updateCaseField(sessionLoc, 'location', 'sahi hai', 0.9);
  assert.strictEqual(
    caseState.location.value,
    'Sector 15, Near Apollo Hospital, Noida',
    'Location must NOT be overwritten with "sahi hai"',
  );
  console.log('✓ Calling update_case_field with "haan" and "sahi hai" did NOT overwrite the location field!');

  // Step 4: Test rejection word: "No."
  // LLM calls update_case_field(location, "No.", 0.9)
  caseState = updateCaseField(sessionLoc, 'location', 'No.', 0.9);
  assert.strictEqual(
    caseState.location.value,
    'Sector 15, Near Apollo Hospital, Noida',
    'Location must NOT be overwritten with "No."',
  );
  assert.strictEqual(
    caseState.location.status,
    'rejected',
    'Rejection word correctly triggers status: rejected',
  );
  assert.strictEqual(
    caseState.location.reaskCount,
    1,
    'Rejection word correctly increments reaskCount',
  );
  console.log('✓ Calling update_case_field with "No." safely triggered rejection without overwriting location!\n');

  // -------------------------------------------------------------------------
  // TEST 3: Tickets Route Transcript Parser Safeguards
  // -------------------------------------------------------------------------
  console.log('Test 3: /api/tickets transcript parser safeguards against "Yes." and short phones');
  
  // Simulate API POST /api/tickets with a transcript where citizen confirms with "Yes."
  const { POST } = await import('../app/api/tickets/route');
  const { NextRequest } = await import('next/server');

  const reqYes = new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'transcript-test-session',
      transcript: [
        { text: 'Namaste, welcome to EchoCare.' },
        { text: 'There is a severe drainage overflow in Sector 15 Noida near Apollo hospital.' },
        { text: 'I have recorded your location as Sector 15 Noida. Could you confirm if this is correct?' },
        { text: 'Yes.' }, // <-- Caller says "Yes."
        { text: 'Please share your contact number.' },
        { text: '9876543210' },
        { text: 'Thank you.' },
      ],
    }),
  });

  const resYes = await POST(reqYes);
  assert.strictEqual(resYes.status, 201, 'POST /api/tickets should return 201');
  const createdTicket = await resYes.json();

  assert.notStrictEqual(
    createdTicket.caseSnapshot.location.value,
    'Yes.',
    'Ticket location must NEVER be "Yes."',
  );
  assert(
    createdTicket.caseSnapshot.location.value.toLowerCase().includes('sector 15') ||
    createdTicket.caseSnapshot.location.value.toLowerCase().includes('apollo'),
    `Ticket location should capture the actual location (got: "${createdTicket.caseSnapshot.location.value}")`,
  );
  console.log('✓ Ticket created via transcript parsing correctly captured location:', createdTicket.caseSnapshot.location.value);
  console.log('✓ Location was NOT overwritten with "Yes."');

  // Test short phone in transcript
  const reqShortPhone = new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'transcript-short-phone-session',
      transcript: [
        { text: 'Water pipe is leaking on MG Road.' },
        { text: 'My number is 12345.' }, // deliberately short
      ],
    }),
  });

  const resShortPhone = await POST(reqShortPhone);
  assert.strictEqual(resShortPhone.status, 201);
  const ticketShortPhone = await resShortPhone.json();
  assert.strictEqual(
    ticketShortPhone.caseSnapshot.contactNumber.confidence,
    0.3,
    'Short phone in transcript must have confidence capped at 0.3',
  );
  assert.strictEqual(
    ticketShortPhone.caseSnapshot.contactNumber.status,
    'unverified',
    'Short phone must have status unverified',
  );
  console.log('✓ Short phone in transcript correctly capped at 0.3 confidence and unverified status\n');

  // -------------------------------------------------------------------------
  // TEST 4: Reproduce exact live scenario from user testing
  // -------------------------------------------------------------------------
  console.log('Test 4: Exact live testing scenario: awkward location, issue description, 1 rejection, 1 confirmation');
  const reqExactScenario = new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'exact-live-scenario-session',
      transcript: [
        { role: 'agent', text: 'Namaste and welcome to EchoCare municipal helpline. How may I assist you with your civic grievance today?आप अपनी समस्या हिंदी में भी बता सकते हैं।' },
        { role: 'user', text: 'Garbage picking web' },
        { role: 'user', text: 'थोड़े दिनों से नहीं आई है.तो बहुत smell आने लगी है.' },
        { role: 'user', text: 'क्योंकि garbage इकट्ठा होने लगा' },
        { role: 'agent', text: 'मैं समझ सकता हूँ। क्या आप कृपया अपनी कॉलोनी या क्षेत्र का नाम बता सकते हैं?' },
        { role: 'user', text: 'n I eighteen' },
        { role: 'user', text: 'memberana' },
        { role: 'user', text: 'राजस्थान से हुए' },
        { role: 'agent', text: 'मैंने आपकी कॉलोनी का नाम "I Eighteen Memberana" दर्ज कर लिया है। क्या आप कृपया अपना संपर्क नंबर बता सकते हैं?' },
        { role: 'user', text: "It's it's NIIT UniversityMurana." },
        { role: 'agent', text: 'मैंने आपका स्थान "NIIT University Murana" दर्ज कर लिया है। क्या आप कृपया अपना संपर्क नंबर बता सकते हैं?' },
        { role: 'user', text: "De la Saint Patrick's birthday," },
        { role: 'user', text: 'nine six three eightsix nine six nine six.' },
        { role: 'agent', text: 'I have recorded your contact number as 9638696969. Could you please confirm if this is correct?' },
        { role: 'user', text: "No. It's not correct." }, // <-- ONE genuine rejection
        { role: 'agent', text: 'I apologize for the trouble. Could you please provide the correct contact number?' },
        { role: 'user', text: 'So, my contact number is nine six three eightnine six nine six nine six.' },
        { role: 'agent', text: 'I have recorded your contact number as 9638969969. Could you please confirm if this is correct?' },
        { role: 'user', text: 'Yes.' }, // <-- Confirmed!
        { role: 'agent', text: 'मैंने आपका स्थान "NIIT University Murana" और संपर्क नंबर "9638969969" दर्ज किया है। क्या आप मुझे यह बताना चाहेंगे कि आपकी समस्या क्या है?' },
        { role: 'user', text: 'Si ayer,थोड़े दिनों से गारबेज हुए' }, // <-- Description statement, NOT location!
        { role: 'agent', text: 'मैं समझ सकता हूँ। मैंने आपकी समस्या के रूप में "गारबेज पिकिंग नहीं आ रही" दर्ज कर लिया है। कृपया प्रतीक्षा करें,हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।' },
        { role: 'user', text: 'क्या मैं municipality कोshow कर सकता हूं इस चीज़ की वजह से?' },
        { role: 'agent', text: 'कृपया प्रतीक्षा करें,हमारे अधिकारी शीघ्र ही आपकी सहायता करेंगे।' },
      ],
    }),
  });

  const resExact = await POST(reqExactScenario);
  assert.strictEqual(resExact.status, 201);
  const ticketExact = await resExact.json();

  // 1. Verify Location is NOT the description
  assert.strictEqual(
    ticketExact.caseSnapshot.location.value,
    'NIIT University Murana',
    `Location must be "NIIT University Murana" (got: "${ticketExact.caseSnapshot.location.value}")`,
  );
  assert.notStrictEqual(
    ticketExact.caseSnapshot.location.value,
    'Si ayer,थोड़े दिनों से गारबेज हुए',
    'Location must NEVER be contaminated with the caller description',
  );
  console.log('✓ Location correctly captured as:', ticketExact.caseSnapshot.location.value);

  // 2. Verify Description
  assert(
    ticketExact.caseSnapshot.description.value.includes('गारबेज') ||
    ticketExact.caseSnapshot.description.value.toLowerCase().includes('garbage'),
    `Description should capture the garbage issue (got: "${ticketExact.caseSnapshot.description.value}")`,
  );
  console.log('✓ Description correctly captured as:', ticketExact.caseSnapshot.description.value);

  // 3. Verify Contact Number
  assert.strictEqual(
    ticketExact.caseSnapshot.contactNumber.value,
    '9638969969',
    `Contact number must be "9638969969" (got: "${ticketExact.caseSnapshot.contactNumber.value}")`,
  );
  assert.strictEqual(
    ticketExact.caseSnapshot.contactNumber.reaskCount,
    1,
    `reaskCount must be exactly 1 after 1 rejection + 1 confirmation (got: ${ticketExact.caseSnapshot.contactNumber.reaskCount})`,
  );
  assert.strictEqual(
    ticketExact.caseSnapshot.contactNumber.status,
    'confirmed',
    `Status must be "confirmed" after user says Yes (got: "${ticketExact.caseSnapshot.contactNumber.status}")`,
  );
  console.log('✓ Contact number confirmed with reaskCount = 1 (no false reaskCount increment)');

  // 4. Verify No False Escalation
  assert.strictEqual(
    ticketExact.caseSnapshot.escalated,
    false,
    `Ticket must NOT be escalated (got: ${ticketExact.caseSnapshot.escalated}, reason: "${ticketExact.caseSnapshot.escalationReason}")`,
  );
  assert.strictEqual(
    ticketExact.caseSnapshot.escalationReason,
    '',
    `Escalation reason must be empty (got: "${ticketExact.caseSnapshot.escalationReason}")`,
  );
  console.log('✓ No false escalation triggered! Ticket is unescalated.\n');

  // -------------------------------------------------------------------------
  // TEST 5: Verify 2 genuine rejections DOES properly escalate
  // -------------------------------------------------------------------------
  console.log('Test 5: Two genuine rejections properly triggers escalation');
  const reqDoubleReject = new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'double-reject-scenario-session',
      transcript: [
        { role: 'agent', text: 'Namaste, welcome to EchoCare.' },
        { role: 'user', text: 'Streetlight not working in Sector 4 Noida' },
        { role: 'agent', text: 'I have recorded your location as "Sector 4 Noida". What is your contact number?' },
        { role: 'user', text: '9876543210' },
        { role: 'agent', text: 'I have recorded your contact number as 9876543210. Could you please confirm if this is correct?' },
        { role: 'user', text: "No, that's wrong." }, // Rejection 1
        { role: 'agent', text: 'Please provide the correct number.' },
        { role: 'user', text: '9876543211' },
        { role: 'agent', text: 'I have recorded your contact number as 9876543211. Could you please confirm if this is correct?' },
        { role: 'user', text: 'No, still incorrect.' }, // Rejection 2
      ],
    }),
  });

  const resDoubleReject = await POST(reqDoubleReject);
  assert.strictEqual(resDoubleReject.status, 201);
  const ticketDouble = await resDoubleReject.json();

  assert.strictEqual(
    ticketDouble.caseSnapshot.contactNumber.reaskCount,
    2,
    `reaskCount must be 2 after two genuine rejections (got: ${ticketDouble.caseSnapshot.contactNumber.reaskCount})`,
  );
  assert.strictEqual(
    ticketDouble.caseSnapshot.escalated,
    true,
    'Ticket must be escalated after two genuine rejections',
  );
  assert.strictEqual(
    ticketDouble.caseSnapshot.escalationReason,
    'reaskCount >= 2 on contactNumber',
    `Escalation reason must state reaskCount >= 2 on contactNumber (got: "${ticketDouble.caseSnapshot.escalationReason}")`,
  );
  console.log('✓ Two genuine rejections correctly triggers escalation with reason:', ticketDouble.caseSnapshot.escalationReason, '\n');

  console.log('=====================================================');
  console.log('ALL VALIDATION & CONFIRMATION SAFEGUARD TESTS PASSED!');
  console.log('=====================================================');
}

runValidationSafeguardTests().catch((err) => {
  console.error('Validation test failed:', err);
  process.exit(1);
});
