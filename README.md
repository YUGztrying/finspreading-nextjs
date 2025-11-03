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

## Future Enhancements

- [ ] Batch processing for multiple files
- [ ] Data validation rules engine
- [ ] Historical trend analysis
- [ ] Multi-currency support
- [ ] Advanced search and filtering
- [ ] Export to multiple formats (Word, PDF)
- [ ] Collaboration features (comments, approvals)
- [ ] Mobile app (React Native)

## License

Proprietary - IFC (International Finance Corporation)

## Support

For issues or questions, contact the development team or create an issue in the repository.

---

**Built with ❤️ for IFC analysts**