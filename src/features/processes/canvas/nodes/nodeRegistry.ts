import { User, Terminal, GitBranch, Circle, AlertTriangle } from 'lucide-react'
import type { NodeType } from '@/api/types'


export const NODE_COLOR: Record<string, string> = {
  start:              '#10b981',
  human_task:         '#2563eb',
  script_task:        '#8b5cf6',
  exclusive_gateway:  '#f59e0b',
  end:                '#ef4444',
}

export const NODE_LABEL: Record<string, string> = {
  start:             'Inicio',
  human_task:        'Tarea humana',
  script_task:       'Script',
  exclusive_gateway: 'Gateway',
  end:               'Fin',
}

export const PALETTE_ITEMS: { type: NodeType; mvp?: boolean }[] = [
  { type: 'start' },
  { type: 'human_task' },
  { type: 'script_task',        mvp: true },
  { type: 'exclusive_gateway',  mvp: true },
  { type: 'end' },
]

export { User, Terminal, GitBranch, Circle, AlertTriangle }
