import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Book, getReadingProgress, useLibrary } from '@/context/LibraryContext';

function MiniBook({ book, onPress }: { book: Book; onPress: () => void }) {
  const colors = useColors();
  const progress = getReadingProgress(book, book.currentSection);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bookRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 }]}>
      <View style={[styles.bookCover, { backgroundColor: colors.primary }]}>
        <Feather name="book-open" size={22} color={colors.primaryForeground} />
      </View>
      <View style={styles.bookRowCopy}>
        <Text numberOfLines={1} style={[styles.bookRowTitle, { color: colors.foreground }]}>{book.title}</Text>
        <Text style={[styles.bookRowMeta, { color: colors.mutedForeground }]}>{book.durationMinutes} min · {progress}% complete</Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.max(progress, 2)}%` }]} />
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books, activeBook, isImporting, importBook, openBook } = useLibrary();
  const [showVoiceTip, setShowVoiceTip] = useState(false);
  const privacyPolicyUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/privacy`
    : null;

  const handleImport = async () => {
    try {
      await importBook();
      router.push('/reader');
    } catch (error) {
      Alert.alert('Couldn’t import that PDF', error instanceof Error ? error.message : 'Please try another text-based PDF.');
    }
  };

  const continueReading = () => {
    if (!activeBook) return;
    openBook(activeBook);
    router.push('/reader');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 108 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>CHAPTER & VOICE</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>Read with your ears.</Text>
          </View>
          <View style={styles.iconButton} />
        </View>

        {showVoiceTip && (
          <View style={[styles.tip, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <Feather name="volume-2" size={17} color={colors.accentForeground} />
            <Text style={[styles.tipText, { color: colors.accentForeground }]}>Choose a narrator and reading speed from the player once a book is open.</Text>
          </View>
        )}

        {activeBook ? (
          <Pressable onPress={continueReading} style={({ pressed }) => [styles.continueCard, { backgroundColor: colors.foreground, opacity: pressed ? 0.92 : 1 }]}>
            <View style={styles.continueTop}>
              <View style={[styles.continueBadge, { backgroundColor: colors.primary }]}>
                <Feather name="headphones" size={14} color={colors.primaryForeground} />
                <Text style={styles.continueBadgeText}>NOW READING</Text>
              </View>
              <Feather name="arrow-up-right" size={20} color="#F7F3ED" />
            </View>
            <Text numberOfLines={2} style={styles.continueTitle}>{activeBook.title}</Text>
            <Text style={styles.continueMeta}>Continue at {activeBook.sections[activeBook.currentSection]?.title ?? 'the beginning'}</Text>
            <View style={styles.continueProgressTrack}>
              <View style={[styles.continueProgressFill, { backgroundColor: colors.primary, width: `${Math.max(getReadingProgress(activeBook, activeBook.currentSection), 4)}%` }]} />
            </View>
          </Pressable>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: colors.foreground }]}>
            <View style={[styles.heroOrb, { backgroundColor: colors.primary }]} />
            <Feather name="volume-2" size={22} color={colors.primary} />
            <Text style={styles.heroTitle}>A calmer way to finish a book.</Text>
            <Text style={styles.heroBody}>Import a PDF and let a natural voice carry you through every chapter, pause, and turning point.</Text>
          </View>
        )}

        <Pressable testID="import-pdf-button" onPress={handleImport} disabled={isImporting} style={({ pressed }) => [styles.importButton, { backgroundColor: colors.primary, opacity: pressed || isImporting ? 0.8 : 1 }]}>
          {isImporting ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="plus" size={19} color={colors.primaryForeground} />}
          <Text style={[styles.importButtonText, { color: colors.primaryForeground }]}>{isImporting ? 'Reading your PDF…' : 'Import a PDF book'}</Text>
        </Pressable>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your library</Text>
          {books.length > 0 && <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{books.length} {books.length === 1 ? 'book' : 'books'}</Text>}
        </View>

        {books.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="bookmark" size={19} color={colors.secondaryForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your next chapter starts here</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Imported books stay on this device, ready whenever you are.</Text>
          </View>
        ) : (
          <View style={styles.libraryList}>
            {books.slice(0, 3).map((book) => <MiniBook key={book.id} book={book} onPress={() => { openBook(book); router.push('/reader'); }} />)}
          </View>
        )}

        <View style={styles.legalLinks}>
          <Pressable
            onPress={() => {
              if (privacyPolicyUrl) {
                void Linking.openURL(privacyPolicyUrl);
              } else {
                Alert.alert('Privacy policy unavailable', 'The public privacy policy URL will be available in the production build.');
              }
            }}
            hitSlop={8}
          >
            <Text style={[styles.legalLink, { color: colors.primary }]}>Privacy policy</Text>
          </Pressable>
          <Text style={[styles.legalDivider, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.legalCopy, { color: colors.mutedForeground }]}>Import only content you are authorized to use.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  iconButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 13 },
  tipText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  heroCard: { minHeight: 224, borderRadius: 25, padding: 24, overflow: 'hidden', justifyContent: 'flex-end', gap: 10 },
  heroOrb: { position: 'absolute', width: 170, height: 170, borderRadius: 100, right: -35, top: -46, opacity: 0.95 },
  heroTitle: { color: '#F7F3ED', fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 33, maxWidth: 290, letterSpacing: -0.7 },
  heroBody: { color: '#D9D3CA', fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, maxWidth: 290 },
  continueCard: { borderRadius: 25, padding: 23, minHeight: 215, justifyContent: 'space-between' },
  continueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  continueBadge: { flexDirection: 'row', gap: 7, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  continueBadgeText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1 },
  continueTitle: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 27, lineHeight: 32, letterSpacing: -0.6, marginTop: 20 },
  continueMeta: { color: '#CFC8BF', fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 5 },
  continueProgressTrack: { height: 4, borderRadius: 4, backgroundColor: '#4A5355', overflow: 'hidden', marginTop: 20 },
  continueProgressFill: { height: '100%', borderRadius: 4 },
  importButton: { height: 56, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  importButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  sectionCount: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  emptyState: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, padding: 21, alignItems: 'center', gap: 9 },
  emptyIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 270 },
  libraryList: { gap: 11 },
  bookRow: { minHeight: 82, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 13 },
  bookCover: { width: 53, height: 58, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bookRowCopy: { flex: 1, gap: 5 },
  bookRowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  bookRowMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  progressTrack: { height: 3, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  progressFill: { height: '100%', borderRadius: 3 },
  legalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 4, paddingHorizontal: 10 },
  legalLink: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  legalDivider: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  legalCopy: { fontFamily: 'Inter_400Regular', fontSize: 10, flexShrink: 1, textAlign: 'center' },
});