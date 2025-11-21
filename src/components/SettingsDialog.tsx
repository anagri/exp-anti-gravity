import { useState } from 'react'
import { Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getAllFeatureFlags,
  setFeatureFlag,
  getAllSearchSettings,
  setSearchSetting,
  SearchSettings,
} from '@/lib/feature-flags'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface SearchSettingConfig {
  key: keyof SearchSettings
  label: string
  description: string
  min: number
  max: number
  step: number
  advanced?: boolean
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
  {
    key: 'HNSW_M',
    label: 'HNSW M',
    description: 'Max connections per layer (requires re-index)',
    min: 4,
    max: 64,
    step: 1,
    advanced: true,
  },
  {
    key: 'HNSW_EF_CONSTRUCTION',
    label: 'HNSW ef_construction',
    description: 'Dynamic candidate list size (requires re-index)',
    min: 16,
    max: 256,
    step: 1,
    advanced: true,
  },
]

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [featureFlags, setFeatureFlagsState] = useState(getAllFeatureFlags())
  const [searchSettings, setSearchSettingsState] = useState(getAllSearchSettings())
  const [hasFeatureFlagChanges, setHasFeatureFlagChanges] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleToggle = (flagName: string) => {
    const currentValue = featureFlags[flagName as keyof typeof featureFlags]
    const newValue = !currentValue

    setFeatureFlag(flagName, newValue)
    setFeatureFlagsState({ ...featureFlags, [flagName]: newValue })
    setHasFeatureFlagChanges(true)
  }

  const handleSearchSettingChange = (key: keyof SearchSettings, value: string) => {
    const numValue = parseFloat(value)
    const config = SEARCH_SETTING_CONFIGS.find((c) => c.key === key)

    if (!config) return

    const newErrors = { ...errors }

    if (isNaN(numValue)) {
      newErrors[key] = 'Invalid number'
    } else if (numValue < config.min || numValue > config.max) {
      newErrors[key] = `Value must be between ${config.min} and ${config.max}`
    } else {
      delete newErrors[key]
      setSearchSetting(key, numValue)
      setSearchSettingsState({ ...searchSettings, [key]: numValue })
    }

    setErrors(newErrors)
  }

  const handleReload = () => {
    window.location.reload()
  }

  const basicSettings = SEARCH_SETTING_CONFIGS.filter((c) => !c.advanced)
  const advancedSettings = SEARCH_SETTING_CONFIGS.filter((c) => c.advanced)

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

        {/* Feature Flags Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Feature Flags</h3>
          <table className="w-full border-collapse" data-testid="table-feature-flags">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">
                  Feature Flag
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">
                  Enabled
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">
                  Action
                </th>
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
                        enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
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
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Hybrid Search Settings
          </h3>
          <p className="text-xs text-gray-600 mb-4">
            Basic settings apply immediately on next search
          </p>

          <div className="space-y-4">
            {basicSettings.map((config) => (
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

        {/* Advanced Settings Section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Advanced Settings
          </h3>
          <p className="text-xs text-amber-700 mb-4 bg-amber-50 p-2 rounded border border-amber-200">
            ⚠ Changes to HNSW index parameters require page reload and document re-indexing
          </p>

          <div className="space-y-4">
            {advancedSettings.map((config) => (
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

        {hasFeatureFlagChanges && (
          <div
            className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md"
            data-testid="reload-warning"
          >
            <p className="text-sm text-amber-800">
              ⚠ Feature flag changes require page reload to take effect
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          {hasFeatureFlagChanges && (
            <Button
              variant="default"
              onClick={handleReload}
              data-testid="btn-reload-now"
            >
              Reload Now
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="btn-close-settings-footer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
