// src/app/(dashboard)/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, LogOut, FileSpreadsheet, Building2, BarChart3 } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-amber-600" />
            <h1 className="text-xl font-light text-stone-900">FinSpreading</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-600">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-stone-200"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-stone-900 mb-2">
            Tableau de bord
          </h2>
          <p className="text-stone-600">
            Bienvenue sur FinSpreading - Analyse d'états financiers pour IFC
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Upload Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/upload')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                Télécharger Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Importez vos états financiers PDF ou Excel
              </p>
              <Button className="w-full bg-amber-600 hover:bg-amber-700">
                Accéder
              </Button>
            </CardContent>
          </Card>

          {/* Actifs Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/actifs')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                État des Actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Visualisez et modifiez vos actifs
              </p>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                Accéder
              </Button>
            </CardContent>
          </Card>

          {/* Passifs Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/passifs')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                État des Passifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Visualisez et modifiez vos passifs
              </p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Accéder
              </Button>
            </CardContent>
          </Card>

          {/* Compte de Résultats Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/compte-resultats')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                Compte de Résultats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Visualisez produits et charges
              </p>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                Accéder
              </Button>
            </CardContent>
          </Card>

          {/* Hors-Bilan Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/hors-bilan')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <FileSpreadsheet className="w-5 h-5 text-orange-600" />
                Hors-Bilan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Visualisez les engagements
              </p>
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                Accéder
              </Button>
            </CardContent>
          </Card>

          {/* IRP Reports Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/rapport-irp')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <FileSpreadsheet className="w-5 h-5 text-stone-600" />
                Rapports IRP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Générez vos rapports standardisés
              </p>
              <Button className="w-full bg-stone-600 hover:bg-stone-700">
                Accéder
              </Button>
            </CardContent>
          </Card>

          {/* CAMELS Analysis Card */}
          <Card className="border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/camels')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-900">
                <BarChart3 className="w-5 h-5 text-red-600" />
                Analyse CAMELS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 mb-4">
                Évaluation de la santé financière
              </p>
              <Button className="w-full bg-red-600 hover:bg-red-700">
                Accéder
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}