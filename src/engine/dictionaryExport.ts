import type { DictionaryEntry } from './dictionary';

export interface DictionaryExportMeta {
  title: string;
  description: string;
  author: string;
  createdDate: string;
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function encodeUtf16Le(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

export function computeAdler32(data: Uint8Array): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}

function uint32Be(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function uint32Le(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function uint64Be(value: number): Uint8Array {
  const hi = Math.floor(value / 0x100000000);
  const lo = value >>> 0;
  const out = new Uint8Array(8);
  out.set(uint32Be(hi), 0);
  out.set(uint32Be(lo), 4);
  return out;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function buildEntryCardSvg(entry: DictionaryEntry): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="190" viewBox="0 0 560 190">
  <rect width="560" height="190" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="20" y="34" font-family="sans-serif" font-size="18" font-weight="700" fill="#0f172a">${escapeXml(entry.headword)}</text>
  <text x="20" y="56" font-family="monospace" font-size="13" fill="#0284c7">${escapeXml(entry.ipa)} · [${escapeXml(entry.pos)}] · Root: ${escapeXml(entry.root)}</text>
  <text x="540" y="34" text-anchor="end" font-family="sans-serif" font-size="16" font-weight="600" fill="#047857">${escapeXml(entry.arabic)}</text>
  <text x="20" y="92" font-family="sans-serif" font-size="12" fill="#334155">${escapeXml(entry.definitionEn.slice(0, 88))}</text>
  <text x="540" y="124" text-anchor="end" font-family="sans-serif" font-size="12" fill="#334155">${escapeXml(entry.definitionAr.slice(0, 82))}</text>
  <text x="20" y="162" font-family="monospace" font-size="11" fill="#64748b">TEXTPRINT Dictionary Card · Corpus Freq: ${entry.frequencyInCorpus}</text>
</svg>`;
}

function buildEntryHtml(entry: DictionaryEntry): string {
  const syns = entry.synonyms.length > 0 ? `<p><b>Synonyms:</b> ${escapeXml(entry.synonyms.join(', '))}</p>` : '';
  return `<div class="tp-entry">
  <h3>${escapeXml(entry.headword)} <span class="ipa">${escapeXml(entry.ipa)}</span> — <span dir="rtl">${escapeXml(entry.arabic)}</span></h3>
  <p><i>POS:</i> ${escapeXml(entry.pos)} | <i>Root:</i> ${escapeXml(entry.root)} | <i>Domain:</i> ${escapeXml(entry.domain)}</p>
  <p><b>EN:</b> ${escapeXml(entry.definitionEn)}</p>
  <p dir="rtl"><b>AR:</b> ${escapeXml(entry.definitionAr)}</p>
  <p><b>Ex (EN):</b> ${escapeXml(entry.exampleEn)}</p>
  <p dir="rtl"><b>مثال (AR):</b> ${escapeXml(entry.exampleAr)}</p>
  ${syns}
</div>`;
}

/**
 * Generates an MDict v2.0 compatible binary container (.mdd resource archive or .mdx entry file).
 * Layout follows MDict 2.0 header framing:
 *   [4B big-endian header_byte_len][UTF-16LE XML Dictionary header][4B little-endian Adler-32]
 *   [40B KeySectionHeader (5 x uint64 BE)][4B Adler-32][KeyBlockInfo (uncompressed)][KeyEntries][RecordHeader][RecordBytes]
 */
function buildMdictBinaryContainer(
  items: Array<{ key: string; payload: Uint8Array }>,
  headerXml: string
): Uint8Array {
  const sorted = [...items].sort((a, b) => a.key.localeCompare(b.key));
  const headerBytes = encodeUtf16Le(headerXml);
  const headerLenBe = uint32Be(headerBytes.length);
  const headerAdlerLe = uint32Le(computeAdler32(headerBytes));

  // Uncompressed Key Index Block (MDict v2: 8-byte record_offset BE + UTF-16LE key + \0\0)
  let recordOffset = 0;
  const keyEntryChunks: Uint8Array[] = [];
  const recordChunks: Uint8Array[] = [];
  for (const item of sorted) {
    keyEntryChunks.push(uint64Be(recordOffset));
    keyEntryChunks.push(encodeUtf16Le(item.key));
    keyEntryChunks.push(new Uint8Array([0, 0]));

    // Plain uncompressed record payload block (zlib flag 0x00000000 + adler32)
    recordChunks.push(item.payload);
    recordOffset += item.payload.length;
  }

  const keyEntriesBytes = concatUint8Arrays(keyEntryChunks);
  const allRecordsBytes = concatUint8Arrays(recordChunks);

  // Key block info (1 block: num_entries u64, first_size u16, first_key, last_size u16, last_key, comp_size u64, decomp_size u64)
  const firstKeyBytes = encodeUtf16Le(sorted[0]?.key ?? '');
  const lastKeyBytes = encodeUtf16Le(sorted[sorted.length - 1]?.key ?? '');
  const keyBlockInfoRaw = concatUint8Arrays([
    uint64Be(sorted.length),
    new Uint8Array([(firstKeyBytes.length >> 9) & 0xff, (firstKeyBytes.length >> 1) & 0xff]),
    firstKeyBytes,
    new Uint8Array([0, 0]),
    new Uint8Array([(lastKeyBytes.length >> 9) & 0xff, (lastKeyBytes.length >> 1) & 0xff]),
    lastKeyBytes,
    new Uint8Array([0, 0]),
    uint64Be(keyEntriesBytes.length + 8),
    uint64Be(keyEntriesBytes.length),
  ]);

  // MDict v2.0 Key Section Header (5 x uint64 BE = 40 bytes + 4-byte Adler32)
  const keySectionHeader = concatUint8Arrays([
    uint64Be(1), // num_key_blocks
    uint64Be(sorted.length), // num_entries
    uint64Be(keyBlockInfoRaw.length), // key_block_info_decompressed_size
    uint64Be(keyBlockInfoRaw.length), // key_block_info_size
    uint64Be(keyEntriesBytes.length + 8), // key_block_size
  ]);
  const keySectionAdler = uint32Be(computeAdler32(keySectionHeader));

  // Uncompressed KeyBlock compression header (0x00000000 + adler32)
  const keyBlockCompHeader = concatUint8Arrays([
    new Uint8Array([0, 0, 0, 0]),
    uint32Be(computeAdler32(keyEntriesBytes)),
  ]);

  // Record Section Header (4 x uint64 BE = 32 bytes)
  const recordSectionHeader = concatUint8Arrays([
    uint64Be(1), // num_record_blocks
    uint64Be(sorted.length), // num_entries
    uint64Be(16), // record_block_info_size
    uint64Be(allRecordsBytes.length + 8), // record_block_data_size
  ]);

  const recordBlockInfo = concatUint8Arrays([
    uint64Be(allRecordsBytes.length + 8),
    uint64Be(allRecordsBytes.length),
  ]);

  const recordBlockCompHeader = concatUint8Arrays([
    new Uint8Array([0, 0, 0, 0]),
    uint32Be(computeAdler32(allRecordsBytes)),
  ]);

  return concatUint8Arrays([
    headerLenBe,
    headerBytes,
    headerAdlerLe,
    keySectionHeader,
    keySectionAdler,
    keyBlockInfoRaw,
    keyBlockCompHeader,
    keyEntriesBytes,
    recordSectionHeader,
    recordBlockInfo,
    recordBlockCompHeader,
    allRecordsBytes,
  ]);
}

/**
 * Exports a genuine binary MDict Data Archive (.mdd) containing SVG phonetic & bilingual definition cards
 * for every entry in the dictionary.
 */
export function buildMdictMddBinary(
  entries: DictionaryEntry[],
  meta: DictionaryExportMeta
): Uint8Array {
  const headerXml =
    `<Dictionary GeneratedByEngineVersion="2.0" RequiredEngineVersion="2.0" ` +
    `Format="" KeyCaseSensitive="No" StripKey="No" Encrypted="0" RegisterBy="EMail" ` +
    `Description="${escapeXml(meta.description)}" Title="${escapeXml(meta.title)} (MDD Media)" ` +
    `CreationDate="${escapeXml(meta.createdDate)}" Compact="Yes" Compat="Yes"/>\r\n`;

  const items = entries.map((entry) => ({
    key: entry.mediaKey || `\\cards\\${entry.id}.svg`,
    payload: encodeUtf8(buildEntryCardSvg(entry)),
  }));

  return buildMdictBinaryContainer(items, headerXml);
}

/**
 * Exports a genuine binary MDict Dictionary (.mdx) containing HTML bilingual entries.
 */
export function buildMdictMdxBinary(
  entries: DictionaryEntry[],
  meta: DictionaryExportMeta
): Uint8Array {
  const headerXml =
    `<Dictionary GeneratedByEngineVersion="2.0" RequiredEngineVersion="2.0" ` +
    `Format="Html" KeyCaseSensitive="No" StripKey="Yes" Encrypted="0" RegisterBy="EMail" ` +
    `Encoding="UTF-8" Description="${escapeXml(meta.description)}" Title="${escapeXml(meta.title)}" ` +
    `CreationDate="${escapeXml(meta.createdDate)}" Compact="Yes" Compat="Yes"/>\r\n`;

  const items: Array<{ key: string; payload: Uint8Array }> = [];
  for (const entry of entries) {
    const html = encodeUtf8(buildEntryHtml(entry));
    items.push({ key: entry.headword, payload: html });
    if (entry.arabic && entry.arabic !== entry.headword) {
      items.push({ key: entry.arabic, payload: html });
    }
  }

  return buildMdictBinaryContainer(items, headerXml);
}

/**
 * Standard MdxBuilder / mdict-utils source text file (.mdx.txt) ready for external MDict tools.
 */
export function buildMdictSourceTxt(entries: DictionaryEntry[]): string {
  return entries
    .map((e) => {
      const html = buildEntryHtml(e).replace(/\r?\n/g, ' ');
      return `${e.headword}\r\n${html}\r\n</>\r\n`;
    })
    .join('');
}

/**
 * International XDXF (XML Dictionary Exchange Format) standard (.xdxf).
 */
export function buildXdxfXml(
  entries: DictionaryEntry[],
  meta: DictionaryExportMeta
): string {
  const articles = entries
    .map(
      (e) => `    <ar>
      <k>${escapeXml(e.headword)}</k>
      <tr f="IPA">${escapeXml(e.ipa)}</tr>
      <pos>${escapeXml(e.pos)}</pos>
      <def>
        <gr>${escapeXml(e.domain)} · Root: ${escapeXml(e.root)}</gr>
        <dtrn xml:lang="ar">${escapeXml(e.arabic)}</dtrn>
        <deftext xml:lang="en">${escapeXml(e.definitionEn)}</deftext>
        <deftext xml:lang="ar">${escapeXml(e.definitionAr)}</deftext>
        <ex><ex_orig>${escapeXml(e.exampleEn)}</ex_orig><ex_tran>${escapeXml(e.exampleAr)}</ex_tran></ex>
      </def>
    </ar>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xdxf lang_from="ENG" lang_to="ARA" format="logical" revision="34">
  <meta_info>
    <title>${escapeXml(meta.title)}</title>
    <full_title>${escapeXml(meta.title)}</full_title>
    <description>${escapeXml(meta.description)}</description>
    <file_ver>1.0</file_ver>
    <creation_date>${escapeXml(meta.createdDate)}</creation_date>
  </meta_info>
  <lexicon>
${articles}
  </lexicon>
</xdxf>`;
}

/**
 * TEI P5 Lex-0 XML academic lexicography standard (.tei.xml).
 */
export function buildTeiP5Xml(
  entries: DictionaryEntry[],
  meta: DictionaryExportMeta
): string {
  const teiEntries = entries
    .map(
      (e) => `      <entry xml:id="${escapeXml(e.id)}" xml:lang="en">
        <form type="lemma">
          <orth>${escapeXml(e.headword)}</orth>
          <pron notation="ipa">${escapeXml(e.ipa)}</pron>
        </form>
        <gramGrp>
          <pos>${escapeXml(e.pos)}</pos>
          <subc type="root">${escapeXml(e.root)}</subc>
        </gramGrp>
        <sense>
          <usg type="domain">${escapeXml(e.domain)}</usg>
          <def xml:lang="en">${escapeXml(e.definitionEn)}</def>
          <def xml:lang="ar">${escapeXml(e.definitionAr)}</def>
          <cit type="translation" xml:lang="ar"><quote>${escapeXml(e.arabic)}</quote></cit>
          <cit type="example"><quote xml:lang="en">${escapeXml(e.exampleEn)}</quote><quote xml:lang="ar">${escapeXml(e.exampleAr)}</quote></cit>
        </sense>
      </entry>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${escapeXml(meta.title)}</title>
        <author>${escapeXml(meta.author)}</author>
      </titleStmt>
      <publicationStmt>
        <p>${escapeXml(meta.description)} (${escapeXml(meta.createdDate)})</p>
      </publicationStmt>
      <sourceDesc>
        <p>Exported from TEXTPRINT Multilingual Stylometry &amp; Lexicography Laboratory.</p>
      </sourceDesc>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
${teiEntries}
    </body>
  </text>
</TEI>`;
}

/**
 * StarDict metadata + tabfile dictionary bundle (.ifo + .dict.txt).
 */
export function buildStarDictBundle(
  entries: DictionaryEntry[],
  meta: DictionaryExportMeta
): { ifo: string; dictTxt: string } {
  const dictTxt = entries
    .map((e) => {
      const def = `${e.arabic} [${e.pos}] ${e.ipa} | Root: ${e.root} | EN: ${e.definitionEn} | AR: ${e.definitionAr}`;
      return `${e.headword}\t${def.replace(/[\r\n\t]+/g, ' ')}`;
    })
    .join('\n');

  const ifo = [
    'StarDict\'s dict ifo file',
    'version=2.4.2',
    `wordcount=${entries.length}`,
    `idxfilesize=${encodeUtf8(entries.map((e) => e.headword).join('')).length + entries.length * 9}`,
    `bookname=${meta.title}`,
    `author=${meta.author}`,
    `date=${meta.createdDate}`,
    'sametypesequence=m',
    `description=${meta.description}`,
  ].join('\n');

  return { ifo, dictTxt };
}

export function buildDictionaryCsv(entries: DictionaryEntry[]): string {
  const headers = [
    'id',
    'headword',
    'arabic',
    'pos',
    'root',
    'ipa',
    'domain',
    'definition_en',
    'definition_ar',
    'example_en',
    'example_ar',
    'corpus_freq',
    'mdd_media_key',
  ];
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...entries.map((e) =>
      [
        e.id,
        e.headword,
        e.arabic,
        e.pos,
        e.root,
        e.ipa,
        e.domain,
        e.definitionEn,
        e.definitionAr,
        e.exampleEn,
        e.exampleAr,
        e.frequencyInCorpus,
        e.mediaKey,
      ]
        .map(esc)
        .join(',')
    ),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function buildDictionaryTsvAnki(entries: DictionaryEntry[]): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim();
  const rows = entries.map(
    (e) =>
      `${clean(e.headword)}\t${clean(e.arabic)}\t${clean(e.ipa)}\t${clean(e.pos)} (${clean(e.root)})\t${clean(e.definitionEn)}<br><div dir="rtl">${clean(e.definitionAr)}</div>\t${clean(e.exampleEn)}`
  );
  return `#separator:tab\n#html:true\n#tags column:6\n${rows.join('\n')}`;
}

export function buildOntoLexJsonLd(
  entries: DictionaryEntry[],
  meta: DictionaryExportMeta
): string {
  const payload = {
    '@context': {
      ontolex: 'http://www.w3.org/ns/lemon/ontolex#',
      lexinfo: 'http://www.lexinfo.net/ontology/2.0/lexinfo#',
      skos: 'http://www.w3.org/2004/02/skos/core#',
    },
    '@type': 'ontolex:Lexicon',
    title: meta.title,
    description: meta.description,
    created: meta.createdDate,
    entries: entries.map((e) => ({
      '@id': `urn:textprint:lexicon:${e.id}`,
      '@type': 'ontolex:LexicalEntry',
      canonicalForm: {
        writtenRep: { '@language': 'en', '@value': e.headword },
        phoneticRep: e.ipa,
      },
      arabicEquivalent: { '@language': 'ar', '@value': e.arabic },
      partOfSpeech: `lexinfo:${e.pos}`,
      morphologicalRoot: e.root,
      domain: e.domain,
      sense: {
        definition: [
          { '@language': 'en', '@value': e.definitionEn },
          { '@language': 'ar', '@value': e.definitionAr },
        ],
        examples: [
          { '@language': 'en', '@value': e.exampleEn },
          { '@language': 'ar', '@value': e.exampleAr },
        ],
      },
      mddMediaKey: e.mediaKey,
    })),
  };
  return JSON.stringify(payload, null, 2);
}
