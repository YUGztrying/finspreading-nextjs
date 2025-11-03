# FinSpreading - Financial Statement Analysis Platform

Modern financial analysis application built for IFC (World Bank) analysts to automate the analysis and standardization of financial statements from banks and microfinances, ensuring compliance with IRP (Investment Risk Platform) standards.

## Overview

FinSpreading replaces the legacy Base44 implementation with a modern, performant stack built on Next.js 15 and Supabase. The application provides:

- **AI-powered document extraction** from PDFs and Excel files
- **Intelligent normalization** handling different institution types (banks vs microfinance)
- **Interactive editable tables** with drag-and-drop functionality
- **IRP report generation** with manual override capabilities
- **Comprehensive audit trails** for all data changes

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **AI Processing**: Anthropic Claude API (document extraction)
- **File Processing**: ExcelJS, PDF parsing
- **UI Components**: shadcn/ui, Radix UI
- **Deployment**: Vercel

## Features

### 1. Document Upload & Processing
- Upload PDF or Excel financial statements
- AI-powered extraction using Claude API
- Automatic classification (Actifs, Passifs, Compte de Résultats, Hors-Bilan)
- Institution type detection (Bank vs Microfinance)

### 2. Financial Statement Management
- **Actifs (Assets)** - View and edit asset positions
- **Passifs (Liabilities)** - Manage liability accounts
- **Compte de Résultats (Income Statement)** - Track revenues and expenses
- **Hors-Bilan (Off-Balance Sheet)** - Monitor off-balance sheet items

### 3. Interactive Tables
- Real-time editing with validation
- Add/remove line items
- Multi-period support
- Automatic calculations
- Color-coded rows (totals, subtotals, manual entries)

### 4. Company Management
- Rename companies across all statements
- Merge data from multiple uploads
- Company selector dropdown
- Export to Excel (all statements)

### 5. IRP Report Generation
- Standardized IRP format for banks and microfinance
- Balance sheet mapping
- Income statement mapping
- CSV export for IRP submission
- Manual override capabilities

## Architecture
```
finspreading-nextjs/
├── src/
│   ├── app/                          # Next.js 15 App Router
│   │   ├── (auth)/                   # Authentication routes
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/              # Protected routes
│   │   │   ├── actifs/
│   │   │   ├── passifs/
│   │   │   ├── compte-resultats/
│   │   │   ├── hors-bilan/
│   │   │   ├── rapport-irp/
│   │   │   ├── dashboard/
│   │   │   └── upload/
│   │   └── api/                      # API routes
│   │       ├── extract-data/         # Claude AI extraction
│   │       ├── process-excel/        # Excel processing
│   │       └── statements/           # CRUD operations
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── statements/               # Statement tables
│   │   └── irp/                      # IRP report components
│   ├── lib/                          # Utilities & logic
│   │   ├── supabase/                 # Supabase clients
│   │   ├── statements/               # Business logic
│   │   │   ├── database.ts           # DB operations
│   │   │   ├── normalize.ts          # Normalization rules
│   │   │   ├── validate.ts           # Validation
│   │   │   └── mappings/             # Financial code mappings
│   │   └── irp/                      # IRP structures
│   └── types/                        # TypeScript definitions
├── supabase/
│   └── migrations/                   # Database migrations
└── public/                           # Static assets
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Anthropic API key (Claude)

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd finspreading-nextjs
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Supabase

Create a new Supabase project at [supabase.com](https://supabase.com)

Run the database migration:
```bash
# Copy migration SQL from supabase/migrations/001_initial_schema.sql
# Execute in Supabase SQL Editor
```

### 4. Configure environment variables

Create `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Set up Supabase Storage

Create storage buckets in Supabase Dashboard:
- `financial-documents` (public read, authenticated write)

### 6. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Schema

### Tables

**financial_statements**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `company_name` (text)
- `type_institution` (enum: 'banque' | 'microfinance')
- `statement_type` (enum: 'actifs' | 'passifs' | 'compte_resultats' | 'hors_bilan')
- `periods` (text[], array of ISO date strings)
- `line_items` (jsonb, array of financial line items)
- `source_files` (text[], array of file names)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**LineItem Structure**
```typescript
{
  poste: string           // Financial code (e.g., "MFA_A11")
  description: string     // Line description
  amounts: number[]       // Values for each period
  is_subtotal?: boolean   // Subtotal indicator
  is_total?: boolean      // Total indicator
  indent_level?: number   // Indentation level
  manual?: boolean        // Manually added
  flags?: string[]        // Validation flags
}
```

## API Routes

### POST /api/extract-data
Extract financial data from PDF using Claude AI

**Request:**
```typescript
{
  file_url: string
  institution_type: 'banque' | 'microfinance'
}
```

### POST /api/process-excel
Process Excel financial statements

**Request:**
```typescript
{
  file_url: string
  institution_type: 'banque' | 'microfinance'
}
```

### POST /api/statements/save
Save processed financial statement

### GET /api/statements/list
List user's financial statements

**Query params:**
- `user_id` (required)
- `company_name` (optional)
- `statement_type` (optional)

### POST /api/statements/rename
Rename a company across all statements

### POST /api/statements/export
Export company statements to Excel

### POST /api/statements/irp-export
Generate IRP-compliant CSV report

## Deployment (Vercel)

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure environment variables (same as `.env.local`)
5. Deploy

### 3. Configure Supabase

Update Supabase project settings:
- Add Vercel domain to "Allowed Redirect URLs"
- Add Vercel domain to "Site URL"

### 4. Update Environment

In `.env.local` and Vercel:
```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Development

### Code Style
```bash
npm run lint        # Run ESLint
npm run build       # Production build
npm run type-check  # TypeScript check
```

### Key Conventions

- Use `async/await` for all async operations
- Handle errors with try-catch blocks
- Log important operations with emojis for visibility
- Use TypeScript strict mode
- Follow Next.js 15 App Router patterns

### Adding a New Statement Type

1. Add to database enum in `supabase/migrations/`
2. Create mapping in `src/lib/statements/mappings/`
3. Add normalization rules in `src/lib/statements/normalize.ts`
4. Create page in `src/app/(dashboard)/`
5. Update IRP structures if needed

## Normalization Rules

The application uses sophisticated normalization rules to standardize financial data:

### Banks (Banque)
- Uses BCEAO/OHADA chart of accounts
- Codes: `ACTIF_XX`, `PASSIF_XX`, `CR_XX`
- Automatic mapping to IRP structure

### Microfinance (Microfinance)
- Uses MIX Market taxonomy
- Codes: `MFA_XXX` (assets), `MFP_XXX` (liabilities), `MFC_XXX` (income statement)
- Handles special microfinance categories

## Troubleshooting

### Build Errors

**TypeScript errors with Supabase client:**
```typescript
// Use type assertion
const supabase = createClient() as any
```

**Missing environment variables:**
Check `.env.local` and ensure all required variables are set

### Runtime Issues

**502 errors during upload:**
- Check file size (max 50MB)
- Verify Anthropic API key
- Check Supabase Storage bucket permissions

**RLS policy errors:**
- Ensure user is authenticated
- Check RLS policies in Supabase Dashboard

## Performance Considerations

- File uploads: ~5-10 seconds for PDF processing
- Excel processing: < 2 seconds
- Statement merging: < 1 second
- Database queries: < 100ms with proper indexing

## Security

- Row Level Security (RLS) enabled on all tables
- User isolation via `user_id` foreign key
- File uploads require authentication
- Service role key only used server-side
- CORS configured for production domain

## Coûts et Infrastructure

### Architecture de l'Application

**Important:** Les analystes IFC n'ont **AUCUN** besoin de compte Vercel. Ils se connectent directement via l'application web avec leur email/mot de passe (Supabase Auth).

- **Vercel:** Hébergement de l'application (pour développeurs uniquement)
- **Supabase:** Base de données, authentification, stockage (pour tous les analystes)
- **Anthropic Claude:** Intelligence artificielle pour extraction de documents

---

### Coûts Actuels (Configuration Gratuite)

L'application fonctionne actuellement avec les plans gratuits:

#### Vercel (Hébergement)
- **Plan actuel:** Hobby (Gratuit)
- **Inclus:**
  - 100 GB bandwidth/mois
  - Déploiements illimités
  - HTTPS automatique
  - Utilisateurs illimités dans l'app
- **Limitations:**
  - 1 développeur seulement
  - Support communautaire
- **Coût:** $0/mois

#### Supabase (Backend)
- **Plan actuel:** Free Tier
- **Inclus:**
  - 500 MB base de données
  - 1 GB stockage fichiers
  - 50,000 utilisateurs actifs/mois
  - 2 GB bandwidth
  - Authentication illimitée
- **Limitations:**
  - Pause après 1 semaine d'inactivité
  - Pas de backups automatiques
- **Coût:** $0/mois

#### Anthropic Claude API
- **Pay-as-you-go**
- **Coût par document PDF:**
  - Claude Sonnet: ~$0.015 (précis)
  - Claude Haiku: ~$0.004 (rapide, moins cher)
- **Estimation:**
  - 10 docs/mois: $0.15
  - 50 docs/mois: $0.75
  - 100 docs/mois: $1.50
- **Coût:** $0-2/mois

**COÛT TOTAL PHASE TEST: $0-2/mois** ✅

---

### Plans Professionnels (Production)

#### Vercel Pro
- **Coût:** $20/mois par développeur
- **Nécessaire si:**
  - Besoin de plusieurs développeurs
  - Analytics détaillés requis
  - Support technique prioritaire
- **Note:** Les analystes n'ont PAS besoin de compte Vercel

#### Supabase Pro
- **Coût:** $25/mois (équipe illimitée)
- **Inclus:**
  - 8 GB base de données
  - 100 GB stockage
  - 250,000 utilisateurs actifs/mois
  - 250 GB bandwidth
  - **Pas de pause automatique**
  - Backups quotidiens (7 jours)
  - Support email
  - 99.9% SLA
- **Recommandé:** Dès la mise en production

#### Supabase Team
- **Coût:** $599/mois
- **Pour:** Organisations avec >20 analystes actifs
- **Inclus:**
  - Tout du plan Pro
  - Point-in-time recovery (2 semaines)
  - Support prioritaire
  - Read replicas
  - Plus de ressources

---

### Estimation par Scénario d'Usage

#### Scénario 1: Pilote (2-5 analystes, 30-50 documents/mois)
| Service | Plan | Coût/mois | Notes |
|---------|------|-----------|-------|
| Vercel | Hobby | $0 | 1 développeur suffit |
| Supabase | Free → Pro | $0 → $25 | Pro recommandé après test |
| Anthropic | Usage | $3-5 | ~50 documents |
| **TOTAL** | | **$3-30/mois** | Selon phase |

**Recommandation:** Commencer gratuit, passer à Supabase Pro après validation.

---

#### Scénario 2: Production (5-15 analystes, 100-300 documents/mois)
| Service | Plan | Coût/mois | Notes |
|---------|------|-----------|-------|
| Vercel | Pro | $20 | Support + analytics |
| Supabase | Pro | $25 | 250k MAU suffisant |
| Anthropic | Usage | $10-20 | 100-300 documents |
| **TOTAL** | | **$55-65/mois** | |

**Utilisateurs supportés:** Jusqu'à 15 analystes actifs quotidiennement

---

#### Scénario 3: Déploiement Complet (20+ analystes, 500+ documents/mois)
| Service | Plan | Coût/mois | Notes |
|---------|------|-----------|-------|
| Vercel | Pro | $20-40 | 1-2 développeurs |
| Supabase | Team | $599 | Plus de capacité |
| Anthropic | Usage | $30-50 | 500+ documents |
| **TOTAL** | | **$650-690/mois** | |

**Utilisateurs supportés:** 50+ analystes simultanés

---

### Optimisations des Coûts

#### 1. Anthropic Claude API
**Stratégies:**
- Utiliser **Claude Haiku** pour documents simples (-75% coût)
- Implémenter un **cache** pour documents similaires
- Batch processing pour grands volumes

**Économies:** $5-15/mois selon volume

#### 2. Supabase Storage
**Stratégies:**
- Compression automatique des PDFs
- Suppression des fichiers après traitement
- Archivage dans S3 après 30 jours

**Économies:** Reste dans le plan Pro même à fort volume

#### 3. Vercel Bandwidth
**Stratégies:**
- Optimisation des images
- Minification du JavaScript
- Edge caching

**Économies:** Reste dans plan Pro sans surcoût

---

### Roadmap des Coûts

#### Mois 1-2: Phase Pilote
- ✅ Free tier partout
- ✅ 2-3 analystes testeurs
- ✅ Validation fonctionnelle
- **Budget:** $0-5/mois

#### Mois 3-6: Production Initiale
- ✅ Supabase Pro: $25/mois
- ✅ Vercel Hobby: $0/mois (suffit)
- ✅ 5-10 analystes
- **Budget:** $30-50/mois

#### Mois 6-12: Scaling
- ✅ Vercel Pro: $20/mois (si besoin support)
- ✅ Supabase Pro: $25/mois
- ✅ 10-20 analystes
- **Budget:** $50-70/mois

#### Mois 12+: Déploiement Complet
- ✅ Évaluer Supabase Team si >20 analystes
- ✅ Négocier contrat annuel Anthropic (-20%)
- **Budget:** $600-700/mois (si >30 analystes)

---

### Questions Fréquentes

#### Q: Combien d'analystes peuvent utiliser l'app?
**R:** Avec Supabase Pro ($25/mois), jusqu'à 250,000 utilisateurs actifs/mois. Pour l'IFC, cela signifie facilement 50-100 analystes actifs quotidiennement.

#### Q: Les analystes ont besoin d'un compte Vercel?
**R:** **NON.** Seuls les développeurs ont besoin de Vercel. Les analystes se connectent via l'application web directement.

#### Q: Peut-on commencer gratuitement?
**R:** **OUI.** Tous les services ont un plan gratuit pour tester. Vous ne payez que quand vous passez en production.

#### Q: Qu'arrive-t-il si on dépasse les limites du plan gratuit?
**R:** L'application continue de fonctionner mais avec des limitations (pause après inactivité, moins de stockage). Mise à niveau recommandée avant d'atteindre les limites.

#### Q: Peut-on migrer vers un self-hosting plus tard?
**R:** **OUI.** Le code est open-source et peut être déployé sur n'importe quelle infrastructure (AWS, Azure, Google Cloud) si les coûts cloud deviennent trop élevés.

---

### Recommandation Finale IFC

**Phase de Test (maintenant):**
- Utiliser les plans gratuits
- Budget: $0-5/mois
- Durée: 1-2 mois

**Mise en Production:**
- Supabase Pro: $25/mois (essentiel)
- Vercel Hobby: $0/mois (suffisant)
- Budget: $30-50/mois
- Pour: 5-15 analystes

**Total investi première année:** ~$400-600
**Économie vs Base44:** ~$XXX (à calculer avec coût Base44)
**Gains productivité:** Inestimables

---

### Contact & Négociations Entreprise

Pour des remises ONG/Organisations Internationales:

**Supabase:**
- Email: sales@supabase.io
- Mentionner: IFC (World Bank Group)
- Possibles: -10 à -20% sur plans annuels

**Anthropic:**
- Email: sales@anthropic.com
- Mentionner: Development finance use case
- Possibles: Volume discounts si >1000 docs/mois

**Vercel:**
- Email: sales@vercel.com
- Généralement pas de remises pour plans Pro

## License

Proprietary - IFC (International Finance Corporation)

## Support

For issues or questions, contact the development team or create an issue in the repository.

---

**Built with ❤️ for IFC analysts**
