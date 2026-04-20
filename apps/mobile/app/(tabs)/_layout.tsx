import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { BG, TEXT, FONT } from '../../src/theme'

export default function TabLayout() {
  return (
    <NativeTabs
      blurEffect="systemMaterialDark"
      backgroundColor={BG.panel}
      tintColor={TEXT.primary}
      labelStyle={{ color: TEXT.secondary, fontFamily: FONT.ui, fontSize: 11 }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house" md="home" />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon sf="square.and.pencil" md="edit" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon sf="book.fill" md="library_books" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="graph">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="analytics" />
        <NativeTabs.Trigger.Label>Graph</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
