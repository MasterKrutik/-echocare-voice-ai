import {
  AgoraClient,
  AgentSession,
  Area,
  generateConvoAIToken,
} from 'agora-agents';
import { DEFAULT_AGENT_UID } from '@/lib/agora';

export interface RegisteredSession {
  channelName: string;
  agentId: string;
  session?: AgentSession;
  createdAt: number;
}

export { POST_ESCALATION_HOLD_PROMPT } from '@/lib/prompts';

// Attach to globalThis so the registry persists across Next.js Fast Refresh in dev mode
interface GlobalWithRegistry {
  __echoCareAgentRegistry?: Map<string, RegisteredSession>;
  __echoCareChannelToAgent?: Map<string, string>;
}

const globalRegistry = globalThis as unknown as GlobalWithRegistry;
if (!globalRegistry.__echoCareAgentRegistry) {
  globalRegistry.__echoCareAgentRegistry = new Map<string, RegisteredSession>();
}
if (!globalRegistry.__echoCareChannelToAgent) {
  globalRegistry.__echoCareChannelToAgent = new Map<string, string>();
}

const sessionRegistry = globalRegistry.__echoCareAgentRegistry;
const channelToAgentMap = globalRegistry.__echoCareChannelToAgent;

/**
 * Register a started agent session
 */
export function registerAgentSession(
  channelName: string,
  agentId: string,
  session?: AgentSession,
): void {
  const item: RegisteredSession = {
    channelName,
    agentId,
    session,
    createdAt: Date.now(),
  };

  sessionRegistry.set(agentId, item);
  sessionRegistry.set(channelName, item);
  channelToAgentMap.set(channelName, agentId);
}

/**
 * Unregister an agent session when stopped
 */
export function unregisterAgentSession(identifier: string): void {
  const item = sessionRegistry.get(identifier);
  if (item) {
    sessionRegistry.delete(item.agentId);
    sessionRegistry.delete(item.channelName);
    channelToAgentMap.delete(item.channelName);
  } else {
    sessionRegistry.delete(identifier);
  }
}

/**
 * Get registered session by agentId or channelName
 */
export function getRegisteredSession(identifier: string): RegisteredSession | undefined {
  return sessionRegistry.get(identifier);
}

/**
 * Resolve agentId by channelName or agentId
 */
export function resolveAgentId(identifier: string): string {
  if (channelToAgentMap.has(identifier)) {
    return channelToAgentMap.get(identifier)!;
  }
  const session = sessionRegistry.get(identifier);
  if (session?.agentId) {
    return session.agentId;
  }
  return identifier;
}

export interface UpdateInstructionsResult {
  success: boolean;
  agentId: string;
  method: 'session_sdk' | 'client_rest';
  error?: string;
}

/**
 * Update agent instructions dynamically at runtime on the running session
 * using Agora's SDK or REST API.
 */
export async function updateAgentInstructions(
  identifier: string,
  instructions: string,
): Promise<UpdateInstructionsResult> {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;

  const targetAgentId = resolveAgentId(identifier);
  const registered = sessionRegistry.get(identifier) || sessionRegistry.get(targetAgentId);

  // 1. Try updating via running AgentSession SDK method if available in memory
  if (registered?.session) {
    try {
      await registered.session.update({
        llm: {
          system_messages: [
            {
              role: 'system',
              content: instructions,
            },
          ],
        },
      });
      return {
        success: true,
        agentId: targetAgentId,
        method: 'session_sdk',
      };
    } catch (err) {
      console.warn('AgentSession.update failed, falling back to client.agents.update:', err);
    }
  }

  // 2. Fall back to AgoraClient REST API call with ConvoAI auth token
  if (!appId || !appCertificate) {
    throw new Error('Agora configuration missing (NEXT_PUBLIC_AGORA_APP_ID or NEXT_AGORA_APP_CERTIFICATE)');
  }

  const client = new AgoraClient({
    area: Area.US,
    appId,
    appCertificate,
  });

  const channel = registered?.channelName || identifier;
  const token = generateConvoAIToken({
    appId,
    appCertificate,
    channelName: channel,
    uid: DEFAULT_AGENT_UID,
  });

  await client.agents.update(
    {
      appid: appId,
      agentId: targetAgentId,
      properties: {
        llm: {
          system_messages: [
            {
              role: 'system',
              content: instructions,
            },
          ],
        },
      },
    },
    {
      headers: {
        Authorization: `agora token=${token}`,
      },
    },
  );

  return {
    success: true,
    agentId: targetAgentId,
    method: 'client_rest',
  };
}
