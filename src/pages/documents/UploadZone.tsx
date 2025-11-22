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
        relative border-2 border-dashed rounded-lg p-8 mb-6 transition-all duration-200
        ${isDragging ? 'border-blue-600 bg-blue-50 scale-[1.02]' : 'border-gray-200 bg-white'}
        ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-blue-400 hover:bg-gray-50'}
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
        <div className={`p-4 rounded-full mb-4 transition-all duration-200 ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
          {isDragging ? (
            <Download className="w-8 h-8 text-blue-600" />
          ) : (
            <Upload className="w-8 h-8 text-gray-500" />
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isDragging ? 'Drop files here' : 'Upload Documents'}
        </h3>

        <p className="text-sm text-gray-500 max-w-md mb-4">
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
