import { View, Text, StyleSheet } from 'react-native'
import { BG, TEXT, FONT } from '../src/theme'

export default function TrashScreen() {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Trash</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base },
  title: { color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 },
})
