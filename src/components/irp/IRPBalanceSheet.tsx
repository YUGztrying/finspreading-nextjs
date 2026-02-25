// src/components/irp/IRPBalanceSheet.tsx
'use client'

import { forwardRef, useImperativeHandle, useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import {
  assetsStructureMicrofinance,
  liabilitiesStructureMicrofinance,
  assetsStructureBank,
  liabilitiesStructureBank,
  IRPLineItem
} from '@/lib/irp/structures'
import { calculateAllLines } from '@/lib/irp/calculator'

interface IRPBalanceSheetProps {
  data: {
    company_name: string
    type_institution: string
    periods: string[]
    period_labels?: string[]
    actifs: any
    passifs: any
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

const IRPBalanceSheet = forwardRef(({ data }: IRPBalanceSheetProps, ref) => {
  const [editedValues, setEditedValues] = useState<Record<string, number>>({})
  
  const isBank = data.type_institution === 'banque'

  const assetsStructure = isBank ? assetsStructureBank : assetsStructureMicrofinance
  const liabilitiesStructure = isBank ? liabilitiesStructureBank : liabilitiesStructureMicrofinance

  // Calculate all values
  const calculatedAssets = useMemo(() => {
    const sourceLineItems = data.actifs?.line_items || []
    return calculateAllLines(assetsStructure, sourceLineItems, data.periods.length)
  }, [data.actifs, data.periods, assetsStructure])

  const calculatedLiabilities = useMemo(() => {
    const sourceLineItems = data.passifs?.line_items || []
    return calculateAllLines(liabilitiesStructure, sourceLineItems, data.periods.length)
  }, [data.passifs, data.periods, liabilitiesStructure])

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
      const assets = []
      const liabilities = []

      // Process assets
      for (const item of assetsStructure) {
        if (item.type === 'header' || item.type === 'subheader') continue
        const values = calculatedAssets.get(item.title) || []
        const finalValues = values.map((v, i) => getFinalValue(item.title, i, v))
        assets.push({ title: item.title, values: finalValues })
      }

      // Process liabilities
      for (const item of liabilitiesStructure) {
        if (item.type === 'header' || item.type === 'subheader') continue
        const values = calculatedLiabilities.get(item.title) || []
        const finalValues = values.map((v, i) => getFinalValue(item.title, i, v))
        liabilities.push({ title: item.title, values: finalValues })
      }

      return { assets, liabilities }
    }
  }))

  const renderStructure = (
    structure: IRPLineItem[],
    calculatedData: Map<string, number[]>,
    sectionTitle: string,
    headerColor: string
  ) => {
    return (
      <div className="mb-8">
        <div className={`${headerColor} text-white p-3 font-bold`}>
          {sectionTitle}
        </div>
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
            {structure.map((item, index) => {
              if (item.type === 'header') {
                return (
                  <TableRow key={index} className="bg-blue-600 text-white">
                    <TableCell colSpan={data.periods.length + 1} className="font-bold p-3">
                      {item.title}
                    </TableCell>
                  </TableRow>
                )
              }

              if (item.type === 'subheader') {
                return (
                  <TableRow key={index} className="bg-blue-100">
                    <TableCell colSpan={data.periods.length + 1} className="font-semibold text-blue-800 p-3">
                      {item.title}
                    </TableCell>
                  </TableRow>
                )
              }

              const values = calculatedData.get(item.title) || Array(data.periods.length).fill(0)
              const rowClass = item.isTotal || item.type === 'finalTotal' ? 'bg-amber-50 font-bold' : ''

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
    )
  }

  return (
    <Card className="border-stone-200 bg-white shadow-sm">
      <CardHeader className="border-b border-stone-100">
        <CardTitle className="flex items-center gap-3 text-xl font-medium text-stone-900">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
          Balance Sheet - Complete IRP Format ({isBank ? 'BANQUE' : 'MICROFINANCE'})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {/* ASSETS */}
          {renderStructure(assetsStructure, calculatedAssets, '=== ASSETS ===', 'bg-blue-600')}
          
          {/* LIABILITIES & EQUITY */}
          {renderStructure(liabilitiesStructure, calculatedLiabilities, '=== LIABILITIES & EQUITY ===', 'bg-blue-600')}
        </div>
      </CardContent>
    </Card>
  )
})

IRPBalanceSheet.displayName = 'IRPBalanceSheet'

export default IRPBalanceSheet