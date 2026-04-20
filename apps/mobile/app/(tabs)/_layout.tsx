import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { BG, TEXT } from '../../src/theme'

export default function TabLayout() {
  return (
    <NativeTabs
      blurEffect="systemMaterialDark"
      backgroundColor={BG.panel}
      tintColor={TEXT.primary}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="graph">
        <NativeTabs.Trigger.Label>Graph</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
