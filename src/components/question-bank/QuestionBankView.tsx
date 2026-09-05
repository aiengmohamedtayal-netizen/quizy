import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  BookOpen,
  Brain,
  Quote,
  CheckCircle2,
  Filter,
  Play,
  Check,
  ShieldCheck,
  AlertTriangle,
  Upload,
  Bookmark,
  BookmarkCheck,
  Flag,
  FlagOff,
  Trash2,
  SquareCheck,
  SquareDashed,
  ImageIcon,
  FileText,
  X,
} from "lucide-react";
import {
  getStoredQuestionBank,
  filterQuestionBank,
  updateQuestionStatus,
  updateQuestionFlags,
  deleteQuestionFromBank,
  getBankSourceDocuments,
  type QuestionBankItem,
  type QuestionBankFilter,
  type QuestionStatus,
} from "@/lib/learning/question-bank";
import { getBloomBadgeLabel } from "@/lib/i18n/translations";
import type { QuizQuestion, Difficulty, BloomLevel } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";
import { ImportBankDialog } from "./ImportBankDialog";
import { ExactQuizRunner } from "./ExactQuizRunner";

// ---------------------------------------------------------------------------
// Tab Definition
// ---------------------------------------------------------------------------

type BankTab = "all" | "saved" | "by_source" | "errors" | "review";

const TABS: Array<{ id: BankTab; label: string }> = [
  { id: "all", label: "كل الأسئلة" },
  { id: "saved", label: "بنكي" },
  { id: "by_source", label: "من الملفات" },
  { id: "errors", label: "أخطأت فيها" },
  { id: "review", label: "للمراجعة" },
];

// ---------------------------------------------------------------------------
// Helper: Fidelity Badge
// ---------------------------------------------------------------------------

function FidelityBadge({ item }: { item: QuestionBankItem }) {
  if (item.importMode !== "exact_source") return null;

  if (item.importFidelity === "exact") {
    return (
      <Badge className="gap-0.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-button py-0">
        <ShieldCheck className="h-2.5 w-2.5" />
        مصدر أصلي
      </Badge>
    );
  }
  if (item.importFidelity === "review_required") {
    return (
      <Badge className="gap-0.5 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-button py-0">
        <AlertTriangle className="h-2.5 w-2.5" />
        يحتاج مراجعة
      </Badge>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Question Card
// ---------------------------------------------------------------------------

function QuestionCard({
  item,
  isSelected,
  onSelect,
  onStatusChange,
  onToggleSave,
  onToggleReview,
  onDelete,
  onStartFromHere,
}: {
  item: QuestionBankItem;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onStatusChange: (id: string, status: QuestionStatus) => void;
  onToggleSave: (id: string) => void;
  onToggleReview: (id: string) => void;
  onDelete: (id: string) => void;
  onStartFromHere: (item: QuestionBankItem) => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <Card
      className={cn(
        "p-4 sm:p-5 space-y-3 border rounded-2xl surface-3d text-right transition-all duration-200",
        isSelected
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : item.isSaved
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-border/80",
        item.requiresReview && "border-amber-500/40",
      )}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selection Checkbox */}
          <button
            type="button"
            onClick={() => onSelect(item.id, !isSelected)}
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label={isSelected ? "إلغاء التحديد" : "تحديد السؤال"}
          >
            {isSelected ? (
              <SquareCheck className="h-4 w-4 text-primary" />
            ) : (
              <SquareDashed className="h-4 w-4" />
            )}
          </button>

          <Badge variant="outline" className="text-xs font-button bg-muted/40">
            {item.topic}
          </Badge>
          <FidelityBadge item={item} />
          {item.importMode === "exact_source" && item.sourcePage && (
            <Badge
              variant="outline"
              className="text-[10px] font-button text-muted-foreground py-0 px-1.5"
            >
              ص. {item.sourcePage}
            </Badge>
          )}
          {item.mediaRequired && (
            <Badge className="gap-0.5 text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-button py-0">
              <ImageIcon className="h-2.5 w-2.5" />
              يحتاج صورة
            </Badge>
          )}
          {item.isSaved && (
            <Badge className="gap-0.5 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-button py-0">
              <BookmarkCheck className="h-2.5 w-2.5" />
              محفوظ
            </Badge>
          )}
          {item.markedForReview && (
            <Badge className="gap-0.5 text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-button py-0">
              <Flag className="h-2.5 w-2.5" />
              للمراجعة
            </Badge>
          )}
        </div>

        {/* Difficulty */}
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] font-button",
            item.difficulty === "easy"
              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
              : item.difficulty === "hard"
                ? "text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/30"
                : "text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/30",
          )}
        >
          {item.difficulty === "easy" ? "سهل" : item.difficulty === "hard" ? "صعب" : "متوسط"}
        </Badge>
      </div>

      {/* Question Text */}
      <h4 className="font-heading-3 text-base leading-relaxed text-foreground">
        {item.originalText ?? item.question}
      </h4>

      {/* Options */}
      <div
        className={cn("grid gap-2 text-xs", showOptions ? "grid-cols-1 sm:grid-cols-2" : "hidden")}
      >
        {item.options.map((opt, optIdx) => {
          const isCorrect = optIdx === item.correctIndex;
          return (
            <div
              key={optIdx}
              className={cn(
                "p-2.5 rounded-xl border font-body-medium transition-colors",
                isCorrect
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-bold flex items-center justify-between"
                  : "border-border/60 bg-muted/20 text-muted-foreground",
              )}
            >
              <span>{opt}</span>
              {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Explanation & Evidence */}
      {showOptions && (
        <div className="text-xs space-y-1.5 pt-1 text-muted-foreground font-body">
          {item.explanation && (
            <p>
              <span className="font-button text-foreground">التفسير: </span>
              {item.explanation}
            </p>
          )}
          {item.evidenceQuote && (
            <p className="text-[11px] italic text-primary/90 bg-muted/40 p-2 rounded-lg border border-border/50">
              <span className="font-button not-italic text-primary">الدليل: </span>«
              {item.evidenceQuote}»
            </p>
          )}
          {item.reviewReason && (
            <p className="text-amber-700 dark:text-amber-300">
              <span className="font-button">سبب المراجعة: </span>
              {item.reviewReason}
            </p>
          )}
        </div>
      )}

      {/* Performance Stats */}
      {(item.correctCount ?? 0) + (item.incorrectCount ?? 0) > 0 && (
        <div className="text-[10px] font-body-medium text-muted-foreground flex gap-3">
          {item.correctCount ? (
            <span className="text-emerald-600">✓ {item.correctCount} صحيح</span>
          ) : null}
          {item.incorrectCount ? (
            <span className="text-destructive">✗ {item.incorrectCount} خاطئ</span>
          ) : null}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowOptions(!showOptions)}
          className="text-xs font-button gap-1 text-muted-foreground hover:text-foreground btn-tactile h-7 px-2"
        >
          <BookOpen className="h-3 w-3" />
          {showOptions ? "إخفاء" : "التفاصيل"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleSave(item.id)}
          className={cn(
            "text-xs font-button gap-1 btn-tactile h-7 px-2",
            item.isSaved
              ? "text-amber-600 hover:text-amber-700"
              : "text-muted-foreground hover:text-amber-600",
          )}
        >
          {item.isSaved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
          {item.isSaved ? "محفوظ" : "حفظ"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleReview(item.id)}
          className={cn(
            "text-xs font-button gap-1 btn-tactile h-7 px-2",
            item.markedForReview
              ? "text-purple-600 hover:text-purple-700"
              : "text-muted-foreground hover:text-purple-600",
          )}
        >
          {item.markedForReview ? <FlagOff className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
          {item.markedForReview ? "إلغاء التعليم" : "للمراجعة"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onStartFromHere(item)}
          className="text-xs font-button gap-1 text-primary hover:text-primary btn-tactile h-7 px-2 mr-auto"
        >
          <Play className="h-3 w-3" />
          ابدأ من هنا
        </Button>

        {item.status !== "approved" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStatusChange(item.id, "approved")}
            className="text-xs font-button gap-1 text-emerald-600 hover:bg-emerald-500/10 btn-tactile h-7 px-2"
          >
            <Check className="h-3 w-3" />
            اعتماد
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStatusChange(item.id, "validated")}
            className="text-xs font-button text-muted-foreground btn-tactile h-7 px-2"
          >
            إلغاء الاعتماد
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(item.id)}
          className="text-xs font-button gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 btn-tactile h-7 px-2"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

interface QuestionBankViewProps {
  onStartQuizFromQuestions: (questions: QuizQuestion[]) => void;
}

export function QuestionBankView({ onStartQuizFromQuestions }: QuestionBankViewProps) {
  const [items, setItems] = useState<QuestionBankItem[]>(() => getStoredQuestionBank());
  const [activeTab, setActiveTab] = useState<BankTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedBloom, setSelectedBloom] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exactQuizQuestions, setExactQuizQuestions] = useState<QuestionBankItem[] | null>(null);

  const reload = () => setItems(getStoredQuestionBank());

  const topics = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.topic));
    return Array.from(set);
  }, [items]);

  const sourceDocs = useMemo(() => getBankSourceDocuments(items), [items]);

  // Build filter from active tab + UI filters
  const filter = useMemo((): QuestionBankFilter => {
    const base: QuestionBankFilter = {
      query: searchQuery || undefined,
      difficulty: selectedDifficulty !== "all" ? (selectedDifficulty as Difficulty) : undefined,
      bloomLevel: selectedBloom !== "all" ? (selectedBloom as BloomLevel) : undefined,
      topic: selectedTopic !== "all" ? selectedTopic : undefined,
      sourceDocumentId: selectedSource !== "all" ? selectedSource : undefined,
    };
    switch (activeTab) {
      case "saved":
        return { ...base, isSaved: true };
      case "errors":
        return { ...base, hasErrors: true };
      case "review":
        return { ...base, markedForReview: true };
      case "by_source":
        return base; // source filter handled via sourceDocumentId selector
      default:
        return base;
    }
  }, [activeTab, searchQuery, selectedDifficulty, selectedBloom, selectedTopic, selectedSource]);

  const filteredItems = useMemo(() => filterQuestionBank(items, filter), [items, filter]);

  // Tab counts
  const tabCounts = useMemo(
    () => ({
      all: items.length,
      saved: items.filter((i) => i.isSaved).length,
      by_source: sourceDocs.length,
      errors: items.filter((i) => (i.incorrectCount ?? 0) > 0).length,
      review: items.filter((i) => i.markedForReview).length,
    }),
    [items, sourceDocs],
  );

  // Multi-select handlers
  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  // Actions
  const handleStatusChange = (id: string, status: QuestionStatus) => {
    updateQuestionStatus(id, status);
    reload();
  };

  const handleToggleSave = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateQuestionFlags(id, { isSaved: !item.isSaved });
    reload();
  };

  const handleToggleReview = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateQuestionFlags(id, { markedForReview: !item.markedForReview });
    reload();
  };

  const handleDelete = (id: string) => {
    deleteQuestionFromBank(id);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    reload();
  };

  // Start exact quiz from a single question
  const handleStartFromHere = (item: QuestionBankItem) => {
    const index = filteredItems.findIndex((i) => i.id === item.id);
    const ordered = [...filteredItems.slice(index), ...filteredItems.slice(0, index)];
    if (item.importMode === "exact_source") {
      setExactQuizQuestions(ordered);
    } else {
      onStartQuizFromQuestions(toQuizQuestions(ordered));
    }
  };

  // Launch quiz from selected questions
  const handleLaunchSelected = () => {
    const selected = filteredItems.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const hasExact = selected.some((i) => i.importMode === "exact_source");
    const hasAI = selected.some((i) => i.importMode === "ai_generated");
    if (hasExact && !hasAI) {
      setExactQuizQuestions(selected);
    } else {
      // Mixed or AI-only: use standard quiz runner
      onStartQuizFromQuestions(toQuizQuestions(selected));
    }
  };

  // Launch all filtered items
  const handleLaunchAll = () => {
    if (filteredItems.length === 0) return;
    const hasExact = filteredItems.some((i) => i.importMode === "exact_source");
    const hasAI = filteredItems.some((i) => i.importMode === "ai_generated");
    if (hasExact && !hasAI) {
      setExactQuizQuestions(filteredItems);
    } else {
      onStartQuizFromQuestions(toQuizQuestions(filteredItems));
    }
  };

  function toQuizQuestions(bankItems: QuestionBankItem[]): QuizQuestion[] {
    return bankItems.map((item) => ({
      question: item.originalText ?? item.question,
      options: item.options,
      correctIndex: item.correctIndex,
      explanation: item.explanation,
      topic: item.topic,
      difficulty: item.difficulty,
      bloomLevel: item.bloomLevel,
      evidenceQuote: item.evidenceQuote,
    }));
  }

  // If running an exact quiz, show that instead
  if (exactQuizQuestions) {
    return (
      <ExactQuizRunner
        questions={exactQuizQuestions}
        sourceDocumentName={exactQuizQuestions[0]?.sourceDocumentName}
        onComplete={() => {}}
        onExit={() => {
          setExactQuizQuestions(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display text-foreground">
            بنك الأسئلة والمراجعة
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-0.5">
            {items.length} سؤال محفوظ · ابحث واختر وابدأ جلسة التدريب
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            className="font-button gap-2 border-border/80 btn-tactile text-sm"
          >
            <Upload className="h-4 w-4" />
            استيراد بنك أسئلة
          </Button>

          {filteredItems.length > 0 && selectedIds.size === 0 && (
            <Button
              onClick={handleLaunchAll}
              className="font-button gap-2 surface-3d btn-tactile shadow-md text-sm"
            >
              <Play className="h-4 w-4" />
              اختبرني ({filteredItems.length})
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-button transition-all duration-200",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    activeTab === tab.id ? "bg-primary/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Multi-Select Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-sm font-button text-primary">
            <SquareCheck className="h-4 w-4" />
            تم تحديد {selectedIds.size} من {filteredItems.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearSelection}
              className="text-xs font-button h-8 gap-1 border-border/80"
            >
              <X className="h-3.5 w-3.5" />
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleLaunchSelected}
              className="text-xs font-button h-8 gap-1.5 surface-3d"
            >
              <Play className="h-3.5 w-3.5" />
              اختبرني في المحدد
            </Button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-4 sm:p-5 space-y-3.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث في الأسئلة أو المواضيع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-input bg-background pr-10 pl-4 py-2.5 text-xs sm:text-sm font-body-medium placeholder:text-muted-foreground/60 transition-all duration-200"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="font-button text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary" />
              الفلاتر:
            </span>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-button"
            >
              <option value="all">كل مستويات الصعوبة</option>
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>

            <select
              value={selectedBloom}
              onChange={(e) => setSelectedBloom(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-button"
            >
              <option value="all">كل المستويات المعرفية</option>
              <option value="remember">تذكر</option>
              <option value="understand">فهم</option>
              <option value="apply">تطبيق</option>
              <option value="analyze">تحليل</option>
            </select>

            {topics.length > 0 && (
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-button"
              >
                <option value="all">كل المواضيع ({topics.length})</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {sourceDocs.length > 0 && activeTab === "by_source" && (
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-button"
              >
                <option value="all">كل الملفات ({sourceDocs.length})</option>
                {sourceDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} ({doc.count})
                  </option>
                ))}
              </select>
            )}

            {/* Select All Toggle */}
            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="mr-auto text-xs font-button text-primary hover:underline flex items-center gap-1"
              >
                {selectedIds.size === filteredItems.length ? (
                  <>
                    <SquareDashed className="h-3 w-3" /> إلغاء تحديد الكل
                  </>
                ) : (
                  <>
                    <SquareCheck className="h-3 w-3" /> تحديد الكل
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty States */}
      {filteredItems.length === 0 && (
        <div className="double-bezel">
          <div className="double-bezel-inner p-10 md:p-14 text-center space-y-4 bg-muted/20 border-dashed">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xs surface-3d">
              {activeTab === "errors" ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              ) : activeTab === "review" ? (
                <Flag className="h-8 w-8" />
              ) : activeTab === "saved" ? (
                <Bookmark className="h-8 w-8" />
              ) : (
                <BookOpen className="h-8 w-8" />
              )}
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-lg sm:text-xl font-heading-2 text-foreground">
                {activeTab === "errors"
                  ? "لا توجد أسئلة أخطأت فيها — أداء ممتاز!"
                  : activeTab === "review"
                    ? "لا توجد أسئلة معلّمة للمراجعة"
                    : activeTab === "saved"
                      ? "لم تحفظ أسئلة بعد"
                      : items.length === 0
                        ? "بنك الأسئلة فارغ حالياً"
                        : "لا نتائج تطابق البحث"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-body leading-relaxed">
                {items.length === 0
                  ? "ارفع ملفك الدراسي أو استورد بنك أسئلة، والأسئلة هتتحفظ هنا للمراجعة."
                  : "جرّب تغيير الفلاتر أو البحث بكلمة أخرى."}
              </p>
              {items.length === 0 && (
                <Button
                  onClick={() => setImportDialogOpen(true)}
                  className="font-button gap-2 surface-3d mt-2"
                >
                  <Upload className="h-4 w-4" />
                  استيراد بنك أسئلة
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Cards */}
      {filteredItems.length > 0 && (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <QuestionCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onSelect={handleSelect}
              onStatusChange={handleStatusChange}
              onToggleSave={handleToggleSave}
              onToggleReview={handleToggleReview}
              onDelete={handleDelete}
              onStartFromHere={handleStartFromHere}
            />
          ))}
        </div>
      )}

      {/* Import Dialog */}
      <ImportBankDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={(count) => {
          reload();
          setImportDialogOpen(false);
        }}
      />
    </div>
  );
}
