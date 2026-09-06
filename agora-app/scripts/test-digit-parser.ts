import { extractSpokenDigits, normalizePhoneNumber } from '../lib/phoneUtils';

const tests = [
  'Nine eight seven six five four three two zero',
  'Nine eight seven six five four three two one zero',
  'eight seven six five four three two one',
  'nine six three eightnine six nine six nine six',
  'mera number 9876543210 hai',
  'नौ आठ सात छह पांच चार तीन दो एक शून्य',
  'double nine eight seven six five four three two one',
  '9876543210',
  '+91 9876543210',
  '09876543210',
];

console.log('--- TEST SPOKEN DIGIT EXTRACTION & NORMALIZATION ---');
tests.forEach((t) => {
  const norm = normalizePhoneNumber(t);
  console.log(`"${t}" -> digits: "${norm.digits}" (isValid10: ${norm.isValid10})`);
});
