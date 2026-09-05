/**
 * Reviews Repository — Neon PostgreSQL
 * Handles spaced repetition schedules, due reviews, and SM-2 retention state.
 */

import { getDb } from "../neon.ts";
import { profilesRepo } from "./profiles.repo.ts";

export interface ReviewScheduleInput {
  userId: string;
  questionId: string;
  nextReviewAt: Date;
  repetitionCount?: number;
  easeFactor?: number;
  intervalDays?: number;
}

export const reviewsRepo = {
  async getDueReviews(
    userId: string,
    beforeDate: Date = new Date(),
  ): Promise<Record<string, unknown>[]> {
    const sql = getDb();
    const rows = await sql`
      SELECT r.*, q.question, q.options, q.correct_index, q.explanation, q.topic
      FROM public.review_schedules r
      JOIN public.questions q ON q.id = r.question_id
      WHERE r.user_id = ${userId}
        AND r.next_review_at <= ${beforeDate.toISOString()}
      ORDER BY r.next_review_at ASC;
    `;
    return rows as unknown as Record<string, unknown>[];
  },

  async scheduleReview(input: ReviewScheduleInput): Promise<void> {
    await profilesRepo.ensureProfile(input.userId);
    const sql = getDb();

    await sql`
      INSERT INTO public.review_schedules (
        user_id,
        question_id,
        next_review_at,
        repetition_count,
        ease_factor,
        interval_days
      ) VALUES (
        ${input.userId},
        ${input.questionId},
        ${input.nextReviewAt.toISOString()},
        ${input.repetitionCount ?? 0},
        ${input.easeFactor ?? 2.5},
        ${input.intervalDays ?? 1}
      );
    `;
  },
};
