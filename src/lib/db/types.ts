/**
 * Database Types for Neon PostgreSQL
 * Corresponds to migrations/neon_schema.sql
 */

import type { Difficulty, BloomLevel } from "../ai/schemas";
import type { ImportMode, ImportFidelity, QuestionMediaRef } from "../learning/exact-import-types";
import type { QuestionStatus } from "../learning/question-bank";

export interface ProfileRecord {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role: "student" | "teacher" | "admin" | "org_admin";
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  user_id?: string | null;
  course_id?: string | null;
  title: string;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  storage_key?: string | null;
  storage_bucket: string;
  file_hash?: string | null;
  page_count: number;
  extracted_text?: string | null;
  summary?: string | null;
  dominant_language: string;
  created_at: string;
}

export interface ConceptRecord {
  id: string;
  document_id: string;
  name: string;
  topic: string;
  definition?: string | null;
  created_at: string;
}

export interface QuestionRecord {
  id: string;
  document_id?: string | null;
  concept_id?: string | null;
  created_by?: string | null;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  bloom_level: BloomLevel;
  evidence_quote?: string | null;
  quality_score?: Record<string, unknown> | null;
  status: QuestionStatus;

  // Exact Source Invariants & Fidelity Fields
  import_mode: ImportMode;
  import_fidelity?: ImportFidelity | null;
  original_text?: string | null;
  source_snapshot?: string | null;
  source_raw_hash?: string | null;
  canonical_question_hash?: string | null;
  render_source_exactly?: boolean | null;
  correct_answer_source?: string | null;
  source_page?: number | null;
  source_section?: string | null;
  source_question_number?: number | null;
  source_document_name?: string | null;
  media_refs?: QuestionMediaRef[] | null;
  requires_review?: boolean | null;
  review_reason?: string | null;
  created_at: string;
}

export interface QuizAttemptRecordDb {
  id: string;
  user_id?: string | null;
  document_id?: string | null;
  course_id?: string | null;
  total_questions: number;
  score: number;
  percentage: number;
  created_at: string;
}

export interface AttemptAnswerRecordDb {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_index?: number | null;
  is_correct: boolean;
  time_taken_seconds?: number | null;
  created_at: string;
}

export interface LearnerMasteryRecordDb {
  id: string;
  user_id: string;
  topic: string;
  total_attempts: number;
  correct_count: number;
  mastery_percentage: number;
  status: "mastered" | "in_progress" | "struggling";
  updated_at: string;
}

export interface ReviewScheduleRecordDb {
  id: string;
  user_id: string;
  question_id: string;
  next_review_at: string;
  repetition_count: number;
  ease_factor: number;
  interval_days: number;
  created_at: string;
}
