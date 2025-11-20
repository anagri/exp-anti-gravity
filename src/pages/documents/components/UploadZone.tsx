import React, { useState, useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFilesSelected, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleBrowseClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-12 mb-6 transition-colors
        ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".md,.txt"
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-upload-input"
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center text-center">
        {isDragging ? (
          <Download className="w-12 h-12 text-primary mb-4" />
        ) : (
          <Upload className="w-12 h-12 text-muted-foreground mb-4" />
        )}

        <h3 className="text-lg font-semibold mb-2">
          {isDragging ? 'Drop files here' : 'Upload Documents'}
        </h3>

        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop .md or .txt files here, or click to browse
        </p>

        <Button
          onClick={handleBrowseClick}
          disabled={disabled}
          data-testid="btn-upload-browse"
          type="button"
        >
          Browse Files
        </Button>
      </div>
    </div>
  );
}
