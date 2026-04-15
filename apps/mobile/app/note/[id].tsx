import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { BG, TEXT, FONT } from '../../src/theme'

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Note: {id}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base },
  title: { color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 },
})
