# كويزي (Quizy)

> **Learn. Practice. Master.**

منصة تعليمية تحوّل محتواك الدراسي إلى تدريب فعّال: أسئلة تفاعلية، مراجعة، وبنك أسئلة يحافظ على المصدر الأصلي.

**Live:** https://quizy.aiengmohamedtayal.workers.dev

## لماذا كويزي؟

```text
المحتوى → التدرّب → التذكّر → المراجعة → الإتقان
```

كويزي يقدّم مسارين واضحين:

| الوضع | ماذا يفعل؟ |
| --- | --- |
| **كويز من المحتوى** | يحلل المادة الدراسية ويولّد أسئلة جديدة مناسبة للتدريب. |
| **بنك الأسئلة الدقيق** | يستخرج بنك الأسئلة الموجود في الملف ويحوله إلى كويز تفاعلي مع الحفاظ على نص المصدر والاختيارات والوسائط عند توفرها. |

## المميزات

- **PDF / DOCX / TXT** مع استخراج النص ودعم OCR للصفحات الممسوحة عند الحاجة.
- **Exact Source Mode** مع `sourceRawHash` و`canonicalQuestionHash` للتحقق من سلامة المصدر والبنية.
- **Question Bank 2.0** للبحث، الفلترة، الحفظ، المراجعة، والتحديد المتعدد.
- **مراجعة الأخطاء** وتتبع الأداء عبر المحاولات.
- **Mastery + Spaced Review** لتوجيه المراجعة بناءً على الأداء.
- **AI Tutor** للشرح والمساعدة بعد الإجابة.
- **RTL-first UI** مع دعم العربية وخط IBM Plex Sans Arabic المضمّن.
- **Motion System** بحركات تفاعلية خفيفة ومراعية لإمكانية الوصول.

## المعمارية

```text
Browser
  │
  ├── React 19 + TanStack Router
  ├── PDF / DOCX / TXT parsing where appropriate
  ├── Local cache / IndexedDB for browser-local state
  │
  ▼
Cloudflare Worker
  │
  ├── TanStack Start SSR
  ├── Server Functions
  ├── AI Router / Provider
  ├── Learning services
  │
  ├── Neon PostgreSQL (persistent relational data)
  └── Cloudflare R2 (documents + media)
```

> **Exact Source is intentionally separate from AI question generation.** The source document is authoritative; uncertain extraction is marked for review rather than guessed.

## التشغيل المحلي

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

اضبط المتغيرات المطلوبة في `.env`. لا تضع أي secrets في GitHub.

### التطوير

```bash
npm run dev
```

ثم افتح:

```text
http://localhost:5173
```

## الأوامر

| الأمر | الاستخدام |
| --- | --- |
| `npm run dev` | خادم التطوير مع HMR |
| `npm run build` | بناء الإنتاج |
| `npm run preview` | معاينة بناء الإنتاج |
| `npm test` | تشغيل الاختبارات |
| `npm run lint` | فحص ESLint |
| `npm run format` | تنسيق Prettier |
| `npm run eval` | تشغيل تقييمات الموديل محليًا |

## جودة Exact Source

المسار الدقيق يتبع هذه القواعد:

1. **لا تخمّن** — الإجابة أو الوسائط غير الموثقة تتحول إلى `review_required`.
2. **لا تغيّر المصدر** — `sourceText` و`sourceSnapshot` مصدران غير قابلين للتعديل.
3. **لا تفقد المحتوى بصمت** — المستندات الكبيرة تُعالَج بالكامل مع progress حقيقي.
4. **لا تعيد التوليد** — Exact Quiz يعرض البيانات المستوردة ولا يستدعي مسار توليد الأسئلة.

## الأمان

- مفاتيح AI وقاعدة البيانات تبقى server-side.
- لا تُدرج `.env` أو مفاتيح حقيقية في المستودع.
- المحتوى المستورد لا يُعرض باستخدام `dangerouslySetInnerHTML`.
- الاستجابات الخارجة من الـAI تمر عبر validation قبل التخزين أو العرض.

## الاختبارات

قبل أي تغيير جوهري شغّل:

```bash
npm test
npx tsc --noEmit --skipLibCheck
npm run lint
npm run build
```

## المساهمة

راجع `CONTRIBUTING.md` قبل فتح Pull Request.

## الحالة الحالية

Quizy منشور حاليًا على Cloudflare Workers. تفاصيل البنية والتشغيل الفعلية هي المصدر الموثوق؛ لا توثّق ميزة غير موجودة فعليًا.
