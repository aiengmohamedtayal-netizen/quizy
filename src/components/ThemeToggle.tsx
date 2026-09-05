import { useTheme, type Theme } from "@/lib/theme";
import { Sun, Moon, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: "light", label: "نهاري", icon: Sun },
    { value: "dark", label: "ليلي", icon: Moon },
    { value: "system", label: "تلقائي", icon: Laptop },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="اختيار وضع المظهر"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/40 p-1 shadow-inner backdrop-blur-sm",
        className,
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive
                ? "bg-background text-foreground shadow-sm scale-100 font-black"
                : "text-muted-foreground hover:text-foreground/80 hover:bg-background/40",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="mr-1 hidden md:inline text-[11px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
