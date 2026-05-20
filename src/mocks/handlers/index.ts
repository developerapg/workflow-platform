import { readHandlers } from './read'
import { persistHandlers } from './persist'
import { instanceHandlers } from './instances'
import { taskHandlers } from './tasks'
import { healthHandlers } from './health'

export const handlers = [
  ...healthHandlers,
  ...readHandlers,
  ...persistHandlers,
  ...instanceHandlers,
  ...taskHandlers,
]
