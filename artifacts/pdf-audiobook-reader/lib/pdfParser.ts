import { Platform } from 'react-native';
import structuredClonePolyfill from '@ungap/structured-clone';
// PDF.js 4.x contains a browser-only dynamic import in its legacy bundle.
// Hermes parses the whole bundle during release builds and rejects that
// syntax, even though React Native uses the in-process worker fallback.
// PDF.js 3.x provides the same text-extraction API in a Hermes-compatible
// CommonJS legacy bundle.

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.js');
type PdfJsWorkerModule = typeof import('pdfjs-dist/legacy/build/pdf.worker.js');
type LegacyFileSystemModule = typeof import('expo-file-system/legacy');
type BlobUtilModule = typeof import('react-native-blob-util')['default'];

function loadPdfJs() {
  // Keep PDF.js out of the launch path. Its large legacy bundle is only
  // needed after the user chooses a PDF, and evaluating it while the root
  // layout is starting can terminate Hermes before React renders.
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as PdfJsModule;
  const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js') as PdfJsWorkerModule;
  return { pdfjs, pdfjsWorker };
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((normalized.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let offset = 0;

  for (const character of normalized) {
    const digit = BASE64_ALPHABET.indexOf(character);
    if (digit < 0) continue;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (buffer >> bits) & 0xff;
      offset += 1;
    }
  }
  return bytes;
}

function nativeFilePath(fileUri: string) {
  return fileUri.startsWith('file://')
    ? decodeURIComponent(fileUri.slice('file://'.length))
    : fileUri;
}

async function readPdfBytesWithLegacyFileSystem(fileUri: string) {
  const fileSystem = require('expo-file-system/legacy') as LegacyFileSystemModule;
  const base64 = await fileSystem.readAsStringAsync(fileUri, {
    encoding: fileSystem.EncodingType.Base64,
  });
  return decodeBase64(base64);
}

async function readPdfBytesWithBlobUtil(fileUri: string) {
  const blobUtil = (require('react-native-blob-util') as { default: BlobUtilModule }).default;
  const base64 = await blobUtil.fs.readFile(nativeFilePath(fileUri), 'base64');
  return decodeBase64(base64);
}

export type SectionKind = 'chapter' | 'section' | 'reading';

export type ParsedSection = {
  title: string;
  text: string;
  kind: SectionKind;
  pageNumber: number;
};

export type ParsedBook = {
  title: string;
  author: string;
  language: string;
  wordCount: number;
  durationMinutes: number;
  sections: ParsedSection[];
};

export interface ParsedPDFText {
  text: string;
  pageCount: number;
  pages: string[];
}

const WORDS_PER_MINUTE = 150;
const PDF_EXTENSION = /\.pdf$/i;

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wordCount(text: string) {
  return text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length ?? 0;
}

function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(PDF_EXTENSION, '');
  const title = withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return title || 'Untitled PDF';
}

function looksLikeHeading(line: string) {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (normalized.length < 2 || normalized.length > 120) return false;
  if (/^(chapter|chap\.|part|section|appendix|prologue|epilogue|introduction|preface)\b/i.test(normalized)) {
    return true;
  }
  const words = normalized.split(/\s+/);
  return words.length <= 8 && normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized);
}

function headingKind(heading: string): SectionKind {
  return /^(chapter|chap\.|part|prologue|epilogue)\b/i.test(heading) ? 'chapter' : 'section';
}

function pageTextFromItems(items: Array<{ str?: string; hasEOL?: boolean }>) {
  return cleanText(items.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join(''));
}

async function readPdfBytes(fileUri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    if (!response.ok) throw new Error(`The selected PDF could not be read (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }

  let fileSystemError: unknown;
  try {
    // File.bytes() is the preferred Expo SDK 54 API, but some Android
    // document-picker URIs trigger a native NullPointerException here.
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(fileUri);
    return await file.bytes();
  } catch (error) {
    fileSystemError = error;
  }

  try {
    return await readPdfBytesWithLegacyFileSystem(fileUri);
  } catch {
    try {
      return await readPdfBytesWithBlobUtil(fileUri);
    } catch {
      const detail = fileSystemError instanceof Error ? fileSystemError.message : '';
      throw new Error(
        /nullpointer/i.test(detail)
          ? 'Android could not read the selected PDF. Please choose it again from your device files.'
          : 'The selected PDF could not be read. Please choose it again.',
      );
    }
  }
}

/**
 * Extracts selectable text with PDF.js in the JavaScript runtime.
 *
 * The previous implementation decoded the PDF bytes as UTF-8. A PDF is a
 * binary container, so that produced unreadable text and failed on Android
 * release builds. PDF.js works with the `file://` URI returned by Expo's
 * document picker after the bytes have been read through Expo FileSystem.
 */
export async function parsePDFText(fileUri: string): Promise<ParsedPDFText> {
  const data = await readPdfBytes(fileUri);
  if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = structuredClonePolyfill as typeof structuredClone;
  }
  const { pdfjs, pdfjsWorker } = loadPdfJs();
  // React Native has no browser Worker implementation. Providing PDF.js'
  // worker handler explicitly makes it use its in-process loopback worker,
  // which is supported by Hermes and does not require a worker URL.
  (globalThis as typeof globalThis & { pdfjsWorker?: typeof pdfjsWorker }).pdfjsWorker = pdfjsWorker;
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
    isEvalSupported: false,
    useWorkerFetch: false,
    verbosity: 0,
  });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pageTextFromItems(content.items as Array<{ str?: string; hasEOL?: boolean }>));
      page.cleanup();
    }
    await document.cleanup();
    return {
      text: cleanText(pages.filter(Boolean).join('\n\n')),
      pageCount: document.numPages,
      pages,
    };
  } finally {
    await loadingTask.destroy();
  }
}

export function isLikelyReadableText(text: string) {
  const normalized = cleanText(text);
  const words = wordCount(normalized);
  const letters = normalized.match(/[\p{L}]/gu)?.length ?? 0;
  return words >= 3 && letters >= 12 && letters / Math.max(1, normalized.length) >= 0.2;
}

export function detectDocumentLanguage(text: string): string {
  const normalized = ` ${text.toLocaleLowerCase()} `;
  const englishMarkers = [' the ', ' and ', ' of ', ' to ', ' in ', ' that ', ' with ', ' is '];
  const spanishMarkers = [' el ', ' la ', ' de ', ' y ', ' que ', ' en ', ' los ', ' las ', ' una ', ' con '];
  const score = (markers: string[]) => markers.reduce((total, marker) => total + (normalized.split(marker).length - 1), 0);
  const englishScore = score(englishMarkers);
  const spanishScore = score(spanishMarkers);
  if (englishScore === 0 && spanishScore === 0) return 'unknown';
  return spanishScore > englishScore ? 'es' : 'en';
}

export async function parsePdf(fileUri: string, filename: string): Promise<ParsedBook> {
  const parsed = await parsePDFText(fileUri);
  const text = cleanText(parsed.text);
  if (!isLikelyReadableText(text)) {
    throw new Error('This PDF does not contain selectable text. Try an OCR or text-based PDF.');
  }

  const sections: ParsedSection[] = parsed.pages
    .map((pageText, index) => {
      const lines = pageText.split('\n').map((line) => line.trim()).filter(Boolean);
      const headingIndex = lines.findIndex(looksLikeHeading);
      const heading = headingIndex >= 0 ? lines[headingIndex] : `Page ${index + 1}`;
      const body = cleanText((headingIndex >= 0 ? lines.slice(headingIndex + 1) : lines).join('\n'));
      return {
        title: heading,
        text: body || pageText,
        kind: headingIndex >= 0 ? headingKind(heading) : 'reading',
        pageNumber: index + 1,
      };
    })
    .filter((section) => section.text.length > 0);

  const totalWords = wordCount(text);
  return {
    title: titleFromFilename(filename),
    author: 'Unknown author',
    language: detectDocumentLanguage(text),
    wordCount: totalWords,
    durationMinutes: Math.max(1, Math.ceil(totalWords / WORDS_PER_MINUTE)),
    sections: sections.length > 0
      ? sections
      : [{ title: 'Reading', text, kind: 'reading', pageNumber: 1 }],
  };
}
