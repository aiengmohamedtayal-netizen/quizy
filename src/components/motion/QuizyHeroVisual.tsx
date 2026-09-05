import { FloatingVector } from "./FloatingVector";

export function QuizyHeroVisual() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute -inset-24 bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.18),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.18),transparent_34%)]" />
      <div className="absolute left-8 top-8 h-20 w-20 rounded-full border border-primary/20 bg-primary/10 blur-sm motion-safe:animate-pulse" />
      <div className="absolute bottom-10 right-10 h-28 w-28 rounded-full border border-violet-500/20 bg-violet-500/10 blur-md motion-safe:animate-pulse" />

      <div className="relative flex h-full items-center justify-center">
        <div className="relative w-full max-w-md [perspective:1200px]">
          <div className="relative rounded-3xl border border-border/70 bg-background/90 p-5 shadow-xl [transform:rotateX(8deg)_rotateY(-10deg)] motion-safe:transition-transform motion-safe:duration-500 hover:[transform:rotateX(2deg)_rotateY(4deg)_translateY(-6px)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">QUIZY</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">اختبر فهمك</h3>
              </div>
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <span aria-hidden="true" className="text-xl">?</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-3 w-11/12 rounded-full bg-muted" />
              <div className="h-3 w-8/12 rounded-full bg-muted" />
              <div className="grid gap-2 pt-3 sm:grid-cols-2">
                {["اختيار صحيح", "مراجعة المفهوم", "فهم أعمق", "تحدي جديد"].map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground shadow-sm motion-safe:transition-transform hover:-translate-y-0.5"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
            </div>
          </div>

          <FloatingVector className="absolute -right-10 -top-12 w-40 text-foreground/60 motion-safe:animate-[float_6s_ease-in-out_infinite]" intensity={5} />
          <div className="absolute -bottom-8 -left-8 grid size-24 place-items-center rounded-3xl border border-primary/20 bg-background/80 shadow-lg backdrop-blur-md motion-safe:animate-[float_7s_ease-in-out_infinite]">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
