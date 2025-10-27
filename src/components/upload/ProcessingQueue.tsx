// src/components/upload/ProcessingQueue.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileSpreadsheet, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface ProcessingQueueProps {
  files: File[]
  processing: boolean[]
  progress: number[]
  removeFile: (index: number) => void
  processFile: (index: number) => void
  isProcessing: boolean
}

export default function ProcessingQueue({
  files,
  processing,
  progress,
  removeFile,
  processFile,
  isProcessing
}: ProcessingQueueProps) {
  return (
    <Card className="border-stone-200 bg-white shadow-sm">
      <CardHeader className="border-b border-stone-100">
        <CardTitle className="flex items-center gap-3 text-xl font-medium text-stone-900">
          <FileSpreadsheet className="w-6 h-6 text-amber-600" />
          Files en attente ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 rounded-lg border border-stone-200 bg-stone-50"
            >
              <FileSpreadsheet className="w-5 h-5 text-stone-600 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-stone-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                
                {processing[index] && (
                  <div className="mt-2">
                    <Progress value={progress[index]} className="h-2" />
                    <p className="text-xs text-stone-600 mt-1">
                      Traitement en cours... {progress[index]}%
                    </p>
                  </div>
                )}
                
                {progress[index] === 100 && !processing[index] && (
                  <div className="flex items-center gap-1 mt-2 text-emerald-600">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-xs font-medium">Terminé</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {!processing[index] && progress[index] !== 100 && (
                  <Button
                    size="sm"
                    onClick={() => processFile(index)}
                    disabled={isProcessing}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      'Traiter'
                    )}
                  </Button>
                )}
                
                {processing[index] && (
                  <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                )}
                
                {!processing[index] && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFile(index)}
                    className="text-stone-600 hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}