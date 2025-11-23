import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import OpenAI from 'openai';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModelCombobox } from '@/components/ui/model-combobox';
import { useApiKey } from '@/contexts/ApiKeyContext';
import { useVectorDB } from '@/contexts/VectorDBContext';
import { getOpenAIConfig } from '@/lib/feature-flags';

interface EditKBModalProps {
  kb: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    embedding_model: string;
    embedding_dimensions: number;
    chunk_max_tokens: number;
    chunk_overlap_tokens: number;
    hnsw_m: number;
    hnsw_ef_construction: number;
    document_count: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditKBModal({ kb, onClose, onSuccess }: EditKBModalProps) {
  const { updateKnowledgeBase, reindexKnowledgeBase } = useVectorDB();
  const { apiKey } = useApiKey();
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description || '');
  const [embeddingModel, setEmbeddingModel] = useState(kb.embedding_model);
  const [embeddingDimensions, setEmbeddingDimensions] = useState(String(kb.embedding_dimensions));
  const [chunkMaxTokens, setChunkMaxTokens] = useState(String(kb.chunk_max_tokens));
  const [chunkOverlapTokens, setChunkOverlapTokens] = useState(String(kb.chunk_overlap_tokens));
  const [hnswM, setHnswM] = useState(String(kb.hnsw_m));
  const [hnswEfConstruction, setHnswEfConstruction] = useState(String(kb.hnsw_ef_construction));
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReindexWarning, setShowReindexWarning] = useState(false);
  const [requiresReindex, setRequiresReindex] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const fetchModels = async () => {
    if (!apiKey) {
      toast.error('Please set your API key first');
      return;
    }

    setIsLoadingModels(true);
    try {
      const baseURL = getOpenAIConfig('BASE_URL');
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL || undefined,
        dangerouslyAllowBrowser: true,
      });
      const list = await openai.models.list();
      const modelIds = list.data.map((m) => m.id).sort();
      setModels(modelIds);
      toast.success('Models loaded successfully');
    } catch (err) {
      console.error('Failed to fetch models', err);
      toast.error('Failed to fetch models. Check your API key and base URL.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Detect if re-index is required
  useEffect(() => {
    const needsReindex =
      embeddingModel !== kb.embedding_model ||
      Number(embeddingDimensions) !== kb.embedding_dimensions ||
      Number(chunkMaxTokens) !== kb.chunk_max_tokens ||
      Number(chunkOverlapTokens) !== kb.chunk_overlap_tokens ||
      Number(hnswM) !== kb.hnsw_m ||
      Number(hnswEfConstruction) !== kb.hnsw_ef_construction;

    setRequiresReindex(needsReindex);
  }, [
    embeddingModel,
    embeddingDimensions,
    chunkMaxTokens,
    chunkOverlapTokens,
    hnswM,
    hnswEfConstruction,
    kb,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    const dimensions = parseInt(embeddingDimensions);
    if (isNaN(dimensions) || dimensions <= 0) {
      setError('Embedding dimensions must be a positive number');
      return;
    }

    const maxTokens = parseInt(chunkMaxTokens);
    if (isNaN(maxTokens) || maxTokens <= 0) {
      setError('Max tokens must be a positive number');
      return;
    }

    const overlapTokens = parseInt(chunkOverlapTokens);
    if (isNaN(overlapTokens) || overlapTokens < 0) {
      setError('Overlap tokens must be a non-negative number');
      return;
    }

    const m = parseInt(hnswM);
    if (isNaN(m) || m < 4 || m > 64) {
      setError('HNSW M must be between 4 and 64');
      return;
    }

    const efConstruction = parseInt(hnswEfConstruction);
    if (isNaN(efConstruction) || efConstruction < 16 || efConstruction > 256) {
      setError('HNSW ef_construction must be between 16 and 256');
      return;
    }

    // If re-index required, show warning
    if (requiresReindex && !showReindexWarning) {
      setShowReindexWarning(true);
      return;
    }

    setIsUpdating(true);
    try {
      // Apply updates
      await updateKnowledgeBase(kb.id, {
        name: trimmedName !== kb.name ? trimmedName : undefined,
        description: description !== (kb.description || '') ? description : undefined,
        config: {
          embedding_model: embeddingModel !== kb.embedding_model ? embeddingModel : undefined,
          embedding_dimensions: dimensions !== kb.embedding_dimensions ? dimensions : undefined,
          chunk_max_tokens: maxTokens !== kb.chunk_max_tokens ? maxTokens : undefined,
          chunk_overlap_tokens:
            overlapTokens !== kb.chunk_overlap_tokens ? overlapTokens : undefined,
          hnsw_m: m !== kb.hnsw_m ? m : undefined,
          hnsw_ef_construction:
            efConstruction !== kb.hnsw_ef_construction ? efConstruction : undefined,
        },
      });

      // Trigger re-index if needed
      if (requiresReindex) {
        await reindexKnowledgeBase(kb.id);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update knowledge base');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelReindex = () => {
    setShowReindexWarning(false);
  };

  // Show re-index warning dialog
  if (showReindexWarning) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        data-testid="dialog-reindex-warning"
      >
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Configuration Change Requires Re-Indexing
              </h2>
            </div>

            <div className="mb-6 space-y-4">
              <p className="text-gray-700">
                The following configuration changes require re-indexing all documents:
              </p>

              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                {embeddingModel !== kb.embedding_model && (
                  <li>
                    Embedding model: {kb.embedding_model} → {embeddingModel}
                  </li>
                )}
                {Number(embeddingDimensions) !== kb.embedding_dimensions && (
                  <li>
                    Dimensions: {kb.embedding_dimensions} → {embeddingDimensions}
                  </li>
                )}
                {Number(chunkMaxTokens) !== kb.chunk_max_tokens && (
                  <li>
                    Chunk max tokens: {kb.chunk_max_tokens} → {chunkMaxTokens}
                  </li>
                )}
                {Number(chunkOverlapTokens) !== kb.chunk_overlap_tokens && (
                  <li>
                    Chunk overlap: {kb.chunk_overlap_tokens} → {chunkOverlapTokens}
                  </li>
                )}
                {Number(hnswM) !== kb.hnsw_m && (
                  <li>
                    HNSW M: {kb.hnsw_m} → {hnswM}
                  </li>
                )}
                {Number(hnswEfConstruction) !== kb.hnsw_ef_construction && (
                  <li>
                    HNSW ef_construction: {kb.hnsw_ef_construction} → {hnswEfConstruction}
                  </li>
                )}
              </ul>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <p className="text-sm text-amber-800 font-medium mb-2">What will happen:</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>
                    • Chunks table will be dropped and recreated ({kb.document_count}{' '}
                    {kb.document_count === 1 ? 'document' : 'documents'} affected)
                  </li>
                  <li>• Documents will be temporarily unsearchable</li>
                  <li>• Sequential indexing will process all documents</li>
                  <li>• This may take several minutes</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCancelReindex}
                variant="outline"
                className="flex-1"
                data-testid="btn-cancel-reindex"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="btn-confirm-reindex"
              >
                Save & Re-Index
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main edit form
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="modal-edit-kb"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Edit Knowledge Base</h2>
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
                disabled={isUpdating}
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="kb-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
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
                disabled={isUpdating}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Embedding Configuration</h3>

              {/* Refresh Models Button */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Available Models
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchModels}
                  disabled={isLoadingModels || !apiKey}
                  data-testid="btn-refresh-embedding-models"
                  data-loading={isLoadingModels.toString()}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingModels ? 'animate-spin' : ''}`} />
                  {isLoadingModels ? 'Loading...' : 'Refresh Models'}
                </Button>
                <p className="mt-1 text-xs text-gray-500">Fetch models from OpenAI API</p>
              </div>

              {/* Embedding Model Dropdown */}
              {models.length > 0 && (
                <div>
                  <label
                    htmlFor="kb-embedding-model"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Embedding Model <span className="text-red-500">*</span>
                  </label>
                  <ModelCombobox
                    models={models}
                    value={embeddingModel}
                    onValueChange={setEmbeddingModel}
                    placeholder="Select embedding model..."
                    disabled={isUpdating}
                    testId="select-embedding-model"
                  />
                  <p className="mt-1 text-xs text-gray-500">OpenAI embedding model to use</p>
                </div>
              )}

              {/* Fallback text input when models not fetched */}
              {models.length === 0 && (
                <div>
                  <label
                    htmlFor="kb-embedding-model"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Embedding Model <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="kb-embedding-model"
                    data-testid="input-kb-embedding-model"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="e.g., text-embedding-3-small"
                    disabled={isUpdating}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    OpenAI embedding model to use (or refresh models above)
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="kb-embedding-dimensions"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                  disabled={isUpdating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Vector dimensions (e.g., 1536 for text-embedding-3-small)
                </p>
              </div>

              <div>
                <label
                  htmlFor="kb-chunk-max-tokens"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Chunk Max Tokens <span className="text-red-500">*</span>
                </label>
                <Input
                  id="kb-chunk-max-tokens"
                  data-testid="input-kb-chunk-max-tokens"
                  type="number"
                  min="1"
                  value={chunkMaxTokens}
                  onChange={(e) => setChunkMaxTokens(e.target.value)}
                  placeholder="2000"
                  disabled={isUpdating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum tokens per chunk (default: 2000)
                </p>
              </div>

              <div>
                <label
                  htmlFor="kb-chunk-overlap-tokens"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Chunk Overlap Tokens <span className="text-red-500">*</span>
                </label>
                <Input
                  id="kb-chunk-overlap-tokens"
                  data-testid="input-kb-chunk-overlap-tokens"
                  type="number"
                  min="0"
                  value={chunkOverlapTokens}
                  onChange={(e) => setChunkOverlapTokens(e.target.value)}
                  placeholder="200"
                  disabled={isUpdating}
                />
                <p className="mt-1 text-xs text-gray-500">Overlap between chunks (default: 200)</p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Advanced Configuration</h3>
              <p className="text-xs text-gray-600">
                HNSW index parameters (requires re-indexing if changed)
              </p>

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
                  disabled={isUpdating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Max connections per layer (range: 4-64, default: 16)
                </p>
              </div>

              <div>
                <label
                  htmlFor="kb-hnsw-ef-construction"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                  disabled={isUpdating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Dynamic candidate list size (range: 16-256, default: 64)
                </p>
              </div>
            </div>

            {requiresReindex && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-xs text-amber-800">
                  ⚠ Configuration changes require re-indexing all documents
                </p>
              </div>
            )}
          </div>

          <div className="border-t p-6 space-y-4 flex-shrink-0">
            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                disabled={isUpdating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="btn-update-kb-submit"
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? 'Updating...' : requiresReindex ? 'Update & Re-Index' : 'Update'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
