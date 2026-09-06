export type FieldStatus = 'unverified' | 'confirmed' | 'rejected';

export type CaseFieldKey =
  | 'category'
  | 'location'
  | 'description'
  | 'contactNumber';

export type CaseFieldValue = {
  value: string;
  confidence: number;
  status: FieldStatus;
  reaskCount: number;
};

export type CaseState = {
  category: CaseFieldValue;
  location: CaseFieldValue;
  description: CaseFieldValue;
  contactNumber: CaseFieldValue;
  contradictionDetected?: boolean;
  escalated?: boolean;
  escalationReason?: string;
};

export type EscalationResult = {
  shouldEscalate: boolean;
  reason: string;
};
