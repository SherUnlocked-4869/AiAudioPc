import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
}

interface TabNavProps {
  tabs: Tab[]
  activeId: string
  onTabChange: (id: string) => void
}

export function TabNav({ tabs, activeId, onTabChange }: TabNavProps) {
  return (
    <nav className="my-4 flex gap-2">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 cursor-pointer rounded-lg border px-3 py-3 transition-colors',
              active
                ? 'border-accent bg-panel-2 text-accent'
                : 'border-border bg-panel text-muted',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
