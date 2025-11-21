import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import * as Comlink from 'comlink'
import { getWorkerClient } from '@/lib/pglite-client'
import { isFeatureEnabled, FEATURES } from '@/lib/feature-flags'
import { useApiKey } from './ApiKeyContext'

interface Document {
  id: string
  filename: string
  content: string
  file_size: number
  mime_type: string
  uploaded_at: string
  chunk_count: number | null
  indexed_at: string | null
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null
  error_message: string | null
  retry_count: number | null
}

interface IndexingProgress {
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  stage: string
  message: string
  chunkCount?: number
  errorMessage?: string
  retryCount?: number
}

interface SearchResult {
  chunkId: string
  documentId: string
  filename: string
  heading: string | null
  content: string
  chunkIndex: number
  similarity: number
}

interface VectorDBContextType {
  initialized: boolean
  documents: Document[]
  uploadFiles: (files: File[]) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  refreshDocuments: () => Promise<void>
  indexingProgress: Map<string, IndexingProgress>
  retryFailed: (documentId: string) => Promise<void>
  searchVectors: (query: string, documentIds: string[]) => Promise<SearchResult[]>
}

const VectorDBContext = createContext<VectorDBContextType | undefined>(
  undefined
)

export function VectorDBProvider({ children }: { children: ReactNode }) {
  const { apiKey } = useApiKey()
  const [initialized, setInitialized] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [indexingProgress, _setIndexingProgress] = useState<Map<string, IndexingProgress>>(new Map())

  const worker = getWorkerClient()

  useEffect(() => {
    async function initializeWorker() {
      const MAX_RETRIES = 3
      let retryCount = 0

      while (retryCount < MAX_RETRIES) {
        try {
          // Subscribe to worker progress updates BEFORE init starts queue processor (Phase queue-processor)
          // Wrap callback with Comlink.proxy on MAIN thread (not in worker)
          await worker.onProgress(Comlink.proxy((progress: IndexingProgress) => {
            _setIndexingProgress(prev => new Map(prev).set(progress.documentId, progress))

            // Refresh documents to update UI with latest status
            if (progress.status === 'completed' || progress.status === 'failed') {
              refreshDocuments()
            }
          }))

          // Send initial feature flag state to worker
          const indexingEnabled = isFeatureEnabled(FEATURES.INDEXING_ENABLED)
          await worker.setIndexingEnabled(indexingEnabled)

          // Send OpenAI API key to worker (Phase embeddings)
          // Workers don't have access to localStorage/context, must pass explicitly
          await worker.setOpenAIKey(apiKey)

          // Init worker (this starts the queue processor)
          await worker.init()

          await refreshDocuments()
          setInitialized(true)

          // Expose worker state for debugging (test environment)
          if (typeof window !== 'undefined') {
            (window as any).__getWorkerState = () => worker.getWorkerState()
          }

          if (import.meta.env.DEV) {
            console.log('[VectorDB] Context initialized, indexing enabled:', indexingEnabled)
          }

          break // Success - exit retry loop
        } catch (error) {
          retryCount++
          console.error(`[VectorDB] Initialization error (attempt ${retryCount}/${MAX_RETRIES}):`, error)

          // Check for WASM-specific errors
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('WebAssembly') || errorMessage.includes('magic word')) {
            console.error('[VectorDB] WebAssembly compilation error detected. This may be due to:')
            console.error('  - WASM files not being served with correct MIME type')
            console.error('  - Browser cache corruption')
            console.error('  - Race condition in worker initialization')
            console.error('  Try: Clear browser cache, hard reload (Cmd+Shift+R), or restart browser')
          }

          if (errorMessage.includes('IndexedDB')) {
            console.error('[VectorDB] IndexedDB error detected. Try clearing IndexedDB storage:')
            console.error('  - Open DevTools > Application > Storage > IndexedDB')
            console.error('  - Delete "rag-vectors" database')
          }

          if (retryCount >= MAX_RETRIES) {
            console.error('[VectorDB] Failed to initialize after max retries. App may not function correctly.')
            // Could set an error state here to show user a recovery UI
          } else {
            console.log(`[VectorDB] Retrying initialization in ${retryCount}s...`)
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000))
          }
        }
      }
    }

    initializeWorker()
  }, [])

  // Listen for feature flag changes
  useEffect(() => {
    const handleFlagChange = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail.flag === 'FEATURE_INDEXING_ENABLED') {
        worker.setIndexingEnabled(customEvent.detail.enabled)

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Indexing enabled changed to:', customEvent.detail.enabled)
        }
      }
    }

    window.addEventListener('featureFlagChanged', handleFlagChange)
    return () => window.removeEventListener('featureFlagChanged', handleFlagChange)
  }, [worker])

  // Sync API key to worker whenever it changes (Phase embeddings)
  useEffect(() => {
    if (initialized) {
      worker.setOpenAIKey(apiKey)

      if (import.meta.env.DEV) {
        console.log('[VectorDB] OpenAI key', apiKey ? 'updated' : 'cleared')
      }
    }
  }, [apiKey, initialized, worker])

  const refreshDocuments = async () => {
    try {
      const docs = await worker.getDocuments()
      setDocuments(docs)

      if (import.meta.env.DEV) {
        console.log('[VectorDB] Documents refreshed:', docs.length)
      }
    } catch (error) {
      console.error('[VectorDB] Error refreshing documents:', error)
      throw error
    }
  }

  const uploadFiles = async (files: File[]) => {
    try {
      // Filter for valid file types
      const validFiles = files.filter(
        (file) =>
          file.name.endsWith('.md') || file.name.endsWith('.txt')
      )

      if (validFiles.length === 0) {
        console.log('[VectorDB] No valid files to upload')
        return
      }

      // Upload each file
      for (const file of validFiles) {
        const content = await file.text()
        const mimeType = file.name.endsWith('.md')
          ? 'text/markdown'
          : 'text/plain'

        await worker.uploadDocument({
          filename: file.name,
          content,
          mimeType,
        })

        if (import.meta.env.DEV) {
          console.log('[VectorDB] File uploaded:', file.name)
        }
      }

      // Refresh document list
      await refreshDocuments()

      // Trigger queue processing immediately (for better UX)
      await worker.triggerQueueProcessing()
    } catch (error) {
      console.error('[VectorDB] Error uploading files:', error)
      throw error
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      await worker.deleteDocument(id)

      if (import.meta.env.DEV) {
        console.log('[VectorDB] Document deleted:', id)
      }

      // Refresh document list
      await refreshDocuments()
    } catch (error) {
      console.error('[VectorDB] Error deleting document:', error)
      throw error
    }
  }

  const retryFailed = async (documentId: string) => {
    // Placeholder for now - will be implemented in later phase
    console.log('[VectorDB] Retry indexing for document:', documentId)
  }

  const searchVectors = async (query: string, documentIds: string[]): Promise<SearchResult[]> => {
    return await worker.searchVectors({ query, documentIds })
  }

  return (
    <VectorDBContext.Provider
      value={{
        initialized,
        documents,
        uploadFiles,
        deleteDocument,
        refreshDocuments,
        indexingProgress,
        retryFailed,
        searchVectors,
      }}
    >
      {children}
    </VectorDBContext.Provider>
  )
}

export function useVectorDB() {
  const context = useContext(VectorDBContext)
  if (context === undefined) {
    throw new Error('useVectorDB must be used within a VectorDBProvider')
  }
  return context
}

export type { SearchResult }
