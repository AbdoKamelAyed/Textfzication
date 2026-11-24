import { CLASSIFIER_VERSION } from './classifier';
import { LINGUISTIC_ENGINE_VERSION } from './linguistic';
import type { Language } from './i18n';

export interface DeploymentTargetSpec {
  id: 'github_pages' | 'firebase_hosting' | 'vercel' | 'cloud_run';
  nameEn: string;
  nameAr: string;
  modeEn: string;
  modeAr: string;
  bestForEn: string;
  bestForAr: string;
  worksOutOfBoxEn: string[];
  worksOutOfBoxAr: string[];
  requiresBackendEn: string[];
  requiresBackendAr: string[];
  buildCommand: string;
  publishDirOrEntry: string;
  configFilename: string;
  configSnippet: string;
  stepsEn: string[];
  stepsAr: string[];
}

export interface TechnologyStackItem {
  layerEn: string;
  layerAr: string;
  technology: string;
  version: string;
  purposeEn: string;
  purposeAr: string;
}

export const TECHNOLOGY_STACK_INVENTORY: TechnologyStackItem[] = [
  {
    layerEn: 'Frontend Framework & UI',
    layerAr: 'واجهة المستخدم الأمامية',
    technology: 'React 19 + TypeScript + Vite + Tailwind CSS v4',
    version: 'React 19.0 / Vite 8.3 / Tailwind 4.3',
    purposeEn: 'Modular RTL/LTR research workbench with dark/light mode and responsive grid layout.',
    purposeAr: 'بيئة بحثية تفاعلية تدعم العربية والإنجليزية والوضع الداكن والفاتح.',
  },
  {
    layerEn: 'Pure Analytical Engines',
    layerAr: 'المحركات التحليلية المستقلة',
    technology: 'src/engine/* (Zero-DOM TypeScript)',
    version: `${LINGUISTIC_ENGINE_VERSION} · ${CLASSIFIER_VERSION}`,
    purposeEn: 'Deterministic EN/AR stylometry, calibrated classifier, diffing, training splits, and .mdd/.mdx dictionary exporters.',
    purposeAr: 'استخراج خصائص العربية والإنجليزية والتصنيف الاحتمالي وتصدير قواميس ‎.mdd و ‎.mdx محلياً بالكامل.',
  },
  {
    layerEn: 'Visualizations & Charts',
    layerAr: 'الرسوم البيانية والشبكات',
    technology: 'D3.js + Recharts + Lucide Icons',
    version: 'd3 7.9 / recharts 3.11',
    purposeEn: 'Force-directed knowledge graphs, 30-day interactive sparklines, IPA/POS linguistics charts, and radar comparisons.',
    purposeAr: 'رسم معرفي تفاعلي ومخططات لسانية وتوزيعات حروف وتشكيل ومقارنات رادارية.',
  },
  {
    layerEn: 'Client Offline & Sync Storage',
    layerAr: 'التخزين المحلي والمزامنة السحابية',
    technology: 'Browser IndexedDB + Firebase Auth & Cloud Firestore',
    version: 'firebase 13.4',
    purposeEn: 'Offline-first RAW/PROCESSED/APPROVED sample persistence plus Google Sign-In, Drive export, and RBAC.',
    purposeAr: 'حفظ غير متصل للطبقات الثلاث مع تسجيل الدخول عبر Google ومزامنة Firestore.',
  },
  {
    layerEn: 'Optional Full-Stack Backend',
    layerAr: 'الخادم الخلفي الاختياري',
    technology: 'Node.js v22 + Express + @google/genai + Drizzle/PostgreSQL',
    version: 'express 4.21 / @google/genai 3.6',
    purposeEn: 'Server-side Gemini ThinkingLevel.HIGH, Search Grounding proxy, and Cloud SQL PostgreSQL persistence.',
    purposeAr: 'بوابة آمنة لنماذج Gemini السحابية والبحث الموثق وقاعدة بيانات Cloud SQL PostgreSQL.',
  },
];

export const DEPLOYMENT_TARGETS: DeploymentTargetSpec[] = [
  {
    id: 'github_pages',
    nameEn: 'GitHub Pages (Static SPA)',
    nameAr: 'صفحات جيت هاب (GitHub Pages - استضافة ساكنة)',
    modeEn: 'Static Client Hosting + Local Deterministic AI Fallback',
    modeAr: 'استضافة ساكنة + بديل محلي حتمي للذكاء الاصطناعي',
    bestForEn: 'Free public academic demos, offline-capable corpus inspection, and dictionary (.mdd/.mdx) publishing.',
    bestForAr: 'العروض البحثية المجانية وفحص المدونات والعمل غير المتصل مع تصدير القواميس.',
    worksOutOfBoxEn: [
      'All 6 stylometric & linguistic engines (EN & Arabic MSA/Egyptian)',
      'Local Deterministic Copilot, Source Registry & Editing Lab fallbacks',
      'Browser IndexedDB persistence, CSV import/export, Dictionary Maker (.mdd/.mdx/.xdxf/.tei.xml)',
    ],
    worksOutOfBoxAr: [
      'جميع المحركات اللغوية والأسلوبية الستة للعربية والإنجليزية',
      'المساعد البحثي المحلي الحتمي واكتشاف المصادر ومختبر التحرير دون توقف',
      'قاعدة IndexedDB المحلية، استيراد/تصدير CSV، وصانع القواميس (.mdd/.mdx/.tei.xml)',
    ],
    requiresBackendEn: [
      'Live cloud Gemini ThinkingLevel.HIGH & Search Grounding (attach a Cloud Run URL in module 14 if desired)',
    ],
    requiresBackendAr: [
      'تحليل Gemini السحابي المباشر والبحث الموثق عبر Google (يمكن ربط رابط Cloud Run من شاشة 14)',
    ],
    buildCommand: 'npm ci && npm run build',
    publishDirOrEntry: 'dist/',
    configFilename: '.github/workflows/deploy-pages.yml',
    configSnippet: `# GitHub Pages static build (set base in vite.config.ts if deploying to /<repo>/)
# vite.config.ts: base: process.env.VITE_BASE_PATH || '/'
name: Deploy TEXTPRINT to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_BASE_PATH: /\${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
      - uses: actions/deploy-pages@v4`,
    stepsEn: [
      'Enable Settings -> Pages -> Source: GitHub Actions in your repository.',
      'Ensure Vite base matches your repository subpath (e.g. VITE_BASE_PATH=/textprint/) if not using a custom domain.',
      'Push to main; dist/ deploys automatically with IndexedDB and local AI fallbacks active.',
    ],
    stepsAr: [
      'من إعدادات المستودع على GitHub اختر Pages ثم Source: GitHub Actions.',
      'اضبط المسار الأساسي VITE_BASE_PATH=/اسم-المستودع/ إذا لم تستخدم نطاقاً مخصصاً.',
      'ارفع التعديلات إلى فرع main ليُبنى مجلد dist/ ويُنشر تلقائياً.',
    ],
  },
  {
    id: 'firebase_hosting',
    nameEn: 'Firebase Hosting (+ Firestore RBAC)',
    nameAr: 'استضافة فايربيز (Firebase Hosting + Firestore)',
    modeEn: 'Global CDN Static + Live Cloud Firestore Auth & Notes',
    modeAr: 'شبكة توزيع سريعة + مصادقة Google وقاعدة Firestore الحية',
    bestForEn: 'Multi-user academic teams needing Google Sign-In, Firestore RBAC, and instant preview channels.',
    bestForAr: 'الفرق البحثية التي تحتاج تسجيل الدخول عبر Google ومزامنة الملاحظات وصلاحيات المشرفين.',
    worksOutOfBoxEn: [
      'Google Sign-In, Drive Export, Cloud Firestore Notes & Admin RBAC',
      'SPA rewrites via firebase.json + all local engines & .mdd dictionary exports',
      'Optional Cloud Run Express URL attachment in 14. Admin & Governance',
    ],
    worksOutOfBoxAr: [
      'تسجيل الدخول عبر Google وتصدير Drive وملاحظات Firestore وصلاحيات الإدارة',
      'إعادة التوجيه عبر firebase.json مع كل المحركات المحلية وصانع القواميس',
      'إمكانية ربط خادم Cloud Run عبر شاشة 14 في أي وقت',
    ],
    requiresBackendEn: [
      'Server-side /api/ai/* Gemini proxy unless Cloud Run backend rewrite or URL is connected',
    ],
    requiresBackendAr: [
      'بوابة /api/ai/* السحابية إذا أردت تشغيل Gemini من الخادم بدلاً من البديل المحلي الحتمي',
    ],
    buildCommand: 'npm run build && npx firebase-tools deploy --only hosting,firestore:rules',
    publishDirOrEntry: 'dist/ (configured in firebase.json)',
    configFilename: 'firebase.json',
    configSnippet: `{
  "firestore": {
    "database": "ai-studio-117e863f-2c6a-4a15-9406-a16d0c3a8602",
    "rules": "firestore.rules"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}`,
    stepsEn: [
      'Run npm run build to generate dist/.',
      'Deploy Firestore rules & preview channel: npx firebase-tools hosting:channel:deploy dev --project gen-lang-client-0224046879.',
      'Deploy production hosting: npx firebase-tools deploy --only hosting,firestore:rules.',
    ],
    stepsAr: [
      'نفّذ npm run build لتجهيز مجلد dist/.',
      'انشر قناة المعاينة التجريبية عبر firebase-tools hosting:channel:deploy dev.',
      'انشر النسخة النهائية عبر firebase-tools deploy --only hosting,firestore:rules.',
    ],
  },
  {
    id: 'vercel',
    nameEn: 'Vercel (Static SPA + Optional Cloud Run Proxy)',
    nameAr: 'منصة فيرسل (Vercel - واجهة سريعة + وسيط اختياري)',
    modeEn: 'Edge CDN Static + Rewrites to Express Cloud Run Backend',
    modeAr: 'استضافة حافة سريعة مع إمكانية تمرير /api/* إلى Cloud Run',
    bestForEn: 'Zero-config PR previews and fast edge delivery with optional API rewrite forwarding to Cloud Run.',
    bestForAr: 'معاينات فورية لكل طلب سحب مع إمكانية ربط مسارات /api/* بخادم Cloud Run.',
    worksOutOfBoxEn: [
      'Instant Vite dist/ deployment with SPA fallback routing',
      'Zero-failure local deterministic Copilot & Stylometry when deployed standalone',
    ],
    worksOutOfBoxAr: [
      'نشر فوري لتطبيق Vite مع توجيه SPA السليم',
      'عمل كامل للمساعد المحلي الحتمي والتحليل الأسلوبي حتى بدون خادم خلفي',
    ],
    requiresBackendEn: [
      'Forward /api/* to Cloud Run in vercel.json or set VITE_API_BASE_URL for live Gemini API',
    ],
    requiresBackendAr: [
      'توجيه /api/* في ملف vercel.json نحو رابط Cloud Run أو ضبط VITE_API_BASE_URL',
    ],
    buildCommand: 'npm run build',
    publishDirOrEntry: 'dist',
    configFilename: 'vercel.json',
    configSnippet: `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://YOUR-CLOUD-RUN-SERVICE.run.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}`,
    stepsEn: [
      'Connect your Git repository inside the Vercel Dashboard (Framework Preset: Vite, Output Directory: dist).',
      'Add vercel.json to route SPA paths to /index.html (and optionally proxy /api/* to your Cloud Run Express URL).',
      'Optionally define VITE_API_BASE_URL in Vercel Project Environment Variables.',
    ],
    stepsAr: [
      'اربط مستودع Git في لوحة Vercel وحدد إطار العمل Vite ومجلد الإخراج dist.',
      'أضف ملف vercel.json لتمرير المسارات إلى /index.html أو ربط /api/* بخادم Cloud Run.',
      'اختيارياً أضف المتغير VITE_API_BASE_URL في إعدادات البيئة داخل Vercel.',
    ],
  },
  {
    id: 'cloud_run',
    nameEn: 'Google Cloud Run (Full-Stack Express + Gemini + Cloud SQL)',
    nameAr: 'جوجل كلاود رن (Cloud Run - الخادم الكامل)',
    modeEn: 'Full-Stack Node v22 Express Server (node server.ts)',
    modeAr: 'بيئة خادم كاملة على Node v22 (node server.ts)',
    bestForEn: 'Full production research laboratory with live Gemini ThinkingLevel.HIGH, Search Grounding, and Cloud SQL PostgreSQL.',
    bestForAr: 'المختبر البحثي الكامل مع ذكاء Gemini السحابي وقاعدة بيانات Cloud SQL PostgreSQL.',
    worksOutOfBoxEn: [
      'Everything in static builds PLUS /api/ai/chat, /api/ai/analyze-deep, /api/ai/discover-sources, /api/ai/edit-transform',
      'PostgreSQL / Drizzle ORM persistence when SQL_HOST is attached',
      'Real-time /api/health and /api/system/status server telemetry',
    ],
    worksOutOfBoxAr: [
      'كل مزايا النسخة الساكنة مضافاً إليها مسارات /api/ai/* المباشرة وقاعدة PostgreSQL',
      'فحص صحة الخادم الحي عبر /api/health و /api/system/status',
    ],
    requiresBackendEn: ['Requires GEMINI_API_KEY secret in Cloud Run environment (never exposed to browser).'],
    requiresBackendAr: ['يتطلب تعيين GEMINI_API_KEY كمتغير بيئة سري داخل الخادم فقط.'],
    buildCommand: 'npm run build && NODE_ENV=production PORT=3000 npm start',
    publishDirOrEntry: 'server.ts ("start": "node server.ts")',
    configFilename: 'Dockerfile (Cloud Run)',
    configSnippet: `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]`,
    stepsEn: [
      'Build dist/ with npm run build, then start Express on Node 22 via npm start (node server.ts).',
      'Configure GEMINI_API_KEY (and optional SQL_HOST / DB_USER / DB_PASS / DB_NAME) in Cloud Run env.',
      'Enable CORS (CORS_ALLOWED_ORIGIN) if serving a separate frontend on GitHub Pages, Firebase Hosting, or Vercel.',
    ],
    stepsAr: [
      'ابنِ التطبيق عبر npm run build ثم شغّل الخادم بالأمر npm start (node server.ts).',
      'أضف GEMINI_API_KEY (وإعدادات Cloud SQL الاختيارية) في متغيرات البيئة داخل Cloud Run.',
      'اضبط CORS_ALLOWED_ORIGIN إذا كانت الواجهة مستضافة على GitHub Pages أو Vercel أو Firebase.',
    ],
  },
];

export function buildDeploymentReportMarkdown(lang: Language): string {
  const title =
    lang === 'ar'
      ? '# تقرير البنية التقنية ودليل النشر الشامل (GitHub Pages / Firebase / Vercel / Cloud Run)'
      : '# TEXTPRINT Technology Stack & Multi-Platform Deployment Report';

  const intro =
    lang === 'ar'
      ? `يوثق هذا التقرير جميع التقنيات المستخدمة في مختبر TEXTPRINT (محرك ${LINGUISTIC_ENGINE_VERSION} والمصنّف ${CLASSIFIER_VERSION}) ويشرح بدقة ما يعمل على الاستضافة الساكنة مقابل الاستضافة الكاملة وكيفية النشر خطوة بخطوة.`
      : `This report documents the full TEXTPRINT technology stack (Engine ${LINGUISTIC_ENGINE_VERSION}, Classifier ${CLASSIFIER_VERSION}), static-hosting deterministic fallbacks, and step-by-step deployment playbooks for GitHub Pages, Firebase Hosting, Vercel, and Google Cloud Run.`;

  const stackSection = [
    lang === 'ar' ? '## 1. جرد التقنيات المستخدمة' : '## 1. Technology Stack Inventory',
    ...TECHNOLOGY_STACK_INVENTORY.map(
      (item) =>
        `- **${lang === 'ar' ? item.layerAr : item.layerEn}**: ${item.technology} (${item.version}) — ${lang === 'ar' ? item.purposeAr : item.purposeEn}`
    ),
  ].join('\n');

  const targetsSection = [
    lang === 'ar' ? '## 2. أدلة النشر حسب المنصة' : '## 2. Platform Deployment Playbooks',
    ...DEPLOYMENT_TARGETS.map((t) => {
      const name = lang === 'ar' ? t.nameAr : t.nameEn;
      const mode = lang === 'ar' ? t.modeAr : t.modeEn;
      const steps = (lang === 'ar' ? t.stepsAr : t.stepsEn)
        .map((s, idx) => `  ${idx + 1}. ${s}`)
        .join('\n');
      return [
        `### ${name}`,
        `- Mode: ${mode}`,
        `- Build / Entry: \`${t.buildCommand}\` -> \`${t.publishDirOrEntry}\``,
        `- Steps:\n${steps}`,
        `- Config (${t.configFilename}):\n\`\`\`\n${t.configSnippet}\n\`\`\``,
      ].join('\n');
    }),
  ].join('\n\n');

  return `${title}\n\n${intro}\n\n${stackSection}\n\n${targetsSection}\n`;
}
