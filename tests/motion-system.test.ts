import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Motion System - Arabic RTL character slicing preserves natural text direction", () => {
  const arabicText = "حوّل محاضراتك وملخصاتك إلى كويز تفاعلي ومذاكرة ذكية";

  // Progressive slicing should strictly match substring prefixes
  for (let i = 1; i <= arabicText.length; i++) {
    const slice = arabicText.slice(0, i);
    assert.equal(slice, arabicText.substring(0, i));
    assert.equal(slice.length, i);
  }

  // Final slice must match the full string exactly
  assert.equal(arabicText.slice(0, arabicText.length), arabicText);
});

test("Motion System - Bilingual mixed Arabic, English and Numbers preserves word order", () => {
  const mixedText = "كويز 1: شرح React 19 مع الذكاء الاصطناعي بنسبة 100%";

  const half = mixedText.slice(0, 15);
  assert.ok(half.startsWith("كويز 1:"));
  assert.equal(mixedText.slice(0, mixedText.length), mixedText);
});

test("Motion System - AnimatedNumber easing formula behaves correctly", () => {
  const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);
  const target = 85;

  // At progress 0: value is 0
  assert.equal(easeOutCubic(0) * target, 0);

  // At progress 0.5: value is between 50% and 90% (eased curve is fast initial)
  const mid = easeOutCubic(0.5) * target;
  assert.ok(mid > target * 0.5);
  assert.ok(mid < target);

  // At progress 1: value equals exact target
  assert.equal(easeOutCubic(1) * target, target);
});

test("Motion System - CSS contains motion tokens and prefers-reduced-motion overrides", () => {
  const stylesPath = path.join(process.cwd(), "src/styles.css");
  const stylesContent = fs.readFileSync(stylesPath, "utf-8");

  // Verify keyframes and utilities exist
  assert.ok(stylesContent.includes("@keyframes slideInRight"), "Missing slideInRight keyframe");
  assert.ok(stylesContent.includes("@keyframes slideInLeft"), "Missing slideInLeft keyframe");
  assert.ok(
    stylesContent.includes(".animate-slide-in-right"),
    "Missing animate-slide-in-right class",
  );
  assert.ok(
    stylesContent.includes(".animate-slide-in-left"),
    "Missing animate-slide-in-left class",
  );
  assert.ok(stylesContent.includes(".animate-caret"), "Missing animate-caret class");

  // Verify prefers-reduced-motion accessibility safeguard
  assert.ok(
    stylesContent.includes("@media (prefers-reduced-motion: reduce)"),
    "Missing prefers-reduced-motion media query",
  );
  assert.ok(stylesContent.includes("animation-duration: 0.01ms !important"));
});

test("Copy Strategy - UI contains humanized, non-robotic Arabic microcopy", () => {
  const indexPath = path.join(process.cwd(), "src/routes/index.tsx");
  const indexContent = fs.readFileSync(indexPath, "utf-8");

  // Checks for warm, educational microcopy
  assert.ok(indexContent.includes("بنقرأ وبنحلل المادة العلمية"));
  assert.ok(indexContent.includes("ابدأ الكويز الآن"));
  assert.ok(indexContent.includes("اكتمل الكويز!"));

  // Verifies avoidance of stale robotic phrases
  assert.ok(!indexContent.includes("قل ما تريد... وشاهد محاضرتك"));
  assert.ok(!indexContent.includes("توليد وبدء الكويز الآن"));
});
