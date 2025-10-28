// src/app/(dashboard)/compte-resultats/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Building2, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import StatementTable from '@/components/statements/StatementTable'
import { LineItem } from '@/types/database.types'

interface FinancialStatement {
  id: string
  company_name: string
  type_institution: string
  statement_type: string
  periods: string[]
  line_items: LineItem[]
  source_files: string[]
  created_at: string
  updated_at: string
}

export default function CompteResultatsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [statement, setStatement] = useState<FinancialStatement | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  // Fetch user and companies
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      try {
        // Fetch all statements for this user
        const response = await fetch(
          `/api/statements/list?user_id=${user.id}&statement_type=compte_resultats`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch statements')
        }

        const result = await response.json()

        if (result.companies && result.companies.length > 0) {
          setCompanies(result.companies)
          setSelectedCompany(result.companies[0])
        } else {
          setNotification({
            type: 'info',
            message: 'Aucun état financier trouvé. Commencez par télécharger un document.'
          })
        }
      } catch (error: any) {
        console.error('Error fetching companies:', error)
        setNotification({
          type: 'error',
          message: error.message || 'Erreur lors du chargement des données'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Fetch statement when company changes
  useEffect(() => {
    if (!selectedCompany || !userId) return

    const fetchStatement = async () => {
      setLoading(true)
      setNotification(null)

      try {
        const response = await fetch(
          `/api/statements/list?user_id=${userId}&company_name=${encodeURIComponent(selectedCompany)}&statement_type=compte_resultats`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch statement')
        }

        const result = await response.json()

        if (result.statements && result.statements.length > 0) {
          setStatement(result.statements[0])
        } else {
          setNotification({
            type: 'info',
            message: `Aucun compte de résultats trouvé pour ${selectedCompany}`
          })
          setStatement(null)
        }
      } catch (error: any) {
        console.error('Error fetching statement:', error)
        setNotification({
          type: 'error',
          message: error.message || 'Erreur lors du chargement de l\'état'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStatement()
  }, [selectedCompany, userId])

  // Save changes
  const handleSave = async (updatedLineItems: LineItem[]) => {
    if (!statement) return

    setSaving(true)
    setNotification(null)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('financial_statements')
        .update({
          line_items: updatedLineItems,
          updated_at: new Date().toISOString()
        })
        .eq('id', statement.id)

      if (error) {
        throw new Error(`Failed to save: ${error.message}`)
      }

      setNotification({
        type: 'success',
        message: '✅ Modifications enregistrées avec succès'
      })

      // Update local state
      setStatement({
        ...statement,
        line_items: updatedLineItems
      })

      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000)

    } catch (error: any) {
      console.error('Save error:', error)
      setNotification({
        type: 'error',
        message: error.message || 'Erreur lors de l\'enregistrement'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !statement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                Compte de Résultats
              </h1>
              <p className="text-sm text-stone-600">
                Visualisez et modifiez les produits et charges
              </p>
            </div>
          </div>

          {/* Company Selector */}
          {companies.length > 0 && (
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-stone-600" />
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[300px] border-stone-200">
                  <SelectValue placeholder="Sélectionner une société" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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

        {/* Statement Info Card */}
        {statement && (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardHeader className="border-b border-stone-100">
              <CardTitle className="flex items-center justify-between">
                <span className="text-xl font-medium text-stone-900">
                  {statement.company_name}
                </span>
                <span className="text-sm font-normal text-stone-600">
                  Type: {statement.type_institution}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-8 text-sm text-stone-600">
                <div>
                  <span className="font-medium">Périodes:</span> {statement.periods.length}
                </div>
                <div>
                  <span className="font-medium">Lignes:</span> {statement.line_items.length}
                </div>
                <div>
                  <span className="font-medium">Dernière mise à jour:</span>{' '}
                  {new Date(statement.updated_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statement Table */}
        {statement ? (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <StatementTable
                periods={statement.periods}
                lineItems={statement.line_items}
                onSave={handleSave}
                readOnly={saving}
              />
            </CardContent>
          </Card>
        ) : (
          !loading && (
            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="p-12 text-center">
                <p className="text-stone-600">
                  Aucun compte de résultats disponible.
                  <br />
                  Téléchargez un document pour commencer.
                </p>
                <Button
                  onClick={() => router.push('/upload')}
                  className="mt-4 bg-amber-600 hover:bg-amber-700"
                >
                  Télécharger un document
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </main>
    </div>
  )
}