import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { askAiTutorFn, type QuizQuestion, type TutorPromptType } from "@/lib/quiz.functions";
import {
  Sparkles,
  Lightbulb,
  Compass,
  HelpCircle,
  Loader2,
  Bot,
  CheckCircle2,
  Target,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TypewriterText } from "@/components/motion";

interface AiTutorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuizQuestion;
  selectedOptionText?: string;
  isCorrect?: boolean;
  documentSnippet?: string;
}

export function AiTutorDialog({
  open,
  onOpenChange,
  question,
  selectedOptionText,
  isCorrect,
  documentSnippet,
}: AiTutorDialogProps) {
  const [activePrompt, setActivePrompt] = useState<TutorPromptType | null>(null);
  const [loading, setLoading] = useState(false);
  const [tutorReply, setTutorReply] = useState<string>("");

  const askTutor = useServerFn(askAiTutorFn);

  const handleAsk = async (promptType: TutorPromptType) => {
    setActivePrompt(promptType);
    setLoading(true);
    setTutorReply("");

    try {
      const res = await askTutor({
        data: {
          questionText: question.question,
          studentAnswer: selectedOptionText,
          correctAnswer: question.options[question.correctIndex] || "",
          explanation: question.explanation,
          topic: question.topic,
          documentSnippet,
          promptType,
        },
      });

      setTutorReply(res.answer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر الاتصال بالمعلم الذكي";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8"
        dir="rtl"
      >
        <DialogHeader className="space-y-2 text-right">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20 surface-3d">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-heading-2 flex items-center gap-2 text-foreground">
                <span>مساعدك الدراسي</span>
                <Badge
                  variant="outline"
                  className="text-xs font-button bg-primary/5 text-primary border-primary/25"
                >
                  AI Tutor
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-body">
                مرشدك الأكاديمي بيوضح المفاهيم بناءً على المادة العلمية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Question Context Card - Double Bezel */}
        <div className="double-bezel mt-2">
          <div className="double-bezel-inner p-4 sm:p-5 space-y-2.5 text-right">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-body">
              <span className="font-button text-foreground">الموضوع: {question.topic}</span>
              {isCorrect !== undefined && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "font-button text-xs",
                    isCorrect
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-destructive/15 text-destructive border border-destructive/30",
                  )}
                >
                  {isCorrect ? "إجابتك صحيحة 🌟" : "إجابتك تحتاج تصحيحاً ⚠️"}
                </Badge>
              )}
            </div>
            <p className="text-sm sm:text-base font-heading-3 text-foreground leading-relaxed">
              {question.question}
            </p>
            <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5 font-body-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>الإجابة الصحيحة: </span>
              <span className="font-button text-emerald-800 dark:text-emerald-300">
                {question.options[question.correctIndex]}
              </span>
            </div>
          </div>
        </div>

        {/* Prompt Options */}
        <div className="space-y-2.5 text-right pt-2">
          <p className="text-xs font-label text-muted-foreground">
            بماذا ترغب أن يساعدك المعلم الآن؟
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant={activePrompt === "explain_simple" ? "default" : "outline"}
              size="sm"
              onClick={() => handleAsk("explain_simple")}
              disabled={loading}
              className="justify-start gap-2 h-auto py-2.5 px-3.5 font-button text-xs btn-tactile border-border/80"
            >
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <span>اشرح لي ببساطة</span>
            </Button>

            <Button
              variant={activePrompt === "give_analogy" ? "default" : "outline"}
              size="sm"
              onClick={() => handleAsk("give_analogy")}
              disabled={loading}
              className="justify-start gap-2 h-auto py-2.5 px-3.5 font-button text-xs btn-tactile border-border/80"
            >
              <Compass className="h-4 w-4 text-primary shrink-0" />
              <span>اديني مثال وتشبيه واقعي</span>
            </Button>

            {isCorrect === false && selectedOptionText && (
              <Button
                variant={activePrompt === "why_wrong" ? "default" : "outline"}
                size="sm"
                onClick={() => handleAsk("why_wrong")}
                disabled={loading}
                className="justify-start gap-2 h-auto py-2.5 px-3.5 font-button text-xs border-destructive/40 text-destructive hover:bg-destructive/10 btn-tactile"
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>وضحلي غلطتي وليه خياري غير صحيح</span>
              </Button>
            )}

            <Button
              variant={activePrompt === "practice_hint" ? "default" : "outline"}
              size="sm"
              onClick={() => handleAsk("practice_hint")}
              disabled={loading}
              className="justify-start gap-2 h-auto py-2.5 px-3.5 font-button text-xs btn-tactile border-border/80"
            >
              <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>تلميح يسهّل علي التفكير</span>
            </Button>

            <Button
              variant={activePrompt === "test_me" ? "default" : "outline"}
              size="sm"
              onClick={() => handleAsk("test_me")}
              disabled={loading}
              className="justify-start gap-2 h-auto py-2.5 px-3.5 font-button text-xs btn-tactile border-border/80"
            >
              <Target className="h-4 w-4 text-blue-500 shrink-0" />
              <span>اختبرني بسؤال تطبيقي سريع</span>
            </Button>

            <Button
              variant={activePrompt === "harder_question" ? "default" : "outline"}
              size="sm"
              onClick={() => handleAsk("harder_question")}
              disabled={loading}
              className="justify-start gap-2 h-auto py-2.5 px-3.5 font-button text-xs btn-tactile border-border/80"
            >
              <Flame className="h-4 w-4 text-rose-500 shrink-0" />
              <span>اديني سؤال أصعب يعمق فهمي</span>
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-button">مساعدك الدراسي بيجهز الشرح المخصص...</p>
          </div>
        )}

        {/* Response Box - Double Bezel */}
        {!loading && tutorReply && (
          <div className="double-bezel mt-3">
            <div className="double-bezel-inner p-5 text-right space-y-2.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-xs font-button text-primary">
                <Bot className="h-4 w-4" />
                <span>شرح مساعدك الدراسي:</span>
              </div>
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-line font-body-medium">
                <TypewriterText text={tutorReply} speedMs={16} delayMs={50} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
