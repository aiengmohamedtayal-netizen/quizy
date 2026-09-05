/**
 * Profiles Repository — Neon PostgreSQL
 * Handles user identity records, session ownership, and role management.
 */

import { getDb } from "../neon.ts";
import type { ProfileRecord } from "../types.ts";

export const profilesRepo = {
  async ensureProfile(userId: string, fullName = "مستخدم كويزي"): Promise<ProfileRecord> {
    const sql = getDb();
    const rows = await sql`
      INSERT INTO public.profiles (id, full_name, role)
      VALUES (${userId}, ${fullName}, 'student')
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      RETURNING *;
    `;
    return rows[0] as unknown as ProfileRecord;
  },

  async getProfileById(userId: string): Promise<ProfileRecord | null> {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM public.profiles WHERE id = ${userId} LIMIT 1;
    `;
    return (rows[0] as unknown as ProfileRecord) ?? null;
  },
};
