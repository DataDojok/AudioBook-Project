import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { detectDocumentLanguage, isLikelyReadableText, parsePdf } from '@/lib/pdfParser';
import type { ParsedBook, ParsedSection } from '@/lib/pdfParser';

export type Book = ParsedBook & {
  id: string;
  filename: string;
  uri: string;
  addedAt: number;
  progress: number;
  currentSection: number;
};

export type VoiceOption = {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
  source: 'device';
};

type LibraryContextValue = {
  books: Book[];
  activeBook: Book | null;
  isHydrated: boolean;
  isImporting: boolean;
  selectedVoice: VoiceOption | null;
  voices: VoiceOption[];
  rate: number;
  currentSection: number;
  currentSentence: number;
  isPlaying: boolean;
  speechError: string | null;
  importBook: () => Promise<void>;
  openBook: (book: Book) => void;
  removeBook: (id: string) => Promise<void>;
  selectVoice: (voice: VoiceOption) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  togglePlayback: () => void;
  stopPlayback: () => void;
  skipBy: (amount: number) => void;
};

const STORAGE_KEY = '@chapter-and-voice/library';
const SETTINGS_KEY = '@chapter-and-voice/settings';
const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeVoice(voice: Speech.Voice): VoiceOption {
  return {
    identifier: voice.identifier,
    name: voice.name || voice.identifier,
    language: voice.language || 'en-US',
    quality: voice.quality,
    source: 'device',
  };
}

function isLanguageVoice(voice: VoiceOption, language: string) {
  return voice.language.toLowerCase() === language
    || voice.language.toLowerCase().startsWith(`${language}-`);
}

function voiceSortRank(voice: VoiceOption) {
  const isEnglish = isLanguageVoice(voice, 'en');
  const isSpanish = isLanguageVoice(voice, 'es');
  const languageRank = isEnglish ? 0 : isSpanish ? 1 : 2;
  const qualityRank = voice.quality?.toLowerCase() === 'enhanced' ? 0 : 1;
  const accentRank = voice.language.toLowerCase() === 'es-es' ? 0
    : voice.language.toLowerCase() === 'es-mx' ? 1
      : voice.language.toLowerCase() === 'es-us' ? 2
        : 3;
  return [languageRank, qualityRank, accentRank, voice.name.toLowerCase()];
}

function sortVoices(voiceList: VoiceOption[]) {
  return [...voiceList].sort((left, right) => {
    const leftRank = voiceSortRank(left);
    const rightRank = voiceSortRank(right);
    for (let index = 0; index < leftRank.length; index += 1) {
      if (leftRank[index] < rightRank[index]) return -1;
      if (leftRank[index] > rightRank[index]) return 1;
    }
    return 0;
  });
}

function getDefaultVoiceForBook(book: Pick<Book, 'language' | 'sections'>, voiceList: VoiceOption[]) {
  const language = !book.language || book.language === 'unknown'
    ? detectDocumentLanguage(book.sections.map((section) => section.text).join(' '))
    : book.language;
  if (language !== 'en' && language !== 'es') return null;

  const languageCode = language === 'es' ? 'mx' : 'en';
  const shelleyVoice = voiceList.find((voice) => {
    const name = voice.name.toLowerCase();
    return name.includes('shelley')
      && name.includes(languageCode)
      && isLanguageVoice(voice, language);
  });
  return shelleyVoice
    ?? voiceList.find((voice) => isLanguageVoice(voice, language))
    ?? null;
}

function flattenSections(book: Book | null): Array<{ sectionIndex: number; text: string }> {
  if (!book) return [];
  const chunks: Array<{ sectionIndex: number; text: string }> = [];
  book.sections.forEach((section, sectionIndex) => {
    const sentences = section.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [section.text];
    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (trimmed) chunks.push({ sectionIndex, text: trimmed });
    });
  });
  return chunks;
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  const [rate, setRateValue] = useState(0.92);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const hasExplicitVoicePreferenceRef = useRef(false);
  const isPlayingRef = useRef(false);
  const currentSentenceRef = useRef(0);
  const playbackRunRef = useRef(0);

  const activeBook = useMemo(() => books.find((book) => book.id === activeBookId) ?? books[0] ?? null, [activeBookId, books]);
  const chunks = useMemo(() => flattenSections(activeBook), [activeBook]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(SETTINGS_KEY),
      Speech.getAvailableVoicesAsync(),
    ]).then(async ([storedBooks, storedSettings, availableVoices]) => {
      if (storedBooks) {
        const storedBookList = JSON.parse(storedBooks) as Book[];
        setBooks(storedBookList);
        void Promise.all(
          storedBookList
            .filter((book) => !isLikelyReadableText(book.sections.map((section) => section.text).join(' ')))
            .map(async (book) => {
              try {
                const repaired = await parsePdf(book.uri, book.filename);
                setBooks((current) => current.map((currentBook) => (
                  currentBook.id === book.id ? { ...currentBook, ...repaired } : currentBook
                )));
              } catch {
                // The cached source file may have expired; leave the book for manual re-import.
              }
            }),
        );
      }
      const normalizedVoices = availableVoices.map(normalizeVoice);
      const supportedVoices = normalizedVoices.filter((voice) => (
        isLanguageVoice(voice, 'en') || isLanguageVoice(voice, 'es')
      ));
      const nextVoices = sortVoices(supportedVoices.length > 0 ? supportedVoices : normalizedVoices);
      setVoices(nextVoices);
      if (nextVoices.length > 0) {
        setSelectedVoice(nextVoices.find((voice) => isLanguageVoice(voice, 'en')) ?? nextVoices[0]);
      }
      if (storedSettings) {
        const settings = JSON.parse(storedSettings) as { voiceId?: string; rate?: number };
        setRateValue(settings.rate ?? 0.92);
        const storedVoice = nextVoices.find((voice) => voice.identifier === settings.voiceId);
        if (storedVoice) {
          hasExplicitVoicePreferenceRef.current = true;
          setSelectedVoice(storedVoice);
        }
      }
      setIsHydrated(true);
    }).catch(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(books)).catch(() => undefined);
  }, [books, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !activeBook) return;
    setCurrentSection(activeBook.currentSection);
  }, [activeBook, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !activeBook || hasExplicitVoicePreferenceRef.current) return;
    const defaultVoice = getDefaultVoiceForBook(activeBook, voices);
    if (defaultVoice) {
      setSelectedVoice((current) => current?.identifier === defaultVoice.identifier ? current : defaultVoice);
    }
  }, [activeBook?.id, isHydrated, voices]);

  useEffect(() => {
    if (!isHydrated || !activeBookId) return;
    setBooks((current) => current.map((book) => (
      book.id === activeBookId
        ? { ...book, currentSection, progress: Math.min(100, Math.round(((currentSection + 1) / Math.max(1, book.sections.length)) * 100)) }
        : book
    )));
  }, [activeBookId, currentSection, isHydrated]);

  useEffect(() => {
    currentSentenceRef.current = currentSentence;
  }, [currentSentence]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    let cancelled = false;
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;

    const stopCurrentSpeech = async () => {
      try {
        await Speech.stop();
      } catch {
        // Stopping an already-finished utterance is safe to ignore.
      }
    };

    const finishChunk = (index: number) => {
      const nextIndex = index + 1;
      if (nextIndex >= chunks.length) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        currentSentenceRef.current = 0;
        setCurrentSentence(0);
        return;
      }
      currentSentenceRef.current = nextIndex;
      setCurrentSentence(nextIndex);
      setCurrentSection(chunks[nextIndex].sectionIndex);
      void speakChunk(nextIndex);
    };

    const speakChunk = async (index: number) => {
      const chunk = chunks[index];
      if (cancelled || runId !== playbackRunRef.current || !chunk || !isPlayingRef.current) return;

      // expo-speech queues calls on some Android versions. Always finish the
      // previous stop before speaking the next chunk so a new utterance is not
      // cancelled by the cleanup of the previous one.
      await stopCurrentSpeech();
      if (cancelled || runId !== playbackRunRef.current || !isPlayingRef.current) return;

      try {
        Speech.speak(chunk.text, {
          voice: selectedVoice?.identifier,
          language: selectedVoice?.language,
          rate,
          pitch: 1,
          volume: 1,
          onDone: () => {
            if (cancelled || runId !== playbackRunRef.current || !isPlayingRef.current) return;
            finishChunk(index);
          },
          onStopped: () => undefined,
          onError: (error) => {
            if (cancelled || runId !== playbackRunRef.current) return;
            isPlayingRef.current = false;
            setIsPlaying(false);
            setSpeechError(error instanceof Error && error.message ? error.message : 'Your device could not start audio. Check that a text-to-speech voice is installed and try again.');
          },
        });
      } catch (error) {
        if (cancelled || runId !== playbackRunRef.current) return;
        isPlayingRef.current = false;
        setIsPlaying(false);
        setSpeechError(error instanceof Error && error.message ? error.message : 'Your device could not start audio. Check that a text-to-speech voice is installed and try again.');
      }
    };

    if (isPlaying && chunks[currentSentence]) {
      setSpeechError(null);
      void speakChunk(currentSentence);
    } else if (!isPlaying) {
      void stopCurrentSpeech();
    }

    return () => {
      cancelled = true;
      void stopCurrentSpeech();
    };
  // Playback is intentionally restarted only for user-controlled state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, selectedVoice?.identifier, rate]);

  const importBook = async () => {
    setIsImporting(true);
    try {
      let result;
      try {
        result = await DocumentPicker.getDocumentAsync({
          type: 'application/pdf',
          copyToCacheDirectory: true,
          multiple: false,
        });
      } catch (pickerError) {
        console.error('DocumentPicker.getDocumentAsync failed:', pickerError);
        throw new Error(
          `The file picker crashed before a PDF could be selected (${
            pickerError instanceof Error ? pickerError.message : String(pickerError)
          }).`,
        );
      }
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      console.log('Picked asset:', JSON.stringify(asset));
      let parsed;
      try {
        parsed = await parsePdf(asset.uri, asset.name);
      } catch (parseError) {
        console.error('parsePdf failed:', parseError);
        throw parseError;
      }
      const book: Book = {
        ...parsed,
        id: makeId(),
        filename: asset.name,
        uri: asset.uri,
        addedAt: Date.now(),
        progress: 0,
        currentSection: 0,
      };
      setBooks((current) => [book, ...current]);
      setActiveBookId(book.id);
      setCurrentSection(0);
      setCurrentSentence(0);
      if (!hasExplicitVoicePreferenceRef.current) {
        const defaultVoice = getDefaultVoiceForBook(book, voices);
        if (defaultVoice) setSelectedVoice(defaultVoice);
      }
      setSpeechError(null);
      // Haptics is optional feedback. Some Android devices/ROMs throw a
      // native NullPointerException here even after the PDF was imported.
      // Never report that optional failure as a PDF import failure.
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // The imported book is already saved; continue without haptics.
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The PDF could not be imported. Try exporting it again as a text-based PDF.';
      Alert.alert('Could not import PDF', message);
    } finally {
      setIsImporting(false);
    }
  };

  const openBook = (book: Book) => {
    Speech.stop();
    playbackRunRef.current += 1;
    isPlayingRef.current = false;
    setIsPlaying(false);
    setSpeechError(null);
    setActiveBookId(book.id);
    setCurrentSection(book.currentSection);
    setCurrentSentence(0);
  };

  const removeBook = async (id: string) => {
    if (activeBookId === id) {
      Speech.stop();
      playbackRunRef.current += 1;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setActiveBookId(null);
    }
    setBooks((current) => current.filter((book) => book.id !== id));
  };

  const selectVoice = async (voice: VoiceOption) => {
    hasExplicitVoicePreferenceRef.current = true;
    setSelectedVoice(voice);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ voiceId: voice.identifier, rate }));
  };

  const setRate = async (nextRate: number) => {
    setRateValue(nextRate);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ voiceId: selectedVoice?.identifier, rate: nextRate }));
  };

  const togglePlayback = () => {
    if (!activeBook || chunks.length === 0) return;
    const nextIsPlaying = !isPlayingRef.current;
    isPlayingRef.current = nextIsPlaying;
    setIsPlaying(nextIsPlaying);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const stopPlayback = () => {
    Speech.stop();
    playbackRunRef.current += 1;
    isPlayingRef.current = false;
    setIsPlaying(false);
  };

  const skipBy = (amount: number) => {
    if (!chunks.length) return;
    const next = Math.max(0, Math.min(chunks.length - 1, currentSentence + amount));
    setCurrentSentence(next);
    currentSentenceRef.current = next;
    setCurrentSection(chunks[next].sectionIndex);
    if (isPlaying) {
      Speech.stop();
      isPlayingRef.current = false;
      setIsPlaying(false);
      setTimeout(() => {
        isPlayingRef.current = true;
        setIsPlaying(true);
      }, 40);
    }
  };

  const value: LibraryContextValue = {
    books, activeBook, isHydrated, isImporting, selectedVoice, voices, rate,
    speechError,
    currentSection, currentSentence, isPlaying, importBook, openBook, removeBook,
    setRate, togglePlayback, stopPlayback, skipBy,
    selectVoice,
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider');
  return context;
}

export function getReadingProgress(book: Book, currentSection: number) {
  if (!book.sections.length) return 0;
  return Math.min(100, Math.round(((currentSection + 1) / book.sections.length) * 100));
}

export function getSectionLabel(section: ParsedSection | undefined) {
  return section?.kind === 'chapter' ? 'CHAPTER' : section?.kind === 'section' ? 'SECTION' : 'READING';
}
