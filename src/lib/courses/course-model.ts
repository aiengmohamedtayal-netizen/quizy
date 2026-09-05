export type UserRole = "student" | "teacher" | "admin" | "org_admin";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
}

export interface Course {
  id: string;
  organizationId?: string;
  instructorId: string;
  title: string;
  description: string;
  category: string;
  isPublished: boolean;
  createdAt: number;
  modulesCount: number;
}

export interface CourseModule {
  id: string;
  courseId: string;
  order: number;
  title: string;
  description?: string;
}

export interface CourseLesson {
  id: string;
  moduleId: string;
  order: number;
  title: string;
  documentSnippet?: string;
  quizId?: string;
}

export interface QuizAssignment {
  id: string;
  courseId: string;
  title: string;
  dueDate?: string;
  passingPercentage: number;
  totalQuestions: number;
}

export interface ShareableResource {
  id: string;
  shareToken: string;
  resourceType: "quiz" | "course" | "study_set";
  resourceId: string;
  title: string;
  isPublic: boolean;
  viewCount: number;
  createdAt: number;
}

/**
 * Generates an unguessable 12-character alphanumeric share token
 */
export function generateShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
