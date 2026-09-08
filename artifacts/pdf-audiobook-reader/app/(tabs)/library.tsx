import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Book, getReadingProgress, useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books, openBook, removeBook } = useLibrary();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 104 }]}
        ListHeaderComponent={<View style={styles.header}><Text style={[styles.eyebrow, { color: colors.primary }]}>COLLECTION</Text><Text style={[styles.title, { color: colors.foreground }]}>Your library</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Every book, ready when you are.</Text></View>}
        ListEmptyComponent={<View style={[styles.empty, { borderColor: colors.border }]}><Feather name="book" size={25} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No books yet</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Import a PDF from Home to build your personal listening shelf.</Text></View>}
        renderItem={({ item }) => <LibraryRow book={item} onOpen={() => { openBook(item); router.push('/reader'); }} onDelete={() => Alert.alert('Remove this book?', 'The PDF will be removed from your local library.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void removeBook(item.id) }])} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function LibraryRow({ book, onOpen, onDelete }: { book: Book; onOpen: () => void; onDelete: () => void }) {
  const colors = useColors();
  const progress = getReadingProgress(book, book.currentSection);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 }]}>
      <View style={[styles.cover, { backgroundColor: colors.primary }]}><Feather name="book-open" size={23} color={colors.primaryForeground} /></View>
      <View style={styles.copy}><Text numberOfLines={2} style={[styles.bookTitle, { color: colors.foreground }]}>{book.title}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{book.wordCount.toLocaleString()} words · {book.durationMinutes} min</Text><View style={[styles.track, { backgroundColor: colors.secondary }]}><View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.max(progress, 2)}%` }]} /></View></View>
      <Pressable accessibilityLabel={`Remove ${book.title}`} onPress={onDelete} hitSlop={12} style={styles.delete}><Feather name="more-horizontal" size={20} color={colors.mutedForeground} /></Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 13 },
  header: { paddingTop: 18, paddingBottom: 10 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 8 },
  row: { minHeight: 103, borderWidth: 1, borderRadius: 20, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  cover: { width: 64, height: 72, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 6 },
  bookTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  track: { height: 3, borderRadius: 3, overflow: 'hidden', marginTop: 3 },
  fill: { height: '100%', borderRadius: 3 },
  delete: { alignSelf: 'flex-start', paddingTop: 2 },
  empty: { minHeight: 220, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, marginTop: 18 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 270 },
});