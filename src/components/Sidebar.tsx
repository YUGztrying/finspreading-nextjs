'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  TrendingUp,
  PieChart,
  FileSpreadsheet,
  BarChart3,
  FileText,
  Download,
  Building2,
  Shield,
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    items: [
      { title: 'Tableau de Bord', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Télécharger Documents', href: '/upload', icon: Upload },
    ],
  },
  {
    label: 'Données',
    items: [
      { title: 'États Actifs', href: '/actifs', icon: TrendingUp },
      { title: 'États Passifs', href: '/passifs', icon: PieChart },
      { title: 'Compte de Résultats', href: '/compte-resultats', icon: BarChart3 },
      { title: 'Hors Bilan', href: '/hors-bilan', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Analyses',
    items: [
      { title: 'Rapport IRP', href: '/rapport-irp', icon: FileText },
      { title: 'Analyse CAMELS', href: '/camels', icon: Shield },
      { title: 'Export Complet', href: '/export', icon: Download },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-stone-200 z-50">
      {/* Header */}
      <div className="border-b border-stone-100 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900 text-lg">
              FinSpreading
            </h2>
            <p className="text-xs text-stone-500">
              Analyse Financière
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 flex-1 overflow-y-auto space-y-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1 px-3">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-300
                        ${isActive
                          ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-100'
                          : 'text-stone-600 hover:bg-amber-50 hover:text-amber-700'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}