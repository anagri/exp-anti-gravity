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

    setIsCreating(true)
    try {
      await createKnowledgeBase({
        name: trimmedName,
        description: description.trim() || undefined,
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">New Knowledge Base</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
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
        </form>
      </div>
    </div>
  )
}
