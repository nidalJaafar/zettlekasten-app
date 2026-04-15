import { NativeTabs, Label } from 'expo-router/unstable-native-tabs'
import { BG, TEXT } from '../../src/theme'

export default function TabLayout() {
  return (
    <NativeTabs
      blurEffect="systemMaterialDark"
      backgroundColor={BG.base}
      tintColor={TEXT.primary}
    >
      <NativeTabs.Trigger name="index" options={{ backgroundColor: BG.base }}>
        <Label>Inbox</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workspace" options={{ backgroundColor: BG.base }}>
        <Label>Editor</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" options={{ backgroundColor: BG.base }}>
        <Label>Library</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="graph" options={{ backgroundColor: BG.base }}>
        <Label>Graph</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
