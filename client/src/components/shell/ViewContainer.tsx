import type { FC } from 'react'
import { PlayerView } from '@/views/PlayerView'
import { HistoryView } from '@/views/HistoryView'
import { ProfileView } from '@/views/ProfileView'
import { SettingsView } from '@/views/SettingsView'

const VIEWS: Record<string, FC> = {
  player: PlayerView,
  history: HistoryView,
  profile: ProfileView,
  settings: SettingsView,
}

export function ViewContainer({ active }: { active: string }) {
  const View = VIEWS[active] ?? PlayerView
  return <View />
}
