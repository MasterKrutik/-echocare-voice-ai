import {
  CaseFieldKey,
  CaseState,
  EscalationResult,
} from '@/types/case';

const globalForCases = globalThis as unknown as {
  __echocare_cases?: Map<string, CaseState>;
};

if (!globalForCases.__echocare_cases) {
  globalForCases.__echocare_cases = new Map<string, CaseState>();
}

const caseStore: Map<string, CaseState> = globalForCases.__echocare_cases;

const BARE_CONFIRMATION_WORDS = new Set([
  'yes',
  'yep',
  'yeah',
  'yup',
  'haan',
  'ha',
  'han',
  'haanji',
  'haji',
  'sahi',
  'sahi hai',
  'sahihai',
  'theek',
  'theek hai',
  'theekhai',
  'correct',
  'right',
  'true',
  'ok',
  'okay',
  'bilkul',
  'avashya',
  'हाँ',
  'हाँजी',
  'सही',
  'सही है',
  'ठीक',
  'ठीक है',
  'बिल्कुल',
  'अवश्य',
]);

const BARE_REJECTION_WORDS = new Set([
  'no',
  'nope',
  'nah',
  'nahi',
  'nahin',
  'na',
  'galat',
  'galat hai',
  'galathai',
  'incorrect',
  'wrong',
  'false',
  'not correct',
  'notcorrect',
  'गलत',
  'गलत है',
  'नहीं',
  'ना',
]);

export function isBareConfirmationWord(val: string): boolean {
  if (!val) return false;
  const clean = val
    .trim()
    .toLowerCase()
    .replace(/^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$/g, '');
  return BARE_CONFIRMATION_WORDS.has(clean);
}

export function isBareRejectionWord(val: string): boolean {
  if (!val) return false;
  const clean = val
    .trim()
    .toLowerCase()
    .replace(/^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$/g, '');
  return BARE_REJECTION_WORDS.has(clean);
}

function createInitialCase(): CaseState {
  return {
    category: {
      value: '',
      confidence: 0,
      status: 'unverified',
      reaskCount: 0,
    },
    location: {
      value: '',
      confidence: 0,
      status: 'unverified',
      reaskCount: 0,
    },
    description: {
      value: '',
      confidence: 0,
      status: 'unverified',
      reaskCount: 0,
    },
    contactNumber: {
      value: '',
      confidence: 0,
      status: 'unverified',
      reaskCount: 0,
    },
    contradictionDetected: false,
    escalated: false,
    escalationReason: '',
  };
}

function isSignificantDifference(
  field: CaseFieldKey,
  oldVal: string,
  newVal: string,
): boolean {
  const cleanOld = oldVal.trim().toLowerCase();
  const cleanNew = newVal.trim().toLowerCase();

  if (!cleanOld || !cleanNew) return false;
  if (cleanOld === cleanNew) return false;

  if (field === 'category') {
    return cleanOld !== cleanNew;
  }

  if (field === 'contactNumber') {
    const digitsOld = cleanOld.replace(/\D/g, '');
    const digitsNew = cleanNew.replace(/\D/g, '');
    if (digitsOld && digitsNew && digitsOld !== digitsNew) {
      return true;
    }
    return cleanOld !== cleanNew;
  }

  // For location and description:
  if (cleanOld.includes(cleanNew) || cleanNew.includes(cleanOld)) {
    return false;
  }

  const oldTokens = new Set(cleanOld.split(/\s+/).filter(Boolean));
  const newTokens = new Set(cleanNew.split(/\s+/).filter(Boolean));
  let commonTokens = 0;
  for (const token of oldTokens) {
    if (newTokens.has(token)) commonTokens++;
  }
  const maxTokens = Math.max(oldTokens.size, newTokens.size);
  return maxTokens > 0 && commonTokens / maxTokens < 0.3;
}

export function getCase(sessionId: string): CaseState {
  let existing = caseStore.get(sessionId);
  if (!existing) {
    existing = createInitialCase();
    caseStore.set(sessionId, existing);
  }
  return existing;
}

export function updateCaseField(
  sessionId: string,
  field: CaseFieldKey,
  value?: string,
  confidence?: number,
  confirmationRejected?: boolean,
): CaseState {
  const currentCase = getCase(sessionId);
  const targetField = currentCase[field];

  let effectiveValue = value;
  let effectiveConfidence = confidence;
  let effectiveRejected = Boolean(confirmationRejected);

  // Safeguard: reject bare confirmation/rejection words as a field VALUE
  if (
    effectiveValue &&
    (isBareConfirmationWord(effectiveValue) || isBareRejectionWord(effectiveValue))
  ) {
    console.warn(
      `[updateCaseField] Rejected bare confirmation/rejection word "${effectiveValue}" for field "${field}". Value will NOT overwrite field.`,
    );

    if (isBareRejectionWord(effectiveValue)) {
      effectiveRejected = true;
    } else if (isBareConfirmationWord(effectiveValue)) {
      // Caller confirmed the existing field value!
      if (targetField.value && targetField.value.trim().length > 0) {
        targetField.status = 'confirmed';
        targetField.confidence = Math.max(
          targetField.confidence,
          effectiveConfidence ?? 0.95,
        );
      }
    }
    // Prevent the confirmation/rejection word from overwriting the field value
    effectiveValue = undefined;
  }

  // Basic validation for contactNumber field:
  // An Indian phone number must have exactly 10 digits.
  // If not exactly 10 digits, cap confidence at 0.3 regardless of what LLM reports.
  if (field === 'contactNumber' && effectiveValue !== undefined) {
    let digits = effectiveValue.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    if (digits.length !== 10) {
      console.warn(
        `[updateCaseField] contactNumber "${effectiveValue}" has ${digits.length} digits (expected exactly 10). Capping confidence at 0.3.`,
      );
      effectiveConfidence = Math.min(
        effectiveConfidence !== undefined ? effectiveConfidence : 0.3,
        0.3,
      );
      targetField.status = 'unverified';
    }
  }

  if (effectiveRejected) {
    targetField.reaskCount += 1;
    targetField.status = 'rejected';
    if (effectiveValue && effectiveValue.trim().length > 0) {
      if (isSignificantDifference(field, targetField.value, effectiveValue)) {
        currentCase.contradictionDetected = true;
      }
      targetField.value = effectiveValue;
      targetField.confidence = effectiveConfidence ?? 0.5;
    }
  } else {
    const hasExistingValue = Boolean(
      targetField.value && targetField.value.trim().length > 0,
    );

    if (
      hasExistingValue &&
      effectiveValue &&
      effectiveValue.trim().length > 0 &&
      targetField.value.trim().toLowerCase() !== effectiveValue.trim().toLowerCase()
    ) {
      targetField.reaskCount += 1;
      if (isSignificantDifference(field, targetField.value, effectiveValue)) {
        currentCase.contradictionDetected = true;
      }
    }

    if (effectiveValue !== undefined) {
      targetField.value = effectiveValue;
    }
    if (effectiveConfidence !== undefined) {
      targetField.confidence = effectiveConfidence;
      // If contactNumber has wrong digit count, force unverified status
      const isBadContactNumber =
        field === 'contactNumber' &&
        targetField.value.replace(/\D/g, '').replace(/^(91|0)/, '').length !== 10;
      targetField.status =
        effectiveConfidence >= 0.8 && !isBadContactNumber
          ? 'confirmed'
          : 'unverified';
    }
  }

  // Always invoke checkEscalation on every single update_case_field call
  checkEscalation(sessionId);

  return currentCase;
}

export function checkEscalation(sessionId: string): EscalationResult {
  const currentCase = getCase(sessionId);
  const fields: CaseFieldKey[] = [
    'category',
    'location',
    'description',
    'contactNumber',
  ];

  // Rule 1: escalate if any field's reaskCount >= 2
  for (const field of fields) {
    if (currentCase[field].reaskCount >= 2) {
      const reason = `Field '${field}' reaskCount is ${currentCase[field].reaskCount} (threshold: 2)`;
      currentCase.escalated = true;
      currentCase.escalationReason = reason;
      return { shouldEscalate: true, reason };
    }
  }

  // Rule 2: escalate if two of {any field confidence < 0.6, contradiction detected, category confidence < 0.5}
  let riskFactorCount = 0;
  const riskFactors: string[] = [];

  const hasAnyLowConfidenceField = fields.some(
    (field) =>
      currentCase[field].value.trim().length > 0 &&
      currentCase[field].confidence < 0.6,
  );
  if (hasAnyLowConfidenceField) {
    riskFactorCount++;
    riskFactors.push('any field confidence < 0.6');
  }

  if (currentCase.contradictionDetected) {
    riskFactorCount++;
    riskFactors.push('contradiction detected');
  }

  if (
    currentCase.category.value.trim().length > 0 &&
    currentCase.category.confidence < 0.5
  ) {
    riskFactorCount++;
    riskFactors.push('category confidence < 0.5');
  }

  if (riskFactorCount >= 2) {
    const reason = `Two risk factors present (${riskFactors.join(', ')})`;
    currentCase.escalated = true;
    currentCase.escalationReason = reason;
    return { shouldEscalate: true, reason };
  }

  return { shouldEscalate: false, reason: '' };
}

export function resetCaseStore(): void {
  caseStore.clear();
}
