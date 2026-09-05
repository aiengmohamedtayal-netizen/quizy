# كويزي (Quizy)

منصة تعليمية تحوّل ملفاتك الدراسية إلى بنك أسئلة ومراجعة ذكية.

---

## 🎯 المفهوم الأساسي

```
المحتوى → التدرّب → التذكّر → المراجعة → الإتقان
```

يدعم كويزي طريقتين مختلفتين لإنشاء الأسئلة:

| الوضع                  | الوصف                                                   |
| ---------------------- | ------------------------------------------------------- |
| **كويز من المحتوى**    | يفهم المحتوى ويولّد أسئلة جديدة بالذكاء الاصطناعي       |
| **بنك الأسئلة الدقيق** | يستخرج الأسئلة الموجودة حرفياً من ملفك بدون إعادة صياغة |

---

## ✨ المميزات الرئيسية

- **دعم PDF، DOCX، TXT** — استخراج نصي أصلي مع دعم OCR للصفحات الممسوحة
- **وضع Exact Source** — استخراج الأسئلة حرفياً مع التحقق من سلامة المصدر بالهاش
- **مراجعة مفضوحة** — يعرف الأسئلة التي تحتاج مراجعة يدوية بوضوح
- **محرك التذكّر** — خوارزمية تباعد زمني لتحديد أهم الأسئلة للمراجعة
- **تتبع المستوى** — إحصاءات أداء ومؤشرات تحسّن لكل موضوع
- **مدرّس ذكاء اصطناعي** — شرح فوري وحوارات موجّهة بعد كل إجابة
- **دعم RTL كامل** — واجهة عربية أصيلة مع خط IBM Plex Sans Arabic
- **نظام حركة متقدم** — انيميشن مدروس واجهة premium

---

## 🏗️ المعمارية

```
src/
├── routes/           # TanStack Router — صفحتا التطبيق الرئيسيتان
├── components/
│   ├── question-bank/ # ImportBankDialog, ExactQuizRunner, QuestionBankView
│   ├── dashboard/     # مكونات لوحة التحكم والإحصاءات
│   ├── motion/        # نظام الحركة والانيميشن
│   └── ui/           # shadcn/ui components
├── lib/
│   ├── ai/           # Router، Provider، Quiz Generator، Exact Extractor
│   ├── documents/    # PDF/DOCX/TXT parsing + OCR
│   ├── learning/     # Question Bank، Mastery Engine، Spaced Review
│   └── observability/ # Structured logging
└── integrations/
    └── supabase/     # Client + Auth (اختياري)

tests/               # 76 اختبار — Document Ingestion، Exact Import، Security...
evals/               # بنية تقييم موديل (للتشغيل المحلي فقط)
```

---

## 🔑 نموذج Exact Source (المبدأ الأساسي)

```
المستند الأصلي
     ↓
استخراج نصي أصلي
     ↓
تحديد حدود الأسئلة (AI-assisted, لا إعادة صياغة)
     ↓
التحقق الحتمي
     ↓
سؤال مع هاشين:
  sourceRawHash         → سلامة المصدر
  canonicalQuestionHash → سلامة البنية
```

**ثلاث قواعد لا تُكسر:**

- لا تخمّن — الإجابة غير المحددة = `requiresReview: true`
- لا تغيّر المصدر — `sourceText` لا يُعدَّل أبداً
- لا تفقد أي جزء بصمت — كل الصفحات تُعالَج مع progress حقيقي

---

## ⚙️ التثبيت والتشغيل

### المتطلبات

- Node.js 20+
- npm

### التثبيت

```bash
npm install
```

### إعداد البيئة

```bash
cp .env.example .env
```

افتح `.env` وحدد:

```env
AI_API_KEY=your-api-key-here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_PROVIDER=openai-compatible
```

للمهام الثقيلة (استخراج بنك الأسئلة من ملفات كبيرة):

```env
AI_FALLBACK_API_KEY=your-heavy-task-key
AI_REASONING_MODEL=gpt-4o
AI_MODEL_EXACT_EXTRACTION=gpt-4o
```

### التشغيل المحلي

```bash
npm run dev
```

المتاح على: `http://localhost:5173`

---

## 📦 الأوامر المتاحة

| الأمر             | الوصف                              |
| ----------------- | ---------------------------------- |
| `npm run dev`     | خادم التطوير مع HMR                |
| `npm run build`   | بناء للإنتاج                       |
| `npm run preview` | معاينة بناء الإنتاج                |
| `npm run test`    | تشغيل كل الاختبارات (76 اختبار)    |
| `npm run lint`    | فحص الكود بـ ESLint                |
| `npm run format`  | تنسيق الكود بـ Prettier            |
| `npm run eval`    | تقييم الموديل (للتشغيل المحلي فقط) |

---

## 🌍 الصيغ المدعومة

| الصيغة  | الاستخراج | OCR                 |
| ------- | --------- | ------------------- |
| `.pdf`  | نصي أصلي  | ✅ للصفحات الممسوحة |
| `.docx` | ✅        | ❌                  |
| `.txt`  | ✅        | ❌                  |

---

## 🔒 الأمان

- جميع مفاتيح AI في طبقة Server فقط — لا يُكشف منها شيء للـ client
- المفاتيح الحساسة تُعمّى في الـ logs عبر `logger.ts`
- `sourceText` لا يُعرض كـ `dangerouslySetInnerHTML` — دائماً React text node
- اختبار أمان تلقائي يتحقق من عدم تسريب المفاتيح في build artifacts

---

## 🗄️ Supabase (اختياري)

Supabase مدعوم للمصادقة والتخزين السحابي لكن ليس مطلوباً للتشغيل المحلي.
التطبيق يعمل كاملاً بدون Supabase باستخدام `localStorage` و `IndexedDB`.

---

## ⚠️ تنبيهات

- لا تضع مفاتيح API حقيقية في `.env.example` أو أي ملف يُرفع لـ GitHub
- `evals/reports/` مُستثناة من Git — يتم توليدها محلياً
- `ibmplexsansarabic/` — الخط مضمّن في المشروع لضمان العرض الصحيح بدون CDN
