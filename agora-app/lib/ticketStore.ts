import { CaseState } from '@/types/case';
import { getCase } from './caseStore';

export type Ticket = {
  ticketId: string;
  sessionId: string;
  summary: string;
  caseSnapshot: CaseState;
  createdAt: string;
};

const globalForTickets = globalThis as unknown as {
  __echocare_tickets?: Ticket[];
};

if (!globalForTickets.__echocare_tickets || globalForTickets.__echocare_tickets.length === 0) {
  globalForTickets.__echocare_tickets = [
    {
      ticketId: 'TICKET-1788705977146-M5LAD',
      sessionId: 'echocare-live-session-1',
      summary:
        'Citizen reported garbage grievance at sector eight nearmarket. Escalated to municipal officer due to: Escalated by municipal assistant to officer (Hold mode)',
      caseSnapshot: {
        category: {
          value: 'garbage',
          confidence: 0.95,
          status: 'confirmed',
          reaskCount: 0,
        },
        location: {
          value: 'sector eight nearmarket',
          confidence: 0.95,
          status: 'confirmed',
          reaskCount: 1,
        },
        description: {
          value:
            'से garbage नहीं आई है. और बहुत बदबू आ रही है। (Garbage collection disrupted for days with severe foul smell)',
          confidence: 0.95,
          status: 'confirmed',
          reaskCount: 0,
        },
        contactNumber: {
          value: '9876543210',
          confidence: 0.95,
          status: 'confirmed',
          reaskCount: 0,
        },
        contradictionDetected: true,
        escalated: true,
        escalationReason:
          'Escalated by municipal assistant to officer (Hold mode)',
      },
      createdAt: new Date().toISOString(),
    },
  ];
}

const tickets: Ticket[] = globalForTickets.__echocare_tickets;

export function createTicket(
  sessionId: string,
  summary: string,
  customSnapshot?: Partial<CaseState>,
): Ticket {
  const currentCase = getCase(sessionId);
  if (customSnapshot) {
    if (customSnapshot.category) {
      currentCase.category = { ...currentCase.category, ...customSnapshot.category };
    }
    if (customSnapshot.location) {
      currentCase.location = { ...currentCase.location, ...customSnapshot.location };
    }
    if (customSnapshot.description) {
      currentCase.description = { ...currentCase.description, ...customSnapshot.description };
    }
    if (customSnapshot.contactNumber) {
      currentCase.contactNumber = { ...currentCase.contactNumber, ...customSnapshot.contactNumber };
    }
    if (customSnapshot.contradictionDetected !== undefined) {
      currentCase.contradictionDetected = customSnapshot.contradictionDetected;
    }
    if (customSnapshot.escalated !== undefined) {
      currentCase.escalated = customSnapshot.escalated;
    }
    if (customSnapshot.escalationReason !== undefined) {
      currentCase.escalationReason = customSnapshot.escalationReason;
    }
  }

  const caseSnapshot: CaseState = JSON.parse(JSON.stringify(currentCase));

  const existingIndex = tickets.findIndex((t) => t.sessionId === sessionId);
  if (existingIndex >= 0) {
    tickets[existingIndex].summary = summary;
    tickets[existingIndex].caseSnapshot = caseSnapshot;
    return tickets[existingIndex];
  }

  const ticket: Ticket = {
    ticketId: `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    sessionId,
    summary,
    caseSnapshot,
    createdAt: new Date().toISOString(),
  };

  tickets.push(ticket);
  return ticket;
}

export function getTickets(): Ticket[] {
  return [...tickets].reverse();
}

export function resetTicketStore(): void {
  tickets.length = 0;
}
