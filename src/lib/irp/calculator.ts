// src/lib/irp/calculator.ts
// IRP Report Calculator - Processes financial statements into IRP format

import { IRPLineItem } from './structures'
import { LineItem } from '@/types/database.types'

interface CalculatedRow {
  title: string
  values: number[]
}

/**
 * Find line items by normalized codes
 */
function findLineItemsByCodes(
  codes: string[],
  lineItems: LineItem[]
): LineItem[] {
  return lineItems.filter(item => codes.includes(item.poste))
}

/**
 * Sum amounts from multiple line items for a specific period
 */
function sumAmountsForPeriod(
  lineItems: LineItem[],
  periodIndex: number
): number {
  return lineItems.reduce((sum, item) => {
    const amount = item.amounts[periodIndex] || 0
    return sum + amount
  }, 0)
}

/**
 * Calculate values for a single IRP line item
 */
function calculateLineItem(
  item: IRPLineItem,
  sourceLineItems: LineItem[],
  numPeriods: number,
  calculatedRows: Map<string, number[]>
): number[] {
  // If it has a default value, use it for all periods
  if (item.defaultValue !== undefined) {
    return Array(numPeriods).fill(item.defaultValue)
  }

  // If it's calculated from components
  if (item.isCalculated && item.components) {
    const values: number[] = Array(numPeriods).fill(0)
    
    for (let periodIndex = 0; periodIndex < numPeriods; periodIndex++) {
      let periodTotal = 0
      
      for (const component of item.components) {
        if (typeof component === 'string') {
          // Simple addition
          const componentValues = calculatedRows.get(component)
          if (componentValues) {
            periodTotal += componentValues[periodIndex] || 0
          }
        } else {
          // Component with sign (for income statement)
          const componentValues = calculatedRows.get(component.name)
          if (componentValues) {
            const value = componentValues[periodIndex] || 0
            periodTotal += component.sign === '+' ? value : -value
          }
        }
      }
      
      // Handle subtraction for items like "Less: Accumulated Depreciation"
      if (item.isSubtraction || item.title.toLowerCase().includes('less:')) {
        // Special handling for subtraction components
        // "Gross Loans" - "Unearned Income" - "Allowance"
        const firstComponent = item.components[0]
        if (typeof firstComponent === 'string') {
          const firstValue = calculatedRows.get(firstComponent)?.[periodIndex] || 0
          periodTotal = firstValue
          
          // Subtract the rest
          for (let i = 1; i < item.components.length; i++) {
            const comp = item.components[i]
            if (typeof comp === 'string') {
              const compValues = calculatedRows.get(comp)
              if (compValues) {
                periodTotal -= compValues[periodIndex] || 0
              }
            }
          }
        }
      }
      
      values[periodIndex] = periodTotal
    }
    
    return values
  }

  // If it has keywords (mapped codes)
  if (item.keywords && item.keywords.length > 0) {
    const values: number[] = []
    
    for (let periodIndex = 0; periodIndex < numPeriods; periodIndex++) {
      let total = 0
      
      for (const keyword of item.keywords) {
        // Check if keyword starts with minus sign (subtraction)
        const isSubtraction = keyword.startsWith('-')
        const cleanKeyword = isSubtraction ? keyword.substring(1) : keyword
        
        const matchingItems = findLineItemsByCodes([cleanKeyword], sourceLineItems)
        const sum = sumAmountsForPeriod(matchingItems, periodIndex)
        
        total += isSubtraction ? -sum : sum
      }
      
      values.push(total)
    }
    
    return values
  }

  // Default: zeros
  return Array(numPeriods).fill(0)
}

/**
 * Calculate all lines in a structure
 */
export function calculateAllLines(
  structure: IRPLineItem[],
  sourceLineItems: LineItem[],
  numPeriods: number
): Map<string, number[]> {
  const calculatedRows = new Map<string, number[]>()
  
  // Process each line in order
  for (const item of structure) {
    // Skip headers and subheaders
    if (item.type === 'header' || item.type === 'subheader') {
      continue
    }
    
    const values = calculateLineItem(item, sourceLineItems, numPeriods, calculatedRows)
    calculatedRows.set(item.title, values)
  }
  
  return calculatedRows
}

/**
 * Generate IRP report data for a company
 */
export interface IRPReportData {
  companyName: string
  institutionType: 'bank' | 'microfinance'
  periods: string[]
  balanceSheet: {
    assets: CalculatedRow[]
    liabilities: CalculatedRow[]
  }
  incomeStatement: CalculatedRow[]
}

export function generateIRPReport(
  companyName: string,
  institutionType: 'bank' | 'microfinance',
  periods: string[],
  assetsStructure: IRPLineItem[],
  liabilitiesStructure: IRPLineItem[],
  incomeStructure: IRPLineItem[],
  assetsLineItems: LineItem[],
  liabilitiesLineItems: LineItem[],
  incomeLineItems: LineItem[]
): IRPReportData {
  const numPeriods = periods.length

  // Calculate assets
  const assetsCalculated = calculateAllLines(assetsStructure, assetsLineItems, numPeriods)
  const assetsRows: CalculatedRow[] = []
  for (const item of assetsStructure) {
    if (item.type === 'header' || item.type === 'subheader') continue
    const values = assetsCalculated.get(item.title) || []
    assetsRows.push({ title: item.title, values })
  }

  // Calculate liabilities
  const liabilitiesCalculated = calculateAllLines(liabilitiesStructure, liabilitiesLineItems, numPeriods)
  const liabilitiesRows: CalculatedRow[] = []
  for (const item of liabilitiesStructure) {
    if (item.type === 'header' || item.type === 'subheader') continue
    const values = liabilitiesCalculated.get(item.title) || []
    liabilitiesRows.push({ title: item.title, values })
  }

  // Calculate income statement
  const incomeCalculated = calculateAllLines(incomeStructure, incomeLineItems, numPeriods)
  const incomeRows: CalculatedRow[] = []
  for (const item of incomeStructure) {
    if (item.type === 'header' || item.type === 'subheader') continue
    const values = incomeCalculated.get(item.title) || []
    incomeRows.push({ title: item.title, values })
  }

  return {
    companyName,
    institutionType,
    periods,
    balanceSheet: {
      assets: assetsRows,
      liabilities: liabilitiesRows
    },
    incomeStatement: incomeRows
  }
}