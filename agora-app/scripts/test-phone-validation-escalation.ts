import { normalizePhoneNumber, extractSpokenDigits } from '../lib/phoneUtils';
import { updateCaseField, getCase, checkEscalation, resetCaseStore } from '../lib/caseStore';
import assert from 'node:assert';

console.log('=====================================================');
console.log('TEST SUITE: Spoken Digits, Validation, Escalation Loop Fix');
console.log('=====================================================');

// TEST 1: Digit extraction from literal user strings
console.log('\n--- Test 1: Literal Transcribed Strings to Digits ---');
const t1 = normalizePhoneNumber('Nine eight seven six five four three two zero');
console.log('T1 (9 digits):', t1);
assert.strictEqual(t1.digits, '987654320');
assert.strictEqual(t1.isValid10, false);

const t2 = normalizePhoneNumber('Nine eight seven six five four three two one zero');
console.log('T2 (10 digits):', t2);
assert.strictEqual(t2.digits, '9876543210');
assert.strictEqual(t2.isValid10, true);

const t3 = normalizePhoneNumber('eight seven six five four three two one');
console.log('T3 (8 digits):', t3);
assert.strictEqual(t3.digits, '87654321');
assert.strictEqual(t3.isValid10, false);

console.log('✓ All 3 user-provided literal test strings parsed accurately!');

// TEST 2: Hindi digits and Hinglish
console.log('\n--- Test 2: Hindi & Hinglish Spoken Digits ---');
const tHindi = normalizePhoneNumber('नौ आठ सात छह पांच चार तीन दो एक शून्य');
console.log('Hindi Devanagari 10 digits:', tHindi);
assert.strictEqual(tHindi.digits, '9876543210');
assert.strictEqual(tHindi.isValid10, true);

const tHinglish = normalizePhoneNumber('nau aath saat chheh paanch chaar teen do ek shunya');
console.log('Hinglish 10 digits:', tHinglish);
assert.strictEqual(tHinglish.digits, '9876543210');
assert.strictEqual(tHinglish.isValid10, true);
console.log('✓ Hindi and Hinglish spoken numbers parsed accurately!');

// TEST 3: caseStore increments reaskCount on failed validation
console.log('\n--- Test 3: caseStore reaskCount on Incomplete Number ---');
resetCaseStore();
const sessionId = 'test-failed-validation-session';

// Attempt 1: short number (9 digits)
const c1 = updateCaseField(sessionId, 'contactNumber', 'Nine eight seven six five four three two zero');
console.log('After attempt 1 (9 digits): reaskCount =', c1.contactNumber.reaskCount, 'status =', c1.contactNumber.status, 'escalated =', c1.escalated);
assert.strictEqual(c1.contactNumber.reaskCount, 1, 'Attempt 1 must increment reaskCount to 1');
assert.strictEqual(c1.contactNumber.status, 'rejected', 'Failed validation must set status to rejected');
assert.strictEqual(c1.escalated, false, '1 failed attempt should not yet escalate');

// Attempt 2: short number (8 digits)
const c2 = updateCaseField(sessionId, 'contactNumber', 'eight seven six five four three two one');
console.log('After attempt 2 (8 digits): reaskCount =', c2.contactNumber.reaskCount, 'status =', c2.contactNumber.status, 'escalated =', c2.escalated);
assert.strictEqual(c2.contactNumber.reaskCount, 2, 'Attempt 2 must increment reaskCount to 2');
assert.strictEqual(c2.escalated, true, '2 failed attempts must trigger escalation!');
assert.strictEqual(c2.escalationReason, "Field 'contactNumber' reaskCount is 2 (threshold: 2)");

console.log('✓ Incomplete number attempts properly increment reaskCount and escalate on attempt 2!');

// TEST 4: HARD CAP AT 3 ATTEMPTS
console.log('\n--- Test 4: Hard Cap Safety Net at 3 Attempts ---');
resetCaseStore();
const sessionHardCap = 'test-hard-cap-session';
updateCaseField(sessionHardCap, 'contactNumber', '12345');
assert.strictEqual(getCase(sessionHardCap).contactNumber.reaskCount, 1);
updateCaseField(sessionHardCap, 'contactNumber', '6789');
assert.strictEqual(getCase(sessionHardCap).contactNumber.reaskCount, 2);
const c3 = updateCaseField(sessionHardCap, 'contactNumber', '999');
assert.strictEqual(c3.contactNumber.reaskCount, 3);
assert.strictEqual(c3.escalated, true);
console.log('✓ Hard cap enforced at 3 attempts!');

// TEST 5: Spoken 10-digit number accepted as valid
console.log('\n--- Test 5: Spoken 10-digit Number Accepted Without Escalation ---');
resetCaseStore();
const sessionValid = 'test-spoken-valid-session';
const cValid = updateCaseField(sessionValid, 'contactNumber', 'Nine eight seven six five four three two one zero', 0.95);
console.log('Spoken 10-digit result: value =', cValid.contactNumber.value, 'status =', cValid.contactNumber.status, 'reaskCount =', cValid.contactNumber.reaskCount);
assert.strictEqual(cValid.contactNumber.value, '9876543210');
assert.strictEqual(cValid.contactNumber.status, 'confirmed');
assert.strictEqual(cValid.contactNumber.reaskCount, 0);
assert.strictEqual(cValid.escalated, false);
console.log('✓ Spoken 10-digit number accepted cleanly as confirmed with 0 reasks!');

console.log('\n=====================================================');
console.log('ALL UNIT TESTS PASSED!');
console.log('=====================================================');
