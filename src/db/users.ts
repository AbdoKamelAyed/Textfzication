import { eq } from 'drizzle-orm';
import { db, isSqlAvailable, markSqlUnavailable } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null) {
  if (!(await isSqlAvailable())) {
    return null;
  }

  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0] ?? null;
  } catch {
    markSqlUnavailable();
    return null;
  }
}

export async function getUserByUid(uid: string) {
  if (!(await isSqlAvailable())) {
    return null;
  }

  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch {
    markSqlUnavailable();
    return null;
  }
}
