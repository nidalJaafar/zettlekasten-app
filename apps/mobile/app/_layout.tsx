import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { ThemeProvider, DarkTheme } from '@react-navigation/native'
import { useAppStore } from '../src/store'
import { BG, TEXT } from '../src/theme'

if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }) as `${string}-${string}-${string}-${string}-${string}`
}

export default function RootLayout() {
  const { initialized, initDb } = useAppStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDb().catch((err) => setError(err instanceof Error ? err.message : 'DB init failed'))
  }, [])

  if (error) {
    return (
      <ThemeProvider value={DarkTheme}>
        <View style={styles.center}>
          <Text style={{ color: TEXT.primary }}>{error}</Text>
        </View>
      </ThemeProvider>
    )
  }

  if (!initialized) {
    return (
      <ThemeProvider value={DarkTheme}>
        <View style={styles.center}>
          <ActivityIndicator color={TEXT.primary} />
        </View>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BG.base } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="workspace"
          options={{
            headerShown: false,
          }}
        />
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
        <Stack.Screen
          name="source-picker"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            headerShown: true,
            headerTitle: 'Select Source',
            headerTintColor: TEXT.primary,
            headerStyle: { backgroundColor: BG.panel },
          }}
        />
        <Stack.Screen
          name="link-picker"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            headerShown: true,
            headerTitle: 'Link Notes',
            headerTintColor: TEXT.primary,
            headerStyle: { backgroundColor: BG.panel },
          }}
        />
      </Stack>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base },
})
