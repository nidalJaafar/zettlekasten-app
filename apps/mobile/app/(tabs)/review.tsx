import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BG, TEXT, FONT } from '../../src/theme'

export default function ReviewScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.base }}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Review</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Select a note from Inbox to start Review</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
    textAlign: 'center',
  },
})
