import { NextRequest, NextResponse } from 'next/server';
import { updateAgentInstructions } from '@/lib/agentRegistry';
import { POST_ESCALATION_HOLD_PROMPT } from '@/lib/prompts';

export interface UpdateInstructionsBody {
  agentId?: string;
  agent_id?: string;
  channelName?: string;
  channel_name?: string;
  instructions?: string;
  mode?: 'hold' | 'custom';
}

/**
 * Agora Conversational AI Dynamic Instructions endpoint.
 *
 * Conforms to the official Agora "Dynamic Instructions" recipe pattern (POST /updateInstructions).
 * Allows updating the running agent's system prompt mid-session without restarting the session.
 */
export async function POST(request: NextRequest) {
  try {
    let body: UpdateInstructionsBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { agentId, agent_id, channelName, channel_name, mode } = body;
    let { instructions } = body;

    const identifier = agentId || agent_id || channel_name || channelName;

    if (!identifier) {
      return NextResponse.json(
        { error: 'agentId (or channel_name) is required' },
        { status: 400 },
      );
    }

    if (!instructions && mode === 'hold') {
      instructions = POST_ESCALATION_HOLD_PROMPT;
    } else if (instructions === 'hold') {
      instructions = POST_ESCALATION_HOLD_PROMPT;
    }

    if (!instructions || typeof instructions !== 'string' || instructions.trim().length === 0) {
      return NextResponse.json(
        { error: 'instructions string is required' },
        { status: 400 },
      );
    }

    const result = await updateAgentInstructions(identifier, instructions);

    return NextResponse.json({
      success: true,
      agentId: result.agentId,
      method: result.method,
      message: 'Instructions updated successfully',
    });
  } catch (error) {
    console.error('Error in /api/updateInstructions:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update instructions',
      },
      { status: 500 },
    );
  }
}
