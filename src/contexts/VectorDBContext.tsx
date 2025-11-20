import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { getWorkerClient } from '@/lib/pglite-client'
import { isFeatureEnabled, FEATURES } from '@/lib/feature-flags'

interface Document {
  id: string
  filename: string
  content: string
  file_size: number
  mime_type: string
  uploaded_at: string
}

interface VectorDBContextType {
  initialized: boolean
  documents: Document[]
  uploadFiles: (files: File[]) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  refreshDocuments: () => Promise<void>
}

const VectorDBContext = createContext<VectorDBContextType | undefined>(
  undefined
)

export function VectorDBProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])

  const worker = getWorkerClient()

  useEffect(() => {
    async function initializeWorker() {
      try {
        await worker.init()

        // Send initial feature flag state to worker
        const indexingEnabled = isFeatureEnabled(FEATURES.INDEXING_ENABLED)
        await worker.setIndexingEnabled(indexingEnabled)

        await refreshDocuments()
        setInitialized(true)

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Context initialized, indexing enabled:', indexingEnabled)
        }
      } catch (error) {
        console.error('[VectorDB] Initialization error:', error)
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

  return (
    <VectorDBContext.Provider
      value={{
        initialized,
        documents,
        uploadFiles,
        deleteDocument,
        refreshDocuments,
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
