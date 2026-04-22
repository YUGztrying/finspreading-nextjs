// src/app/(dashboard)/upload/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Building2, AlertCircle, CheckCircle, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import FileUploadZone from '@/components/upload/FileUploadZone'
import ProcessingQueue from '@/components/upload/ProcessingQueue'
import type { ExtractFromPagesResult } from '@/components/upload/PagePickerDialog'

// react-pdf pulls in pdfjs-dist which uses browser-only APIs (DOMMatrix, etc.).
// Load the dialog on the client only to keep SSR/prerendering happy.
const PagePickerDialog = dynamic(
  () => import('@/components/upload/PagePickerDialog'),
  { ssr: false }
)

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState<boolean[]>([])
  const [progress, setProgress] = useState<number[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [institutionType, setInstitutionType] = useState<'banque' | 'microfinance'>('banque')
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const [verificationCompany, setVerificationCompany] = useState<string | null>(null)

  // Page-picker dialog state (PDF flow)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFileUrl, setPickerFileUrl] = useState<string | null>(null)
  const [pickerFileName, setPickerFileName] = useState('')
  const [pickerFileIndex, setPickerFileIndex] = useState<number | null>(null)

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files)
      setFiles(prev => [...prev, ...newFiles])
      setProcessing(prev => [...prev, ...newFiles.map(() => false)])
      setProgress(prev => [...prev, ...newFiles.map(() => 0)])
    }
  }, [])

  const handleFileInput = useCallback((selectedFiles: File[]) => {
    setFiles(prev => [...prev, ...selectedFiles])
    setProcessing(prev => [...prev, ...selectedFiles.map(() => false)])
    setProgress(prev => [...prev, ...selectedFiles.map(() => 0)])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setProcessing(prev => prev.filter((_, i) => i !== index))
    setProgress(prev => prev.filter((_, i) => i !== index))
  }, [])

  const processFile = async (index: number) => {
    const file = files[index]
    setIsProcessing(true)
    setNotification(null)

    // Update processing state
    setProcessing(prev => {
      const newProcessing = [...prev]
      newProcessing[index] = true
      return newProcessing
    })

    let progressInterval: ReturnType<typeof setInterval> | null = null

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Simulate progress
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = [...prev]
          if (newProgress[index] === undefined) newProgress[index] = 0
          if (newProgress[index] < 90) {
            newProgress[index] = Math.min(newProgress[index] + 10, 90)
          }
          return newProgress
        })
      }, 500)

      // Step 1: Upload file to Supabase Storage
      const storedFileName = `${Date.now()}_${file.name}`
      const filePath = `${user.id}/${storedFileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('financial-documents')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Step 2: Create signed URL (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('financial-documents')
        .createSignedUrl(filePath, 3600) // 3600 seconds = 1 hour

      if (urlError || !urlData) {
        throw new Error(`Failed to create signed URL: ${urlError?.message}`)
      }

      const fileUrl = urlData.signedUrl

      // Step 3: Branch by file type
      const lowerFileName = file.name.toLowerCase()
      const isPdf = lowerFileName.endsWith('.pdf')
      const isExcel = lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')

      if (!isPdf && !isExcel) {
        throw new Error(`Type de fichier non supporté: ${file.name}`)
      }

      if (isPdf) {
        // PDF flow: open the page-picker dialog. The analyst picks which pages
        // contain which statement type. Extraction + save happen in the picker's
        // onExtracted callback (handleExtractionResult below).
        clearInterval(progressInterval)
        setProgress(prev => {
          const newProgress = [...prev]
          newProgress[index] = 50 // upload done, awaiting user input
          return newProgress
        })
        setPickerFileUrl(fileUrl)
        setPickerFileName(file.name)
        setPickerFileIndex(index)
        setPickerOpen(true)
        return // dialog drives the rest of the flow
      }

      // Excel flow: single server-side call handles extraction + save + normalization.
      const response = await fetch('/api/process-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: fileUrl,
          institution_type: institutionType,
          company_name: file.name.replace(/\.(xlsx|xls|pdf)$/i, '').replace(/[_-]/g, ' '),
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Processing failed')
      }

      const result = await response.json().catch(() => ({}))

      // Complete progress
      setProgress(prev => {
        const newProgress = [...prev]
        newProgress[index] = 100
        return newProgress
      })

      const uploadedCompanyName =
        result.company_name || file.name.replace(/\.(xlsx|xls|pdf)$/i, '').replace(/[_-]/g, ' ')
      setVerificationCompany(uploadedCompanyName)
      setNotification(null)

      // Auto-remove after 3 seconds
      setTimeout(() => removeFile(index), 3000)

    } catch (error: any) {

      setNotification({
        type: 'error',
        message: error?.message || 'Une erreur est survenue lors du traitement'
      })

      setProgress(prev => {
        const newProgress = [...prev]
        newProgress[index] = 0
        return newProgress
      })
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      setProcessing(prev => {
        const newProcessing = [...prev]
        newProcessing[index] = false
        return newProcessing
      })
      setIsProcessing(false)
    }
  }

  // Called by PagePickerDialog after /api/extract-from-pages returns.
  // Saves each extracted statement through the existing /api/statements/save
  // flow so we reuse normalization, merging, and validation.
  const handleExtractionResult = async (result: ExtractFromPagesResult) => {
    if (pickerFileIndex === null) return
    const index = pickerFileIndex

    try {
      for (const statement of result.statements) {
        const statementData = {
          company_name: result.company_name,
          type_institution: institutionType,
          statement_type: statement.statement_type,
          periods: statement.periods,
          line_items: statement.line_items,
          source_file: pickerFileName,
        }

        const saveResponse = await fetch('/api/statements/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: statementData }),
        })

        if (!saveResponse.ok) {
          const err = await saveResponse.json().catch(() => ({}))
          throw new Error(err.error || `Échec de la sauvegarde pour ${statement.statement_type}`)
        }
      }

      // Success: close dialog, complete progress, show verification card
      setPickerOpen(false)
      setPickerFileUrl(null)
      setPickerFileName('')
      setPickerFileIndex(null)

      setProgress(prev => {
        const newProgress = [...prev]
        newProgress[index] = 100
        return newProgress
      })
      setVerificationCompany(result.company_name)
      setNotification(null)

      setTimeout(() => removeFile(index), 3000)
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Sauvegarde échouée après extraction',
      })
    } finally {
      setProcessing(prev => {
        const newProcessing = [...prev]
        newProcessing[index] = false
        return newProcessing
      })
      setIsProcessing(false)
    }
  }

  const handlePickerClose = () => {
    // User cancelled the picker — reset the file's processing state so they can retry
    if (pickerFileIndex !== null) {
      const index = pickerFileIndex
      setProcessing(prev => {
        const newProcessing = [...prev]
        newProcessing[index] = false
        return newProcessing
      })
      setProgress(prev => {
        const newProgress = [...prev]
        newProgress[index] = 0
        return newProgress
      })
    }
    setPickerOpen(false)
    setPickerFileUrl(null)
    setPickerFileName('')
    setPickerFileIndex(null)
    setIsProcessing(false)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard')}
            className="border-stone-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-light text-stone-900">
              Télécharger Documents
            </h1>
            <p className="text-sm text-stone-600">
              Importez vos états financiers et laissez l'IA extraire les données
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Notification */}
        {notification && (
          <Alert
            variant={notification.type === 'error' ? 'destructive' : 'default'}
            className={
              notification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : notification.type === 'info'
                ? 'border-blue-200 bg-blue-50'
                : ''
            }
          >
            {notification.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-700" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription
              className={
                notification.type === 'success'
                  ? 'text-emerald-800'
                  : notification.type === 'info'
                  ? 'text-blue-800'
                  : ''
              }
            >
              {notification.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Post-upload verification card */}
        {verificationCompany && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-900 mb-0.5">{verificationCompany} — données importées</p>
                  <p className="text-sm text-emerald-700 mb-3">
                    Vérifiez et corrigez les données extraites dans chaque tableau avant de lancer les rapports.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'États Actifs', href: `/actifs?company=${encodeURIComponent(verificationCompany)}` },
                      { label: 'États Passifs', href: `/passifs?company=${encodeURIComponent(verificationCompany)}` },
                      { label: 'Compte de Résultats', href: `/compte-resultats?company=${encodeURIComponent(verificationCompany)}` },
                      { label: 'Hors Bilan', href: `/hors-bilan?company=${encodeURIComponent(verificationCompany)}` },
                    ].map(({ label, href }) => (
                      <Button
                        key={label}
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(href)}
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 h-7 px-3 text-xs"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setVerificationCompany(null)}
                  className="shrink-0 -mt-1 -mr-1 h-7 w-7 text-emerald-600 hover:bg-emerald-100"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Institution Type Selector */}
        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-3 text-xl font-medium text-stone-900">
              <Building2 className="w-6 h-6 text-amber-600" />
              Type d'Institution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <label className="text-sm font-medium text-stone-700">
                Sélectionnez le type d'institution:
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="institutionType"
                    value="banque"
                    checked={institutionType === 'banque'}
                    onChange={(e) => setInstitutionType(e.target.value as 'banque' | 'microfinance')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-stone-700">Banque</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="institutionType"
                    value="microfinance"
                    checked={institutionType === 'microfinance'}
                    onChange={(e) => setInstitutionType(e.target.value as 'banque' | 'microfinance')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-stone-700">Microfinance</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Zone */}
        <Card className="border-stone-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileUploadZone onFileSelect={handleFileInput} dragActive={dragActive} />
            </div>
          </CardContent>
        </Card>

        {/* Processing Queue */}
        {files.length > 0 && (
          <ProcessingQueue
            files={files}
            processing={processing}
            progress={progress}
            removeFile={removeFile}
            processFile={processFile}
            isProcessing={isProcessing}
          />
        )}
      </main>

      {/* PDF Page-Picker Dialog — opens automatically when a PDF is uploaded */}
      <PagePickerDialog
        open={pickerOpen}
        fileUrl={pickerFileUrl}
        fileName={pickerFileName}
        institutionType={institutionType}
        onClose={handlePickerClose}
        onExtracted={handleExtractionResult}
      />
    </div>
  )
}