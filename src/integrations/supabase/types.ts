export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          role: "student" | "teacher" | "admin" | "org_admin";
          preferred_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          role?: "student" | "teacher" | "admin" | "org_admin";
          preferred_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      documents: {
        Row: {
          id: string;
          user_id: string | null;
          course_id: string | null;
          title: string;
          file_name: string;
          file_size_bytes: number;
          file_type: string;
          extracted_text: string | null;
          summary: string | null;
          dominant_language: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          course_id?: string | null;
          title: string;
          file_name: string;
          file_size_bytes: number;
          file_type: string;
          extracted_text?: string | null;
          summary?: string | null;
          dominant_language?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          document_id: string | null;
          concept_id: string | null;
          created_by: string | null;
          question: string;
          options: Json;
          correct_index: number;
          explanation: string;
          topic: string;
          difficulty: "easy" | "medium" | "hard";
          bloom_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
          evidence_quote: string | null;
          quality_score: Json | null;
          status: "draft" | "generated" | "validated" | "approved" | "rejected" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id?: string | null;
          concept_id?: string | null;
          created_by?: string | null;
          question: string;
          options: Json;
          correct_index: number;
          explanation: string;
          topic: string;
          difficulty: "easy" | "medium" | "hard";
          bloom_level?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
          evidence_quote?: string | null;
          quality_score?: Json | null;
          status?: "draft" | "generated" | "validated" | "approved" | "rejected" | "archived";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string | null;
          document_id: string | null;
          course_id: string | null;
          total_questions: number;
          score: number;
          percentage: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          document_id?: string | null;
          course_id?: string | null;
          total_questions: number;
          score: number;
          percentage: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_attempts"]["Insert"]>;
      };
      learner_mastery: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          total_attempts: number;
          correct_count: number;
          mastery_percentage: number;
          status: "mastered" | "in_progress" | "struggling";
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          total_attempts?: number;
          correct_count?: number;
          mastery_percentage?: number;
          status?: "mastered" | "in_progress" | "struggling";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["learner_mastery"]["Insert"]>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;
