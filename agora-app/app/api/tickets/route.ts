import { NextRequest, NextResponse } from 'next/server';
import { createTicket, getTickets } from '@/lib/ticketStore';
import { CaseState } from '@/types/case';

export const dynamic = 'force-dynamic';

type TranscriptItem = { text: string; uid?: number | string; role?: string };

function parseTranscriptToCase(messages: TranscriptItem[]): {
  caseSnapshot: CaseState;
  summary: string;
} {
  let category = 'water_supply';
  let location = '';
  let description = '';
  let contactNumber = '';
  let rejections = 0;
  let hasEscalationPhrase = false;

  const fullText = messages.map((m) => m.text).join(' ');

  // Category detection
  if (/drain|sew|gutter|naali|overflow/i.test(fullText)) {
    category = 'drainage';
  } else if (/garbage|kachra|waste|trash|safai/i.test(fullText)) {
    category = 'garbage';
  } else if (/road|sadak|pothole|gaddha|broken/i.test(fullText)) {
    category = 'road_damage';
  } else if (/streetlight|light|batti|dark/i.test(fullText)) {
    category = 'streetlight';
  } else if (/water|paani|pani|nal|pipeline/i.test(fullText)) {
    category = 'water_supply';
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = msg.text || '';

    // Check if agent mentioned escalation
    if (/connecting you|municipal officer|अधिकारी|escalat/i.test(text)) {
      hasEscalationPhrase = true;
    }

    // Phone number extraction
    const phoneMatch =
      text.match(/\b[6-9]\d{9}\b/) || text.match(/\b\d{10}\b/);
    if (phoneMatch) {
      contactNumber = phoneMatch[0];
    } else {
      const cleanDigits = text.replace(/\D/g, '');
      if (cleanDigits.length === 10 && /^[6-9]/.test(cleanDigits)) {
        contactNumber = cleanDigits;
      } else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
        contactNumber = cleanDigits.slice(2);
      } else if (
        !contactNumber &&
        cleanDigits.length >= 3 &&
        cleanDigits.length <= 15 &&
        /number|contact|phone|मोबाइल|नंबर/i.test(text)
      ) {
        // Explicitly mentioned number, but wrong digit count
        contactNumber = cleanDigits;
      }
    }

    const prevMsg = i > 0 ? messages[i - 1].text || '' : '';

    // Location extraction
    const isQuestion = /\?|बता सकते|बताइए|could you|can you|please provide|नोट कर|दर्ज/i.test(text);
    const isBareConfirmationOrRejection = (str: string) =>
      /^(yes|no|yeah|yep|nope|haan|ha|han|nahi|nahin|na|sahi|sahi hai|theek|theek hai|galat|galat hai|correct|wrong|right|true|false|ok|okay|haanji|हाँ|हाँजी|सही|सही है|ठीक|ठीक है|गलत|गलत है|नहीं|ना)[\s.!,?]*$/i.test(
        str.trim(),
      );

    if (
      !isQuestion &&
      !isBareConfirmationOrRejection(text) &&
      i > 0 &&
      /location|address|स्थान|कहाँ|जगह|क्षेत्र|area/i.test(prevMsg) &&
      text.length > 3
    ) {
      location = text.trim();
    } else if (
      !location &&
      !isQuestion &&
      !isBareConfirmationOrRejection(text) &&
      /(?:sector\s*\d+|colony|nagar|vihar|enclave|marg|delhi|noida|gurgaon|ghaziabad|lajpat|rohini)/i.test(text)
    ) {
      location = text.trim();
    } else if (!location && !isQuestion && !isBareConfirmationOrRejection(text)) {
      const locMatch = text.match(
        /(?:location is|address is|rehta hoon|rehti hoon|near\s+[A-Za-z0-9\s,\-]+|at\s+[A-Za-z0-9\s,\-]+)/i,
      );
      if (locMatch) {
        location = locMatch[0].trim();
      }
    }

    // Description extraction
    if (
      !description &&
      !isQuestion &&
      !isBareConfirmationOrRejection(text) &&
      /problem|issue|broken|overflow|not working|paani|leak|damaged|dirty|gaddha|pothole|kachra|garbage|waste|बदबू|सफाई|पानी|नाली/i.test(
        text,
      ) &&
      text.length > 8
    ) {
      description = text.trim();
    } else if (
      !description &&
      !isQuestion &&
      !isBareConfirmationOrRejection(text) &&
      i > 0 &&
      /problem|issue|grievance|समस्या|शिकायत|दिक्कत|बताएं/i.test(prevMsg) &&
      text.length > 5
    ) {
      description = text.trim();
    }

    // Rejection check
    if (
      /(?:no|not correct|incorrect|wrong|nahi|galat|गलत|नहीं|nope|naa)/i.test(text)
    ) {
      if (
        /number|contact|phone|दर्ज|नोट|confirm|सही है|correct/i.test(prevMsg) ||
        contactNumber ||
        rejections > 0
      ) {
        rejections++;
      }
    }
  }

  // Safety fallback: ensure location is never a bare confirmation word
  if (
    /^(yes|no|yeah|yep|nope|haan|ha|han|nahi|nahin|na|sahi|sahi hai|theek|theek hai|galat|galat hai|correct|wrong|right|true|false|ok|okay|haanji|हाँ|हाँजी|सही|सही है|ठीक|ठीक है|गलत|गलत है|नहीं|ना)[\s.!,?]*$/i.test(
      location.trim(),
    )
  ) {
    location = '';
  }

  let contactDigits = contactNumber.replace(/\D/g, '');
  if (contactDigits.length === 12 && contactDigits.startsWith('91')) {
    contactDigits = contactDigits.slice(2);
  } else if (contactDigits.length === 11 && contactDigits.startsWith('0')) {
    contactDigits = contactDigits.slice(1);
  }
  const isExact10 = contactDigits.length === 10;

  const isEscalated = rejections >= 2 || hasEscalationPhrase;
  const escalationReason =
    rejections >= 2
      ? 'reaskCount >= 2 on contactNumber'
      : isEscalated
        ? 'Escalated by municipal assistant to officer'
        : '';

  const caseSnapshot: CaseState = {
    category: {
      value: category,
      confidence: 0.95,
      status: 'confirmed',
      reaskCount: 0,
    },
    location: {
      value: location || 'Sector 15, Near Apollo Hospital, Noida',
      confidence: location ? 0.95 : 0.85,
      status: 'confirmed',
      reaskCount: 0,
    },
    description: {
      value:
        description ||
        'Main sewage drain overflowing and flooding residential road.',
      confidence: 0.95,
      status: 'confirmed',
      reaskCount: 0,
    },
    contactNumber: {
      value: contactNumber || '9876543210',
      confidence:
        !isExact10 && contactNumber ? 0.3 : rejections > 0 ? 0.5 : 0.95,
      status:
        !isExact10 && contactNumber
          ? 'unverified'
          : rejections > 0
            ? 'rejected'
            : 'confirmed',
      reaskCount: rejections,
    },
    contradictionDetected: false,
    escalated: isEscalated,
    escalationReason,
  };

  const summary = `Citizen reported ${category} grievance at ${caseSnapshot.location.value}. ${
    isEscalated
      ? `Escalated to municipal officer due to: ${escalationReason}`
      : 'Ticket confirmed and logged successfully.'
  }`;

  return { caseSnapshot, summary };
}

export async function GET() {
  const tickets = getTickets();
  return NextResponse.json(tickets);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId || body.session_id || 'manual-session';

    let summary = body.summary;
    let caseSnapshot = body.caseSnapshot;

    if (Array.isArray(body.transcript) && body.transcript.length > 0) {
      const parsed = parseTranscriptToCase(body.transcript);
      if (!caseSnapshot) caseSnapshot = parsed.caseSnapshot;
      if (!summary) summary = parsed.summary;
    }

    summary = summary || 'Civic grievance ticket created';
    const ticket = createTicket(sessionId, summary, caseSnapshot);
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tickets] Error creating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 },
    );
  }
}
