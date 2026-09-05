import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Calendar,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Clock,
  HelpCircle,
  RotateCcw,
  Target,
  Zap,
} from "lucide-react";
import { buildUnifiedLearnerModel } from "@/lib/learning/learner-model";
import { determineNextBestAction } from "@/lib/learning/decision-engine";
import { generatePersonalizedStudyPlan, type StudyPlan } from "@/lib/learning/study-planner";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion";

interface LearnerDashboardProps {
  onStartQuizFromTopic?: (topic: string) => void;
  onStartSpacedReview?: () => void;
}

export function LearnerDashboard({
  onStartQuizFromTopic,
  onStartSpacedReview,
}: LearnerDashboardProps) {
  const learner = useMemo(() => buildUnifiedLearnerModel(), []);
  const nba = useMemo(() => determineNextBestAction(learner), [learner]);

  const {
    totalQuizzesTaken,
    totalQuestionsAnswered,
    overallAccuracy,
    calibratedTopics,
    dueReviews,
  } = learner;

  // Study Plan State
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [dailyHours, setDailyHours] = useState(1.5);
  const [generatedPlan, setGeneratedPlan] = useState<StudyPlan | null>(null);

  const handleGeneratePlan = () => {
    const weak = Object.values(calibratedTopics)
      .filter((t) => t.masteryScore < 60)
      .map((t) => t.topic);
    const all = Object.keys(calibratedTopics);

    const plan = generatePersonalizedStudyPlan({
      examDate,
      dailyHours,
      weakTopics: weak,
      allTopics: all.length > 0 ? all : ["المفاهيم العامة والمصطلحات الأساسية"],
    });

    setGeneratedPlan(plan);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير 👋";
    return "مساء الخير 👋";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* 1. Human-Centered Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground">
            {getGreeting()} جاهز لمتابعة مذاكرتك؟
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">
            كويزي بتابع تقدمك وتقترحلك أفضل خطوة للمذاكرة بناءً على مستواك.
          </p>
        </div>

        {totalQuizzesTaken > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full text-xs font-button w-fit shadow-xs">
            <Zap className="h-4 w-4 fill-current" />
            <span>
              جلسات المذاكرة: <AnimatedNumber value={totalQuizzesTaken} />
            </span>
          </div>
        )}
      </div>

      {/* 2. Next Best Action Card (🎯 خطوتك الجاية) - Double Bezel */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-6 md:p-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground font-button px-3 py-1 flex items-center gap-1.5 text-xs shadow-xs">
                  <Target className="h-3.5 w-3.5" />
                  خطوتك الجاية
                </Badge>
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-xs text-muted-foreground font-button bg-card/80"
                >
                  <Clock className="h-3 w-3" />
                  {nba.estimatedMinutes} دقائق متوقعة
                </Badge>
                {nba.targetTopic && (
                  <Badge variant="secondary" className="text-xs font-button bg-muted/60">
                    {nba.targetTopic}
                  </Badge>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl md:text-3xl font-heading-2 text-foreground">
                {nba.titleAr}
              </h2>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">
                {nba.descriptionAr}
              </p>

              {/* Explainability Block ("ليه كويزي اختارت ده؟") */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-button text-foreground">
                  <Lightbulb className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                  <span>ليه دي أنسب خطوة ليك دلوقتي؟</span>
                </div>
                <p className="leading-relaxed font-body">{nba.rationaleAr}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 self-end md:self-center w-full sm:w-auto">
              <Button
                className="font-button gap-2 text-sm shadow-md surface-3d btn-tactile h-11 px-6"
                onClick={() => {
                  if (nba.type === "SPACED_REPETITION_DUE" && onStartSpacedReview) {
                    onStartSpacedReview();
                  } else if (nba.targetTopic && onStartQuizFromTopic) {
                    onStartQuizFromTopic(nba.targetTopic);
                  } else if (onStartSpacedReview) {
                    onStartSpacedReview();
                  }
                }}
              >
                <Sparkles className="h-4 w-4" />
                {nba.actionCtaAr}
              </Button>

              {nba.alternatives.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-button text-muted-foreground h-9 btn-tactile border-border/80"
                  onClick={() => {
                    const alt = nba.alternatives[0];
                    if (alt.topic && onStartQuizFromTopic) {
                      onStartQuizFromTopic(alt.topic);
                    }
                  }}
                >
                  {nba.alternatives[0].labelAr}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Spaced Retention Alert if cards are due */}
      {dueReviews.length > 0 && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/30 flex items-center justify-between gap-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-heading-3 text-foreground">
                لديك {dueReviews.length} مفاهيم مستحقة للمراجعة المتباعدة اليوم
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                المراجعة السريعة الآن تحمي المفاهيم من النسيان وتثبتها في الذاكرة طويلة الأجل.
              </p>
            </div>
          </div>
          {onStartSpacedReview && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/30 hover:bg-amber-500/20 text-xs shrink-0 font-button btn-tactile"
              onClick={onStartSpacedReview}
            >
              ابدأ المراجعة ({dueReviews.length})
            </Button>
          )}
        </Card>
      )}

      {/* 4. Calibrated Mastery Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-heading-2 text-foreground flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              مستوى إتقانك
            </h2>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              بنقيس مستوى إتقانك للمفاهيم بناءً على إجاباتك، عشان تعرف إيه اللي ثبت وإيه اللي محتاج
              مراجعة.
            </p>
          </div>
          {totalQuestionsAnswered > 0 && (
            <Badge variant="outline" className="text-xs font-button bg-card/80">
              إجمالي الأسئلة: <AnimatedNumber value={totalQuestionsAnswered} /> | دقة الإجابات:{" "}
              <AnimatedNumber value={overallAccuracy} suffix="%" />
            </Badge>
          )}
        </div>

        {Object.keys(calibratedTopics).length === 0 ? (
          <div className="double-bezel">
            <div className="double-bezel-inner p-8 text-center space-y-3 bg-muted/20 border-dashed">
              <HelpCircle className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <h3 className="text-base font-heading-3 text-foreground">
                لا توجد بيانات تقييم كافية بعد
              </h3>
              <p className="text-xs text-muted-foreground font-body max-w-md mx-auto leading-relaxed">
                ارفع أول محاضرة أو ملخص، وحل أسئلة الكويز لتبدأ كويزي في بناء خريطتك المعرفية وتحديد
                نقاط قوتك والمواضيع التي تحتاج دعماً.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(calibratedTopics).map((t) => {
              const isMastered = t.masteryScore >= 80;
              const isStruggling = t.masteryScore < 60;

              const confidenceColor =
                t.confidenceLevel === "high"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : t.confidenceLevel === "moderate"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                    : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30";

              const confidenceLabel =
                t.confidenceLevel === "high"
                  ? "مؤكد"
                  : t.confidenceLevel === "moderate"
                    ? "جيد"
                    : "تقييم أولي";

              return (
                <Card
                  key={t.topic}
                  className="p-4 space-y-3 hover:shadow-md transition-all duration-200 border-border/80 rounded-2xl surface-3d"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-heading-3 text-foreground text-sm">{t.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                        <span>{t.evidenceCount} أسئلة</span>
                        <span>•</span>
                        <span>آخر تقييم: {t.lastAssessedFormattedAr}</span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn("text-[11px] font-button border", confidenceColor)}
                    >
                      {confidenceLabel}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-button">
                      <span className="text-muted-foreground">نسبة الإتقان</span>
                      <span
                        className={
                          isMastered
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isStruggling
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-blue-600 dark:text-blue-400"
                        }
                      >
                        <AnimatedNumber value={t.masteryScore} suffix="%" />
                      </span>
                    </div>
                    <Progress value={t.masteryScore} className="h-2 rounded-full" />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px] font-body">
                      {t.humanizedAssessmentAr}
                    </span>

                    {onStartQuizFromTopic && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs font-button text-primary hover:text-primary gap-1 btn-tactile"
                        onClick={() => onStartQuizFromTopic(t.topic)}
                      >
                        <span>تدرّب الآن</span>
                        <ArrowLeft className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Personalized Study Plan Tab & Generator - Double Bezel */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading-2 text-foreground">
                خطة المذاكرة الذكية وموعد الامتحان
              </h2>
              <p className="text-xs text-muted-foreground font-body">
                حدد موعد اختبارك والوقت اليومي المتاح، وهنساعدك توزع المذاكرة وترتب أولوياتك.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/70">
            <div className="space-y-1.5">
              <label className="text-xs font-label text-foreground">
                تاريخ الامتحان أو الموعد النهائي
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-label text-foreground">
                ساعات المذاكرة اليومية المتاحة ({dailyHours} ساعة/يوم)
              </label>
              <input
                type="range"
                min="0.5"
                max="6"
                step="0.5"
                value={dailyHours}
                onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                className="w-full accent-primary mt-2"
              />
            </div>
          </div>

          <Button
            onClick={handleGeneratePlan}
            className="font-button gap-2 text-sm w-full sm:w-auto surface-3d btn-tactile"
          >
            <Sparkles className="h-4 w-4" />
            توليد خطة المذاكرة المخصصة
          </Button>

          {generatedPlan && (
            <div className="space-y-4 pt-4 border-t border-border/80 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-primary/20 text-primary border-primary/30 font-button">
                  {generatedPlan.daysRemaining} يوماً حتى الامتحان
                </Badge>
                <Badge variant="outline" className="text-muted-foreground font-button">
                  إجمالي الساعات المخططة:{" "}
                  {Math.max(1, Math.round(generatedPlan.totalEstimatedMinutes / 60))} ساعة
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {generatedPlan.sessions.slice(0, 6).map((session, idx) => (
                  <Card
                    key={idx}
                    className="p-4 space-y-2 bg-card border-border/80 rounded-2xl surface-3d"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-button text-primary">
                        اليوم {session.dayNumber}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {session.estimatedMinutes} دقيقة
                      </span>
                    </div>
                    <h3 className="font-heading-3 text-sm text-foreground">{session.focusTopic}</h3>
                    <p className="text-xs text-muted-foreground font-body leading-relaxed">
                      {session.goal}
                    </p>
                    <ul className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/60">
                      {session.recommendedActivities.map((act, i) => (
                        <li key={i} className="flex items-center gap-1.5 font-body">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{act}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
