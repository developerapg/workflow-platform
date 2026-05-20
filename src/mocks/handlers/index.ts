import type { RequestHandler } from 'msw'

// Handlers will be added per-phase.
// Each feature module registers its own handlers here.
export const handlers: RequestHandler[] = []
