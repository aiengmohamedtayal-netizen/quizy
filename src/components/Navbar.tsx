import { useState } from "react";
import { Sparkles, Zap, LayoutDashboard, Database, RotateCcw, Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export type MainNavTab = "studio" | "dashboard" | "bank";

interface NavbarProps {
  activeTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  canReset: boolean;
  onReset: () => void;
}

export function Navbar({ activeTab, onTabChange, canReset, onReset }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: MainNavTab; label: string; icon: typeof Zap }> = [
    { id: "studio", label: "الكويز", icon: Zap },
    { id: "dashboard", label: "لوحة الإتقان", icon: LayoutDashboard },
    { id: "bank", label: "بنك الأسئلة", icon: Database },
  ];

  const handleSelect = (tab: MainNavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md transition-colors duration-200">
      <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-3.5">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20 surface-3d">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-display text-foreground tracking-tight">كويزي</span>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-[10px] py-0 px-2 font-bold text-primary border-primary/30"
              >
                Learn. Practice. Master.
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-body-medium hidden md:block">
              منصة التدريب والمراجعة لاختبار فهمك وتثبيت معلوماتك
            </p>
          </div>
        </div>

        {/* Desktop Central Navigation Pill */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-1 rounded-2xl border border-border/80 bg-muted/40 p-1 shadow-inner backdrop-blur-sm"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-button transition-all duration-200",
                  isActive
                    ? "bg-background text-primary shadow-sm scale-100 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <Icon
                  className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls: Reset & Theme Toggle */}
        <div className="flex items-center gap-2">
          {canReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="gap-1.5 font-button text-xs h-9 border-border/80 hover:border-primary/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ملف جديد</span>
            </Button>
          )}

          {/* Theme Switcher */}
          <ThemeToggle />

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            aria-label="القائمة"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-muted/30 text-foreground hover:bg-muted/70 transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-lg px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-button transition-all",
                    isActive
                      ? "bg-primary/10 text-primary font-bold border border-primary/30"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>المظهر والإعدادات</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
