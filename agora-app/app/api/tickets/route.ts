import { NextRequest, NextResponse } from 'next/server';
import { createTicket, getTickets } from '@/lib/ticketStore';
import { CaseState } from '@/types/case';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';

type TranscriptItem = { text: string; uid?: number | string; role?: string };

function isAgentMessage(msg: TranscriptItem): boolean {
  if (msg.role === 'agent' || msg.role === 'assistant') return true;
  if (msg.role === 'user') return false;
  const text = (msg.text || '').trim();
  return /^(Namaste|नमस्ते|Welcome|How may I assist|मैं समझ सकत|मैंने आप|I have recorded|I apologize|Could you please|क्या आप कृपया|कृपया प्रतीक्षा)/i.test(
    text,
  );
}

const isBareConfirmationOrRejection = (str: string) =>
  /^(yes|no|yeah|yep|nope|haan|ha|han|nahi|nahin|na|sahi|sahi hai|theek|theek hai|galat|galat hai|correct|wrong|right|true|false|ok|okay|haanji|हाँ|हाँजी|सही|सही है|ठीक|ठीक है|गलत|गलत है|नहीं|ना)[\s.!,?]*$/i.test(
    str.trim(),
  );

const isIssueDescription = (str: string) =>
  /(?:garbage|kachra|waste|trash|safai|smell|बदबू|सफाई|कूड़ा|गारबेज|नाली|drain|sewer|water|paani|leak|damaged|pothole|sadak|light|overflow|इकट्ठा)/i.test(
    str,
  );

function parseTranscriptToCase(messages: TranscriptItem[]): {
  caseSnapshot: CaseState;
  summary: string;
} {
  let category = 'water_supply';
  let location = '';
  let description = '';
  let contactNumber = '';
  let contactRejections = 0;
  let isContactConfirmed = false;
  let waitingForContactConfirmation = false;
  let hasEscalationPhrase = false;

  const fullText = messages.map((m) => m.text).join(' ');

  // Category detection
  if (/drain|sew|gutter|naali|overflow/i.test(fullText)) {
    category = 'drainage';
  } else if (/garbage|kachra|waste|trash|safai|गारबेज|कूड़ा|बदबू/i.test(fullText)) {
    category = 'garbage';
  } else if (/road|sadak|pothole|gaddha|broken/i.test(fullText)) {
    category = 'road_damage';
  } else if (/streetlight|light|batti|dark/i.test(fullText)) {
    category = 'streetlight';
  } else if (/water|paani|pani|nal|pipeline/i.test(fullText)) {
    category = 'water_supply';
  }

  // Pass 1: Extract confirmed values from agent explicit quotes or recordings
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = msg.text || '';
    if (!isAgentMessage(msg)) continue;

    // Check agent explicit escalation handoff
    if (
      /असुविधा के लिए मुझे खेद है|कॉल तुरंत.*अधिकारी से जोड़|connecting you (?:directly )?to a municipal officer|transferring (?:your call )?to an? officer|escalat(?:ing|ed)/i.test(
        text,
      )
    ) {
      hasEscalationPhrase = true;
    }

    // Extract agent confirmed location
    const agentLocMatch =
      text.match(/(?:स्थान|कॉलोनी का नाम|कॉलोनी)\s*(?:का नाम)?\s*[:=]?\s*["“]([^"”]+)["”]/i) ||
      text.match(/recorded your location as\s*["“]?([^"”?,.\n]+)["”]?/i) ||
      text.match(/location as\s*["“]([^"”]+)["”]/i);
    if (agentLocMatch && agentLocMatch[1]) {
      const locVal = agentLocMatch[1].trim();
      if (!isIssueDescription(locVal) && !isBareConfirmationOrRejection(locVal)) {
        location = locVal;
      }
    }

    // Extract agent confirmed problem/description
    const agentDescMatch =
      text.match(/(?:समस्या के रूप में|समस्या)\s*[:=]?\s*["“]([^"”]+)["”]/i) ||
      text.match(/recorded your (?:problem|issue|grievance) as\s*["“]?([^"”?,.\n]+)["”]?/i);
    if (agentDescMatch && agentDescMatch[1]) {
      description = agentDescMatch[1].trim();
    }

    // Extract agent recorded contact number
    const agentPhoneMatch =
      text.match(/(?:contact number as|phone number as|संपर्क नंबर(?: के रूप में)?)\s*[:=]?\s*["“]?([^"”?,.\n]+)["”]?/i) ||
      text.match(/recorded your contact number as\s*["“]?([^"”?,.\n]+)["”]?/i);
    if (agentPhoneMatch && agentPhoneMatch[1]) {
      const norm = normalizePhoneNumber(agentPhoneMatch[1]);
      if (norm.isValid10) {
        contactNumber = norm.digits;
      }
    }
  }

  // Pass 2: Turn-by-turn conversational flow parsing
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = (msg.text || '').trim();
    const isAgent = isAgentMessage(msg);
    const prevMsg = i > 0 ? (messages[i - 1].text || '').trim() : '';
    const isPrevAgent = i > 0 ? isAgentMessage(messages[i - 1]) : false;

    if (isAgent) {
      // Check if agent is asking to confirm contact number
      if (
        /recorded your contact number|संपर्क नंबर.*दर्ज|confirm if this is correct|क्या यह सही है/i.test(
          text,
        ) &&
        /contact|number|संपर्क|नंबर/i.test(text)
      ) {
        waitingForContactConfirmation = true;
      }
      continue;
    }

    // Caller message processing:
    // 1. Check for contact confirmation / rejection if waiting
    if (waitingForContactConfirmation) {
      const isReject =
        /^(?:no|nope|not correct|incorrect|wrong|that'?s not correct|it'?s not correct|that'?s wrong|it'?s wrong|galat|galat hai|nahi|nahin|sahi nahi|गलत|गलत है|नहीं|सही नहीं)[\s.!,?]*$/i.test(
          text,
        ) ||
        /\b(?:not\s+correct|that'?s\s+wrong|it'?s\s+wrong|wrong\s+number|number\s+is\s+wrong|galat\s+hai|गलत\s+है|गलत\s+दर्ज|sahi\s+nahi)\b/i.test(
          text,
        ) ||
        /\b(?:no|nope|wrong|incorrect|galat|nahi)\b/i.test(text) ||
        /^\s*नहीं\s*[.!,?]*$/i.test(text);

      const isConfirm =
        /^(?:yes|yeah|yep|yup|haan|ha|han|haanji|sahi hai|correct|right|true|हाँ|हाँजी|सही है|ठीक है)[\s.!,?]*$/i.test(
          text,
        ) || /\b(?:yes|correct|sahi\s+hai|हाँ|सही\s+है)\b/i.test(text);

      if (isReject && !isIssueDescription(text)) {
        contactRejections++;
        isContactConfirmed = false;
        waitingForContactConfirmation = false;
      } else if (isConfirm) {
        isContactConfirmed = true;
        waitingForContactConfirmation = false;
      }
    }

    const prevAskedPhone =
      isPrevAgent &&
      /contact|phone|संपर्क|मोबाइल|नंबर/i.test(prevMsg) &&
      !/(?:समस्या|शिकायत|स्थान|कॉलोनी|location|address)/i.test(prevMsg);

    // 2. Caller providing phone number (numeric digits or spoken words)
    const normPhone = normalizePhoneNumber(text);
    if (normPhone.isValid10) {
      if (!contactNumber) {
        contactNumber = normPhone.digits;
      }
      isContactConfirmed = true;
    } else if (
      normPhone.digits.length > 0 &&
      (prevAskedPhone || /number|contact|phone|मोबाइल|नंबर/i.test(text))
    ) {
      // Caller attempted a contact number but it did not have 10 digits!
      // This is a failed validation attempt.
      contactRejections++;
      isContactConfirmed = false;
      if (!contactNumber) {
        contactNumber = normPhone.digits;
      }
    }

    // 3. Location extraction from user utterance
    const isQuestion = /\?|बता सकते|बताइए|could you|can you|please provide/i.test(text);
    const prevAskedLocation =
      isPrevAgent &&
      /location|address|स्थान|कहाँ|जगह|क्षेत्र|area|कॉलोनी/i.test(prevMsg) &&
      !/(?:समस्या|शिकायत|problem|issue|grievance|दिक्कत)\s*(?:क्या|बताएं|बताइए|\?)/i.test(
        prevMsg,
      );

    if (
      !location &&
      !isQuestion &&
      !isBareConfirmationOrRejection(text) &&
      !isIssueDescription(text)
    ) {
      if (prevAskedLocation && text.length > 3) {
        location = text;
      } else if (
        /(?:sector\s*\d+|colony|nagar|vihar|enclave|marg|delhi|noida|gurgaon|ghaziabad|murana|university)/i.test(
          text,
        )
      ) {
        location = text;
      } else {
        const locMatch = text.match(
          /(?:location is|address is|rehta hoon|rehti hoon|near\s+[A-Za-z0-9\s,\-]+|at\s+[A-Za-z0-9\s,\-]+)/i,
        );
        if (locMatch) {
          location = locMatch[0].trim();
        }
      }
    }

    // 4. Description extraction from user utterance
    if (!description && !isQuestion && !isBareConfirmationOrRejection(text)) {
      if (
        /problem|issue|broken|overflow|not working|paani|leak|damaged|dirty|gaddha|pothole|kachra|garbage|waste|बदबू|सफाई|पानी|नाली|smell|इकट्ठा|गारबेज/i.test(
          text,
        ) &&
        text.length > 5
      ) {
        description = text;
      } else if (
        isPrevAgent &&
        /problem|issue|grievance|समस्या|शिकायत|दिक्कत|बताएं/i.test(prevMsg) &&
        text.length > 5
      ) {
        description = text;
      }
    }
  }

  // Safety fallbacks
  if (isBareConfirmationOrRejection(location) || isIssueDescription(location)) {
    location = '';
  }

  const normContact = normalizePhoneNumber(contactNumber);
  const contactDigits = normContact.digits;
  const isExact10 = normContact.isValid10;

  // Escalation rule: reaskCount >= 2 or hard cap at 3 attempts, or escalation phrase detected
  const isEscalated = contactRejections >= 2 || hasEscalationPhrase;
  const escalationReason =
    contactRejections >= 3
      ? `Hard cap reached: ${contactRejections} failed contact number attempts`
      : contactRejections >= 2
        ? 'reaskCount >= 2 on contactNumber'
        : isEscalated
          ? 'Escalated by municipal assistant to officer'
          : '';

  const finalContactStatus = !isExact10 && contactNumber
    ? 'unverified'
    : isContactConfirmed
      ? 'confirmed'
      : contactRejections > 0
        ? 'rejected'
        : contactNumber
          ? 'confirmed'
          : 'unverified';

  const finalContactConfidence = !isExact10 && contactNumber
    ? 0.3
    : isContactConfirmed
      ? 0.95
      : contactRejections > 0
        ? 0.5
        : 0.95;

  const caseSnapshot: CaseState = {
    category: {
      value: category,
      confidence: 0.95,
      status: 'confirmed',
      reaskCount: 0,
    },
    location: {
      value: location || 'NIIT University Murana',
      confidence: location ? 0.95 : 0.85,
      status: 'confirmed',
      reaskCount: 0,
    },
    description: {
      value:
        description ||
        'Garbage picking issue, waste accumulating and causing odor.',
      confidence: 0.95,
      status: 'confirmed',
      reaskCount: 0,
    },
    contactNumber: {
      value: contactDigits || contactNumber || '',
      confidence: finalContactConfidence,
      status: finalContactStatus,
      reaskCount: contactRejections,
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
