import { CaseState } from '@/types/case';
import { getCase } from './caseStore';

export type Ticket = {
  ticketId: string;
  sessionId: string;
  summary: string;
  caseSnapshot: CaseState;
  createdAt: string;
};

const tickets: Ticket[] = [];

export function createTicket(sessionId: string, summary: string): Ticket {
  const currentCase = getCase(sessionId);
  const caseSnapshot: CaseState = JSON.parse(JSON.stringify(currentCase));

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
  return [...tickets];
}

export function resetTicketStore(): void {
  tickets.length = 0;
}
