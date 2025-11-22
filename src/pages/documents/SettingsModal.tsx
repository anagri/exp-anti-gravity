import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllFeatureFlags, setFeatureFlag } from '@/lib/feature-flags';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [featureFlags, setFeatureFlagsState] = useState(getAllFeatureFlags());
  const [hasChanges, setHasChanges] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (flagName: string) => {
    const currentValue = featureFlags[flagName as keyof typeof featureFlags];
    const newValue = !currentValue;

    setFeatureFlag(flagName, newValue);
    setFeatureFlagsState({ ...featureFlags, [flagName]: newValue });
    setHasChanges(true);
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="div-settings-modal"
    >
      <div className="bg-white border rounded-lg p-6 max-w-2xl w-full mx-4 shadow-lg">
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

        <div>
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

        {hasChanges && (
          <div
            className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md"
            data-testid="reload-warning"
          >
            <p className="text-sm text-amber-800">
              ⚠ Changes require page reload to take effect
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          {hasChanges && (
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
  );
}
