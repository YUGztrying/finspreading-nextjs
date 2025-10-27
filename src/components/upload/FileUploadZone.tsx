// src/components/upload/FileUploadZone.tsx
'use client'

import { useCallback } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploadZoneProps {
  onFileSelect: (files: File[]) => void
  dragActive: boolean
}

export default function FileUploadZone({ onFileSelect, dragActive }: FileUploadZoneProps) {
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      onFileSelect(filesArray)
    }
  }, [onFileSelect])

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-12 text-center transition-colors
        ${dragActive 
          ? 'border-amber-500 bg-amber-50' 
          : 'border-stone-300 bg-stone-50 hover:bg-stone-100'
        }
      `}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleFileInput}
        accept=".pdf,.xlsx,.xls"
        multiple
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={`
          p-4 rounded-full transition-colors
          ${dragActive ? 'bg-amber-100' : 'bg-stone-200'}
        `}>
          {dragActive ? (
            <Upload className="w-8 h-8 text-amber-600" />
          ) : (
            <FileSpreadsheet className="w-8 h-8 text-stone-600" />
          )}
        </div>
        
        <div>
          <p className="text-lg font-medium text-stone-900 mb-1">
            {dragActive ? 'Déposez vos fichiers ici' : 'Glissez-déposez vos fichiers'}
          </p>
          <p className="text-sm text-stone-600">
            ou
          </p>
        </div>
        
        <Button
          type="button"
          onClick={() => document.getElementById('file-upload')?.click()}
          className="bg-amber-600 hover:bg-amber-700"
        >
          Sélectionner des fichiers
        </Button>
        
        <p className="text-xs text-stone-500">
          Formats acceptés: PDF, Excel (.xlsx, .xls)
        </p>
      </div>
    </div>
  )
}