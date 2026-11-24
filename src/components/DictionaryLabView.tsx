import { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeLinguisticChartsData,
  extractCorpusDictionaryCandidates,
  LINGUISTIC_SYMBOLS_CATALOG,
  STARTER_LINGUISTIC_DICTIONARY,
  type DictionaryEntry,
  type PartOfSpeech,
} from '../engine/dictionary';
import {
  buildDictionaryCsv,
  buildDictionaryTsvAnki,
  buildMdictMddBinary,
  buildMdictMdxBinary,
  buildMdictSourceTxt,
  buildOntoLexJsonLd,
  buildStarDictBundle,
  buildTeiP5Xml,
  buildXdxfXml,
  type DictionaryExportMeta,
} from '../engine/dictionaryExport';
import type { TextSample } from '../engine/types';
import { useI18n } from '../lib/i18nContext';

interface Props {
  samples: TextSample[];
  onLogAudit?: (action: string, targetType: string, targetId: string, details: string) => void;
}

type DictionaryTab = 'maker' | 'symbols_charts' | 'exports';
type SymbolGroupFilter = 'all' | 'ipa_consonant' | 'ipa_vowel' | 'arabic_phoneme' | 'arabic_diacritic';
type PreviewFormat = 'xdxf' | 'tei' | 'mdx_txt' | 'stardict' | 'anki' | 'jsonld';

function downloadData(data: string | Uint8Array, filename: string, mimeType: string) {
  const payload =
    typeof data === 'string'
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const blob = new Blob([payload as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function DictionaryLabView({ samples, onLogAudit }: Props) {
  const { lang, t } = useI18n();
  const [tab, setTab] = useState<DictionaryTab>('maker');
  const [entries, setEntries] = useState<DictionaryEntry[]>(STARTER_LINGUISTIC_DICTIONARY);
  const [searchQuery, setSearchQuery] = useState('');
  const [posFilter, setPosFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string>(STARTER_LINGUISTIC_DICTIONARY[0].id);

  // Dictionary Editor / Creator form
  const [dictTitle, setDictTitle] = useState('TEXTPRINT Bilingual Stylometry & Linguistics Dictionary');
  const [headword, setHeadword] = useState('');
  const [arabicEq, setArabicEq] = useState('');
  const [pos, setPos] = useState<PartOfSpeech>('noun');
  const [root, setRoot] = useState('');
  const [ipa, setIpa] = useState('');
  const [domain, setDomain] = useState('linguistics');
  const [defEn, setDefEn] = useState('');
  const [defAr, setDefAr] = useState('');
  const [exEn, setExEn] = useState('');
  const [exAr, setExAr] = useState('');
  const [synonymsRaw, setSynonymsRaw] = useState('');
  const [makerNotice, setMakerNotice] = useState<string | null>(null);

  // Symbols & Charts state
  const [symbolGroup, setSymbolGroup] = useState<SymbolGroupFilter>('all');
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  // Export preview state
  const [previewFormat, setPreviewFormat] = useState<PreviewFormat>('xdxf');
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (posFilter !== 'all' && e.pos !== posFilter) return false;
      if (!q) return true;
      return (
        e.headword.toLowerCase().includes(q) ||
        e.arabic.toLowerCase().includes(q) ||
        e.definitionEn.toLowerCase().includes(q) ||
        e.definitionAr.toLowerCase().includes(q) ||
        e.root.toLowerCase().includes(q) ||
        e.domain.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, posFilter]);

  const activeEntry =
    filteredEntries.find((e) => e.id === selectedId) ?? filteredEntries[0] ?? null;

  const chartsData = useMemo(
    () => computeLinguisticChartsData(entries, samples),
    [entries, samples]
  );

  const filteredSymbols = useMemo(
    () =>
      LINGUISTIC_SYMBOLS_CATALOG.filter((s) =>
        symbolGroup === 'all' ? true : s.group === symbolGroup
      ),
    [symbolGroup]
  );

  const exportMeta: DictionaryExportMeta = useMemo(
    () => ({
      title: dictTitle.trim() || 'TEXTPRINT Bilingual Dictionary',
      description:
        'Bilingual English-Arabic stylometric, phonetic (IPA), and linguistic reference dictionary built in TEXTPRINT.',
      author: 'TEXTPRINT Lexicography Lab',
      createdDate: new Date().toISOString().slice(0, 10),
    }),
    [dictTitle]
  );

  const previewText = useMemo(() => {
    const sampleSubset = entries.slice(0, 3);
    if (previewFormat === 'xdxf') return buildXdxfXml(sampleSubset, exportMeta);
    if (previewFormat === 'tei') return buildTeiP5Xml(sampleSubset, exportMeta);
    if (previewFormat === 'mdx_txt') return buildMdictSourceTxt(sampleSubset);
    if (previewFormat === 'stardict') {
      const sd = buildStarDictBundle(sampleSubset, exportMeta);
      return `${sd.ifo}\n\n--- .dict.txt preview ---\n${sd.dictTxt}`;
    }
    if (previewFormat === 'anki') return buildDictionaryTsvAnki(sampleSubset);
    return buildOntoLexJsonLd(sampleSubset, exportMeta);
  }, [entries, exportMeta, previewFormat]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headword.trim() || !arabicEq.trim()) {
      setMakerNotice(
        t({
          en: 'Please enter both an English headword and an Arabic equivalent.',
          ar: 'يرجى إدخال الكلمة بالإنجليزية وما يقابلها بالعربية.',
        })
      );
      return;
    }

    const slug = headword
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-|-$/g, '');
    const id = `dict-${slug || Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

    const newEntry: DictionaryEntry = {
      id,
      headword: headword.trim(),
      arabic: arabicEq.trim(),
      pos,
      root: root.trim() || '—',
      ipa: ipa.trim() || `/${headword.trim().toLowerCase()}/`,
      domain: domain.trim() || 'general',
      definitionEn: defEn.trim() || `Specialized linguistic term: ${headword.trim()}.`,
      definitionAr: defAr.trim() || `مصطلح لغوي متخصص: ${arabicEq.trim()}.`,
      exampleEn: exEn.trim() || `${headword.trim()} appears in bilingual stylometry corpora.`,
      exampleAr: exAr.trim() || `يرد مصطلح "${arabicEq.trim()}" في دراسات تحليل الأسلوب.`,
      synonyms: synonymsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      frequencyInCorpus: 1,
      mediaKey: `\\cards\\${id}.svg`,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setSelectedId(id);
    setHeadword('');
    setArabicEq('');
    setRoot('');
    setIpa('');
    setDefEn('');
    setDefAr('');
    setExEn('');
    setExAr('');
    setSynonymsRaw('');
    setMakerNotice(
      t({
        en: `Added "${newEntry.headword}" ↔ "${newEntry.arabic}" to your dictionary (${entries.length + 1} entries).`,
        ar: `تمت إضافة "${newEntry.headword}" ↔ "${newEntry.arabic}" إلى القاموس (${entries.length + 1} مدخلاً).`,
      })
    );
    onLogAudit?.(
      'ADD_DICTIONARY_ENTRY',
      'dictionary',
      id,
      `Added dictionary entry "${newEntry.headword}" (${newEntry.arabic}).`
    );
  };

  const handleExtractFromCorpus = () => {
    const candidates = extractCorpusDictionaryCandidates(samples, entries, 8);
    if (candidates.length === 0) {
      setMakerNotice(
        t({
          en: 'All high-frequency corpus terms are already in your dictionary.',
          ar: 'جميع المصطلحات المتكررة في المدونة موجودة بالفعل في القاموس.',
        })
      );
      return;
    }
    setEntries((prev) => [...candidates, ...prev]);
    setSelectedId(candidates[0].id);
    setMakerNotice(
      t({
        en: `Extracted ${candidates.length} candidate terms from your loaded ${samples.length} corpus samples.`,
        ar: `تم استخراج ${candidates.length} مصطلحاً مرشحاً تلقائياً من عينات المدونة الحالية (${samples.length} عينة).`,
      })
    );
    onLogAudit?.(
      'EXTRACT_CORPUS_DICTIONARY',
      'dictionary',
      'corpus_candidates',
      `Extracted ${candidates.length} corpus terms into Dictionary Maker.`
    );
  };

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) {
      setSelectedId(entries.find((item) => item.id !== id)?.id ?? '');
    }
  };

  const handleCopyOrInsertSymbol = (sym: string) => {
    setIpa((prev) => (prev ? `${prev}${sym}` : sym));
    setCopiedSymbol(sym);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(sym).catch(() => {});
    }
    window.setTimeout(() => setCopiedSymbol(null), 1500);
  };

  const triggerDownload = (fmt: 'mdd' | 'mdx' | 'mdx_txt' | 'xdxf' | 'tei' | 'stardict' | 'csv' | 'anki' | 'jsonld') => {
    const baseSlug = (dictTitle.trim() || 'textprint-dictionary')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (fmt === 'mdd') {
      const bytes = buildMdictMddBinary(entries, exportMeta);
      downloadData(bytes, `${baseSlug}.mdd`, 'application/octet-stream');
      setExportStatus(
        t({
          en: `Downloaded ${baseSlug}.mdd (${bytes.byteLength.toLocaleString()} bytes · MDict v2.0 archive with ${entries.length} SVG entry cards).`,
          ar: `تم تنزيل ${baseSlug}.mdd (${bytes.byteLength.toLocaleString()} بايت · أرشيف MDict v2.0 يضم ${entries.length} بطاقة SVG).`,
        })
      );
    } else if (fmt === 'mdx') {
      const bytes = buildMdictMdxBinary(entries, exportMeta);
      downloadData(bytes, `${baseSlug}.mdx`, 'application/octet-stream');
      setExportStatus(
        t({
          en: `Downloaded ${baseSlug}.mdx (${bytes.byteLength.toLocaleString()} bytes · MDict v2.0 dictionary binary).`,
          ar: `تم تنزيل ${baseSlug}.mdx (${bytes.byteLength.toLocaleString()} بايت · ملف قاموس MDict v2.0 الثنائي).`,
        })
      );
    } else if (fmt === 'mdx_txt') {
      downloadData(buildMdictSourceTxt(entries), `${baseSlug}.mdx.txt`, 'text/plain;charset=utf-8');
      setExportStatus(`Downloaded ${baseSlug}.mdx.txt`);
    } else if (fmt === 'xdxf') {
      downloadData(buildXdxfXml(entries, exportMeta), `${baseSlug}.xdxf`, 'application/xml;charset=utf-8');
      setExportStatus(`Downloaded ${baseSlug}.xdxf`);
    } else if (fmt === 'tei') {
      downloadData(buildTeiP5Xml(entries, exportMeta), `${baseSlug}.tei.xml`, 'application/xml;charset=utf-8');
      setExportStatus(`Downloaded ${baseSlug}.tei.xml`);
    } else if (fmt === 'stardict') {
      const sd = buildStarDictBundle(entries, exportMeta);
      downloadData(sd.ifo, `${baseSlug}.ifo`, 'text/plain;charset=utf-8');
      downloadData(sd.dictTxt, `${baseSlug}.dict.txt`, 'text/plain;charset=utf-8');
      setExportStatus(`Downloaded StarDict bundle (${baseSlug}.ifo + ${baseSlug}.dict.txt)`);
    } else if (fmt === 'csv') {
      downloadData(buildDictionaryCsv(entries), `${baseSlug}.csv`, 'text/csv;charset=utf-8');
      setExportStatus(`Downloaded ${baseSlug}.csv`);
    } else if (fmt === 'anki') {
      downloadData(buildDictionaryTsvAnki(entries), `${baseSlug}-anki.tsv`, 'text/tab-separated-values;charset=utf-8');
      setExportStatus(`Downloaded ${baseSlug}-anki.tsv`);
    } else {
      downloadData(buildOntoLexJsonLd(entries, exportMeta), `${baseSlug}-ontolex.json`, 'application/json');
      setExportStatus(`Downloaded ${baseSlug}-ontolex.json`);
    }

    onLogAudit?.(
      'EXPORT_DICTIONARY',
      'dictionary',
      fmt,
      `Exported ${entries.length} bilingual dictionary entries in ${fmt.toUpperCase()} format.`
    );
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t({
              en: '15. Bilingual Dictionary Maker, Linguistics Charts & International Exports (.mdd)',
              ar: '15. صانع القواميس ثنائية اللغة، رسوم اللسانيات والتصدير الدولي (‎.mdd)',
            })}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t({
              en: 'Build EN↔AR specialized dictionaries with IPA pronunciation & Arabic roots, explore phonetic/morphological symbols, and export to .mdd, .mdx, XDXF, TEI P5, and StarDict.',
              ar: 'أنشئ قواميس متخصصة (إنجليزي ↔ عربي) بالنطق الصوتي IPA والجذور العربية، واستعرض جداول الرموز اللسانية، وصدّر بصيغ ‎.mdd و ‎.mdx و XDXF و TEI P5 و StarDict.',
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0 max-w-full">
          {(
            [
              ['maker', t({ en: 'Dictionary Maker', ar: 'صانع القواميس' })],
              ['symbols_charts', t({ en: 'Linguistics Charts & Symbols', ar: 'الرسوم والرموز اللسانية' })],
              ['exports', t({ en: 'Exports (.mdd / .mdx / XML)', ar: 'التصدير الدولي (.mdd)' })],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: DICTIONARY MAKER */}
      {tab === 'maker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Dictionary Directory & Search */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({ en: 'Lexicon Entries', ar: 'مداخل القاموس' })} ({filteredEntries.length})
                </h2>
              </div>

              <button
                type="button"
                onClick={handleExtractFromCorpus}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{t({ en: 'Extract from Corpus', ar: 'استخراج من المدونة' })}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t({ en: 'Search EN, AR, root, domain...', ar: 'ابحث بالإنجليزية أو العربية أو الجذر...' })}
                  aria-label="Search dictionary entries"
                  className="w-full ps-8 pe-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                aria-label="Filter by part of speech"
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                className="sm:w-32 px-2 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="all">{t({ en: 'All POS', ar: 'كل الأقسام' })}</option>
                <option value="noun">{t({ en: 'Noun', ar: 'اسم' })}</option>
                <option value="verb">{t({ en: 'Verb', ar: 'فعل' })}</option>
                <option value="adjective">{t({ en: 'Adjective', ar: 'صفة' })}</option>
                <option value="adverb">{t({ en: 'Adverb', ar: 'ظرف' })}</option>
                <option value="phrase">{t({ en: 'Phrase', ar: 'عبارة' })}</option>
                <option value="term">{t({ en: 'Term', ar: 'مصطلح' })}</option>
              </select>
            </div>

            {makerNotice && (
              <p role="status" className="text-xs text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded px-2.5 py-1.5">
                {makerNotice}
              </p>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
              {filteredEntries.map((entry) => {
                const isSelected = activeEntry?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`p-2.5 flex items-start justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className="flex-1 min-w-0 text-start"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 break-words">
                          {entry.headword}
                        </span>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400" dir="rtl">
                          {entry.arabic}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 break-words flex flex-wrap items-center gap-x-1.5">
                        <span dir="ltr">{entry.ipa}</span>
                        <span>·</span>
                        <span>{entry.pos}</span>
                        <span>·</span>
                        <span>{entry.root}</span>
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.headword}`}
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Entry Inspector + Add New Entry Form */}
          <div className="lg:col-span-7 space-y-5 min-w-0">
            {activeEntry && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 break-words">
                      {activeEntry.headword}
                    </h2>
                    <p className="text-xs font-mono text-sky-700 dark:text-sky-400 break-all">
                      {activeEntry.ipa} · [{activeEntry.pos}] · {t({ en: 'Root', ar: 'الجذر' })}: {activeEntry.root}
                    </p>
                  </div>
                  <div className="text-end min-w-0">
                    <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400" dir="rtl">
                      {activeEntry.arabic}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {activeEntry.domain} · freq {activeEntry.frequencyInCorpus}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div dir="ltr" className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">English Definition &amp; Context</span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{activeEntry.definitionEn}</p>
                    <p className="text-slate-600 dark:text-slate-400 italic">“{activeEntry.exampleEn}”</p>
                  </div>
                  <div dir="rtl" className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">التعريف العربي والمثال السياقي</span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{activeEntry.definitionAr}</p>
                    <p className="text-slate-600 dark:text-slate-400">«{activeEntry.exampleAr}»</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="break-all">.mdd media key: {activeEntry.mediaKey}</span>
                  {activeEntry.synonyms.length > 0 && (
                    <span>Synonyms: {activeEntry.synonyms.join(', ')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Add New Entry Form */}
            <form
              onSubmit={handleAddEntry}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({ en: 'Add Custom Bilingual Dictionary Entry', ar: 'إضافة مدخل قاموسي جديد (إنجليزي ↔ عربي)' })}
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('symbols_charts')}
                  className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
                >
                  {t({ en: 'Pick IPA / Arabic Symbols', ar: 'اختر رموز IPA والتشكيل' })}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="dict-headword" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Headword (English or Term)', ar: 'الكلمة الأساسية (Headword)' })}
                  </label>
                  <input
                    id="dict-headword"
                    type="text"
                    value={headword}
                    onChange={(e) => setHeadword(e.target.value)}
                    placeholder="e.g., morphology"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="dict-arabic" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Arabic Equivalent', ar: 'المقابل العربي' })}
                  </label>
                  <input
                    id="dict-arabic"
                    type="text"
                    dir="rtl"
                    value={arabicEq}
                    onChange={(e) => setArabicEq(e.target.value)}
                    placeholder="مثال: علم الصرف"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="dict-pos" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Part of Speech', ar: 'القسم النحوي (POS)' })}
                  </label>
                  <select
                    id="dict-pos"
                    value={pos}
                    onChange={(e) => setPos(e.target.value as PartOfSpeech)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="noun">noun</option>
                    <option value="verb">verb</option>
                    <option value="adjective">adjective</option>
                    <option value="adverb">adverb</option>
                    <option value="particle">particle</option>
                    <option value="phrase">phrase</option>
                    <option value="term">term</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dict-ipa" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'IPA Transcription', ar: 'النطق الصوتي (IPA)' })}
                  </label>
                  <input
                    id="dict-ipa"
                    type="text"
                    value={ipa}
                    onChange={(e) => setIpa(e.target.value)}
                    placeholder="/mɔːrˈfɒlədʒi/"
                    className="w-full px-3 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="dict-root" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Arabic / Etymological Root', ar: 'الجذر اللغوي (مثال: ص-ر-ف)' })}
                  </label>
                  <input
                    id="dict-root"
                    type="text"
                    value={root}
                    onChange={(e) => setRoot(e.target.value)}
                    placeholder="ص-ر-ف"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="dict-domain" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Linguistic Domain', ar: 'المجال الدلالي' })}
                  </label>
                  <input
                    id="dict-domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="linguistics"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="dict-def-en" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Clear English Definition', ar: 'التعريف الواضح بالإنجليزية' })}
                  </label>
                  <textarea
                    id="dict-def-en"
                    rows={2}
                    value={defEn}
                    onChange={(e) => setDefEn(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="dict-def-ar" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t({ en: 'Clear Arabic Definition', ar: 'التعريف الواضح بالعربية' })}
                  </label>
                  <textarea
                    id="dict-def-ar"
                    rows={2}
                    dir="rtl"
                    value={defAr}
                    onChange={(e) => setDefAr(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t({ en: 'Add Dictionary Entry', ar: 'إضافة إلى القاموس' })}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: LINGUISTICS CHARTS & SYMBOLS */}
      {tab === 'symbols_charts' && (
        <div className="space-y-6">
          {/* Interactive IPA & Arabic Phonetic / Diacritic Symbol Reference */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t({
                    en: 'Interactive IPA Phonetic & Arabic Diacritic Symbol Chart',
                    ar: 'خريطة الرموز الصوتية الدولية (IPA) والتشكيل العربي التفاعلية',
                  })}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t({
                    en: 'Click any symbol to copy it and insert it into the Dictionary Maker IPA field.',
                    ar: 'انقر على أي رمز لنسخه وإدراجه مباشرة في حقل النطق الصوتي بصانع القواميس.',
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['all', t({ en: 'All Symbols', ar: 'كل الرموز' })],
                    ['ipa_consonant', t({ en: 'IPA Consonants', ar: 'صوامت IPA' })],
                    ['ipa_vowel', t({ en: 'IPA Vowels', ar: 'صوائت IPA' })],
                    ['arabic_phoneme', t({ en: 'Arabic Phonemes', ar: 'فونيمات عربية' })],
                    ['arabic_diacritic', t({ en: 'Arabic Tashkeel', ar: 'حركات التشكيل' })],
                  ] as const
                ).map(([gid, label]) => (
                  <button
                    key={gid}
                    type="button"
                    onClick={() => setSymbolGroup(gid)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      symbolGroup === gid
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {copiedSymbol && (
              <p role="status" className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                {t({
                  en: `Copied "${copiedSymbol}" and appended to Dictionary IPA input.`,
                  ar: `تم نسخ الرمز "${copiedSymbol}" وإضافته إلى حقل النطق الصوتي.`,
                })}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSymbols.map((sym) => (
                <button
                  key={`${sym.codepoint}-${sym.nameEn}`}
                  type="button"
                  onClick={() => handleCopyOrInsertSymbol(sym.symbol)}
                  className="text-start p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-sky-500 dark:hover:border-sky-500 transition-colors space-y-1.5 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xl font-mono text-sky-700 dark:text-sky-300 shrink-0">
                      {sym.symbol}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>{sym.codepoint}</span>
                      {copiedSymbol === sym.symbol ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'ar' ? sym.nameAr : sym.nameEn}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {lang === 'ar' ? sym.articulationAr : sym.articulationEn}
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                    {sym.exampleToken} · {sym.exampleGloss}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Linguistics Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t({ en: 'Dictionary Parts of Speech (POS) Distribution', ar: 'توزيع الأقسام النحوية في القاموس' })}
              </h3>
              <div className="h-56 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.posDistribution} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="pos" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t({
                  en: 'Corpus Character Script & Arabic Diacritic Breakdown',
                  ar: 'توزيع الحروف اللاتينية والعربية والتشكيل في المدونة',
                })}
              </h3>
              <div className="h-56 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.scriptComposition} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="script" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartsData.scriptComposition.map((item) => (
                        <Cell key={item.script} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t({ en: 'Corpus Word-Length Histogram (Characters)', ar: 'تدرّج أطوال الكلمات في المدونة (بالأحرف)' })}
              </h3>
              <div className="h-56 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.wordLengthHistogram} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({ en: 'Top Corpus Content Tokens (Zipf Rank)', ar: 'أعلى المفردات تكراراً (ترتيب زيف)' })}
                </h3>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {chartsData.totalAnalyzedTokens} tokens
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-start">
                      <th className="py-1.5 pr-3 font-medium">#</th>
                      <th className="py-1.5 pr-3 font-medium">{t({ en: 'Token', ar: 'المفردة' })}</th>
                      <th className="py-1.5 text-end font-medium">{t({ en: 'Count', ar: 'التكرار' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {chartsData.zipfTopTokens.map((tok) => (
                      <tr key={tok.token}>
                        <td className="py-1.5 pr-3 text-slate-500 dark:text-slate-400">{tok.rank}</td>
                        <td className="py-1.5 pr-3 text-slate-900 dark:text-slate-100">{tok.token}</td>
                        <td className="py-1.5 text-end text-sky-700 dark:text-sky-400">{tok.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTERNATIONAL DICTIONARY EXPORTS (.mdd, .mdx, XDXF, TEI P5, StarDict, Anki) */}
      {tab === 'exports' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label htmlFor="export-dict-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t({ en: 'Dictionary Publication Title', ar: 'عنوان القاموس المصدّر' })}
                </label>
                <input
                  id="export-dict-title"
                  type="text"
                  value={dictTitle}
                  onChange={(e) => setDictTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                {entries.length} {t({ en: 'entries packaged', ar: 'مدخلاً جاهزاً للتصدير' })}
              </span>
            </div>

            {exportStatus && (
              <p role="status" className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded px-3 py-2">
                {exportStatus}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  fmt: 'mdd' as const,
                  badge: 'MDict .mdd (Binary v2.0)',
                  titleEn: 'MDict Resource Archive (.mdd)',
                  titleAr: 'أرشيف الموارد والرسوم الصوتية (.mdd)',
                  descEn: 'Packages generated phonetic & bilingual SVG cards in spec-compliant MDict v2.0 binary format with UTF-16LE header and Adler-32 checksum.',
                  descAr: 'يحزم بطاقات التعريف والنطق بصيغة MDict v2.0 الثنائية مع ترويسة UTF-16LE وفحص Adler-32 المتوافق مع GoldenDict و MDict.',
                  primary: true,
                },
                {
                  fmt: 'mdx' as const,
                  badge: 'MDict .mdx (Binary v2.0)',
                  titleEn: 'MDict Bilingual Dictionary (.mdx)',
                  titleAr: 'ملف القاموس الثنائي (.mdx)',
                  descEn: 'Companion binary MDict v2.0 headword index with EN & AR headwords, IPA, roots, and RTL/LTR HTML entries.',
                  descAr: 'ملف المداخل الثنائي المرافق لملف .mdd يدعم البحث بالإنجليزية والعربية وعرض التعريفات والرموز الصوتية.',
                  primary: true,
                },
                {
                  fmt: 'mdx_txt' as const,
                  badge: 'MDict Source .mdx.txt',
                  titleEn: 'MDict Builder Source (.txt)',
                  titleAr: 'مصدر MDict النصي (</>.txt)',
                  descEn: 'Plain UTF-8 source compatible with mdict-utils and MdxBuilder compilation.',
                  descAr: 'ملف نصي قياسي جاهز لأدوات mdict-utils و MdxBuilder.',
                },
                {
                  fmt: 'xdxf' as const,
                  badge: 'ISO / XDXF (.xdxf)',
                  titleEn: 'XDXF XML Dictionary',
                  titleAr: 'معيار التبادل XML (XDXF)',
                  descEn: 'Universal XML Dictionary Exchange Format supported across open lexicography tools.',
                  descAr: 'صيغة تبادل القواميس القياسية المعتمدة عالمياً في البرمجيات المعجمية.',
                },
                {
                  fmt: 'tei' as const,
                  badge: 'TEI P5 Lex-0 (.tei.xml)',
                  titleEn: 'TEI P5 Academic XML',
                  titleAr: 'معيار TEI P5 الأكاديمي (XML)',
                  descEn: 'Scholarly Text Encoding Initiative P5 standard preserving IPA, POS, roots, and bilingual citations.',
                  descAr: 'المعيار الأكاديمي المعتمد في اللسانيات الرقمية لحفظ الجذور والأمثلة والنطق الصوتي.',
                },
                {
                  fmt: 'stardict' as const,
                  badge: 'StarDict (.ifo + .dict.txt)',
                  titleEn: 'StarDict Lexicon Bundle',
                  titleAr: 'حزمة StarDict (.ifo + .dict.txt)',
                  descEn: 'Exports both StarDict metadata .ifo descriptor and tab-delimited lexicon entries.',
                  descAr: 'يصدّر ملف التعريف .ifo مع ملف المداخل لبيئات القواميس الحرة.',
                },
                {
                  fmt: 'anki' as const,
                  badge: 'Anki Flashcards (.tsv)',
                  titleEn: 'Anki Study Deck (.tsv)',
                  titleAr: 'بطاقات المراجعة أنكي (.tsv)',
                  descEn: 'HTML-enabled tab-separated deck with headword, Arabic gloss, IPA, root, and bilingual definitions.',
                  descAr: 'ملف مراجعة جاهز للاستيراد في Anki يدعم تنسيق RTL العربي والنطق الصوتي.',
                },
                {
                  fmt: 'csv' as const,
                  badge: 'CSV UTF-8 BOM (.csv)',
                  titleEn: 'Spreadsheet Lexicon (.csv)',
                  titleAr: 'جدول بيانات إكسل (.csv)',
                  descEn: 'Excel-safe UTF-8 with BOM preserving Arabic script cleanly.',
                  descAr: 'ملف CSV بترميز UTF-8 BOM مضمون لعرض العربية بوضوح في Excel.',
                },
                {
                  fmt: 'jsonld' as const,
                  badge: 'W3C OntoLex JSON-LD (.json)',
                  titleEn: 'Semantic Web OntoLex (.json)',
                  titleAr: 'بيانات دلالية OntoLex JSON-LD',
                  descEn: 'Linked linguistic data graph conforming to W3C OntoLex-Lemon vocabulary.',
                  descAr: 'بيانات معجمية مترابطة متوافقة مع معيار W3C OntoLex-Lemon.',
                },
              ].map((card) => (
                <div
                  key={card.fmt}
                  className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col justify-between gap-3 min-w-0"
                >
                  <div className="space-y-1">
                    <span className="inline-block font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-400">
                      {card.badge}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {lang === 'ar' ? card.titleAr : card.titleEn}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {lang === 'ar' ? card.descAr : card.descEn}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerDownload(card.fmt)}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      card.primary
                        ? 'bg-sky-600 text-white hover:bg-sky-700'
                        : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>{t({ en: 'Download', ar: 'تنزيل' })} .{card.fmt === 'stardict' ? 'ifo/.txt' : card.fmt === 'mdx_txt' ? 'mdx.txt' : card.fmt === 'tei' ? 'tei.xml' : card.fmt === 'jsonld' ? 'json' : card.fmt === 'anki' ? 'tsv' : card.fmt}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Live Format Structure Preview */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t({ en: 'International Schema Preview (First 3 Entries)', ar: 'معاينة البنية القياسية قبل التصدير (أول ٣ مداخل)' })}
              </h2>
              <select
                aria-label="Select schema preview format"
                value={previewFormat}
                onChange={(e) => setPreviewFormat(e.target.value as PreviewFormat)}
                className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="xdxf">XDXF (.xdxf)</option>
                <option value="tei">TEI P5 XML (.tei.xml)</option>
                <option value="mdx_txt">MDict Source (.mdx.txt)</option>
                <option value="stardict">StarDict (.ifo + .dict)</option>
                <option value="anki">Anki (.tsv)</option>
                <option value="jsonld">OntoLex JSON-LD (.json)</option>
              </select>
            </div>

            <pre dir="ltr" className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-72">
              {previewText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
