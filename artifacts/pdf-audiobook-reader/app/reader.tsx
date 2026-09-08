import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSectionLabel, useLibrary, VoiceOption } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

const speedOptions = [0.78, 0.92, 1.06, 1.2];

export default function ReaderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeBook, selectedVoice, voices, rate, currentSection, currentSentence, isPlaying, speechError, togglePlayback, stopPlayback, skipBy, selectVoice, setRate } = useLibrary();
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [speedSheetOpen, setSpeedSheetOpen] = useState(false);

  const section = activeBook?.sections[currentSection];
  const readableText = useMemo(() => section?.text ?? '', [section?.text]);
  const sectionSentenceOffset = activeBook
    ? activeBook.sections.slice(0, currentSection).reduce((count, item) => count + (item.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length ?? 0), 0)
    : 0;
  const sentencePreview = useMemo(() => {
    const sentences = readableText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
    const localSentence = Math.max(0, currentSentence - sectionSentenceOffset);
    return sentences.slice(Math.max(0, localSentence - 2), localSentence + 3).map((item) => item.trim());
  }, [currentSentence, readableText, sectionSentenceOffset]);

  if (!activeBook) {
    return <View style={[styles.emptyScreen, { backgroundColor: colors.background }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Open a book to start listening.</Text><Pressable onPress={() => router.back()}><Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text></Pressable></View>;
  }

  const progress = Math.min(100, Math.round(((currentSection + 1) / activeBook.sections.length) * 100));
  const narratorName = selectedVoice?.name ?? 'System voice';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => { stopPlayback(); router.back(); }} hitSlop={12} style={styles.topButton}><Feather name="chevron-down" size={25} color={colors.foreground} /></Pressable>
        <Text style={[styles.topLabel, { color: colors.mutedForeground }]}>LISTENING</Text>
        <Pressable onPress={() => setVoiceSheetOpen(true)} hitSlop={12} style={styles.topButton}><Feather name="sliders" size={19} color={colors.foreground} /></Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
        <View style={styles.bookHeader}>
          <View style={[styles.largeCover, { backgroundColor: colors.primary }]}><Feather name="book-open" size={31} color={colors.primaryForeground} /></View>
          <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.foreground }]}>{activeBook.title}</Text>
          <Text style={[styles.bookMeta, { color: colors.mutedForeground }]}>{activeBook.author} · {activeBook.durationMinutes} min read</Text>
        </View>

        <View style={[styles.progressRow, { backgroundColor: colors.secondary }]}>
          <View style={styles.progressCopy}><Text style={[styles.progressTitle, { color: colors.secondaryForeground }]}>{section?.title ?? 'Opening pages'}</Text><Text style={[styles.progressMeta, { color: colors.mutedForeground }]}>{progress}% complete</Text></View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.max(progress, 2)}%` }]} /></View>
        </View>

        <View style={[styles.readingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>{getSectionLabel(section)}</Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section?.title}</Text>
          <Text style={[styles.readingText, { color: colors.foreground }]}>
            {sentencePreview.length > 0 ? sentencePreview.map((sentence, index) => <Text key={`${sentence}-${index}`} style={index === Math.min(2, sentencePreview.length - 1) ? styles.currentSentence : undefined}>{sentence}{' '}</Text>) : readableText}
          </Text>
          <View style={[styles.structureNote, { backgroundColor: colors.accent }]}>
            <Feather name="check-circle" size={15} color={colors.accentForeground} />
            <Text style={[styles.structureNoteText, { color: colors.accentForeground }]}>Pauses tuned for punctuation and paragraph breaks</Text>
          </View>
        </View>

        <View style={styles.player}>
          <View style={styles.playerMeta}><Text style={[styles.playerEyebrow, { color: colors.primary }]}>NARRATOR</Text><Text numberOfLines={1} style={[styles.playerVoice, { color: colors.foreground }]}>{narratorName}</Text></View>
          <View style={styles.controls}>
            <Pressable testID="skip-back-button" onPress={() => skipBy(-1)} style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.55 : 1 }]}><Feather name="rotate-ccw" size={20} color={colors.foreground} /><Text style={[styles.skipText, { color: colors.foreground }]}>15</Text></Pressable>
            <Pressable testID="play-button" onPress={togglePlayback} style={({ pressed }) => [styles.playButton, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.94 : 1 }] }]}><Feather name={isPlaying ? 'pause' : 'play'} size={27} color={colors.primaryForeground} style={isPlaying ? undefined : { marginLeft: 3 }} /></Pressable>
            <Pressable testID="skip-forward-button" onPress={() => skipBy(1)} style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.55 : 1 }]}><Feather name="rotate-cw" size={20} color={colors.foreground} /><Text style={[styles.skipText, { color: colors.foreground }]}>15</Text></Pressable>
          </View>
          {speechError && (
            <View style={[styles.audioError, { backgroundColor: colors.accent }]}>
              <Feather name="volume-x" size={16} color={colors.accentForeground} />
              <Text style={[styles.audioErrorText, { color: colors.accentForeground }]}>{speechError}</Text>
            </View>
          )}
          <View style={styles.optionsRow}>
            <Pressable onPress={() => setVoiceSheetOpen(true)} style={[styles.option, { backgroundColor: colors.secondary }]}><Feather name="mic" size={15} color={colors.secondaryForeground} /><Text numberOfLines={1} style={[styles.optionText, { color: colors.secondaryForeground }]}>{narratorName}</Text><Feather name="chevron-down" size={14} color={colors.mutedForeground} /></Pressable>
            <Pressable onPress={() => setSpeedSheetOpen(true)} style={[styles.optionSmall, { backgroundColor: colors.secondary }]}><Text style={[styles.optionText, { color: colors.secondaryForeground }]}>{rate.toFixed(2)}×</Text></Pressable>
          </View>
        </View>
      </ScrollView>

       <VoiceSheet visible={voiceSheetOpen} voices={voices} selectedVoice={selectedVoice} onClose={() => setVoiceSheetOpen(false)} onSelect={(voice) => { void selectVoice(voice); setVoiceSheetOpen(false); void Haptics.selectionAsync(); }} />
      <SpeedSheet visible={speedSheetOpen} rate={rate} onClose={() => setSpeedSheetOpen(false)} onSelect={(nextRate) => { void setRate(nextRate); setSpeedSheetOpen(false); }} />
    </View>
  );
}

function VoiceSheet({ visible, voices, selectedVoice, onClose, onSelect }: { visible: boolean; voices: VoiceOption[]; selectedVoice: VoiceOption | null; onClose: () => void; onSelect: (voice: VoiceOption) => void }) {
  const colors = useColors();
  const spanishVoices = voices.filter((voice) => voice.language.toLowerCase().startsWith('es'));
  const renderVoice = (voice: VoiceOption) => <Pressable key={voice.identifier} onPress={() => onSelect(voice)} style={[styles.voiceRow, { borderBottomColor: colors.border }]}><View style={[styles.voiceIcon, { backgroundColor: selectedVoice?.identifier === voice.identifier ? colors.primary : colors.secondary }]}><Feather name="mic" size={16} color={selectedVoice?.identifier === voice.identifier ? colors.primaryForeground : colors.secondaryForeground} /></View><View style={styles.voiceCopy}><Text style={[styles.voiceName, { color: colors.foreground }]}>{voice.name}</Text><Text style={[styles.voiceMeta, { color: colors.mutedForeground }]}>{voice.language} {voice.quality ? `· ${voice.quality}` : ''}</Text></View>{selectedVoice?.identifier === voice.identifier && <Feather name="check" size={19} color={colors.primary} />}</Pressable>;
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.sheet, { backgroundColor: colors.background }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>NARRATOR</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Choose a voice</Text></View><Pressable onPress={onClose} hitSlop={12}><Feather name="x" size={21} color={colors.foreground} /></Pressable></View><Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>Choose from the voices installed on your device. Device narration keeps your imported book on this device.</Text>{spanishVoices.length === 0 && <Text style={[styles.voiceHint, { color: colors.mutedForeground }]}>No Spanish voice is installed yet. Download one in your device’s speech settings and reopen this picker.</Text>}<ScrollView style={styles.voiceList}><Text style={[styles.listLabel, { color: colors.primary }]}>DEVICE VOICES</Text>{voices.map(renderVoice)}</ScrollView>{voices.length === 0 && <Text style={[styles.noVoices, { color: colors.mutedForeground }]}>Your device voices will appear here when available.</Text>}</View></View></Modal>;
}

function SpeedSheet({ visible, rate, onClose, onSelect }: { visible: boolean; rate: number; onClose: () => void; onSelect: (rate: number) => void }) {
  const colors = useColors();
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.speedSheet, { backgroundColor: colors.background }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>PACE</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Reading speed</Text></View><Pressable onPress={onClose} hitSlop={12}><Feather name="x" size={21} color={colors.foreground} /></Pressable></View><View style={styles.speedList}>{speedOptions.map((speed) => <Pressable key={speed} onPress={() => onSelect(speed)} style={[styles.speedRow, { backgroundColor: rate === speed ? colors.primary : colors.secondary }]}><Text style={[styles.speedValue, { color: rate === speed ? colors.primaryForeground : colors.secondaryForeground }]}>{speed.toFixed(2)}×</Text><Text style={[styles.speedLabel, { color: rate === speed ? '#F7F3ED' : colors.mutedForeground }]}>{speed < 0.9 ? 'Slow and spacious' : speed > 1.1 ? 'Quick listen' : 'Natural pace'}</Text>{rate === speed && <Feather name="check" size={17} color={colors.primaryForeground} />}</Pressable>)}</View></View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  topButton: { width: 32, alignItems: 'center' },
  topLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8 },
  content: { paddingHorizontal: 20, gap: 20 },
  bookHeader: { alignItems: 'center', paddingTop: 7 },
  largeCover: { width: 88, height: 106, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  bookTitle: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 31, textAlign: 'center', letterSpacing: -0.5 },
  bookMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 7 },
  progressRow: { borderRadius: 16, padding: 14, gap: 10 },
  progressCopy: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  progressTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, maxWidth: '75%' },
  progressMeta: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  readingCard: { borderWidth: 1, borderRadius: 21, padding: 20, gap: 9 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.7 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 26 },
  readingText: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 27, marginTop: 8 },
  currentSentence: { color: '#C9894B', fontFamily: 'Inter_600SemiBold' },
  structureNote: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 11, marginTop: 7 },
  structureNoteText: { fontFamily: 'Inter_500Medium', fontSize: 11, flex: 1 },
  player: { gap: 15, paddingTop: 2 },
  playerMeta: { alignItems: 'center', gap: 5 },
  playerEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  playerVoice: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 39 },
  playButton: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  skipButton: { width: 39, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  skipText: { fontFamily: 'Inter_700Bold', fontSize: 9, position: 'absolute', top: 17 },
  audioError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 11 },
  audioErrorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  optionsRow: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, height: 44, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionSmall: { height: 44, minWidth: 72, paddingHorizontal: 13, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, flex: 1 },
  emptyScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  backLink: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23,32,42,0.45)', justifyContent: 'flex-end' },
  sheet: { minHeight: '56%', maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 35 },
  speedSheet: { minHeight: '42%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 35 },
  sheetHandle: { width: 38, height: 4, borderRadius: 5, backgroundColor: '#D2C7B9', alignSelf: 'center', marginBottom: 21 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.5 },
  sheetBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 9, marginBottom: 12 },
  voiceList: { marginTop: 2 },
  voiceRow: { minHeight: 69, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  voiceCopy: { flex: 1, gap: 4 },
  voiceName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  voiceMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  voiceHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  listLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4, marginTop: 15, marginBottom: 2 },
  noVoices: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 25, textAlign: 'center' },
  speedList: { gap: 10, marginTop: 24 },
  speedRow: { height: 58, borderRadius: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  speedValue: { fontFamily: 'Inter_700Bold', fontSize: 15, width: 49 },
  speedLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
});