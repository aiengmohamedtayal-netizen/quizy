# Quizy Visual & Motion System

Quizy's visual language should feel modern and technical without becoming distracting or app-like noise.

## Visual Direction

- Cyan-to-purple gradient as the primary brand accent.
- Soft glass surfaces, subtle depth, and restrained shadows.
- Geometric education motifs: cards, checkmarks, question marks, document sheets, progress rings.
- Prefer SVG for lightweight decorative vectors and icons.
- Use CSS transforms and opacity for most UI motion.
- Reserve 3D/WebGL effects for high-value hero moments rather than core workflows.

## Motion Principles

### 1. Purposeful motion
Motion should communicate hierarchy, state changes, progress, or interaction feedback.

### 2. Fast and restrained
Use short transitions for controls and slightly slower easing for page-level composition.

### 3. Reduced motion
Respect `prefers-reduced-motion: reduce` and provide an effectively static presentation.

### 4. Performance first
Prefer GPU-friendly `transform` and `opacity`. Avoid continuous expensive effects on large DOM trees.

## Recommended Effects

### Hero
- Floating document/question-card layers with small parallax offsets.
- Animated SVG accent lines or particles.
- Subtle gradient movement.
- Optional lightweight 3D object on capable devices.

### Quiz
- Question-card entrance/exit transitions.
- Progress ring interpolation.
- Correct/incorrect state micro-interactions.
- Focus transitions that remain keyboard-accessible.

### Results
- Animated score/count-up presentation.
- Mastery progress reveal.
- Lightweight celebratory particles after completion.

### Question Bank
- Staggered card/list reveal.
- Hover depth using small translate/scale changes.
- Filter and selection state transitions.

## Do Not Add

- Full-screen autoplay video backgrounds.
- Constant infinite motion across the whole page.
- Heavy WebGL scenes behind text.
- Motion that changes layout unexpectedly.
- Decorative effects that reduce readability or accessibility.

## Implementation Guidance

Keep animation behavior behind reusable primitives such as:

```text
src/components/motion/
├── AnimatedPresence.tsx
├── FadeSlide.tsx
├── FloatingVector.tsx
├── ProgressReveal.tsx
└── ReducedMotion.tsx
```

For 3D, isolate the renderer behind a client-only boundary and lazy-load it so the core application remains fast and resilient.
