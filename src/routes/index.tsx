import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Trophy,
  Sliders,
  AlertTriangle,
  Layers,
  BookOpen,
  Check,
  Zap,
  Target,
  Brain,
  Quote,
  Bot,
  Compass,
  LayoutDashboard,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  analyzeDocumentFn,
  generateQuizFn,
  ocrPagesServerFn,
  type QuizQuestion,
  type QuizConfig,
  type DocumentAnalysis,
} from "@/lib/quiz.functions";
import { parseAndValidateDocument, DocumentIngestionError } from "@/lib/documents/document-service";
import type { NormalizedDocument } from "@/lib/documents/normalized-document";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AiTutorDialog } from "@/components/AiTutorDialog";
import { LearnerDashboard } from "@/components/dashboard/LearnerDashboard";
import { QuestionBankView } from "@/components/question-bank/QuestionBankView";
import {
  createTargetedReviewQuiz,
  calculateNextReviewInterval,
} from "@/lib/learning/spaced-review";
import { analyzeAttemptMastery, recordAttemptToStorage } from "@/lib/learning/mastery-engine";
import { saveQuestionsToBank, getStoredQuestionBank } from "@/lib/learning/question-bank";
import { getBloomBadgeLabel } from "@/lib/i18n/translations";
import { Navbar, type MainNavTab } from "@/components/Navbar";
import { TypewriterText, AnimatedNumber, TiltCard, MagneticButton } from "@/components/motion";

export const Route = createFileRoute("/")({
  component: Index,
});

type MainTab = MainNavTab;
type Phase = "upload" | "pipeline" | "configure" | "generating" | "quiz" | "result";

const PIPELINE_STEPS: Array<{ id: number; labelAr: string; labelEn: string }> = [
  { id: 1, labelAr: "بنقرأ الملف ونفحص سلامته...", labelEn: "Reading file" },
  { id: 2, labelAr: "بنفحص الصفحات ونحدد بنيتها...", labelEn: "Inspecting pages" },
  { id: 3, labelAr: "بنستخرج المحتوى والنصوص...", labelEn: "Extracting content" },
  {
    id: 4,
    labelAr: "بنراجع جودة القراءة ونقاء الرموز...",
    labelEn: "Evaluating extraction quality",
  },
  {
    id: 5,
    labelAr: "بنقرأ الصفحات المصورة عند الحاجة (معالجة بصرية)...",
    labelEn: "Processing scanned pages",
  },
  { id: 6, labelAr: "بنفهم المادة والمحاور العلمية...", labelEn: "Analyzing educational content" },
  { id: 7, labelAr: "بنحدد أهم الأفكار والمفاهيم...", labelEn: "Extracting key concepts" },
  { id: 8, labelAr: "بنجهزلك أسئلة تختبر فهمك وتطبيقك...", labelEn: "Generating questions" },
  {
    id: 9,
    labelAr: "بنراجع جودة الأسئلة ودقة الإجابات...",
    labelEn: "Validating question quality",
  },
  { id: 10, labelAr: "الكويز جاهز للبدء بتأصيل كامل!", labelEn: "Quiz ready" },
];

function Index() {
  const [mainTab, setMainTab] = useState<MainTab>("studio");
  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSizeBytes, setFileSizeBytes] = useState(0);
  const [extractedText, setExtractedText] = useState("");
  const [normalizedDoc, setNormalizedDoc] = useState<NormalizedDocument | null>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);

  // Loading Steps State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Quiz Configuration State
  const [config, setConfig] = useState<QuizConfig>({
    questionCount: 10,
    difficulty: "mixed",
    questionType: "mixed",
    language: "auto",
    targetBloomLevel: "all",
  });

  // Active Quiz State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // AI Tutor State
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState<QuizQuestion | null>(null);
  const [tutorStudentAnswer, setTutorStudentAnswer] = useState<string | undefined>();
  const [tutorIsCorrect, setTutorIsCorrect] = useState<boolean | undefined>();

  // Server functions
  const analyzeDoc = useServerFn(analyzeDocumentFn);
  const generateQuiz = useServerFn(generateQuizFn);
  const ocrPages = useServerFn(ocrPagesServerFn);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setPhase("pipeline");
        setCurrentStepIndex(0); // 1. بنقرأ الملف
        setFileName(file.name);
        setFileSizeBytes(file.size);

        // Step 1-5: Document Ingestion Pipeline with real state callbacks
        const parsed = await parseAndValidateDocument(file, {
          onProgress: (stage) => {
            if (stage.includes("فحص صفحات")) {
              setCurrentStepIndex(1); // 2. بنفحص الصفحات
            } else if (stage.includes("استخراج النصوص")) {
              setCurrentStepIndex(2); // 3. بنستخرج المحتوى
            } else if (stage.includes("قراءة الصفحات المصورة") || stage.includes("بصرية")) {
              setCurrentStepIndex(4); // 5. بنقرأ الصفحات المصورة عند الحاجة
            }
          },
          ocrPageFetcher: async (pages) => {
            setCurrentStepIndex(4); // 5. بنقرأ الصفحات المصورة
            return await ocrPages({ data: { pages, documentName: file.name } });
          },
        });

        setCurrentStepIndex(3); // 4. بنراجع جودة القراءة
        await new Promise((r) => setTimeout(r, 200));

        setExtractedText(parsed.text);
        if (parsed.normalizedDoc) {
          setNormalizedDoc(parsed.normalizedDoc);
        }

        // Step 6: بنفهم المادة (AI Analysis)
        setCurrentStepIndex(5);
        const analysis = await analyzeDoc({
          data: { text: parsed.text.slice(0, 8000), filename: file.name },
        });

        // Step 7: بنحدد أهم الأفكار والمفاهيم
        setCurrentStepIndex(6);
        setDocumentAnalysis(analysis);
        await new Promise((r) => setTimeout(r, 200));

        // Default language matching dominant language
        if (analysis.dominantLanguage === "ar") {
          setConfig((c) => ({ ...c, language: "ar" }));
        } else if (analysis.dominantLanguage === "en") {
          setConfig((c) => ({ ...c, language: "en" }));
        }

        // Advance to configure phase
        setPhase("configure");
      } catch (e: unknown) {
        if (e instanceof DocumentIngestionError) {
          toast.error(e.message, {
            description: e.details.technicalDetails,
            duration: 6000,
          });
        } else {
          const errorMsg = e instanceof Error ? e.message : "حدث خطأ أثناء معالجة الملف";
          toast.error(errorMsg);
        }
        setPhase("upload");
      }
    },
    [analyzeDoc, ocrPages],
  );

  const handleStartGeneration = useCallback(async () => {
    if (!extractedText) {
      toast.error("لا يوجد نص للمعالجة، يرجى إعادة رفع الملف");
      setPhase("upload");
      return;
    }

    try {
      setPhase("generating");
      setCurrentStepIndex(7); // 8. بنجهزلك أسئلة تختبر فهمك وتطبيقك

      const result = await generateQuiz({
        data: {
          text: extractedText.slice(0, 180000),
          config,
          contextTopics: documentAnalysis?.topics,
          filename: fileName,
        },
      });

      setCurrentStepIndex(8); // 9. بنراجع جودة الأسئلة ودقة الإجابات
      await new Promise((r) => setTimeout(r, 350));

      if (!result.questions || result.questions.length === 0) {
        throw new Error(
          "قدرنا نقرأ الملف لكن حصلت مشكلة أثناء إنشاء الأسئلة. المحتوى يحتاج تركيزاً أكبر على أفكار تعليمية واضحة.",
        );
      }

      setCurrentStepIndex(9); // 10. الكويز جاهز للبدء بتأصيل كامل
      await new Promise((r) => setTimeout(r, 300));

      setQuestions(result.questions);
      setAnswers([]);
      setCurrent(0);
      setSelected(null);
      setRevealed(false);
      setPhase("quiz");
      toast.success(`تم إعداد ${result.questions.length} سؤالاً بنجاح وفق معايير بلوم والتأصيل!`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "فشل توليد الكويز";
      toast.error(errorMsg, { duration: 5000 });
      setPhase("configure");
    }
  }, [extractedText, config, documentAnalysis, generateQuiz, fileName]);

  const resetAll = () => {
    setPhase("upload");
    setExtractedText("");
    setNormalizedDoc(null);
    setDocumentAnalysis(null);
    setQuestions([]);
    setAnswers([]);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
  };

  const retakeSameQuiz = () => {
    setAnswers([]);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setPhase("quiz");
  };

  const submitAnswer = () => {
    if (selected === null) return;
    setRevealed(true);
  };

  const nextQuestion = () => {
    const newAnswers = [...answers, selected ?? -1];
    setAnswers(newAnswers);
    if (current + 1 >= questions.length) {
      setPhase("result");
      // Persist attempt record
      const score = newAnswers.reduce(
        (acc, ans, i) => acc + (ans === questions[i]?.correctIndex ? 1 : 0),
        0,
      );
      recordAttemptToStorage({
        id: "att_" + Date.now(),
        timestamp: Date.now(),
        documentName: fileName,
        totalQuestions: questions.length,
        score,
        percentage: Math.round((score / questions.length) * 100),
        evidences: questions.map((q, i) => ({
          questionId: "q_" + i,
          topic: q.topic,
          conceptId: q.conceptId,
          isCorrect: newAnswers[i] === q.correctIndex,
          difficulty: q.difficulty,
          bloomLevel: q.bloomLevel || "understand",
          timestamp: Date.now(),
        })),
      });

      // Save to Question Bank
      saveQuestionsToBank(questions, fileName || "ملف دراسي");
    } else {
      setCurrent(current + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const openTutorForQuestion = (
    q: QuizQuestion,
    selectedOptionIdx?: number | null,
    isCorrectAnswer?: boolean,
  ) => {
    setTutorQuestion(q);
    setTutorStudentAnswer(
      selectedOptionIdx !== undefined && selectedOptionIdx !== null
        ? q.options[selectedOptionIdx]
        : undefined,
    );
    setTutorIsCorrect(isCorrectAnswer);
    setTutorOpen(true);
  };

  const handleSmartReview = () => {
    const analysis = analyzeAttemptMastery(questions, answers);
    const reviewSet = createTargetedReviewQuiz(questions, answers, analysis.weakTopics);
    if (reviewSet.length === 0) {
      toast.success("أحسنت! إجاباتك كاملة ولا توجد مفاهيم متعثرة تتطلب المراجعة.");
      return;
    }
    setQuestions(reviewSet);
    setAnswers([]);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setPhase("quiz");
    toast.success(`بدء جولة مراجعة لتثبيت المعلومة (${reviewSet.length} أسئلة)!`);
  };

  const handleStartQuizFromQuestions = (bankQuestions: QuizQuestion[]) => {
    setQuestions(bankQuestions);
    setAnswers([]);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setPhase("quiz");
    setMainTab("studio");
    toast.success(`بدء كويز من بنك الأسئلة (${bankQuestions.length} أسئلة)!`);
  };

  const handleStartQuizFromTopic = (topic: string) => {
    const matching = getStoredQuestionBank().filter((q) => q.topic === topic);
    if (matching.length > 0) {
      handleStartQuizFromQuestions(
        matching.map((m) => ({
          question: m.question,
          options: m.options,
          correctIndex: m.correctIndex,
          explanation: m.explanation,
          topic: m.topic,
          difficulty: m.difficulty,
          bloomLevel: m.bloomLevel,
          evidenceQuote: m.evidenceQuote,
        })),
      );
    } else {
      toast.error(
        `لا توجد أسئلة كافية مخزنة لموضوع «${topic}». ارفع ملفاً جديداً لإنشاء كويز مخصص.`,
      );
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background bg-grid-subtle text-foreground flex flex-col transition-colors duration-200">
      <Toaster position="top-center" richColors />

      {/* Global Navigation Bar */}
      <Navbar
        activeTab={mainTab}
        onTabChange={setMainTab}
        canReset={mainTab === "studio" && phase !== "upload"}
        onReset={resetAll}
      />

      {/* Main Content Area */}
      <main className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
        {/* TAB 1: STUDIO (Interactive Quiz Pipeline) */}
        {mainTab === "studio" && (
          <>
            {phase === "upload" && (
              <UploadView
                dragOver={dragOver}
                setDragOver={setDragOver}
                onFile={handleFile}
                fileRef={fileRef}
              />
            )}

            {(phase === "pipeline" || phase === "generating") && (
              <PipelineLoadingView
                steps={PIPELINE_STEPS}
                currentStepIndex={currentStepIndex}
                fileName={fileName}
              />
            )}

            {phase === "configure" && (
              <ConfigureView
                fileName={fileName}
                fileSizeBytes={fileSizeBytes}
                analysis={documentAnalysis}
                normalizedDoc={normalizedDoc}
                config={config}
                setConfig={setConfig}
                onStart={handleStartGeneration}
                onBack={resetAll}
              />
            )}

            {phase === "quiz" && questions.length > 0 && (
              <QuizView
                q={questions[current]}
                index={current}
                total={questions.length}
                selected={selected}
                setSelected={setSelected}
                revealed={revealed}
                onSubmit={submitAnswer}
                onNext={nextQuestion}
                onAskTutor={() =>
                  openTutorForQuestion(
                    questions[current],
                    selected,
                    selected === questions[current].correctIndex,
                  )
                }
              />
            )}

            {phase === "result" && (
              <EnhancedResultsView
                questions={questions}
                answers={answers}
                onRetake={retakeSameQuiz}
                onSmartReview={handleSmartReview}
                onConfigure={() => setPhase("configure")}
                onNewFile={resetAll}
                onAskTutor={(q, idx) =>
                  openTutorForQuestion(q, answers[idx], answers[idx] === q.correctIndex)
                }
              />
            )}
          </>
        )}

        {/* TAB 2: LEARNER DASHBOARD & STUDY PLANNER */}
        {mainTab === "dashboard" && (
          <LearnerDashboard onStartQuizFromTopic={handleStartQuizFromTopic} />
        )}

        {/* TAB 3: QUESTION BANK */}
        {mainTab === "bank" && (
          <QuestionBankView onStartQuizFromQuestions={handleStartQuizFromQuestions} />
        )}
      </main>

      {/* Interactive AI Tutor Dialog */}
      {tutorQuestion && (
        <AiTutorDialog
          open={tutorOpen}
          onOpenChange={setTutorOpen}
          question={tutorQuestion}
          selectedOptionText={tutorStudentAnswer}
          isCorrect={tutorIsCorrect}
          documentSnippet={extractedText.slice(0, 4000)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 1: UPLOAD VIEW
// ---------------------------------------------------------------------------

function UploadView({
  dragOver,
  setDragOver,
  onFile,
  fileRef,
}: {
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  onFile: (f: File) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-3">
        <Badge
          variant="secondary"
          className="px-3.5 py-1 font-button text-xs tracking-wide text-primary bg-primary/10 border-primary/20"
        >
          كويزي | نظام المذاكرة والتدريب المستمر
        </Badge>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-foreground tracking-tight leading-tight min-h-[2.5em] flex items-center justify-center">
          <TypewriterText
            text="ارفع محاضرتك أو ملخصك، وحوّل أهم ما فيه لتدريب يساعدك تختبر فهمك"
            speedMs={22}
            delayMs={60}
          />
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed font-body-medium">
          ارفع ملفك الدراسي، وهنبدأ فوراً في تنظيم المحتوى وتجهيز تدريب ومراجعة تناسب مستواك.
        </p>
      </div>

      <TiltCard
        maxTilt={1.8}
        spotlight={true}
        className="double-bezel transition-transform duration-200"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "double-bezel-inner cursor-pointer border-2 border-dashed p-10 md:p-14 text-center transition-all duration-200",
            dragOver
              ? "border-primary bg-primary/10 scale-[1.005]"
              : "border-border/80 hover:border-primary/60 hover:bg-muted/30",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={handleChange}
          />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20 surface-3d">
            <Upload className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-lg sm:text-xl font-heading-3 text-foreground">
            اسحب وأفلت الملف هنا، أو اضغط للاختيار
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-body">
            يدعم ملفات PDF و Word (.docx) والنصوص (.txt) حتى 30 ميجابايت
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Badge
              variant="outline"
              className="text-xs bg-card/90 font-button border-border/80 shadow-xs"
            >
              <FileText className="h-3 w-3 mr-1 text-primary" /> PDF
            </Badge>
            <Badge
              variant="outline"
              className="text-xs bg-card/90 font-button border-border/80 shadow-xs"
            >
              <FileText className="h-3 w-3 mr-1 text-primary" /> Word DOCX
            </Badge>
            <Badge
              variant="outline"
              className="text-xs bg-card/90 font-button border-border/80 shadow-xs"
            >
              <FileText className="h-3 w-3 mr-1 text-primary" /> TXT
            </Badge>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 2: PIPELINE LOADING VIEW
// ---------------------------------------------------------------------------

function PipelineLoadingView({
  steps,
  currentStepIndex,
  fileName,
}: {
  steps: Array<{ id: number; labelAr: string; labelEn: string }>;
  currentStepIndex: number;
  fileName: string;
}) {
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  return (
    <div className="double-bezel">
      <div className="double-bezel-inner p-8 md:p-10 space-y-8 animate-in fade-in duration-300">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/25 surface-3d animate-pulse">
            <Brain className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-heading-2 text-foreground">
              بنقرأ وبنحلل المادة العلمية
            </h2>
            <p className="text-xs text-muted-foreground font-body truncate max-w-sm mx-auto mt-1">
              الملف: <span className="font-button text-foreground">{fileName}</span>
            </p>
          </div>

          <div className="max-w-xs mx-auto space-y-1.5 pt-1">
            <Progress value={progressPercent} className="h-1.5 transition-all duration-300" />
            <p className="text-[11px] font-button text-muted-foreground">
              <AnimatedNumber value={progressPercent} suffix="% مكتمل" />
            </p>
          </div>
        </div>

        <div className="space-y-2.5 max-w-md mx-auto" aria-live="polite">
          {steps.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-2xl border text-xs sm:text-sm transition-all duration-300",
                  isDone && "border-emerald-500/30 bg-emerald-500/5 text-foreground font-medium",
                  isCurrent &&
                    "border-primary bg-primary/10 font-bold text-primary shadow-sm scale-[1.01]",
                  idx > currentStepIndex && "border-border/40 text-muted-foreground/50 opacity-60",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className="flex-1 font-body-medium">
                  {isCurrent ? <TypewriterText text={step.labelAr} speedMs={16} /> : step.labelAr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 3: CONFIGURE VIEW ("الكويز جاهز")
// ---------------------------------------------------------------------------

function ConfigureView({
  fileName,
  fileSizeBytes,
  analysis,
  normalizedDoc,
  config,
  setConfig,
  onStart,
  onBack,
}: {
  fileName: string;
  fileSizeBytes: number;
  analysis: DocumentAnalysis | null;
  normalizedDoc?: NormalizedDocument | null;
  config: QuizConfig;
  setConfig: React.Dispatch<React.SetStateAction<QuizConfig>>;
  onStart: () => void;
  onBack: () => void;
}) {
  const formatKb = (bytes: number) => (bytes / 1024).toFixed(0) + " KB";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner - Double Bezel */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-6 md:p-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                <h2 className="text-2xl sm:text-3xl font-heading-2 text-foreground">
                  محتوى الدراسة جاهز للتدريب!
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-body">
                تم استيعاب «{fileName}» ({formatKb(fileSizeBytes)}) بنجاح.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {normalizedDoc?.extractionQuality && (
                <Badge
                  variant="outline"
                  className={cn(
                    "px-3 py-1 font-button text-xs",
                    normalizedDoc.extractionQuality.confidence === "EXCELLENT" &&
                      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    normalizedDoc.extractionQuality.confidence === "GOOD" &&
                      "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                    normalizedDoc.extractionQuality.confidence === "PARTIAL" &&
                      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  جودة القراءة:{" "}
                  {normalizedDoc.extractionQuality.confidence === "EXCELLENT"
                    ? "ممتازة"
                    : normalizedDoc.extractionQuality.confidence === "GOOD"
                      ? "جيدة جداً"
                      : "جزئية"}{" "}
                  ({normalizedDoc.extractionQuality.pagesWithText} من{" "}
                  {normalizedDoc.extractionQuality.pageCount} صفحة)
                  {normalizedDoc.extractionQuality.extractionMethod === "hybrid" ||
                  normalizedDoc.extractionQuality.extractionMethod === "ocr"
                    ? " • مدعومة بـ OCR"
                    : ""}
                </Badge>
              )}
              {analysis?.hasExistingQuestions ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-1 font-button w-fit"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  تم اكتشاف أسئلة سابقة في الملف
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary px-3 py-1 font-button w-fit"
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1" />
                  محتوى شرح ومفاهيم تعليمية
                </Badge>
              )}
            </div>
          </div>

          {analysis?.summary && (
            <div className="rounded-xl bg-muted/40 p-3.5 border border-border/60 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <span className="font-button text-foreground">ملخص المحتوى: </span>
              {analysis.summary}
            </div>
          )}

          {analysis?.concepts && analysis.concepts.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-label text-muted-foreground mb-2">
                المفاهيم المحورية المستخلصة من المحتوى:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.concepts.map((c) => (
                  <Badge
                    key={c.id}
                    variant="secondary"
                    className="text-xs font-body-medium bg-muted/70"
                  >
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form - Double Bezel */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-border/60">
            <Sliders className="h-5 w-5 text-primary" />
            <h3 className="text-lg sm:text-xl font-heading-3 text-foreground">حدد طريقة التدريب</h3>
          </div>

          {/* 0. Learner Intent & Goal Selector (UNESCO Human Agency) */}
          <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/20">
            <label className="text-xs sm:text-sm font-heading-3 text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span>إيه هدفك الأساسي من جلسة المذاكرة دي؟ (Quizy بتقترح وأنت تختار)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: "understand",
                  label: "أفهم من الصفر",
                  count: 5,
                  diff: "easy",
                  bloom: "understand",
                },
                {
                  id: "review",
                  label: "أراجع وأثبت",
                  count: 10,
                  diff: "medium",
                  bloom: "remember",
                },
                { id: "assess", label: "أختبر مستواي", count: 15, diff: "mixed", bloom: "all" },
                { id: "exam", label: "استعداد للامتحان", count: 20, diff: "hard", bloom: "apply" },
              ].map((goal) => (
                <Button
                  key={goal.id}
                  type="button"
                  variant={config.questionCount === goal.count ? "default" : "outline"}
                  className="text-xs font-button h-10 transition-all btn-tactile"
                  onClick={() => {
                    setConfig((c) => ({
                      ...c,
                      questionCount: goal.count,
                      difficulty: goal.diff as QuizConfig["difficulty"],
                      targetBloomLevel: goal.bloom as QuizConfig["targetBloomLevel"],
                    }));
                  }}
                >
                  {goal.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 1. Question Count */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-label text-foreground">
              عدد الأسئلة المطلوبة
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 30].map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant={config.questionCount === num ? "default" : "outline"}
                  className="font-button text-xs sm:text-sm h-9 btn-tactile"
                  onClick={() => setConfig((c) => ({ ...c, questionCount: num }))}
                >
                  {num} أسئلة
                </Button>
              ))}
            </div>
          </div>

          {/* 2. Difficulty */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-label text-foreground">مستوى الصعوبة</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { val: "easy", label: "سهل (Easy)" },
                { val: "medium", label: "متوسط (Medium)" },
                { val: "hard", label: "صعب (Hard)" },
                { val: "mixed", label: "مختلط (Mixed)" },
              ].map((item) => (
                <Button
                  key={item.val}
                  type="button"
                  variant={config.difficulty === item.val ? "default" : "outline"}
                  className="font-button text-xs sm:text-sm h-9 btn-tactile"
                  onClick={() =>
                    setConfig((c) => ({ ...c, difficulty: item.val as QuizConfig["difficulty"] }))
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 3. Bloom Cognitive Level Target */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-label text-foreground flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-primary" />
              <span>التركيز المعرفي وفق تصنيف بلوم (Bloom's Taxonomy)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { val: "all", label: "متنوع (جميع المستويات)" },
                { val: "remember", label: "تذكر واسترجاع" },
                { val: "understand", label: "فهم واستيعاب" },
                { val: "apply", label: "تطبيق وسيناريوهات" },
                { val: "analyze", label: "تحليل ومقارنات" },
              ].map((item) => (
                <Button
                  key={item.val}
                  type="button"
                  variant={config.targetBloomLevel === item.val ? "default" : "outline"}
                  className="font-button text-xs h-9 btn-tactile"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      targetBloomLevel: item.val as QuizConfig["targetBloomLevel"],
                    }))
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 4. Question Type */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-label text-foreground">نوع الأسئلة</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "mcq", label: "اختيار من متعدد" },
                { val: "true-false", label: "صح أو خطأ" },
                { val: "mixed", label: "مختلط (MCQ + T/F)" },
              ].map((item) => (
                <Button
                  key={item.val}
                  type="button"
                  variant={config.questionType === item.val ? "default" : "outline"}
                  className="font-button text-xs sm:text-sm h-9 btn-tactile"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      questionType: item.val as QuizConfig["questionType"],
                    }))
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 5. Language */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-label text-foreground">لغة الأسئلة</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "auto", label: "تلقائي (حسب الملف)" },
                { val: "ar", label: "العربية (Arabic)" },
                { val: "en", label: "English" },
              ].map((item) => (
                <Button
                  key={item.val}
                  type="button"
                  variant={config.language === item.val ? "default" : "outline"}
                  className="font-button text-xs sm:text-sm h-9 btn-tactile"
                  onClick={() =>
                    setConfig((c) => ({ ...c, language: item.val as QuizConfig["language"] }))
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="sm:w-1/3 font-button btn-tactile border-border/80"
            >
              إلغاء والرجوع
            </Button>
            <MagneticButton
              type="button"
              onClick={onStart}
              className="sm:w-2/3 font-button gap-2 text-base shadow-md surface-3d bg-primary text-primary-foreground h-11 px-6 rounded-xl flex items-center justify-center"
            >
              <Zap className="h-5 w-5" />
              ابدأ الكويز الآن
            </MagneticButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 4: INTERACTIVE QUIZ VIEW
// ---------------------------------------------------------------------------

function QuizView({
  q,
  index,
  total,
  selected,
  setSelected,
  revealed,
  onSubmit,
  onNext,
  onAskTutor,
}: {
  q: QuizQuestion;
  index: number;
  total: number;
  selected: number | null;
  setSelected: (n: number) => void;
  revealed: boolean;
  onSubmit: () => void;
  onNext: () => void;
  onAskTutor: () => void;
}) {
  const progress = ((index + 1) / total) * 100;
  const optionLabels = ["أ", "ب", "ج", "د", "هـ", "و"];

  // Accessibility keyboard shortcuts (1-4 for options, Enter to submit/next)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (revealed) {
        if (e.key === "Enter") {
          e.preventDefault();
          onNext();
        }
      } else {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= q.options.length) {
          e.preventDefault();
          setSelected(num - 1);
        } else if (e.key === "Enter" && selected !== null) {
          e.preventDefault();
          onSubmit();
        }
      }
    },
    [revealed, q.options.length, selected, setSelected, onSubmit, onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const difficultyBadge = useMemo(() => {
    switch (q.difficulty) {
      case "easy":
        return (
          <Badge
            variant="secondary"
            className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-button text-xs border border-emerald-500/30"
          >
            سهل
          </Badge>
        );
      case "hard":
        return (
          <Badge
            variant="secondary"
            className="bg-red-500/15 text-red-800 dark:text-red-300 font-button text-xs border border-red-500/30"
          >
            صعب
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="bg-blue-500/15 text-blue-800 dark:text-blue-300 font-button text-xs border border-blue-500/30"
          >
            متوسط
          </Badge>
        );
    }
  }, [q.difficulty]);

  const bloomBadge = useMemo(() => {
    const level = q.bloomLevel || "understand";
    const label = getBloomBadgeLabel(level, "ar");
    const colorClasses =
      level === "remember"
        ? "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30"
        : level === "apply"
          ? "bg-purple-500/10 text-purple-900 dark:text-purple-200 border-purple-500/30"
          : level === "analyze"
            ? "bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 border-indigo-500/30"
            : level === "evaluate"
              ? "bg-rose-500/10 text-rose-900 dark:text-rose-200 border-rose-500/30"
              : "bg-teal-500/10 text-teal-900 dark:text-teal-200 border-teal-500/30";

    return (
      <Badge variant="outline" className={cn("text-xs font-button", colorClasses)}>
        <Brain className="h-3 w-3 mr-1 opacity-80" />
        {label}
      </Badge>
    );
  }, [q.bloomLevel]);

  return (
    <div key={index} className="space-y-6 animate-slide-in-right">
      {/* Progress & Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground font-button">
          <span>
            السؤال {index + 1} من {total}
          </span>
          <span className="font-mono">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2 rounded-full transition-all duration-300" />
      </div>

      <div className="double-bezel">
        <div className="double-bezel-inner p-6 md:p-8 space-y-6">
          {/* Topic, Bloom and Difficulty Tags */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="font-button text-xs text-muted-foreground bg-muted/30"
              >
                الموضوع: {q.topic}
              </Badge>
              {bloomBadge}
            </div>
            {difficultyBadge}
          </div>

          {/* Question Stem */}
          <h2 className="text-xl sm:text-2xl md:text-3xl font-heading-2 text-foreground leading-relaxed">
            {q.question}
          </h2>

          {/* Options List */}
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
                    "group flex w-full items-center justify-between gap-3.5 rounded-2xl border-2 p-4 text-right transition-all duration-200 btn-tactile",
                    !revealed &&
                      "hover:border-primary/50 hover:bg-muted/40 cursor-pointer border-border/80 bg-card",
                    isSelected &&
                      !revealed &&
                      "border-primary bg-primary/10 shadow-sm font-bold text-primary",
                    isCorrect &&
                      "border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50 font-bold shadow-xs",
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
                        !isSelected &&
                          !isCorrect &&
                          !isWrong &&
                          "bg-muted text-muted-foreground group-hover:bg-muted/90",
                      )}
                    >
                      {letter}
                    </span>
                    <span className="leading-relaxed font-body-medium text-sm sm:text-base text-foreground">
                      {opt}
                    </span>
                  </div>

                  {isCorrect && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-button shrink-0">
                      <span className="hidden sm:inline">إجابة صحيحة</span>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    </div>
                  )}
                  {isWrong && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive font-button shrink-0">
                      <span className="hidden sm:inline">إجابة خاطئة</span>
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Grounded Explanation Box */}
          {revealed && q.explanation && (
            <div className="rounded-2xl bg-muted/40 border border-border/80 p-5 text-sm space-y-2.5 animate-fade-in">
              <p className="font-heading-3 text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                تفسير الإجابة:
              </p>
              <div className="text-muted-foreground font-body leading-relaxed">
                <TypewriterText text={q.explanation} speedMs={16} delayMs={50} />
              </div>

              {/* Evidence Quote from Source Document */}
              {q.evidenceQuote && (
                <div className="rounded-xl bg-card border border-border/70 p-3.5 mt-3 text-xs space-y-1 shadow-2xs">
                  <p className="font-button text-primary flex items-center gap-1.5">
                    <Quote className="h-3.5 w-3.5" />
                    الدليل من المستند:
                  </p>
                  <p className="italic text-muted-foreground font-body leading-relaxed">
                    «{q.evidenceQuote}»
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions & AI Tutor Trigger */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60">
            {revealed ? (
              <Button
                type="button"
                variant="outline"
                onClick={onAskTutor}
                className="gap-2 font-button w-full sm:w-auto text-primary border-primary/40 hover:bg-primary/5 btn-tactile"
              >
                <Bot className="h-4 w-4" />
                <span>ناقش مساعدك الدراسي في هذا السؤال</span>
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                تلميح: اضغط 1-4 للاختيار و Enter للتأكيد
              </p>
            )}

            {!revealed ? (
              <Button
                onClick={onSubmit}
                disabled={selected === null}
                size="lg"
                className="font-button px-8 w-full sm:w-auto surface-3d btn-tactile"
              >
                تحقق من الإجابة
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={onNext}
                size="lg"
                className="font-button px-8 w-full sm:w-auto surface-3d btn-tactile"
              >
                {index + 1 >= total ? "عرض النتيجة 🏆" : "السؤال التالي"}
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 5: ENHANCED RESULTS VIEW WITH TOPIC, COGNITIVE & REVIEW OPTIONS
// ---------------------------------------------------------------------------

function EnhancedResultsView({
  questions,
  answers,
  onRetake,
  onSmartReview,
  onConfigure,
  onNewFile,
  onAskTutor,
}: {
  questions: QuizQuestion[];
  answers: number[];
  onRetake: () => void;
  onSmartReview: () => void;
  onConfigure: () => void;
  onNewFile: () => void;
  onAskTutor: (q: QuizQuestion, idx: number) => void;
}) {
  const total = questions.length;
  const score = answers.reduce(
    (acc, ans, i) => acc + (ans === questions[i]?.correctIndex ? 1 : 0),
    0,
  );
  const incorrect = total - score;
  const percentage = Math.round((score / total) * 100);

  // Mastery and Cognitive Analysis
  const { topicMastery, bloomMastery, weakTopics } = useMemo(() => {
    return analyzeAttemptMastery(questions, answers);
  }, [questions, answers]);

  // Next Review Interval Calculation
  const nextReview = useMemo(() => {
    return calculateNextReviewInterval(percentage);
  }, [percentage]);

  const grade =
    percentage >= 90
      ? "ممتاز 🏆"
      : percentage >= 75
        ? "جيد جداً 🌟"
        : percentage >= 60
          ? "جيد 👍"
          : percentage >= 50
            ? "مقبول ⚠️"
            : "يحتاج لمراجعة المادة 📚";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Score Header Card - Double Bezel */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-8 md:p-10 text-center space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20 surface-3d">
            <Trophy className="h-10 w-10" />
          </div>

          <div>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground">اكتمل الكويز!</h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground font-body">
              ملخص أدائك وتحليل إجاباتك بالتفصيل
            </p>
          </div>

          <div className="py-2">
            <div className="text-6xl sm:text-7xl font-display text-primary tracking-tight font-mono">
              <AnimatedNumber value={percentage} suffix="%" durationMs={900} />
            </div>
            <p className="mt-2 text-xl font-heading-3 text-foreground">{grade}</p>
          </div>

          {/* Quick Numbers */}
          <div className="grid grid-cols-2 max-w-sm mx-auto gap-3 pt-1">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <p className="text-2xl sm:text-3xl font-display text-emerald-600 dark:text-emerald-400">
                <AnimatedNumber value={score} durationMs={700} />
              </p>
              <p className="text-xs font-button text-muted-foreground mt-0.5">إجابات صحيحة</p>
            </div>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
              <p className="text-2xl sm:text-3xl font-display text-destructive">
                <AnimatedNumber value={incorrect} durationMs={700} />
              </p>
              <p className="text-xs font-button text-muted-foreground mt-0.5">إجابات غير صحيحة</p>
            </div>
          </div>

          {/* Spaced Repetition Recommended Interval */}
          <div className="pt-2 text-xs text-muted-foreground font-body-medium flex items-center justify-center gap-1.5">
            <Compass className="h-4 w-4 text-primary" />
            <span>موعد المراجعة المقترح لتثبيت المعلومة: </span>
            <span className="font-button text-foreground">{nextReview.labelAr}</span>
          </div>
        </div>
      </div>

      {/* 2. Pedagogical Reflection: "فهمنا من الاختبار ده إيه؟" */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-2 text-foreground text-lg sm:text-xl font-heading-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3>اكتشف اللي محتاج مراجعة</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
              <p className="text-xs font-button text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>نقاط قوتك التي أتقنتها:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(topicMastery).filter((t) => t.accuracy >= 70).length > 0 ? (
                  Object.values(topicMastery)
                    .filter((t) => t.accuracy >= 70)
                    .map((t) => (
                      <Badge
                        key={t.topic}
                        className="bg-emerald-600 text-white text-xs font-button"
                      >
                        {t.name} ({t.accuracy}%)
                      </Badge>
                    ))
                ) : (
                  <span className="text-xs text-muted-foreground font-body">
                    واصل التدريب لترقية المفاهيم إلى مرحلة الإتقان.
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
              <p className="text-xs font-button text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>مفاهيم تحتاج تثبيتاً ومراجعة:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {weakTopics.length > 0 ? (
                  weakTopics.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="bg-background text-amber-800 dark:text-amber-300 border-amber-500/40 text-xs font-button"
                    >
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-body-medium">
                    ممتاز! لا توجد مواضيع متعثرة في هذا الكويز.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actionable Next Steps (Student Choice & Agency) */}
          <div className="p-4 bg-muted/30 border border-border/70 rounded-2xl space-y-3">
            <p className="text-xs font-button text-foreground">
              الخطوات التالية المقترحة لك الآن (اختار ما يناسبك):
            </p>
            <div className="flex flex-wrap gap-2">
              {weakTopics.length > 0 && (
                <Button
                  size="sm"
                  onClick={onSmartReview}
                  className="font-button text-xs gap-1.5 bg-primary text-primary-foreground btn-tactile"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>راجع أخطاءك وثبّت المعلومة ({weakTopics.length})</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={onRetake}
                className="text-xs font-button btn-tactile border-border/80"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                إعادة الكويز بترتيب خيارات جديد
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onConfigure}
                className="text-xs font-button btn-tactile border-border/80"
              >
                <Sliders className="h-3.5 w-3.5 mr-1" />
                تغيير إعدادات الأسئلة
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Weak Topics Recommendation Alert */}
      {weakTopics.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-base">
            <AlertTriangle className="h-5 w-5" />
            <span>خطوتك الجاية (اكتشف اللي محتاج مراجعة)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            أظهرت النتائج أنك واجهت صعوبة في المواضيع التالية. يمكنك بدء جولة مراجعة ذكية تركز عليها
            مباشرة:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {weakTopics.map((topic) => (
              <Badge
                key={topic}
                variant="outline"
                className="bg-background font-bold border-amber-500/40 text-amber-900 dark:text-amber-200"
              >
                {topic}
              </Badge>
            ))}
          </div>

          <div className="pt-1">
            <Button
              onClick={onSmartReview}
              size="sm"
              className="font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Brain className="h-4 w-4" />
              <span>راجع أخطاءك وثبّت المعلومة الآن</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Topic Analytics Breakdown */}
      <Card className="p-6 md:p-8 space-y-5">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          مستوى التمكّن حسب المواضيع (Topic Mastery)
        </h3>
        <div className="space-y-4">
          {Object.entries(topicMastery).map(([topic, stats]) => {
            return (
              <div key={topic} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <span>{topic}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] py-0 px-1.5",
                        stats.status === "mastered"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                          : stats.status === "in_progress"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                            : "bg-red-500/10 text-red-700 border-red-500/30",
                      )}
                    >
                      {stats.status === "mastered"
                        ? "متقن"
                        : stats.status === "in_progress"
                          ? "قيد التقدم"
                          : "يحتاج تدريب"}
                    </Badge>
                  </span>
                  <span>
                    {stats.correctCount} / {stats.totalAttempts} ({stats.accuracy}%)
                  </span>
                </div>
                <Progress value={stats.accuracy} className="h-2" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Cognitive Analysis (Bloom's Taxonomy) */}
      <Card className="p-6 md:p-8 space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          التحليل المعرفي وفق هرم بلوم (Bloom's Taxonomy)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {Object.entries(bloomMastery).map(([bloom, data]) => {
            const label = getBloomBadgeLabel(bloom, "ar");
            return (
              <div key={bloom} className="p-3 rounded-lg border border-border/60 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="text-xl font-black mt-1 text-primary">
                  {data.correct} / {data.total}
                </p>
                <p className="text-xs text-muted-foreground font-medium">{data.percentage}%</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detailed Question Review List */}
      <Card className="p-6 md:p-8 space-y-5">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          مراجعة الأسئلة وتفسيراتها بالتفصيل
        </h3>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const isCorrect = answers[idx] === q.correctIndex;
            return (
              <div
                key={idx}
                className={cn(
                  "p-4 rounded-xl border space-y-2 text-right transition-all",
                  isCorrect
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <span>السؤال {idx + 1}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {q.topic}
                    </Badge>
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      isCorrect
                        ? "bg-emerald-500/20 text-emerald-800"
                        : "bg-destructive/20 text-destructive"
                    }
                  >
                    {isCorrect ? "صحيح" : "خاطئ"}
                  </Badge>
                </div>

                <p className="text-sm font-bold leading-relaxed">{q.question}</p>

                <div className="text-xs space-y-1 pt-1 text-muted-foreground font-medium">
                  <p>
                    <span className="font-bold text-foreground">الإجابة الصحيحة: </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                      {q.options[q.correctIndex]}
                    </span>
                  </p>
                  {!isCorrect && answers[idx] !== undefined && answers[idx] >= 0 && (
                    <p>
                      <span className="font-bold text-foreground">إجابتك: </span>
                      <span className="text-destructive font-bold">{q.options[answers[idx]]}</span>
                    </p>
                  )}
                  {q.explanation && (
                    <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-bold text-foreground">التفسير: </span>
                      {q.explanation}
                    </p>
                  )}
                  {q.evidenceQuote && (
                    <p className="pt-1 text-[11px] italic text-primary/80">
                      <span className="font-bold">الدليل من المستند: </span>«{q.evidenceQuote}»
                    </p>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAskTutor(q, idx)}
                    className="gap-1.5 text-xs text-primary font-bold hover:bg-primary/10"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>اسأل المعلم الذكي عن هذا السؤال</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {weakTopics.length > 0 && (
          <Button
            onClick={onSmartReview}
            size="lg"
            variant="default"
            className="sm:w-1/4 font-bold gap-2 bg-gradient-to-r from-primary to-accent"
          >
            <Brain className="h-4 w-4" />
            مراجعة ذكية
          </Button>
        )}
        <Button
          onClick={onRetake}
          size="lg"
          variant="outline"
          className={cn("font-bold gap-2", weakTopics.length > 0 ? "sm:w-1/4" : "sm:w-1/3")}
        >
          <RotateCcw className="h-4 w-4" />
          إعادة الكويز
        </Button>
        <Button
          onClick={onConfigure}
          size="lg"
          variant="secondary"
          className={cn("font-bold gap-2", weakTopics.length > 0 ? "sm:w-1/4" : "sm:w-1/3")}
        >
          <Sliders className="h-4 w-4" />
          تغيير الإعدادات
        </Button>
        <Button
          onClick={onNewFile}
          size="lg"
          variant="outline"
          className={cn("font-bold gap-2", weakTopics.length > 0 ? "sm:w-1/4" : "sm:w-1/3")}
        >
          <ArrowRight className="h-4 w-4" />
          ملف جديد
        </Button>
      </div>
    </div>
  );
}
