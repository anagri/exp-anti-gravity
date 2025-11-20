import { ChangeEvent } from 'react'
import { useVectorDB } from '@/contexts/VectorDBContext'

/**
 * Minimal file upload component using plain file input
 * Accepts .md and .txt files
 */
export function FileUpload() {
  const { uploadFiles } = useVectorDB()

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) {
      return
    }

    try {
      await uploadFiles(files)
      e.target.value = '' // Reset input after upload
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files. Please try again.')
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
        Upload Documents
      </label>
      <input
        id="file-upload"
        type="file"
        accept=".md,.txt"
        multiple
        onChange={handleFileChange}
        data-testid="file-upload-input"
        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
      />
      <p className="mt-1 text-sm text-gray-500">
        Accepted file types: .md, .txt
      </p>
    </div>
  )
}
