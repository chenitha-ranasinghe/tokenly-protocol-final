/**
 * GET /api/quests
 *
 * Returns the complete list of available quests enriched with per-user
 * completion status and eligibility. Mirrors the GET handler in
 * /api/quests/claim so both paths work for frontend consumers.
 *
 * Response shape:
 *  {
 *    quests: Quest[]   — see types.ts for the Quest interface
 *  }
 */

import { NextRequest } from 'next/server';

// Re-export the GET handler from the claim route so the quest list is
// always in sync — a single source of truth for the QUESTS registry.
export { GET } from '@/app/api/quests/claim/route';

// Explicitly block POST at this path (claims must go through /claim)
export async function POST(_request: NextRequest): Promise<Response> {
  return Response.json(
    {
      error: 'To claim a quest, POST to /api/quests/claim with { questId: string }.',
      code:  'BAD_REQUEST',
    },
    { status: 405 }
  );
}
