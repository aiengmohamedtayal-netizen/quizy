import { useState, useRef, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { importExactBankFn } from "@/lib/quiz.functions";
import { parseAndValidateDocument } from "@/lib/documents/document-service";
import { saveExactSourceBank } from "@/lib/learning/question-bank";
import type {
  ImportedQuestion,
  ExactImportResult,
  ImportPreviewSummary,
} from "@/lib/learning/exact-import-types";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type ImportStep = "upload" | "extracting" | "preview" | "done";

interface ImportBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (count: number) => void;
}

const ALLOWED_TYPES = [".pdf", ".docx", ".txt"];

// ---------------------------------------------------------------------------
// Fidelity Badge
// ---------------------------------------------------------------------------

function FidelityBadge({ fidelity }: { fidelity: ImportedQuestion["importFidelity"] }) {
  if (fidelity === "exact") {
    return (
      <Badge className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-button">
        <ShieldCheck className="h-3 w-3" />
        مطابق 100%
      </Badge>
    );
  }
  if (fidelity === "review_required") {
    return (
      <Badge className="gap-1 text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-button">
        <AlertTriangle className="h-3 w-3" />
        يحتاج مراجعة
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 text-[10px] bg-destructive/15 text-destructive border border-destructive/30 font-button">
      <X className="h-3 w-3" />
      فشل الاستخراج
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Preview Summary Banner
// ---------------------------------------------------------------------------

function PreviewSummaryBanner({ preview }: { preview: ImportPreviewSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-center">
        <p className="text-xl font-display text-foreground">{preview.total}</p>
        <p className="text-[10px] font-button text-muted-foreground mt-0.5">إجمالي الأسئلة</p>
      </div>
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
        <p className="text-xl font-display text-emerald-600 dark:text-emerald-400">
          {preview.exact}
        </p>
        <p className="text-[10px] font-button text-muted-foreground mt-0.5">مطابق 100%</p>
      </div>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
        <p className="text-xl font-display text-amber-600 dark:text-amber-400">
          {preview.needsReview}
        </p>
        <p className="text-[10px] font-button text-muted-foreground mt-0.5">يحتاج مراجعة</p>
      </div>
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3 text-center">
        <p className="text-xl font-display text-blue-600 dark:text-blue-400">
          {preview.mediaRequired}
        </p>
        <p className="text-[10px] font-button text-muted-foreground mt-0.5">يحتاج صورة</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dual-View Question Preview Card
// ---------------------------------------------------------------------------

function QuestionPreviewCard({
  question,
  index,
  onRemove,
}: {
  question: ImportedQuestion;
  index: number;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 space-y-3 text-right transition-all duration-200",
        question.importFidelity === "exact"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : question.importFidelity === "review_required"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-destructive/30 bg-destructive/5",
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-button text-muted-foreground">
            {question.sourceQuestionNumber
              ? `السؤال ${question.sourceQuestionNumber}`
              : `#${index + 1}`}
          </span>
          {question.sourcePage && (
            <Badge
              variant="outline"
              className="text-[10px] font-button text-muted-foreground py-0 px-1.5"
            >
              ص. {question.sourcePage}
            </Badge>
          )}
          <FidelityBadge fidelity={question.importFidelity} />
          {question.mediaRequired && (
            <Badge className="gap-1 text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-button">
              <ImageIcon className="h-3 w-3" />
              يحتاج صورة
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
            aria-label={expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="حذف السؤال"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Review Reason */}
      {question.requiresReview && question.reviewReason && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-body bg-amber-500/10 rounded-xl px-3 py-2">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{question.reviewReason}</span>
        </div>
      )}

      {/* Dual-View Preview */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Source View */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
            <p className="text-[10px] font-button text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              المصدر الأصلي
            </p>
            <pre className="text-xs font-body leading-relaxed whitespace-pre-wrap text-foreground/80 rtl">
              {question.sourceSnapshot}
            </pre>
          </div>

          {/* Quiz View */}
          <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
            <p className="text-[10px] font-button text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              داخل الكويز
            </p>
            <p className="text-xs font-heading-3 text-foreground leading-relaxed">
              {question.originalText}
            </p>
            <div className="space-y-1 pt-1">
              {question.options.map((opt, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-lg border font-body",
                    i === question.correctIndex
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 font-bold"
                      : "border-border/50 bg-muted/20 text-muted-foreground",
                  )}
                >
                  {opt}
                </div>
              ))}
            </div>
            {question.correctAnswerSource && (
              <p className="text-[10px] text-muted-foreground font-body-medium pt-1">
                الإجابة في المصدر:{" "}
                <span className="font-button text-foreground">{question.correctAnswerSource}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Collapsed: show question text only */}
      {!expanded && (
        <p className="text-sm font-heading-3 text-foreground leading-relaxed line-clamp-2">
          {question.originalText}
        </p>
      )}

      {/* Fidelity match indicator */}
      <div
        className={cn(
          "text-center text-[10px] font-button py-1 rounded-lg",
          question.importFidelity === "exact"
            ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
            : "text-amber-700 dark:text-amber-300 bg-amber-500/10",
        )}
      >
        {question.importFidelity === "exact"
          ? "✓ المصدر والكويز متطابقان"
          : "⚠ يوجد فرق — راجع السؤال قبل الاستخدام"}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dialog Component
// ---------------------------------------------------------------------------

export function ImportBankDialog({ open, onOpenChange, onImportComplete }: ImportBankDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState<ExactImportResult | null>(null);
  const [questions, setQuestions] = useState<ImportedQuestion[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const importExact = useServerFn(importExactBankFn);

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase();
      const isAllowed = ALLOWED_TYPES.some((t) => ext.endsWith(t));
      if (!isAllowed) {
        toast.error("صيغة الملف غير مدعومة. الصيغ المدعومة: PDF، DOCX، TXT");
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        toast.error("حجم الملف يتجاوز 30MB");
        return;
      }

      setLoading(true);
      setStep("extracting");
      setProgressPct(5);
      setProgressMsg("بنقرأ الملف...");

      try {
        // Step 1: Parse the document
        setProgressMsg("بنستخرج المحتوى...");
        setProgressPct(20);
        const parsed = await parseAndValidateDocument(file);

        setProgressMsg("بنحلل بنية الأسئلة...");
        setProgressPct(40);

        // Step 2: Run exact extraction server function
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        setProgressMsg("بنحدد حدود الأسئلة ونستخرجها بالحرف...");
        setProgressPct(60);

        const extractionResult = await importExact({
          data: {
            text: parsed.text,
            documentName: file.name,
            documentId,
            pageCount: parsed.normalizedDoc?.metadata.pageCount ?? 1,
          },
        });

        setProgressMsg("بنتحقق من الأمانة وبنحسب التوقيعات...");
        setProgressPct(85);

        await new Promise((r) => setTimeout(r, 300));

        setProgressPct(100);
        setProgressMsg("الاستخراج اكتمل!");
        setResult(extractionResult);
        setQuestions(extractionResult.questions.filter((q) => q.importFidelity !== "failed"));
        setStep("preview");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الاستخراج";
        toast.error(msg);
        setStep("upload");
      } finally {
        setLoading(false);
      }
    },
    [importExact],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleConfirmImport = useCallback(() => {
    const toSave = questions.filter((q) => q.importFidelity !== "failed");
    if (toSave.length === 0) {
      toast.error("لا يوجد أسئلة صالحة للاستيراد");
      return;
    }
    saveExactSourceBank(toSave);
    toast.success(`تم حفظ ${toSave.length} سؤالاً في بنك الأسئلة!`);
    onImportComplete(toSave.length);
    setStep("done");
    setTimeout(() => {
      onOpenChange(false);
      // Reset state for next use
      setStep("upload");
      setResult(null);
      setQuestions([]);
      setProgressPct(0);
    }, 1500);
  }, [questions, onImportComplete, onOpenChange]);

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8"
        dir="rtl"
      >
        <DialogHeader className="space-y-2 text-right">
          <DialogTitle className="text-xl sm:text-2xl font-heading-2 text-foreground">
            استيراد بنك أسئلة
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-body">
            ارفع ملف بنك الأسئلة واستخرج الأسئلة كما هي — بدون أي تعديل أو إعادة صياغة.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-button text-muted-foreground pt-2">
          {(["upload", "extracting", "preview", "done"] as ImportStep[]).map((s, i, arr) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : arr.indexOf(step) > i
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {arr.indexOf(step) > i ? "✓" : i + 1}
              </span>
              <span className={step === s ? "text-foreground font-bold" : ""}>
                {s === "upload"
                  ? "رفع الملف"
                  : s === "extracting"
                    ? "الاستخراج"
                    : s === "preview"
                      ? "المراجعة"
                      : "تم"}
              </span>
              {i < arr.length - 1 && <span className="opacity-30">›</span>}
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-3xl p-10 text-center space-y-4 cursor-pointer transition-all duration-200",
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/60 hover:border-primary/50 hover:bg-muted/20",
            )}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary surface-3d">
              <Upload className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="font-heading-3 text-foreground text-sm">
                اسحب ملف بنك الأسئلة هنا أو اضغط للاختيار
              </p>
              <p className="text-xs text-muted-foreground font-body">
                PDF، DOCX، TXT — بحد أقصى 30MB
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground font-body-medium max-w-sm mx-auto leading-relaxed">
              الأسئلة هتُستخرج حرفياً كما هي في الملف — بدون إعادة صياغة أو تعديل.
            </p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
        />

        {/* Step: Extracting */}
        {step === "extracting" && (
          <div className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              <p className="font-heading-3 text-foreground text-sm">{progressMsg}</p>
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-muted-foreground font-body">
                بنستخرج الأسئلة حرفياً ونتحقق من تطابقها مع المصدر...
              </p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && result && (
          <div className="space-y-5">
            <PreviewSummaryBanner preview={result.preview} />

            <div className="rounded-2xl bg-muted/30 border border-border/60 p-4 text-xs text-muted-foreground font-body space-y-1">
              <p className="font-button text-foreground">ماذا تعني هذه النتائج؟</p>
              <p>
                •{" "}
                <span className="font-button text-emerald-700 dark:text-emerald-300">
                  مطابق 100%
                </span>{" "}
                — السؤال مستخرج بثقة عالية ويمكن إضافته مباشرة.
              </p>
              <p>
                •{" "}
                <span className="font-button text-amber-700 dark:text-amber-300">يحتاج مراجعة</span>{" "}
                — الاستخراج غير مكتمل. راجع السؤال قبل الاستخدام.
              </p>
              <p>
                • <span className="font-button text-blue-700 dark:text-blue-300">يحتاج صورة</span> —
                السؤال يشير إلى شكل أو صورة لم تُستخرج. افتح المصدر للمراجعة.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-heading-3 text-foreground">
                الأسئلة المستخرجة ({questions.length})
              </p>
              <Badge variant="outline" className="font-button text-xs">
                {questions.filter((q) => q.importFidelity === "exact").length} مطابق ·{" "}
                {questions.filter((q) => q.importFidelity === "review_required").length} للمراجعة
              </Badge>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {questions.map((q, i) => (
                <QuestionPreviewCard
                  key={q.id}
                  question={q}
                  index={i}
                  onRemove={() => removeQuestion(q.id)}
                />
              ))}
              {questions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm font-body">
                  لا يوجد أسئلة قابلة للاستيراد.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                className="font-button text-sm border-border/80"
              >
                رفع ملف آخر
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={questions.length === 0}
                className="font-button text-sm gap-2 surface-3d flex-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                إضافة {questions.length} سؤال إلى بنك الأسئلة
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center py-10 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="font-heading-2 text-foreground">تم الاستيراد بنجاح!</p>
            <p className="text-xs text-muted-foreground font-body">
              الأسئلة أُضيفت إلى بنك أسئلتك وجاهزة للتدريب.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
