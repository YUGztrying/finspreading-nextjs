'use client'

import { useSidebar } from '@/components/providers/SidebarProvider'
import { Menu, Building2 } from 'lucide-react'

export function MobileHeader() {
  const { toggleSidebar } = useSidebar()

  return (
    <header className="bg-white border-b border-stone-200 px-4 py-3 md:hidden sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-stone-600" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-stone-900">FinSpreading</h1>
            <p className="text-xs text-stone-500">Analyse Financière</p>
          </div>
        </div>
      </div>
    </header>
  )
}