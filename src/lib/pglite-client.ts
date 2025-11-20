import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { PGliteWorkerAPI } from '@/workers/pglite.worker'

let workerInstance: Worker | null = null
let apiInstance: Remote<PGliteWorkerAPI> | null = null

/**
 * Get or create the PGlite worker client instance (singleton pattern)
 *
 * @returns Remote proxy to the PGlite worker API
 */
export function getWorkerClient(): Remote<PGliteWorkerAPI> {
  if (!apiInstance) {
    workerInstance = new Worker(
      new URL('../workers/pglite.worker.ts', import.meta.url),
      { type: 'module' }
    )
    apiInstance = Comlink.wrap<PGliteWorkerAPI>(workerInstance)

    if (import.meta.env.DEV) {
      console.log('[PGlite Client] Worker instance created')
    }
  }
  return apiInstance
}

/**
 * Terminate the worker and clean up references
 *
 * Use this for cleanup when the worker is no longer needed
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
    apiInstance = null

    if (import.meta.env.DEV) {
      console.log('[PGlite Client] Worker terminated')
    }
  }
}
