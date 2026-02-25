// src/components/irp/IRPIncomeStatement.tsx
'use client'

import { forwardRef, useImperativeHandle, useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import {
  incomeStatementStructureMicrofinance,
  incomeStatementStructureBank,
  IRPLineItem
} from '@/lib/irp/structures'
import { calculateAllLines } from '@/lib/irp/calculator'

interface IRPIncomeStatementProps {
  data: {
    company_name: string
    type_institution: string
    periods: string[]
    period_labels?: string[]
    compte_resultats: any
  }
}

const formatNumber = (num: number | null) => {
  if (num == null || isNaN(num)) return ''
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

const parseNumber = (str: string) => {
  if (!str || str === '') return 0
  const cleanedStr = str.replace(/,/g, '').replace(/[^0-9.-]/g, '')
  return parseFloat(cleanedStr) || 0
}

const IRPIncomeStatement = forwardRef(({ data }: IRPIncomeStatementProps, ref) => {
  const [editedValues, setEditedValues] = useState<Record<string, number>>({})
  
  const isBank = data.type_institution === 'banque'
  
  // Select appropriate structure
  const incomeStructure = isBank ? incomeStatementStructureBank : incomeStatementStructureMicrofinance

  // Calculate all values
  const calculatedIncome = useMemo(() => {
    const sourceLineItems = data.compte_resultats?.line_items || []
    return calculateAllLines(incomeStructure, sourceLineItems, data.periods.length)
  }, [data.compte_resultats, data.periods, incomeStructure])

  // Reset edited values when data changes
  useEffect(() => {
    setEditedValues({})
  }, [data.company_name, data.type_institution])

  // Apply edits
  const getFinalValue = (rowTitle: string, periodIndex: number, calculatedValue: number) => {
    const editKey = `${rowTitle}_${periodIndex}`
    return editedValues[editKey] !== undefined ? editedValues[editKey] : calculatedValue
  }

  // Handle cell edit
  const handleCellEdit = (rowTitle: string, periodIndex: number, value: string) => {
    const numValue = parseNumber(value)
    const editKey = `${rowTitle}_${periodIndex}`
    setEditedValues(prev => ({ ...prev, [editKey]: numValue }))
  }

  // Expose data for export
  useImperativeHandle(ref, () => ({
    getCalculatedData: () => {
      const rows = []

      for (const item of incomeStructure) {
        if (item.type === 'header' || item.type === 'subheader') continue
        const values = calculatedIncome.get(item.title) || []
        const finalValues = values.map((v, i) => getFinalValue(item.title, i, v))
        rows.push({ title: item.title, values: finalValues })
      }

      return rows
    }
  }))

  if (!data.compte_resultats) {
    return (
      <Card className="border-stone-200 bg-white shadow-sm">
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-stone-900 mb-3">
            Aucun compte de résultats disponible
          </h3>
          <p className="text-stone-600">
            Téléchargez un document de compte de résultats pour voir cette section
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-stone-200 bg-white shadow-sm">
      <CardHeader className="border-b border-stone-100">
        <CardTitle className="flex items-center gap-3 text-xl font-medium text-stone-900">
          <BarChart3 className="w-6 h-6 text-purple-600" />
          {isBank ? 'BANQUE' : 'MICROFINANCE'} TEMPLATE : INCOME STATEMENT
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50 border-b-2 border-stone-200">
                <TableHead className="font-semibold text-stone-700 w-1/2">Description</TableHead>
                {data.periods.map((period, index) => (
                  <TableHead key={index} className="font-semibold text-stone-700 text-right">
                    {data.period_labels?.[index] ?? format(new Date(period), 'MMM yyyy')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomeStructure.map((item, index) => {
                if (item.type === 'header') {
                  return (
                    <TableRow key={index} className="bg-purple-600 text-white">
                      <TableCell colSpan={data.periods.length + 1} className="font-bold p-3">
                        {item.title}
                      </TableCell>
                    </TableRow>
                  )
                }

                if (item.type === 'subheader') {
                  return (
                    <TableRow key={index} className="bg-purple-100">
                      <TableCell colSpan={data.periods.length + 1} className="font-semibold text-purple-800 p-3">
                        {item.title}
                      </TableCell>
                    </TableRow>
                  )
                }

                const values = calculatedIncome.get(item.title) || Array(data.periods.length).fill(0)
                const rowClass = item.isTotal || item.type === 'majorTotal' || item.type === 'finalTotal' 
                  ? 'bg-amber-50 font-bold' 
                  : ''

                return (
                  <TableRow key={index} className={rowClass}>
                    <TableCell className="font-medium p-3">{item.title}</TableCell>
                    {values.map((value, periodIndex) => {
                      const finalValue = getFinalValue(item.title, periodIndex, value)
                      const isEdited = editedValues[`${item.title}_${periodIndex}`] !== undefined

                      return (
                        <TableCell key={periodIndex} className="p-1">
                          <Input
                            type="text"
                            value={formatNumber(finalValue)}
                            onChange={(e) => handleCellEdit(item.title, periodIndex, e.target.value)}
                            onFocus={(e) => {
                              const val = parseNumber(e.target.value)
                              e.target.value = val.toString()
                            }}
                            onBlur={(e) => {
                              const val = parseNumber(e.target.value)
                              e.target.value = formatNumber(val)
                            }}
                            className={`text-right border-0 shadow-none p-2 h-8 ${
                              isEdited ? 'bg-yellow-50 border border-yellow-300' : 'bg-transparent'
                            } ${item.isCalculated ? 'bg-gray-50 text-gray-600' : ''}`}
                            readOnly={item.isCalculated}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
})

IRPIncomeStatement.displayName = 'IRPIncomeStatement'

export default IRPIncomeStatement