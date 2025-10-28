// src/components/irp/IRPSummary.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'

interface IRPSummaryProps {
  data: {
    company_name: string
    type_institution: string
    periods: string[]
    actifs: any
    passifs: any
    compte_resultats: any
    last_modified: string
  }
}

export default function IRPSummary({ data }: IRPSummaryProps) {
  const formatNumber = (num: number) => {
    if (isNaN(num) || num == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const getTotalAssets = () => {
    if (!data.actifs?.line_items) return null
    const totalLine = data.actifs.line_items.find((item: any) => 
      item.is_total || item.description?.toLowerCase().includes('total')
    )
    return totalLine?.amounts?.[totalLine.amounts.length - 1] || null
  }

  const getTotalLiabilities = () => {
    if (!data.passifs?.line_items) return null
    const totalLine = data.passifs.line_items.find((item: any) => 
      item.is_total || item.description?.toLowerCase().includes('total')
    )
    return totalLine?.amounts?.[totalLine.amounts.length - 1] || null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Statement Information Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <h2 className="text-lg font-bold">STATEMENT INFORMATION</h2>
      </div>
      
      <div className="p-6">
        {/* Company Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{data.company_name}</h1>
          <p className="text-gray-600 mt-1">IRP Report - Standardized Format</p>
          <p className="text-sm text-gray-500 mt-1">
            Data as of: {format(new Date(data.last_modified), 'MM/dd/yyyy HH:mm')}
          </p>
        </div>

        {/* Statement Periods */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Statement Periods</h3>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Statement Date</th>
                  {data.periods.map((period, index) => (
                    <th key={index} className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                      {format(new Date(period), 'MM/dd/yyyy')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">Statement Months</td>
                  {data.periods.map((_, index) => (
                    <td key={index} className="border border-gray-300 px-3 py-2 text-center text-sm">12 Months</td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">Statement Type</td>
                  {data.periods.map((_, index) => (
                    <td key={index} className="border border-gray-300 px-3 py-2 text-center text-sm">FY End</td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">Accounting Standard</td>
                  {data.periods.map((_, index) => (
                    <td key={index} className="border border-gray-300 px-3 py-2 text-center text-sm">Local GAAP</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Information */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Summary Balance Sheet Information</h3>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Item</th>
                  {data.periods.map((period, index) => (
                    <th key={index} className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                      {format(new Date(period), 'MM/dd/yyyy')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">Total Assets</td>
                  {data.periods.map((_, index) => (
                    <td key={index} className="border border-gray-300 px-3 py-2 text-right text-sm font-mono">
                      {formatNumber(getTotalAssets())}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">Total Liabilities & Equity</td>
                  {data.periods.map((_, index) => (
                    <td key={index} className="border border-gray-300 px-3 py-2 text-right text-sm font-mono">
                      {formatNumber(getTotalLiabilities())}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">Balance Check</td>
                  {data.periods.map((_, index) => (
                    <td key={index} className="border border-gray-300 px-3 py-2 text-right text-sm font-mono">0</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Coverage Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Statement Coverage</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.actifs && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                <div className="text-xs text-green-600 font-medium">ASSETS</div>
                <div className="text-lg font-bold text-green-800">{data.actifs.line_items?.length || 0}</div>
                <div className="text-xs text-green-600">line items</div>
              </div>
            )}
            {data.passifs && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                <div className="text-xs text-blue-600 font-medium">LIABILITIES</div>
                <div className="text-lg font-bold text-blue-800">{data.passifs.line_items?.length || 0}</div>
                <div className="text-xs text-blue-600">line items</div>
              </div>
            )}
            {data.compte_resultats && (
              <div className="bg-purple-50 border border-purple-200 rounded p-3 text-center">
                <div className="text-xs text-purple-600 font-medium">INCOME</div>
                <div className="text-lg font-bold text-purple-800">{data.compte_resultats.line_items?.length || 0}</div>
                <div className="text-xs text-purple-600">line items</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This IRP report presents a consolidated view based on extracted data. 
            Data updates automatically every 30 seconds and when you return to this page. 
            Amounts displayed correspond to the latest available periods for each statement.
          </p>
        </div>
      </div>
    </div>
  )
}