import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVectorDB } from '@/contexts/VectorDBContext'

interface CreateKBModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateKBModal({ onClose, onSuccess }: CreateKBModalProps) {
  const { createKnowledgeBase } = useVectorDB()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small')
  const [embeddingDimensions, setEmbeddingDimensions] = useState('1536')
  const [hnswM, setHnswM] = useState('16')
  const [hnswEfConstruction, setHnswEfConstruction] = useState('64')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }

    if (trimmedName.length > 50) {
      setError('Name must be 50 characters or less')
      return
    }

    const trimmedModel = embeddingModel.trim()
    if (!trimmedModel) {
      setError('Embedding model is required')
      return
    }

    const dimensions = parseInt(embeddingDimensions)
    if (isNaN(dimensions) || dimensions <= 0) {
      setError('Embedding dimensions must be a positive number')
      return
    }

    const m = parseInt(hnswM)
    if (isNaN(m) || m < 4 || m > 64) {
      setError('HNSW M must be between 4 and 64')
      return
    }

    const efConstruction = parseInt(hnswEfConstruction)
    if (isNaN(efConstruction) || efConstruction < 16 || efConstruction > 256) {
      setError('HNSW ef_construction must be between 16 and 256')
      return
    }

    setIsCreating(true)
    try {
      await createKnowledgeBase({
        name: trimmedName,
        description: description.trim() || undefined,
        config: {
          embedding_model: trimmedModel,
          embedding_dimensions: dimensions,
          hnsw_m: m,
          hnsw_ef_construction: efConstruction
        }
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge base')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-create-kb">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">New Knowledge Base</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto p-6 space-y-4">
            <div>
            <label htmlFor="kb-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="kb-name"
              data-testid="input-kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., React Documentation"
              maxLength={50}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="kb-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="kb-description"
              data-testid="textarea-kb-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this knowledge base"
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Embedding Configuration</h3>

            <div>
              <label htmlFor="kb-embedding-model" className="block text-sm font-medium text-gray-700 mb-1">
                Embedding Model <span className="text-red-500">*</span>
              </label>
              <Input
                id="kb-embedding-model"
                data-testid="input-kb-embedding-model"
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                placeholder="e.g., text-embedding-3-small"
                disabled={isCreating}
              />
              <p className="mt-1 text-xs text-gray-500">OpenAI embedding model to use</p>
            </div>

            <div>
              <label htmlFor="kb-embedding-dimensions" className="block text-sm font-medium text-gray-700 mb-1">
                Embedding Dimensions <span className="text-red-500">*</span>
              </label>
              <Input
                id="kb-embedding-dimensions"
                data-testid="input-kb-embedding-dimensions"
                type="number"
                min="1"
                value={embeddingDimensions}
                onChange={(e) => setEmbeddingDimensions(e.target.value)}
                placeholder="1536"
                disabled={isCreating}
              />
              <p className="mt-1 text-xs text-gray-500">Vector dimensions (e.g., 1536 for text-embedding-3-small)</p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Advanced Configuration</h3>
            <p className="text-xs text-gray-600">HNSW index parameters (requires re-indexing if changed later)</p>

            <div>
              <label htmlFor="kb-hnsw-m" className="block text-sm font-medium text-gray-700 mb-1">
                HNSW M <span className="text-red-500">*</span>
              </label>
              <Input
                id="kb-hnsw-m"
                data-testid="input-kb-hnsw-m"
                type="number"
                min="4"
                max="64"
                value={hnswM}
                onChange={(e) => setHnswM(e.target.value)}
                placeholder="16"
                disabled={isCreating}
              />
              <p className="mt-1 text-xs text-gray-500">Max connections per layer (range: 4-64, default: 16)</p>
            </div>

            <div>
              <label htmlFor="kb-hnsw-ef-construction" className="block text-sm font-medium text-gray-700 mb-1">
                HNSW ef_construction <span className="text-red-500">*</span>
              </label>
              <Input
                id="kb-hnsw-ef-construction"
                data-testid="input-kb-hnsw-ef-construction"
                type="number"
                min="16"
                max="256"
                value={hnswEfConstruction}
                onChange={(e) => setHnswEfConstruction(e.target.value)}
                placeholder="64"
                disabled={isCreating}
              />
              <p className="mt-1 text-xs text-gray-500">Dynamic candidate list size (range: 16-256, default: 64)</p>
            </div>
            </div>
          </div>

          <div className="border-t p-6 space-y-4 flex-shrink-0">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="btn-create-kb-submit"
              disabled={isCreating}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
