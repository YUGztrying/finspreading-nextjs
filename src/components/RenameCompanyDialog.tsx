'use client'

import { useState } from 'react'
import { Pencil, Loader2 } from 'lucide-react'

interface RenameCompanyDialogProps {
  currentName: string
  statementType: string
  userId: string
  onSuccess: () => void
}

export default function RenameCompanyDialog({ 
  currentName, 
  statementType,
  userId,
  onSuccess 
}: RenameCompanyDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newName, setNewName] = useState(currentName)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRename = async () => {
    if (!newName.trim() || newName === currentName) {
      setError('Veuillez entrer un nouveau nom différent')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/statements/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_company_name: currentName,
          new_company_name: newName.trim(),
          statement_type: statementType,
          user_id: userId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du renommage')
      }

      console.log('✅ Rename success:', data)
      setIsOpen(false)
      onSuccess()
    } catch (err) {
      console.error('❌ Rename error:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors"
        title="Renommer l'entreprise"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* Dialog Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <h2 className="text-xl font-semibold text-stone-900 mb-4">
              Renommer l'entreprise
            </h2>

            {/* Content */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Nom actuel
                </label>
                <input
                  type="text"
                  value={currentName}
                  disabled
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Nouveau nom
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Entrez le nouveau nom"
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  ℹ️ Si ce nom existe déjà, les états financiers seront fusionnés automatiquement.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setNewName(currentName)
                  setError(null)
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRename}
                disabled={isLoading || !newName.trim() || newName === currentName}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Renommage...
                  </>
                ) : (
                  'Renommer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}