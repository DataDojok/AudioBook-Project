# PDF Audiobook Reader

An Expo mobile app that turns selectable-text PDF books into a structured, resumable listening experience.

## Run & Operate

- `pnpm --filter @workspace/pdf-audiobook-reader run dev` — run the Expo mobile reader
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The API server remains available at `pnpm --filter @workspace/api-server run dev` for shared workspace services.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo SDK 54, Expo Router, AsyncStorage, expo-document-picker, expo-speech

## Where things live

- `artifacts/pdf-audiobook-reader/app/(tabs)/index.tsx` — import-first home screen and continue reading card
- `artifacts/pdf-audiobook-reader/app/(tabs)/library.tsx` — local PDF library
- `artifacts/pdf-audiobook-reader/app/reader.tsx` — structure-aware reading player, narrator selection, and speed controls
- `artifacts/pdf-audiobook-reader/context/LibraryContext.tsx` — local library, playback queue, speech state, and persistence
- `artifacts/pdf-audiobook-reader/lib/pdfParser.ts` — selectable-text PDF parsing and chapter/section detection
- `artifacts/pdf-audiobook-reader/constants/colors.ts` — shared product palette

## Architecture decisions

- The first build is frontend-only and persists the local library with AsyncStorage, avoiding an account or server requirement for personal books.
- Playback uses device text-to-speech voices and queues sentence-sized chunks so punctuation remains natural.
- Speech playback serializes `stop()` before each new utterance and uses run guards so stale callbacks cannot interrupt a newer play, skip, or voice-change action.
- PDF import targets selectable-text PDFs; scanned/image-only PDFs are rejected with explicit OCR guidance.

## Product

- Import a PDF from the device file picker.
- Extract selectable text and identify likely chapter/section headings.
- Listen with available device voices, choose a narrator, change pace, skip through sentences, and resume from stored section progress.
- Browse or remove imported books from the local library.

## User preferences

No additional preferences recorded.

## Gotchas

- The parser supports text-based PDFs. OCR for scanned PDFs and premium cloud neural voices are future enhancements.
- Device text-to-speech must have an installed voice; playback errors are surfaced in the reader instead of failing silently.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
