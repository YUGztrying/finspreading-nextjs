// src/app/api/extract-data/route.ts
// API Route to extract financial data from PDFs using Claude API
// Ported from Base44 ExtractDataFromUploadedFile

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { file_url, institution_type = 'banque' } = body

    if (!file_url) {
      return NextResponse.json(
        { error: 'file_url is required' },
        { status: 400 }
      )
    }

    console.log('📄 Extracting data from PDF:', file_url)
    console.log('🏦 Institution type:', institution_type)

    // Step 1: Fetch the PDF file
    const response = await fetch(file_url)
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`)
    }

    const pdfBuffer = await response.arrayBuffer()
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64')

    console.log('📦 PDF size:', (pdfBuffer.byteLength / 1024).toFixed(2), 'KB')

    // Step 2: Create extraction prompt
    const extractionPrompt = `Tu es un expert comptable spécialisé dans l'analyse d'états financiers ${institution_type === 'banque' ? 'bancaires' : 'de microfinance'}.

Analyse ce document PDF et extrais les données financières structurées.

INSTRUCTIONS CRITIQUES:
1. Identifie le type d'état financier (actifs, passifs, hors_bilan, compte_resultats)
2. Extrais TOUS les postes comptables avec leurs codes et montants
3. Détecte les périodes (dates) dans les en-têtes de colonnes
4. Pour chaque ligne, extrais: code poste, description, et montants pour chaque période
5. Identifie les sous-totaux et totaux (is_subtotal, is_total)
6. Préserve la structure hiérarchique (indent_level)

FORMAT DE SORTIE (JSON strict):
{
  "company_name": "Nom de l'institution",
  "statement_type": "actifs|passifs|hors_bilan|compte_resultats",
  "periods": ["2024-12-31", "2023-12-31"],
  "line_items": [
    {
      "poste": "ACTIF_01",
      "description": "Caisse, Banque Centrale",
      "amounts": [1000000, 900000],
      "is_subtotal": false,
      "is_total": false,
      "indent_level": 0
    }
  ]
}

RÈGLES:
- Les montants doivent être des NOMBRES, pas des strings
- Les périodes au format YYYY-MM-DD
- Ne pas inventer de données, extrais uniquement ce qui est visible
- Si un montant n'est pas lisible, utilise 0
- Les codes postes doivent suivre la nomenclature ${institution_type === 'banque' ? 'bancaire (ACTIF_01, PASSIF_01, etc.)' : 'microfinance (MFA_A10, MFP_G10, etc.)'}

Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`

    // Step 3: Call Claude API
    console.log('🤖 Calling Claude API...')
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: extractionPrompt,
            },
          ],
        },
      ],
    })

    console.log('✅ Claude API response received')
    console.log('Usage:', message.usage)

    // Step 4: Extract JSON from Claude's response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    console.log('📝 Raw response length:', responseText.length)

    // Try to find JSON in the response
    let extractedData: any
    
    // Look for JSON block (might be wrapped in ```json ... ```)
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                     responseText.match(/```\n([\s\S]*?)\n```/) ||
                     responseText.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      try {
        extractedData = JSON.parse(jsonStr)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        throw new Error('Failed to parse JSON from Claude response')
      }
    } else {
      throw new Error('No JSON found in Claude response')
    }

    // Step 5: Validate extracted data
    if (!extractedData.statement_type || !extractedData.line_items) {
      throw new Error('Invalid data structure from Claude')
    }

    // Step 6: Clean and normalize the data
    const cleanedData = {
      company_name: extractedData.company_name || 'Unknown',
      statement_type: extractedData.statement_type,
      periods: extractedData.periods || [],
      line_items: extractedData.line_items.map((item: any) => ({
        poste: item.poste || '',
        description: item.description || '',
        amounts: Array.isArray(item.amounts) ? item.amounts.map(Number) : [],
        is_subtotal: Boolean(item.is_subtotal),
        is_total: Boolean(item.is_total),
        indent_level: Number(item.indent_level) || 0,
        manual: false,
        flags: []
      }))
    }

    console.log('🎯 Extraction complete:')
    console.log('  - Company:', cleanedData.company_name)
    console.log('  - Type:', cleanedData.statement_type)
    console.log('  - Periods:', cleanedData.periods.length)
    console.log('  - Line items:', cleanedData.line_items.length)

    return NextResponse.json({
      success: true,
      data: cleanedData,
      summary: {
        company_name: cleanedData.company_name,
        statement_type: cleanedData.statement_type,
        periods_count: cleanedData.periods.length,
        line_items_count: cleanedData.line_items.length,
        tokens_used: message.usage.input_tokens + message.usage.output_tokens
      }
    })

  } catch (error: any) {
    console.error('❌ PDF extraction error:', error)
    
    // Handle specific errors
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        {
          error: 'Configuration error',
          details: 'Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to .env.local'
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: error.message || 'PDF extraction failed',
        details: 'An error occurred while processing the PDF with AI. The file might be corrupted or not readable.'
      },
      { status: 500 }
    )
  }
}