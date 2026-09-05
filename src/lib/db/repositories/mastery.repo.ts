/**
 * Mastery Repository — Neon PostgreSQL
 * Handles cumulative topic mastery, accuracy scoring, and learner retention.
 */

import { getDb } from "../neon.ts";
import { profilesRepo } from "./profiles.repo.ts";
import type { ConceptMastery } from "../../learning/mastery-engine.ts";

export const masteryRepo = {
  async getLearnerMastery(userId: string): Promise<Record<string, ConceptMastery>> {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM public.learner_mastery WHERE user_id = ${userId};
    `;

    const mastery: Record<string, ConceptMastery> = {};
    for (const r of rows) {
      mastery[r.topic] = {
        name: r.topic,
        topic: r.topic,
        correctCount: Number(r.correct_count),
        totalAttempts: Number(r.total_attempts),
        accuracy:
          r.total_attempts > 0
            ? Math.round((Number(r.correct_count) / Number(r.total_attempts)) * 100)
            : 0,
        masteryScore: Number(r.mastery_percentage),
        status: r.status as "mastered" | "in_progress" | "struggling",
      };
    }
    return mastery;
  },

  async upsertTopicMastery(
    userId: string,
    topic: string,
    correctCount: number,
    totalAttempts: number,
    masteryPercentage: number,
    status: "mastered" | "in_progress" | "struggling" = "in_progress",
  ): Promise<void> {
    await profilesRepo.ensureProfile(userId);
    const sql = getDb();

    await sql`
      INSERT INTO public.learner_mastery (
        user_id,
        topic,
        correct_count,
        total_attempts,
        mastery_percentage,
        status,
        updated_at
      ) VALUES (
        ${userId},
        ${topic},
        ${correctCount},
        ${totalAttempts},
        ${masteryPercentage},
        ${status},
        NOW()
      )
      ON CONFLICT (user_id, topic) DO UPDATE SET
        correct_count = EXCLUDED.correct_count,
        total_attempts = EXCLUDED.total_attempts,
        mastery_percentage = EXCLUDED.mastery_percentage,
        status = EXCLUDED.status,
        updated_at = NOW();
    `;
  },

  async recordQuizMastery(
    userId: string,
    topicMastery: Record<string, ConceptMastery>,
  ): Promise<void> {
    await profilesRepo.ensureProfile(userId);
    for (const [topic, data] of Object.entries(topicMastery)) {
      await this.upsertTopicMastery(
        userId,
        topic,
        data.correctCount,
        data.totalAttempts,
        data.masteryScore,
        data.status,
      );
    }
  },
};
