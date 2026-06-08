import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import { checkRateLimit } from '@/lib/db';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import type { User } from '@/lib/types';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await checkRateLimit(`ai-chat:${user.id}`, 20, 60)) {
      return NextResponse.json({ error: 'Rate limit: 20 messages per minute.' }, { status: 429 });
    }

    const body = await request.json() as { message?: string; history?: ChatMessage[]; context?: string };
    const { message, history = [], context = '' } = body;
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const systemPrompt = `You are the Tokenly AI Assistant — a helpful, knowledgeable guide for the Tokenly physical asset tokenization platform.

You help users with:
- Understanding how vault tokens work
- Explaining the CAN (Certified Authenticator Network) system
- Providing market insights on sneakers, watches, luxury goods, trading cards
- Explaining the RRS (Reviewer Reputation Score) system
- Navigating platform features

Platform context: ${context || 'User is on the Tokenly platform.'}
User: ${(user as unknown as Record<string, unknown>).name ?? 'Member'} | Points: ${(user as unknown as Record<string, unknown>).points ?? 0} | RRS: ${(user as unknown as Record<string, unknown>).rrs_score ?? 0}

Be concise, helpful, and honest. Never promise features that don't exist yet.`;

    const messages = [
      ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const response = await groqChat({
      model: GROQ_MODELS.fast,
      max_tokens: 600,
      temperature: 0.7,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });

    return NextResponse.json({ success: true, response, powered_by: 'Llama 3.1 8B Instant (Groq)' });
  } catch (error) {
    console.error('[AI-Chat]', error);
    return NextResponse.json({ error: 'AI assistant unavailable. Please try again.' }, { status: 500 });
  }
}
