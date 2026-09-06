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

  if (confirmationRejected) {
    targetField.reaskCount += 1;
    targetField.status = 'rejected';
    if (value && value.trim().length > 0) {
      if (isSignificantDifference(field, targetField.value, value)) {
        currentCase.contradictionDetected = true;
      }
      targetField.value = value;
      targetField.confidence = confidence ?? 0.5;
    }
  } else {
    const hasExistingValue = Boolean(
      targetField.value && targetField.value.trim().length > 0,
    );

    if (
      hasExistingValue &&
      value &&
      value.trim().length > 0 &&
      targetField.value.trim().toLowerCase() !== value.trim().toLowerCase()
    ) {
      targetField.reaskCount += 1;
      if (isSignificantDifference(field, targetField.value, value)) {
        currentCase.contradictionDetected = true;
      }
    }

    if (value !== undefined) {
      targetField.value = value;
    }
    if (confidence !== undefined) {
      targetField.confidence = confidence;
      targetField.status = confidence >= 0.8 ? 'confirmed' : 'unverified';
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
