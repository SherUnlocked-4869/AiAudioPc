import { useState } from 'react'
import { InteractiveDots } from '@/components/ui/interactive-dots'
import { TopBar } from '@/components/shell/TopBar'
import { TabNav, type Tab } from '@/components/shell/TabNav'
import { ViewContainer } from '@/components/shell/ViewContainer'
import { useClaudioContext } from '@/hooks/useClaudio'

const TABS: Tab[] = [
  { id: 'player', label: 'Player' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [active, setActive] = useState('player')
  const { audioAnalyser, isOnline } = useClaudioContext()

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <InteractiveDots
          dotColor="#d4a853"
          dotSize={30}
          audioAnalyser={audioAnalyser ?? undefined}
        />
      </div>
      <div className="relative z-10 mx-auto max-w-[900px] p-4">
        <TopBar online={isOnline} />
        <TabNav tabs={TABS} activeId={active} onTabChange={setActive} />
        <ViewContainer active={active} />
      </div>
    </div>
  )
}
