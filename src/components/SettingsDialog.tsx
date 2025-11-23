/**
 * Settings dialog component for feature flags, OpenAI config, and search settings
 * E2E: e2e/pages/shared/SettingsComponent.ts
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Settings, X } from 'lucide-react';
import OpenAI from 'openai';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModelCombobox } from '@/components/ui/model-combobox';
import { useApiKey } from '@/contexts/ApiKeyContext';
import {
  SearchSettings,
  getAllFeatureFlags,
  getAllOpenAIConfig,
  getAllSearchSettings,
  getOpenAIConfig,
  setFeatureFlag,
  setOpenAIConfig,
  setSearchSetting,
} from '@/lib/feature-flags';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchSettingConfig {
  key: keyof SearchSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
}

const SEARCH_SETTING_CONFIGS: SearchSettingConfig[] = [
  {
    key: 'VECTOR_TOP_K',
    label: 'Vector Top K',
    description: 'Number of vector search results',
    min: 1,
    max: 20,
    step: 1,
  },
  {
    key: 'SIMILARITY_THRESHOLD',
    label: 'Similarity Threshold',
    description: 'Cosine similarity cutoff (0-1)',
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: 'BM25_LIMIT',
    label: 'BM25 Result Limit',
    description: 'Number of BM25 results',
    min: 1,
    max: 50,
    step: 1,
  },
];

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { apiKey, setApiKey: setApiKeyContext } = useApiKey();
  const [featureFlags, setFeatureFlagsState] = useState(getAllFeatureFlags());
  const [searchSettings, setSearchSettingsState] = useState(getAllSearchSettings());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // OpenAI Configuration state
  const [openaiConfig, setOpenaiConfigState] = useState(getAllOpenAIConfig());
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Refresh config state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setOpenaiConfigState(getAllOpenAIConfig());
      setLocalApiKey(apiKey || '');
      setSearchSettingsState(getAllSearchSettings());
      setFeatureFlagsState(getAllFeatureFlags());
    }
  }, [isOpen, apiKey]);

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

  if (!isOpen) return null;

  const handleToggle = (flagName: string) => {
    const currentValue = featureFlags[flagName as keyof typeof featureFlags];
    const newValue = !currentValue;

    setFeatureFlag(flagName, newValue);
    setFeatureFlagsState({ ...featureFlags, [flagName]: newValue });
  };

  const handleSearchSettingChange = (key: keyof SearchSettings, value: string) => {
    const numValue = parseFloat(value);
    const config = SEARCH_SETTING_CONFIGS.find((c) => c.key === key);

    if (!config) return;

    const newErrors = { ...errors };

    if (isNaN(numValue)) {
      newErrors[key] = 'Invalid number';
    } else if (numValue < config.min || numValue > config.max) {
      newErrors[key] = `Value must be between ${config.min} and ${config.max}`;
    } else {
      delete newErrors[key];
      setSearchSetting(key, numValue);
      setSearchSettingsState({ ...searchSettings, [key]: numValue });
    }

    setErrors(newErrors);
  };

  const handleSaveApiKey = () => {
    setApiKeyContext(localApiKey);
  };

  const handleBaseURLChange = (value: string) => {
    setOpenAIConfig('BASE_URL', value || undefined);
    setOpenaiConfigState({ ...openaiConfig, BASE_URL: value || undefined });
  };

  const handleChatModelChange = (value: string) => {
    setOpenAIConfig('CHAT_MODEL', value);
    setOpenaiConfigState({ ...openaiConfig, CHAT_MODEL: value });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="div-settings-modal"
    >
      <div className="bg-white border rounded-lg p-6 max-w-3xl w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center">
            <Settings className="w-6 h-6 text-gray-700 mr-3" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="btn-close-settings"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* OpenAI Configuration Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3">OpenAI Configuration</h3>
          <p className="text-xs text-gray-600 mb-4">
            Configure your OpenAI API settings (also editable on welcome page)
          </p>

          <div className="space-y-4">
            {/* API Key */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <label htmlFor="api-key" className="text-sm font-medium text-gray-900 block mb-1">
                  API Key
                </label>
                <p className="text-xs text-gray-600">Your OpenAI API key</p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    data-testid="input-openai-api-key"
                    placeholder="sk-..."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3"
                    data-testid="btn-toggle-api-key-visibility"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveApiKey}
                  data-testid="btn-save-api-key"
                  disabled={localApiKey === apiKey}
                >
                  Save API Key
                </Button>
              </div>
            </div>

            {/* Base URL */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <label htmlFor="base-url" className="text-sm font-medium text-gray-900 block mb-1">
                  Base URL (Optional)
                </label>
                <p className="text-xs text-gray-600">For Azure OpenAI or proxy endpoints</p>
              </div>
              <Input
                id="base-url"
                type="text"
                value={openaiConfig.BASE_URL || ''}
                onChange={(e) => handleBaseURLChange(e.target.value)}
                data-testid="input-openai-base-url"
                placeholder="https://api.openai.com/v1 (default)"
              />
            </div>

            {/* Credential Change Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-900">
                <strong>Note:</strong> Changing API key or base URL does not require re-indexing
                knowledge bases if the same embedding model is available at the new endpoint.
              </p>
            </div>

            {/* Refresh Models Button */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-1">
                  Available Models
                </label>
                <p className="text-xs text-gray-600">Fetch models from OpenAI API</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchModels}
                disabled={isLoadingModels || !apiKey}
                data-testid="btn-refresh-models"
                data-loading={isLoadingModels.toString()}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingModels ? 'animate-spin' : ''}`} />
                {isLoadingModels ? 'Loading...' : 'Refresh Models'}
              </Button>
            </div>

            {/* Chat Model */}
            {models.length > 0 && (
              <div className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <label
                    htmlFor="chat-model"
                    className="text-sm font-medium text-gray-900 block mb-1"
                  >
                    Chat Model
                  </label>
                  <p className="text-xs text-gray-600">Model for chat completions</p>
                </div>
                <ModelCombobox
                  models={models}
                  value={openaiConfig.CHAT_MODEL}
                  onValueChange={handleChatModelChange}
                  placeholder="Select chat model..."
                  testId="select-chat-model"
                />
              </div>
            )}
          </div>
        </div>

        {/* Feature Flags Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Feature Flags</h3>
          <table className="w-full border-collapse" data-testid="table-feature-flags">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">
                  Feature Flag
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Enabled</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(featureFlags).map(([flagName, enabled]) => (
                <tr
                  key={flagName}
                  className="border-b last:border-b-0"
                  data-testid={`feature-flag-${flagName}`}
                  data-enabled={enabled.toString()}
                >
                  <td className="py-2 px-3 text-sm text-gray-900">{flagName}</td>
                  <td className="py-2 px-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {enabled ? '✓ true' : '✗ false'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(flagName)}
                      data-testid={`toggle-${flagName}`}
                      className="h-8 text-xs"
                    >
                      {enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Search Settings Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Hybrid Search Settings</h3>
          <p className="text-xs text-gray-600 mb-4">Settings apply immediately on next search</p>

          <div className="space-y-4">
            {SEARCH_SETTING_CONFIGS.map((config) => (
              <div key={config.key} className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <label
                    htmlFor={config.key}
                    className="text-sm font-medium text-gray-900 block mb-1"
                  >
                    {config.label}
                  </label>
                  <p className="text-xs text-gray-600">{config.description}</p>
                </div>
                <div>
                  <Input
                    id={config.key}
                    type="number"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={searchSettings[config.key]}
                    onChange={(e) => handleSearchSettingChange(config.key, e.target.value)}
                    data-testid={`input-${config.key}`}
                    className={errors[config.key] ? 'border-red-500' : ''}
                  />
                  {errors[config.key] && (
                    <p className="text-xs text-red-600 mt-1">{errors[config.key]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} data-testid="btn-close-settings-footer">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
