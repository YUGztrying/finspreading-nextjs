# FinSpreading

A web app that turns West-African bank and microfinance financial statements
(PDFs from BCEAO/SYSCOA-IMF auditors, BCEAO Excel reporting forms) into
standardized data that feeds IRP reports and CAMELS analyses for IFC analysts.

The goal is to remove the manual re-keying that traditionally costs an analyst
hours per institution. An analyst uploads the PDF, tags the relevant pages,
reviews the extracted figures, and exports an IRP-compliant Excel — instead of
typing 200 lines from a scanned audit report.

## Tech stack

- **Frontend** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind, shadcn/ui
- **Backend** Supabase (Postgres + Auth + Storage + RLS), Next.js API routes
- **Extraction** Anthropic Claude Sonnet 4 (PDF document content blocks)
- **Excel** ExcelJS + xlsx, pdf-lib for splitting source PDFs page-by-page
- **Tests** Jest + ts-jest, 215+ unit tests
- **Hosting** Vercel (Hobby tier is enough for piloting)

## Quick start

```bash
git clone <repo-url>
cd finspreading-nextjs
npm install
cp .env.example .env.local   # see "Environment" below
npm run dev                  # http://localhost:3000
```

```bash
npm test                     # unit tests
npm run test:coverage        # with coverage
npx tsc --noEmit             # strict typecheck
npm run lint                 # ESLint
npm run build                # production build
```

### Environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...               # server-only
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL files in `supabase/` against your project (SQL editor or CLI):
   `camels_analyses.sql`, `camels_overrides.sql`, `period_mappings.sql`.
   The core `financial_statements` table is currently created out of band — see
   the schema section below for its expected shape.
3. Create a public storage bucket called `financial-documents` with
   authenticated write.
4. Add the local dev URL and the Vercel preview/prod URLs to **Auth → URL
   Configuration → Redirect URLs**.

## Architecture map

```
src/
├── app/
│   ├── (auth)/                   login/, signup/
│   ├── (dashboard)/              actifs/, passifs/, hors-bilan/,
│   │                             compte-resultats/, upload/, rapport-irp/,
│   │                             camels/, export/, dashboard/
│   └── api/
│       ├── extract-from-pages/   PDF → 1 Claude call per statement type
│       ├── extract-data/         (legacy single-shot extractor, kept for Excel paths)
│       ├── process-excel/        BCEAO Etat 167 .xlsx → statements
│       ├── statements/           save / list / rename / delete-company / export / irp-report
│       ├── camels/               analyze / history
│       └── period-mappings/      cross-source period alignment
├── components/
│   ├── ui/                       shadcn primitives
│   ├── statements/               StatementTable, CodePicker
│   ├── upload/                   FileUploadZone, PagePickerDialog, ProcessingQueue
│   ├── irp/                      IRPBalanceSheet, IRPIncomeStatement, IRPSummary
│   └── camels/                   RatioTable, ScoreCard, CompositeGauge, PeriodAlignmentDialog
└── lib/
    ├── normalization/
    │   ├── normalize.ts          dispatcher (bank vs microfinance)
    │   ├── banks/                PCB BCEAO normalizers
    │   ├── microfinance/         SYSCOA-IMF normalizers
    │   │   ├── catalog.ts        unified picker catalog (200+ entries, both plans)
    │   │   └── description-map.ts fallback when only descriptions are readable
    │   └── period-resolver.ts    "exercice N-1" → YYYY-MM-DD using closing date
    ├── statements/               database.ts (merge logic), validate.ts
    ├── irp/                      structures.ts, calculator.ts (IRP report generation)
    └── camels/                   calculator.ts, field-mapper.ts, narrative-generator.ts
```

## Key concepts

### Institution types

Every statement is tagged `'banque'` or `'microfinance'`. This choice drives:

- **Chart of accounts** used by the normalizer (PCB BCEAO for banks,
  SYSCOA-IMF for microfinance).
- **Code picker scope** in the UI — the picker filters its catalog by
  institution so a bank analyst never sees `MFA_*` codes and a microfinance
  analyst never sees `ACTIF_*`.
- **IRP structure** used to aggregate line items into the final report.

### Code namespaces

| Prefix | Meaning | Where |
|---|---|---|
| `MFA_*` | Microfinance Assets (SYSCOA-IMF, A01…E90) | `microfinance/actifs.ts` |
| `MFP_F/G/H/K/L_*` | Microfinance Liabilities | `microfinance/passifs.ts` |
| `MFC_*`, `MFP_V/W/X_*` | Microfinance Income Statement (charges / produits) | `microfinance/compte-resultats.ts` |
| `ACTIF_01..14`, `ACTIF_TOTAL` | Bank Assets (PCB BCEAO) | `banks/actifs.ts` |
| `PASSIF_01..16`, `PASSIF_TOTAL` | Bank Liabilities | `banks/passifs.ts` |
| `CR_01..20` | Bank Income Statement | `banks/compte-resultats.ts` |

`MFP_` is shared between Microfinance Passifs (F/G/H/K/L) and Microfinance
Produits (V/W/X). The `CatalogEntry.section` field disambiguates.

Anything the normalizer can't recognize becomes `MFA_UNDEFINED_<hash>`,
`PASSIF_UNDEFINED`, etc. — see `isUndefinedPoste()` in `catalog.ts`. The UI
flags these in red so the analyst picks the right code via the picker.

### Period resolution

BCEAO statements label their comparative columns `"exercice N-1"` and
`"exercice N"` with the real years only visible in the printed "Date d'arrêté"
field. Claude reads this date reliably on some pages but not others (the
checkered-box form OCRs poorly).

`src/lib/normalization/period-resolver.ts` solves this deterministically:

1. Claude is prompted to return `closing_date` (the printed date) and
   `periods` (the column headers, verbatim — relative labels allowed).
2. `resolveRelativePeriods()` rewrites `"exercice N-1"` → `<year-1>-12-31`
   using the closing date, normalizes any absolute date to YYYY-MM-DD, and
   leaves anything unrecognized untouched with a `hasUnresolved` flag.
3. `/api/extract-from-pages` runs a **closing-date consensus pass** across the
   4 statement types of one PDF: if any type read the date, propagate it to
   the others that came back empty, then re-resolve.

This is what makes multi-PDF merging stable — `"2023-12-31"` from PDF #1
always equals `"2023-12-31"` from PDF #2, so the union in `mergeStatements()`
is clean.

### Sign convention (read this before touching `irp/structures.ts`)

Expense and provision lines on BCEAO PDFs are **printed and stored as
negative numbers** (`CR_02` = −18 768 FCFA, `CR_15` = −6 406 FCFA, etc.).
Every aggregate in `incomeStatementStructureBank` therefore sums signed
components — it does **not** subtract. A `sign: '-'` on an already-negative
expense double-negates and breaks every subtotal.

The microfinance structure (`MFC_*`) has not been validated against a real
SFD income statement yet — see `HANDOFF.md` for the known-debt list.

## API routes

| Route | Purpose |
|---|---|
| `POST /api/extract-from-pages` | Main PDF flow: 1 Claude call per tagged statement type, consensus closing-date resolution, returns `data` + `warnings` + `summary` |
| `POST /api/process-excel` | BCEAO Etat 167 Excel → statements (single-shot) |
| `POST /api/extract-data` | Legacy single-shot PDF extraction |
| `POST /api/statements/save` | Save + merge into existing statement (one row per company × type) |
| `GET /api/statements/list` | List by user / company / type |
| `POST /api/statements/rename` | Rename a company across all its statements |
| `DELETE /api/statements/delete-company` | Drop all rows for a company |
| `GET /api/statements/export` | Excel export (full IRP report) |
| `POST /api/statements/irp-report` | Build the IRP data structure server-side |
| `POST /api/camels/analyze` | Compute CAMELS ratios + scores |
| `GET /api/camels/history` | Historical scores |

All routes are auth-gated via `requireUser()` — the user id always comes from
the verified session, never from the request body.

## Database

Core table — created out of band today; capture it in a migration before
shipping to production:

```sql
create table financial_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  company_name text not null,
  type_institution text not null check (type_institution in ('banque','microfinance')),
  statement_type text not null check (statement_type in ('actifs','passifs','hors_bilan','compte_resultats')),
  periods text[] not null,
  line_items jsonb not null,
  source_files text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: every row is readable/writable only by its owner
alter table financial_statements enable row level security;
create policy "own rows" on financial_statements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`LineItem` shape (stored as JSONB):

```ts
{
  poste: string,           // Normalized code e.g. "MFA_A10", "ACTIF_04"
  description: string,     // Raw label as extracted
  amounts: number[],       // One value per period, same order as `periods`
  is_subtotal?: boolean,
  is_total?: boolean,
  indent_level?: number,
  manual?: boolean,        // Added by the analyst in the editor
  flags?: string[]         // e.g. ['unmapped']
}
```

The supporting tables (`camels_analyses`, `camels_overrides`,
`period_mappings`) have their own SQL files in `supabase/`.

## Upload flow (PDF)

```
analyst drops PDF
   ↓
upload to Supabase Storage (slugified key — accents/spaces would be rejected)
   ↓
PagePickerDialog renders page thumbnails with react-pdf
   ↓
analyst tags each page with 1+ statement types (multi-tag because BCEAO
bilans show Actif + Passif side-by-side on the same page)
   ↓
POST /api/extract-from-pages with { file_url, institution_type, selections }
   ↓
pdf-lib splits the source PDF into one sub-PDF per statement type
   ↓
Promise.allSettled — 4 parallel Claude calls (one per type)
   ↓
period-resolver applies closing-date consensus across types
   ↓
response: { data, warnings, summary }
   ↓
upload page loops through statements, calls /api/statements/save for each
   ↓
saveFinancialStatement either creates a new row or merges into the existing
one for that (company, type), unioning periods
   ↓
verification card with a per-type recap (lines · periods · source pages)
```

Partial failures are surfaced — the green "data imported" card is no longer
shown when any extraction or save failed. A period-asymmetry heuristic also
warns when Actifs and Passifs of the same PDF come back with a different
number of periods.

## Deployment (Vercel)

1. Push the branch to GitHub.
2. Import the repo in Vercel.
3. Set every env var from the **Environment** section above on the **Preview**
   and **Production** environments (it's a common pitfall to set them only on
   Production and get cryptic "Failed to fetch" errors on previews).
4. Add the Vercel preview/prod URLs to Supabase Auth redirect URLs.
5. Deploy.

The Supabase Free tier pauses the project after 7 days of inactivity, which
makes every auth call fail with "Failed to fetch" until you click "Restore"
in the dashboard. Move to Supabase Pro ($25/mo) before piloting with real
users.

## Costs

Today, running on free tiers:

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby | $0 |
| Supabase | Free | $0 (pauses after 7d idle) |
| Anthropic | pay-as-you-go | ~€0.40 per uploaded PDF (4 Claude calls per PDF, Sonnet 4) |

Realistic pilot budget (50 docs/mo, 5 analysts): **~€20-25/mo**, dominated by
Supabase Pro ($25) once activated. Anthropic stays under €25/mo until ~50
docs/day.

## Contributing & next steps

- See [HANDOFF.md](./HANDOFF.md) for the punch list aimed at the AI &
  Innovation team picking this up.
- Open an issue or PR against `main`.
- Tests must stay green (`npm test`) and `tsc --noEmit` must be clean before
  merging.

## License

Proprietary — IFC (International Finance Corporation).
