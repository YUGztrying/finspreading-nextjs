// src/app/api/extract-data/route.ts
// API Route to extract financial data from PDFs using Claude API
// Updated to handle multi-statement PDFs (actifs, passifs, compte_resultats, hors_bilan in one file)

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

    // Step 2: Create extraction prompt for MULTIPLE statements
    const extractionPrompt = `Tu es un expert comptable spécialisé dans l'analyse d'états financiers ${institution_type === 'banque' ? 'bancaires' : 'de microfinance'}.

Analyse ce document PDF qui peut contenir PLUSIEURS états financiers (actifs, passifs, hors_bilan, compte_resultats).

INSTRUCTIONS CRITIQUES:
1. Détecte TOUS les types d'états financiers présents dans le document
2. Pour CHAQUE état financier trouvé, extrais séparément:
   - Le type (actifs, passifs, hors_bilan, compte_resultats)
   - TOUS les postes comptables avec leurs codes et montants
   - Les périodes (dates) dans les en-têtes
3. Pour chaque ligne, extrais: code poste, description, et montants pour chaque période
4. Identifie les sous-totaux et totaux (is_subtotal, is_total)
5. Préserve la structure hiérarchique (indent_level)

FORMAT DE SORTIE (JSON strict) - TABLEAU d'états financiers:
{
  "company_name": "Nom de l'institution",
  "statements": [
    {
      "statement_type": "actifs",
      "periods": ["2024-12-31", "2023-12-31"],
      "line_items": [
        {
          "poste": "RBA_0010",
          "description": "Caisse, Banque Centrale, CCP",
          "amounts": [1000000, 900000],
          "is_subtotal": false,
          "is_total": false,
          "indent_level": 0
        }
      ]
    },
    {
      "statement_type": "passifs",
      "periods": ["2024-12-31", "2023-12-31"],
      "line_items": [
        {
          "poste": "RBP_0010",
          "description": "Banque Centrale, CCP",
          "amounts": [500000, 400000],
          "is_subtotal": false,
          "is_total": false,
          "indent_level": 0
        }
      ]
    }
  ]
}

RÈGLES:
- Les montants doivent être des NOMBRES, pas des strings
- Les périodes au format YYYY-MM-DD
- Garde les CODES ORIGINAUX du document (RBA_0010, RBP_0010, RCR_0010, RHB_0010, etc.)
- Ne pas inventer de données, extrais uniquement ce qui est visible
- Si un montant n'est pas lisible, utilise 0
- Si le document contient UN SEUL état financier, retourne quand même un tableau avec un élément
- Les types valides: "actifs", "passifs", "hors_bilan", "compte_resultats"

IMPORTANT: Retourne TOUS les états financiers trouvés dans le PDF, pas seulement le premier!

Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`

    // Step 3: Call Claude API
    console.log('🤖 Calling Claude API...')
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
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

    // Step 4: Parse response
    const textContent = message.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response')
    }

    const rawResponse = textContent.text
    console.log('📝 Raw response length:', rawResponse.length)

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawResponse.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    let parsedData
    try {
      parsedData = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse JSON:', jsonStr.substring(0, 500))
      throw new Error('Invalid JSON response from Claude API')
    }

    // Validate structure
    if (!parsedData.company_name || !parsedData.statements || !Array.isArray(parsedData.statements)) {
      throw new Error('Invalid response structure - missing company_name or statements array')
    }

    // Log extraction results
    console.log('🎯 Extraction complete:')
    console.log(`  - Company: ${parsedData.company_name}`)
    console.log(`  - Statements found: ${parsedData.statements.length}`)
    
    for (const statement of parsedData.statements) {
      console.log(`  - ${statement.statement_type}: ${statement.line_items?.length || 0} lines, ${statement.periods?.length || 0} periods`)
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      summary: {
        company: parsedData.company_name,
        total_statements: parsedData.statements.length,
        statements: parsedData.statements.map((s: any) => ({
          type: s.statement_type,
          lines: s.line_items?.length || 0,
          periods: s.periods?.length || 0
        }))
      }
    })

  } catch (error: any) {
    console.error('❌ Extraction error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to extract data',
        details: 'An error occurred during PDF extraction'
      },
      { status: 500 }
    )
  }
}