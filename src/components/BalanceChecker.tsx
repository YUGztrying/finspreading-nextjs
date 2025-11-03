// src/components/BalanceChecker.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

interface BalanceCheckerProps {
  periods: string[]
  actifsAmounts: number[]
  passifsAmounts: number[]
  companyName?: string
}

export default function BalanceChecker({ 
  periods,
  actifsAmounts,
  passifsAmounts,
  companyName 
}: BalanceCheckerProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount))
  }

  const formatPeriod = (period: string) => {
    const date = new Date(period)
    return isNaN(date.getTime()) ? period : date.getFullYear().toString()
  }

  // Vérifier l'équilibre pour chaque période
  const balanceChecks = periods.map((period, idx) => {
    const actif = actifsAmounts[idx] || 0
    const passif = passifsAmounts[idx] || 0
    const difference = actif - passif
    const isBalanced = Math.abs(difference) < 0.01
    const differencePercentage = actif !== 0 ? (Math.abs(difference) / actif) * 100 : 0

    return {
      period,
      actif,
      passif,
      difference,
      isBalanced,
      differencePercentage
    }
  })

  const allBalanced = balanceChecks.every(check => check.isBalanced)

  return (
    <Card className="border-stone-200 bg-white shadow-sm">
      <CardHeader className="border-b border-stone-100">
        <CardTitle className="flex items-center justify-between">
          <span className="text-xl font-medium text-stone-900">
            Vérification de Balance
          </span>
          {allBalanced ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600" />
          )}
        </CardTitle>
        {companyName && (
          <p className="text-sm text-stone-600 mt-1">{companyName}</p>
        )}
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Équation comptable pour chaque période */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">
            Équation Comptable par Période
          </p>
          
          <div className="grid gap-3">
            {balanceChecks.map((check, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-lg border ${
                  check.isBalanced 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-stone-700">
                    {formatPeriod(check.period)}
                  </span>
                  {check.isBalanced ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-stone-600 text-xs">Total Actifs</p>
                    <p className="text-lg font-semibold text-stone-900 font-mono">
                      {formatAmount(check.actif)}
                    </p>
                  </div>
                  <div className="text-stone-400 text-xl">=</div>
                  <div>
                    <p className="text-stone-600 text-xs">Total Passifs</p>
                    <p className="text-lg font-semibold text-stone-900 font-mono">
                      {formatAmount(check.passif)}
                    </p>
                  </div>
                </div>

                {!check.isBalanced && (
                  <div className="mt-2 text-xs text-red-700">
                    Différence: {check.difference > 0 ? '+' : ''}{formatAmount(check.difference)} 
                    ({check.differencePercentage.toFixed(2)}%)
                    <br />
                    {check.difference > 0 
                      ? 'Les actifs dépassent les passifs' 
                      : 'Les passifs dépassent les actifs'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Résultat global */}
        {allBalanced ? (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertDescription className="text-emerald-800">
              <span className="font-medium">Toutes les périodes sont équilibrées</span>
              <br />
              Les actifs et passifs sont en équilibre parfait pour toutes les périodes.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Déséquilibre détecté</span>
              <br />
              Une ou plusieurs périodes présentent un déséquilibre. Vérifiez les montants ci-dessus.
            </AlertDescription>
          </Alert>
        )}

        {/* Info */}
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-700" />
          <AlertDescription className="text-blue-800 text-xs">
            L'équation comptable fondamentale impose que le total des actifs soit égal au total des passifs et des capitaux propres pour chaque période. Un déséquilibre indique une erreur de saisie ou des données manquantes.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}