import { Tabs } from 'expo-router'
import { glassStyle, TEXT, FONT } from '../../src/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TEXT.primary,
        tabBarInactiveTintColor: TEXT.muted,
        tabBarLabelStyle: { fontFamily: FONT.ui, fontSize: 11 },
        tabBarStyle: [glassStyle.tabBar, { position: 'absolute' }],
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="workspace" options={{ title: 'Editor' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="graph" options={{ title: 'Graph' }} />
    </Tabs>
  )
}
