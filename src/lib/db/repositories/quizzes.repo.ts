/**
 * Quizzes Repository — Neon PostgreSQL
 * Handles quiz attempts, answer logs, and historical performance records.
 */

import { getDb } from "../neon.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export interface SaveQuizAttemptInput {
  userId?: string | null;
  documentId?: string | null;
  courseId?: string | null;
  totalQuestions: number;
  score: number;
  percentage: number;
  answers: Array<{
    questionId: string;
    selectedIndex?: number | null;
    isCorrect: boolean;
    timeTakenSeconds?: number;
  }>;
}

export const quizzesRepo = {
  async recordAttempt(input: SaveQuizAttemptInput): Promise<{ id: string }> {
    const sql = getDb();
    const userId = isValidUuid(input.userId) ? input.userId : null;
    const documentId = isValidUuid(input.documentId) ? input.documentId : null;
    const courseId = isValidUuid(input.courseId) ? input.courseId : null;

    // 1. Insert quiz attempt
    const attemptRows = await sql`
      INSERT INTO public.quiz_attempts (
        user_id,
        document_id,
        course_id,
        total_questions,
        score,
        percentage
      ) VALUES (
        ${userId},
        ${documentId},
        ${courseId},
        ${input.totalQuestions},
        ${input.score},
        ${input.percentage}
      )
      RETURNING id;
    `;

    const attemptId = attemptRows[0].id;

    // 2. Insert answers
    for (const ans of input.answers) {
      if (!isValidUuid(ans.questionId)) continue;
      await sql`
        INSERT INTO public.attempt_answers (
          attempt_id,
          question_id,
          selected_index,
          is_correct,
          time_taken_seconds
        ) VALUES (
          ${attemptId},
          ${ans.questionId},
          ${ans.selectedIndex ?? null},
          ${ans.isCorrect},
          ${ans.timeTakenSeconds ?? null}
        );
      `;
    }

    return { id: attemptId };
  },

  async getAttempts(userId?: string): Promise<Record<string, unknown>[]> {
    const sql = getDb();
    const uid = isValidUuid(userId) ? userId : null;

    if (uid) {
      const rows = await sql`
        SELECT a.*,
          (SELECT json_agg(ans.*) FROM public.attempt_answers ans WHERE ans.attempt_id = a.id) as answers
        FROM public.quiz_attempts a
        WHERE a.user_id = ${uid}
        ORDER BY a.created_at DESC
        LIMIT 50;
      `;
      return rows as unknown as Record<string, unknown>[];
    }

    const rows = await sql`
      SELECT a.*,
        (SELECT json_agg(ans.*) FROM public.attempt_answers ans WHERE ans.attempt_id = a.id) as answers
      FROM public.quiz_attempts a
      ORDER BY a.created_at DESC
      LIMIT 50;
    `;
    return rows as unknown as Record<string, unknown>[];
  },
};
