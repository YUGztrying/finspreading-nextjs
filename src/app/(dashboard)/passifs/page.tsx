// src/app/(dashboard)/passifs/page.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import RenameCompanyDialog from '@/components/RenameCompanyDialog'
import ExportButton from '@/components/ExportButton'
import BalanceChecker from '@/components/BalanceChecker'

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

function PassifsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [statement, setStatement] = useState<FinancialStatement | null>(null)
  const [actifsStatement, setActifsStatement] = useState<FinancialStatement | null>(null)
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
        const response = await fetch(
          `/api/statements/list?user_id=${user.id}&statement_type=passifs`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch statements')
        }

        const result = await response.json()

        if (result.companies && result.companies.length > 0) {
          setCompanies(result.companies)
          const paramCompany = searchParams.get('company')
          const initial = (paramCompany && result.companies.includes(paramCompany)) ? paramCompany : result.companies[0]
          setSelectedCompany(initial)
        } else {
          setNotification({
            type: 'info',
            message: 'Aucun état financier trouvé. Commencez par télécharger un document.'
          })
        }
      } catch (error: any) {
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

  // Fetch statements when company changes
  useEffect(() => {
    if (!selectedCompany || !userId) return

    const fetchStatements = async () => {
      setLoading(true)
      setNotification(null)

      try {
        // Fetch passifs
        const passifsResponse = await fetch(
          `/api/statements/list?user_id=${userId}&company_name=${encodeURIComponent(selectedCompany)}&statement_type=passifs`
        )

        if (passifsResponse.ok) {
          const passifsResult = await passifsResponse.json()
          if (passifsResult.statements && passifsResult.statements.length > 0) {
            setStatement(passifsResult.statements[0])
          } else {
            setStatement(null)
          }
        }

        // Fetch actifs pour le balance checker
        const actifsResponse = await fetch(
          `/api/statements/list?user_id=${userId}&company_name=${encodeURIComponent(selectedCompany)}&statement_type=actifs`
        )

        if (actifsResponse.ok) {
          const actifsResult = await actifsResponse.json()
          if (actifsResult.statements && actifsResult.statements.length > 0) {
            setActifsStatement(actifsResult.statements[0])
          } else {
            setActifsStatement(null)
          }
        }

        if (!statement && !actifsStatement) {
          setNotification({
            type: 'info',
            message: `Aucun état des passifs trouvé pour ${selectedCompany}`
          })
        }

      } catch (error: any) {
        setNotification({
          type: 'error',
          message: error.message || 'Erreur lors du chargement de l\'état'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStatements()
  }, [selectedCompany, userId])

  // Calculate totals for balance checker
  const actifsAmounts = actifsStatement?.periods.map((_, periodIdx) => {
  return actifsStatement.line_items
    .filter((item: any) => item.is_total)
    .reduce((sum: number, item: any) => {
      const amounts = item.amounts || []
      return sum + (amounts[periodIdx] || 0)
    }, 0)
}) || []

const passifsAmounts = statement?.periods.map((_, periodIdx) => {
  return statement.line_items
    .filter((item: any) => item.is_total)
    .reduce((sum: number, item: any) => {
      const amounts = item.amounts || []
      return sum + (amounts[periodIdx] || 0)
    }, 0)
}) || []

  // Refresh data after rename
  const handleRenameSuccess = async () => {
    
    setNotification({
      type: 'success',
      message: '✅ Entreprise renommée avec succès'
    })

    setLoading(true)

    try {
      const response = await fetch(
        `/api/statements/list?user_id=${userId}&statement_type=passifs`
      )

      if (response.ok) {
        const result = await response.json()
        
        if (result.companies && result.companies.length > 0) {
          setCompanies(result.companies)
          const firstCompany = result.companies[0]
          setSelectedCompany(firstCompany)
          
          // Fetch passifs
          const passifsResponse = await fetch(
            `/api/statements/list?user_id=${userId}&company_name=${encodeURIComponent(firstCompany)}&statement_type=passifs`
          )
          
          if (passifsResponse.ok) {
            const passifsResult = await passifsResponse.json()
            if (passifsResult.statements && passifsResult.statements.length > 0) {
              setStatement(passifsResult.statements[0])
            }
          }

          // Fetch actifs
          const actifsResponse = await fetch(
            `/api/statements/list?user_id=${userId}&company_name=${encodeURIComponent(firstCompany)}&statement_type=actifs`
          )
          
          if (actifsResponse.ok) {
            const actifsResult = await actifsResponse.json()
            if (actifsResult.statements && actifsResult.statements.length > 0) {
              setActifsStatement(actifsResult.statements[0])
            }
          }
        }
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }

    setTimeout(() => setNotification(null), 3000)
  }

  // Save changes
  const handleSave = async (updatedLineItems: LineItem[]) => {
    if (!statement) return

    setSaving(true)
    setNotification(null)

    try {
      const supabase = createClient() as any

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

      setStatement({
        ...statement,
        line_items: updatedLineItems
      })

      setTimeout(() => setNotification(null), 3000)

    } catch (error: any) {
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
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
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
                  État des Passifs
                </h1>
              </div>
            </div>

            {selectedCompany && userId && (
              <div className="flex items-center gap-2">
                <ExportButton
                  companyName={selectedCompany}
                  userId={userId}
                />
                <RenameCompanyDialog
                  currentName={selectedCompany}
                  statementType="passifs"
                  userId={userId}
                  onSuccess={handleRenameSuccess}
                />
              </div>
            )}
          </div>

          {companies.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-stone-600" />
                <span className="text-lg font-medium text-stone-900">
                  {selectedCompany}
                </span>
              </div>
              
              {companies.length > 1 && (
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
              )}
            </div>
          )}
          
          <p className="text-sm text-stone-600 mt-2">
            Visualisez et modifiez les postes de passifs
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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

        {/* Balance Checker - Only show if we have both actifs and passifs */}
        {statement && actifsStatement && (
          <BalanceChecker
            periods={statement.periods}
            actifsAmounts={actifsAmounts}
            passifsAmounts={passifsAmounts}
            companyName={selectedCompany}
          />
        )}

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
                  Aucun état des passifs disponible.
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

export default function PassifsPage() {
  return <Suspense fallback={null}><PassifsPageContent /></Suspense>
}