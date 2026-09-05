import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Shuffle,
  Flag,
  BookOpen,
  ShieldCheck,
  Trophy,
  Brain,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { QuestionBankItem } from "@/lib/learning/question-bank";
import { trackQuestionAttempt, updateQuestionFlags } from "@/lib/learning/question-bank";
import { getObjectUrl, revokeAllObjectUrls } from "@/lib/learning/media-store";
import { AnimatedNumber } from "@/components/motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExactQuizRunnerProps {
  questions: QuestionBankItem[];
  sourceDocumentName?: string;
  onComplete: (results: ExactQuizResults) => void;
  onExit: () => void;
}

export interface ExactQuizResults {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  answers: (number | null)[];
  markedForReview: Set<number>;
}

type QuizRunnerPhase = "quiz" | "results";

// ---------------------------------------------------------------------------
// Question Media Renderer
// ---------------------------------------------------------------------------

function QuestionMedia({ mediaRefs }: { mediaRefs?: QuestionBankItem["mediaRefs"] }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaRefs || mediaRefs.length === 0) return;
    const primaryRef = mediaRefs.find((r) => r.relation === "question" || r.relation === "figure");
    if (!primaryRef) return;

    getObjectUrl(primaryRef.mediaId).then((url) => setImageUrl(url));
  }, [mediaRefs]);

  if (!imageUrl) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60 bg-muted/30">
      <img
        src={imageUrl}
        alt="صورة مرتبطة بالسؤال من المصدر الأصلي"
        className="w-full max-h-64 object-contain"
        loading="lazy"
      />
      <p className="text-[10px] text-muted-foreground font-body text-center py-1.5 border-t border-border/50">
        صورة من المصدر الأصلي
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question Navigator
// ---------------------------------------------------------------------------

function QuestionNavigator({
  total,
  current,
  answers,
  markedForReview,
  onJump,
}: {
  total: number;
  current: number;
  answers: (number | null)[];
  markedForReview: Set<number>;
  onJump: (index: number) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5 justify-center"
      role="navigation"
      aria-label="التنقل بين الأسئلة"
    >
      {Array.from({ length: total }, (_, i) => {
        const isAnswered = answers[i] !== undefined && answers[i] !== null;
        const isCurrent = i === current;
        const isMarked = markedForReview.has(i);

        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`السؤال ${i + 1}`}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "h-7 w-7 rounded-lg text-[11px] font-button transition-all duration-150 border",
              isCurrent
                ? "bg-primary text-primary-foreground border-primary scale-110 shadow-sm"
                : isAnswered
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : isMarked
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70",
            )}
          >
            {isMarked && !isCurrent ? "⚑" : i + 1}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results View
// ---------------------------------------------------------------------------

function ResultsView({
  questions,
  results,
  onRetake,
  onReviewErrors,
  onExit,
}: {
  questions: QuestionBankItem[];
  results: ExactQuizResults;
  onRetake: () => void;
  onReviewErrors: () => void;
  onExit: () => void;
}) {
  const percentage = Math.round((results.correct / results.total) * 100);
  const grade =
    percentage >= 90
      ? "ممتاز 🏆"
      : percentage >= 75
        ? "جيد جداً 🌟"
        : percentage >= 60
          ? "جيد 👍"
          : percentage >= 50
            ? "مقبول ⚠️"
            : "يحتاج مراجعة 📚";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Score Header */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-8 text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary surface-3d">
            <Trophy className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-3xl font-display text-foreground">اكتمل الكويز!</h2>
            <p className="text-xs text-muted-foreground font-body mt-1">
              الأسئلة من وضع المصدر الأصلي
            </p>
          </div>
          <div className="text-6xl font-display text-primary tracking-tight font-mono">
            <AnimatedNumber value={percentage} suffix="%" durationMs={900} />
          </div>
          <p className="text-xl font-heading-3 text-foreground">{grade}</p>
          <div className="grid grid-cols-3 max-w-xs mx-auto gap-3 pt-1">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-xl font-display text-emerald-600 dark:text-emerald-400">
                <AnimatedNumber value={results.correct} durationMs={700} />
              </p>
              <p className="text-[10px] font-button text-muted-foreground mt-0.5">صحيح</p>
            </div>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-center">
              <p className="text-xl font-display text-destructive">
                <AnimatedNumber value={results.incorrect} durationMs={700} />
              </p>
              <p className="text-[10px] font-button text-muted-foreground mt-0.5">خاطئ</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-center">
              <p className="text-xl font-display text-muted-foreground">
                <AnimatedNumber value={results.skipped} durationMs={700} />
              </p>
              <p className="text-[10px] font-button text-muted-foreground mt-0.5">تخطيت</p>
            </div>
          </div>
        </div>
      </div>

      {/* Question-by-question review */}
      <div className="space-y-3">
        <h3 className="font-heading-3 text-foreground text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          مراجعة الأسئلة
        </h3>
        {questions.map((q, idx) => {
          const userAnswer = results.answers[idx];
          const isCorrect = userAnswer === q.correctIndex;
          const wasSkipped = userAnswer === null || userAnswer === undefined;

          return (
            <div
              key={q.id}
              className={cn(
                "rounded-2xl border p-4 space-y-2 text-right",
                wasSkipped
                  ? "border-border/60 bg-muted/20"
                  : isCorrect
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-button text-muted-foreground">
                    {q.sourceQuestionNumber ? `السؤال ${q.sourceQuestionNumber}` : `#${idx + 1}`}
                  </span>
                  {q.sourcePage && (
                    <Badge variant="outline" className="text-[10px] font-button py-0 px-1.5">
                      ص. {q.sourcePage}
                    </Badge>
                  )}
                  {q.importFidelity === "exact" && (
                    <Badge className="gap-0.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-button py-0">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      مصدر أصلي
                    </Badge>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] font-button",
                    wasSkipped
                      ? "text-muted-foreground bg-muted/40"
                      : isCorrect
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                        : "bg-destructive/15 text-destructive",
                  )}
                >
                  {wasSkipped ? "تخطيت" : isCorrect ? "صحيح ✓" : "خاطئ ✗"}
                </Badge>
              </div>
              <p className="text-sm font-heading-3 text-foreground leading-relaxed">
                {q.originalText ?? q.question}
              </p>
              <div className="text-xs space-y-1 text-muted-foreground font-body-medium">
                <p>
                  <span className="font-button text-foreground">الإجابة الصحيحة: </span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-button">
                    {q.options[q.correctIndex]}
                  </span>
                  {q.correctAnswerSource && (
                    <span className="text-muted-foreground ml-1">({q.correctAnswerSource})</span>
                  )}
                </p>
                {!isCorrect && !wasSkipped && userAnswer !== undefined && userAnswer >= 0 && (
                  <p>
                    <span className="font-button text-foreground">إجابتك: </span>
                    <span className="text-destructive font-button">{q.options[userAnswer]}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {results.incorrect > 0 && (
          <Button onClick={onReviewErrors} className="font-button gap-2 surface-3d sm:flex-1">
            <Brain className="h-4 w-4" />
            راجع أخطاءك ({results.incorrect})
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onRetake}
          className="font-button gap-2 border-border/80 sm:flex-1"
        >
          <RotateCcw className="h-4 w-4" />
          إعادة الكويز
        </Button>
        <Button
          variant="ghost"
          onClick={onExit}
          className="font-button gap-2 text-muted-foreground sm:flex-1"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للبنك
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Exact Quiz Runner
// ---------------------------------------------------------------------------

export function ExactQuizRunner({
  questions: initialQuestions,
  sourceDocumentName,
  onComplete,
  onExit,
}: ExactQuizRunnerProps) {
  const [phase, setPhase] = useState<QuizRunnerPhase>("quiz");
  const [shuffled, setShuffled] = useState(false);
  const [questions, setQuestions] = useState(initialQuestions);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(initialQuestions.length).fill(null),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<ExactQuizResults | null>(null);

  const total = questions.length;
  const q = questions[current];
  const progress = ((current + 1) / total) * 100;
  const optionLabels = ["أ", "ب", "ج", "د", "هـ", "و"];

  // Cleanup object URLs on unmount
  useEffect(() => () => revokeAllObjectUrls(), []);

  const handleShuffle = useCallback(() => {
    if (shuffled) {
      setQuestions(initialQuestions);
      setShuffled(false);
    } else {
      setQuestions([...initialQuestions].sort(() => Math.random() - 0.5));
      setShuffled(true);
    }
    setAnswers(new Array(initialQuestions.length).fill(null));
    setSelected(null);
    setRevealed(false);
    setCurrent(0);
    toast.info(shuffled ? "تم استعادة الترتيب الأصلي" : "تم ترتيب الأسئلة عشوائياً");
  }, [shuffled, initialQuestions]);

  const handleSubmit = () => {
    if (selected === null) return;
    setRevealed(true);
    const newAnswers = [...answers];
    newAnswers[current] = selected;
    setAnswers(newAnswers);

    // Track attempt
    const isCorrect = selected === q.correctIndex;
    trackQuestionAttempt(q.id, isCorrect);
    if (!isCorrect) {
      updateQuestionFlags(q.id, { markedForReview: true });
    }
  };

  const handleNext = () => {
    if (current + 1 >= total) {
      // Build results
      const finalAnswers = [...answers];
      if (selected !== null) finalAnswers[current] = selected;

      const correct = finalAnswers.filter((a, i) => a === questions[i]?.correctIndex).length;
      const skipped = finalAnswers.filter((a) => a === null).length;

      const quizResults: ExactQuizResults = {
        total,
        correct,
        incorrect: total - correct - skipped,
        skipped,
        answers: finalAnswers,
        markedForReview,
      };
      setResults(quizResults);
      onComplete(quizResults);
      setPhase("results");
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const handleJumpTo = (index: number) => {
    if (revealed && selected !== null) {
      const newAnswers = [...answers];
      newAnswers[current] = selected;
      setAnswers(newAnswers);
    }
    setCurrent(index);
    setSelected(answers[index]);
    setRevealed(answers[index] !== null);
  };

  const toggleMarkForReview = () => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(current)) {
        next.delete(current);
      } else {
        next.add(current);
      }
      return next;
    });
  };

  const handleRetake = () => {
    setAnswers(new Array(total).fill(null));
    setSelected(null);
    setRevealed(false);
    setCurrent(0);
    setResults(null);
    setMarkedForReview(new Set());
    setPhase("quiz");
  };

  const handleReviewErrors = () => {
    if (!results) return;
    const errorQuestions = questions.filter(
      (_, i) => results.answers[i] !== questions[i]?.correctIndex,
    );
    setQuestions(errorQuestions);
    setAnswers(new Array(errorQuestions.length).fill(null));
    setSelected(null);
    setRevealed(false);
    setCurrent(0);
    setResults(null);
    setMarkedForReview(new Set());
    setPhase("quiz");
  };

  if (phase === "results" && results) {
    return (
      <ResultsView
        questions={questions}
        results={results}
        onRetake={handleRetake}
        onReviewErrors={handleReviewErrors}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className="gap-1.5 font-button text-xs bg-primary/5 text-primary border-primary/25"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          وضع المصدر الأصلي
          {sourceDocumentName && (
            <span className="opacity-60 text-[10px]">· {sourceDocumentName}</span>
          )}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShuffle}
          className="gap-1.5 text-xs font-button text-muted-foreground h-8"
        >
          <Shuffle className="h-3.5 w-3.5" />
          {shuffled ? "الترتيب الأصلي" : "عشوائي"}
        </Button>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-button">
          <span>
            السؤال {current + 1} من {total}
          </span>
          <span className="font-mono">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2 rounded-full transition-all duration-300" />
      </div>

      {/* Question Navigator */}
      <QuestionNavigator
        total={total}
        current={current}
        answers={answers}
        markedForReview={markedForReview}
        onJump={handleJumpTo}
      />

      {/* Question Card */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-5 md:p-7 space-y-5">
          {/* Question Metadata */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
            {q.sourceQuestionNumber && (
              <Badge
                variant="outline"
                className="font-button text-xs text-muted-foreground bg-muted/30"
              >
                سؤال #{q.sourceQuestionNumber}
              </Badge>
            )}
            {q.sourcePage && (
              <Badge
                variant="outline"
                className="font-button text-xs text-muted-foreground bg-muted/30"
              >
                صفحة {q.sourcePage}
              </Badge>
            )}
            {q.topic && (
              <Badge variant="outline" className="font-button text-xs text-muted-foreground">
                {q.topic}
              </Badge>
            )}
            {q.importFidelity === "exact" && (
              <Badge className="gap-0.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-button">
                <ShieldCheck className="h-2.5 w-2.5" />
                مطابق للمصدر
              </Badge>
            )}
            {q.requiresReview && (
              <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 font-button">
                يحتاج مراجعة
              </Badge>
            )}
            <button
              type="button"
              onClick={toggleMarkForReview}
              className={cn(
                "ml-auto flex items-center gap-1 text-xs font-button px-2 py-1 rounded-lg transition-colors",
                markedForReview.has(current)
                  ? "text-amber-600 bg-amber-500/10"
                  : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              <Flag className="h-3 w-3" />
              {markedForReview.has(current) ? "مُعلَّم" : "علّم للمراجعة"}
            </button>
          </div>

          {/* Question text — ALWAYS renders originalText */}
          <h2 className="text-xl sm:text-2xl font-heading-2 text-foreground leading-relaxed">
            {q.originalText ?? q.question}
          </h2>

          {/* Media (if available) */}
          {q.mediaRefs && q.mediaRefs.length > 0 && <QuestionMedia mediaRefs={q.mediaRefs} />}

          {/* Media required but not extracted */}
          {q.mediaRequired && (!q.mediaRefs || q.mediaRefs.length === 0) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200 font-body space-y-1">
              <p className="font-button flex items-center gap-1.5">
                <Flag className="h-4 w-4" />
                السؤال يحتاج صورة أو شكل
              </p>
              <p className="text-xs">
                تعذر استخراج الصورة المرتبطة بهذا السؤال. ارجع للمصدر الأصلي للاطلاع عليها.
              </p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3" role="radiogroup" aria-label="خيارات الإجابة">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = revealed && i === q.correctIndex;
              const isWrong = revealed && isSelected && i !== q.correctIndex;
              const letter = optionLabels[i] || `${i + 1}`;

              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={revealed}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-right transition-all duration-200 btn-tactile",
                    !revealed &&
                      "hover:border-primary/50 hover:bg-muted/40 cursor-pointer border-border/80 bg-card",
                    isSelected &&
                      !revealed &&
                      "border-primary bg-primary/10 shadow-sm font-bold text-primary",
                    isCorrect &&
                      "border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50 font-bold",
                    isWrong && "border-destructive bg-destructive/15 text-destructive font-bold",
                    revealed && "cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center font-button text-xs shrink-0 transition-colors",
                        isSelected && !revealed && "bg-primary text-primary-foreground",
                        isCorrect && "bg-emerald-600 text-white",
                        isWrong && "bg-destructive text-destructive-foreground",
                        !isSelected && !isCorrect && !isWrong && "bg-muted text-muted-foreground",
                      )}
                    >
                      {letter}
                    </span>
                    <span className="leading-relaxed font-body-medium text-sm">{opt}</span>
                  </div>
                  {isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                  {isWrong && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation after reveal */}
          {revealed && q.explanation && (
            <div className="rounded-2xl bg-muted/40 border border-border/80 p-4 text-sm space-y-2 animate-fade-in">
              <p className="font-heading-3 text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                الشرح:
              </p>
              <p className="text-muted-foreground font-body leading-relaxed">{q.explanation}</p>
            </div>
          )}

          {/* Source ref on reveal */}
          {revealed && (q.sourcePage || q.correctAnswerSource) && (
            <div className="text-xs text-muted-foreground font-body-medium flex flex-wrap gap-x-3 gap-y-1">
              {q.sourcePage && <span>المصدر: صفحة {q.sourcePage}</span>}
              {q.correctAnswerSource && (
                <span>
                  الإجابة في المصدر:{" "}
                  <span className="font-button text-foreground">{q.correctAnswerSource}</span>
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => current > 0 && handleJumpTo(current - 1)}
              disabled={current === 0}
              className="gap-1.5 font-button text-xs border-border/80 w-full sm:w-auto"
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>

            {!revealed ? (
              <Button
                onClick={handleSubmit}
                disabled={selected === null}
                size="lg"
                className="font-button px-8 w-full sm:w-auto surface-3d btn-tactile"
              >
                تأكيد الإجابة
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                size="lg"
                className="font-button px-8 w-full sm:w-auto surface-3d btn-tactile"
              >
                {current + 1 >= total ? "شوف النتيجة 🏆" : "السؤال التالي"}
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
