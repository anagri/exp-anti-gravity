import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyProvider } from '@/contexts/ApiKeyContext';
import { setSearchSetting } from '@/lib/feature-flags';
import SettingsDialog from './SettingsDialog';

const renderSettingsDialog = (props = {}) => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };
  return render(
    <BrowserRouter>
      <ApiKeyProvider>
        <SettingsDialog {...defaultProps} {...props} />
      </ApiKeyProvider>
    </BrowserRouter>
  );
};

describe('SettingsDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <BrowserRouter>
        <ApiKeyProvider>
          <SettingsDialog isOpen={false} onClose={vi.fn()} />
        </ApiKeyProvider>
      </BrowserRouter>
    );

    expect(screen.queryByTestId('div-settings-modal')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    renderSettingsDialog();

    expect(screen.getByTestId('div-settings-modal')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders feature flags section', () => {
    renderSettingsDialog();

    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    expect(screen.getByTestId('table-feature-flags')).toBeInTheDocument();
  });

  it('renders search settings section with all inputs', () => {
    renderSettingsDialog();

    expect(screen.getByText('Hybrid Search Settings')).toBeInTheDocument();
    expect(screen.getByTestId('input-VECTOR_TOP_K')).toBeInTheDocument();
    expect(screen.getByTestId('input-SIMILARITY_THRESHOLD')).toBeInTheDocument();
    expect(screen.getByTestId('input-BM25_LIMIT')).toBeInTheDocument();
  });

  it('displays default values for search settings', () => {
    renderSettingsDialog();

    expect(screen.getByTestId('input-VECTOR_TOP_K')).toHaveValue(3);
    expect(screen.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue(0.3);
    expect(screen.getByTestId('input-BM25_LIMIT')).toHaveValue(10);
  });

  it('displays stored values when they exist', () => {
    setSearchSetting('VECTOR_TOP_K', 5);
    setSearchSetting('SIMILARITY_THRESHOLD', 0.7);

    renderSettingsDialog();

    expect(screen.getByTestId('input-VECTOR_TOP_K')).toHaveValue(5);
    expect(screen.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue(0.7);
  });

  it('updates search setting on input change', async () => {
    const eventListener = vi.fn();
    window.addEventListener('searchSettingChanged', eventListener);

    renderSettingsDialog();

    const input = screen.getByTestId('input-VECTOR_TOP_K');
    fireEvent.change(input, { target: { value: '7' } });

    await waitFor(() => {
      expect(localStorage.getItem('search-setting-VECTOR_TOP_K')).toBe('7');
      expect(eventListener).toHaveBeenCalled();
    });

    window.removeEventListener('searchSettingChanged', eventListener);
  });

  it('validates min/max bounds for inputs', async () => {
    renderSettingsDialog();

    const input = screen.getByTestId('input-VECTOR_TOP_K');
    fireEvent.change(input, { target: { value: '25' } });

    await waitFor(() => {
      expect(screen.getByText('Value must be between 1 and 20')).toBeInTheDocument();
    });
  });

  it('validates numeric input', async () => {
    renderSettingsDialog();

    const input = screen.getByTestId('input-VECTOR_TOP_K');
    fireEvent.change(input, { target: { value: 'abc' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid number')).toBeInTheDocument();
    });
  });

  it('closes dialog when close button clicked', () => {
    const onClose = vi.fn();
    renderSettingsDialog({ onClose });

    const closeButton = screen.getByTestId('btn-close-settings');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('closes dialog when footer close button clicked', () => {
    const onClose = vi.fn();
    renderSettingsDialog({ onClose });

    const closeButton = screen.getByTestId('btn-close-settings-footer');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows reload warning when feature flag changed', async () => {
    renderSettingsDialog();

    const toggleButton = screen.getByTestId('toggle-FEATURE_INDEXING_ENABLED');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('reload-warning')).toBeInTheDocument();
      expect(screen.getByText(/Feature flag changes require page reload/)).toBeInTheDocument();
    });
  });

  it('does not show reload warning for search setting changes', async () => {
    renderSettingsDialog();

    const input = screen.getByTestId('input-VECTOR_TOP_K');
    fireEvent.change(input, { target: { value: '5' } });

    await waitFor(() => {
      expect(localStorage.getItem('search-setting-VECTOR_TOP_K')).toBe('5');
    });

    expect(screen.queryByTestId('reload-warning')).not.toBeInTheDocument();
  });

  it('shows reload button when feature flag changed', async () => {
    renderSettingsDialog();

    const toggleButton = screen.getByTestId('toggle-FEATURE_INDEXING_ENABLED');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const reloadButton = screen.getByTestId('btn-reload-now');
      expect(reloadButton).toBeInTheDocument();
      expect(reloadButton).toHaveTextContent('Reload Now');
    });
  });
});
