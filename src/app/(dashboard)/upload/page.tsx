// src/app/(dashboard)/upload/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Building2, AlertCircle, CheckCircle } from 'lucide-react'
import FileUploadZone from '@/components/upload/FileUploadZone'
import ProcessingQueue from '@/components/upload/ProcessingQueue'

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

      // Step 3: Process the file based on type
      const lowerFileName = file.name.toLowerCase()
      let apiEndpoint = ''
      
      if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')) {
        apiEndpoint = '/api/process-excel'
        console.log('📊 Excel file detected, using /api/process-excel')
      } else if (lowerFileName.endsWith('.pdf')) {
        apiEndpoint = '/api/extract-data'
        console.log('📄 PDF file detected, using /api/extract-data')
      } else {
        throw new Error(`Type de fichier non supporté: ${file.name}`)
      }

      // Step 4: Call processing API
      // Step 4: Call processing API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: fileUrl,
          institution_type: institutionType,
          user_id: user?.id,  // ADD THIS
          company_name: file.name.replace(/\.(xlsx|xls|pdf)$/i, '').replace(/[_-]/g, ' ')  // ADD THIS
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Processing failed')
      }

      const result = await response.json().catch(() => ({}))

      // Step 5: Save to database
      console.log('💾 Saving to database...')

      // Updated section for PDF processing in upload page
// Replace lines 162-217 in src/app/(dashboard)/upload/page.tsx

      let processedData: any
      
      if (apiEndpoint === '/api/process-excel') {
        // Excel processing - already handles multiple statements
        console.log('📊 Excel processing complete')
        
        // Excel route already saves to database, so we're done
        const savedCount = result.saved_statements?.length || 0
        console.log(`✅ ${savedCount} statement(s) saved from Excel`)
        
      } else {
        // PDF processing - now handles MULTIPLE statements
        const statements = result.data.statements || []
        const companyName = result.data.company_name
        
        console.log(`📄 Processing ${statements.length} statement(s) from PDF...`)
        
        let savedCount = 0
        const savedIds: string[] = []
        
        // Process each statement separately
        for (const statement of statements) {
          const statementData = {
            company_name: companyName,
            type_institution: institutionType,
            statement_type: statement.statement_type,
            periods: statement.periods,
            line_items: statement.line_items,
            source_file: __filename
          }
          
          try {
            // Save to database
            const saveResponse = await fetch('/api/statements/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                data: statementData,
                user_id: user?.id 
              }),
            })
            
            if (saveResponse.ok) {
              const saveResult = await saveResponse.json()
              console.log(`✅ Saved ${statement.statement_type}:`, saveResult.statement_id)
              savedIds.push(saveResult.statement_id)
              savedCount++
            } else {
              console.warn(`⚠️ Failed to save ${statement.statement_type}`)
            }
          } catch (saveError) {
            console.error(`❌ Error saving ${statement.statement_type}:`, saveError)
          }
        }
        
        console.log(`💾 Saved ${savedCount}/${statements.length} statements to database`)
      }

      // Complete progress
      setProgress(prev => {
        const newProgress = [...prev]
        newProgress[index] = 100
        return newProgress
      })

      // Different success messages for Excel vs PDF
      let successMessage = ''
      if (apiEndpoint === '/api/process-excel') {
        const savedCount = result.saved_statements?.length || 0
        const totalTables = result.summary?.totalTables || 0
        successMessage = `✅ Excel traité! ${totalTables} tableau(x) détecté(s), ${savedCount} sauvegardé(s).`
      } else {
        // PDF extraction - multi-statement support
        const statements = result.data.statements || []
        const company = result.data.company_name || 'Unknown'
        const types = statements.map((s: any) => s.statement_type).join(', ')
        successMessage = `✅ PDF traité! ${statements.length} état(s) financier(s) pour ${company}: ${types}`
      }

      setNotification({
        type: 'success',
        message: successMessage
      })

      console.log('📊 Processing complete:', result)

      // Auto-remove after 3 seconds
      setTimeout(() => removeFile(index), 3000)

    } catch (error: any) {
      console.error('Processing error:', error)
      
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
    </div>
  )
}