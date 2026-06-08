import { NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';

import type { DbAdapter } from '@/lib/db-types';

interface QuestDef {
  reward: number;
  desc: string;
  type: 'daily' | 'onetime';
  check?: (db: DbAdapter, userId: string) => Promise<boolean>;
}

const QUESTS: Record<string, QuestDef> = {
  'daily_login': { reward: 50, desc: 'Daily Login Reward', type: 'daily' },
  'first_review': { 
    reward: 200, desc: 'Submit Your First Review', type: 'onetime',
    check: async (db, userId) => {
      const r = await db.prepare('SELECT total_reviews FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      return Boolean(r && Number(r.total_reviews) >= 1);
    }
  },
  'five_reviews': { 
    reward: 500, desc: 'Complete 5 Product Reviews', type: 'onetime',
    check: async (db, userId) => {
      const r = await db.prepare('SELECT total_reviews FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      return Boolean(r && Number(r.total_reviews) >= 5);
    }
  },
  'first_trade': { 
    reward: 150, desc: 'Execute Your First Vault Trade', type: 'onetime',
    check: async (db, userId) => {
      const t = await db.prepare('SELECT COUNT(*) as c FROM trades WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
      return Boolean(t && Number(t.c) >= 1);
    }
  },
  'accuracy_master': { 
    reward: 1000, desc: 'Achieve 80%+ Review Accuracy (5+ reviews)', type: 'onetime',
    check: async (db, userId) => {
      const u = await db.prepare('SELECT total_reviews, accurate_reviews FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      const tr = Number(u?.total_reviews);
      const ar = Number(u?.accurate_reviews);
      return Boolean(u && tr >= 5 && tr > 0 && ar / tr >= 0.8);
    }
  },
  'portfolio_builder': { 
    reward: 300, desc: 'Own Shares in 3 Different Assets', type: 'onetime',
    check: async (db, userId) => {
      const s = await db.prepare('SELECT COUNT(DISTINCT product_id) as c FROM user_shares WHERE user_id = ? AND shares > 0').get(userId) as Record<string, unknown> | undefined;
      return Boolean(s && Number(s.c) >= 3);
    }
  },
};

export async function GET(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
        const userId = user.id as string;

    const questList = await Promise.all(Object.entries(QUESTS).map(async ([id, quest]) => {
      let completed = false;
      const todayFilter = "date('now')";
      
      if (quest.type === 'daily') {
        const prev = await db.prepare(`SELECT id FROM quest_completions WHERE user_id = ? AND quest_id = ? AND completed_at >= ${todayFilter}`).get(userId, id);
        completed = !!prev;
      } else {
        const prev = await db.prepare('SELECT id FROM quest_completions WHERE user_id = ? AND quest_id = ?').get(userId, id);
        completed = !!prev;
      }

      let eligible = false;
      if (quest.type === 'daily') {
        eligible = !completed;
      } else {
        eligible = !completed && (quest.check ? await quest.check(db, userId) : true);
      }

      return { id, title: quest.desc, reward: quest.reward, type: quest.type, completed, eligible };
    }));

    return NextResponse.json({ quests: questList });
  } catch (error) {
    console.error('Quest List Error:', error);
    return NextResponse.json({ error: "Quest claim failed. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const questId = body.questId || 'daily_login';
    
    if (!QUESTS[questId]) return NextResponse.json({ error: 'Invalid Quest ID' }, { status: 400 });

    const quest = QUESTS[questId];
    const db = await getDb();
        const userId = user.id as string;

    const todayFilter = "date('now')";
    if (quest.type === 'daily') {
      const prev = await db.prepare(`SELECT id FROM quest_completions WHERE user_id = ? AND quest_id = ? AND completed_at >= ${todayFilter}`).get(userId, questId);
      if (prev) return NextResponse.json({ error: 'Quest already claimed today.' }, { status: 400 });
    } else {
      const prev = await db.prepare('SELECT id FROM quest_completions WHERE user_id = ? AND quest_id = ?').get(userId, questId);
      if (prev) return NextResponse.json({ error: 'Quest already completed.' }, { status: 400 });
    }

    if (quest.check && !await quest.check(db, userId)) {
      return NextResponse.json({ error: 'Quest requirements not met yet.' }, { status: 400 });
    }

    await db.transaction(async (txDb) => {
      await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(quest.reward, userId);
      await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), userId, quest.reward, 'reward', quest.desc);
      await txDb.prepare('INSERT INTO quest_completions (id, user_id, quest_id) VALUES (?, ?, ?)')
        .run(crypto.randomUUID(), userId, questId);
    });

    const updatedUser = await db.prepare('SELECT id, name, points, experiment_group, rrs_score, total_reviews, accurate_reviews, is_admin, total_trades FROM users WHERE id = ?').get(userId);

    // Quest completion notification (in-app + push)
    createNotification(
      userId,
      'Quest Complete',
      `${quest.desc} — You earned ${quest.reward.toLocaleString()} PTS!`,
      'yield',
      '/dashboard'
    ).catch(() => {});

    return NextResponse.json({ 
      success: true, 
      message: `Quest Complete! You received ${quest.reward} pts.`,
      reward: quest.reward,
      user: updatedUser
    });

  } catch (error) {
    console.error('Quest Route Error:', error);
    return NextResponse.json({ error: "Quest claim failed. Please try again." }, { status: 500 });
  }
}
