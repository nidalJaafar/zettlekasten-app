import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { useAppStore } from '../src/store'
import { BG, TEXT, FONT } from '../src/theme'

export default function RootLayout() {
  const { initialized, initDb } = useAppStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDb().catch((err) => setError(err instanceof Error ? err.message : 'DB init failed'))
  }, [])

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: TEXT.primary }}>{error}</Text>
      </View>
    )
  }

  if (!initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={TEXT.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BG.base } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="trash"
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Trash',
          headerTintColor: TEXT.primary,
          headerStyle: { backgroundColor: BG.panel },
        }}
      />
      <Stack.Screen
        name="note/[id]"
        options={{
          headerShown: true,
          headerTitle: 'Note',
          headerTintColor: TEXT.primary,
          headerStyle: { backgroundColor: BG.panel },
        }}
      />
    </Stack>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base },
})
