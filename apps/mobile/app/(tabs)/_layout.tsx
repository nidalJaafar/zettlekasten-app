import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { BG, TEXT, FONT } from '../../src/theme'

export default function TabLayout() {
  return (
    <NativeTabs
      blurEffect="systemMaterialDark"
      backgroundColor={BG.panel}
      tintColor={TEXT.primary}
      labelStyle={{ color: TEXT.muted, fontFamily: FONT.ui, fontSize: 11, fontWeight: '500' }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon sf={{ default: 'square', selected: 'square.and.pencil' }} md="edit_note" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="library_books" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="graph">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="analytics" />
        <NativeTabs.Trigger.Label>Graph</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
