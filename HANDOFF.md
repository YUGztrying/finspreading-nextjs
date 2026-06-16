# Handoff notes — for the AI & Innovation team

Welcome. This document is the result of the last few iterations on
FinSpreading. It captures what the application does today, what's solid, what's
fragile, and what we'd tackle next. Read `README.md` first for setup and the
architecture map; this file focuses on the things you can't infer from the
code alone.

The author has limited bandwidth to keep iterating, so the goal is to make
your first two days productive without having to reverse-engineer recent
decisions.

## TL;DR — what works today

- **PDF upload + page picker (multi-tag)** — handles the common BCEAO layout
  where Actif and Passif sit side-by-side on the same page. Each page can be
  tagged with one or more statement types.
- **Claude extraction with relative-period handling** — column headers like
  `"exercice N-1"` are resolved deterministically to real dates using the
  printed "Date d'arrêté" field. A consensus pass across the 4 statement
  types of one PDF makes the resolution robust even when Claude only reads
  the date on one page.
- **Statement merge across PDFs** — uploading two annual reports for the same
  company (e.g. FY 2023 + FY 2024) yields a single statement with the union
  of periods, lines preserved across years.
- **Code picker** — the editable Code column is a searchable dialog rendering
  the canonical chart of accounts, filtered by institution type. Replaces a
  free-text input that required analysts to memorize the Référentiel SFD BCEAO /
  PCB BCEAO codes.
- **IRP export (bank income statement)** — signed-component aggregation pins
  every subtotal to the published Compte de Résultat (tested against a real
  BBGCI statement).
- **CAMELS analysis** — ratios + scoring exist for both institution types.
  Not the focus of recent work; treat as second-tier when planning fixes.
- **Tests** — 215 unit tests covering normalization, period resolution, IRP
  calculation, and API contracts. Keep them green.

## Conformity with the BCEAO referentials

The microfinance catalog (`src/lib/normalization/microfinance/`) was audited
against the official **Référentiel comptable spécifique des SFD de l'UMOA**
(BCEAO, Instruction n° 025-02-2009, version allégée — Annexes 1 to 5).

**Confirmed aligned.**
- 100% of postes printed in the allégée Bilan (Annexe 2, DIMF 2000) and
  Compte de Résultat (Annexe 3, DIMF 2080) are present in our catalog.
- Annexe 1 ("Nomenclature des codes postes et concordance avec le plan de
  comptes") matches our MFA_/MFP_/MFC_ structure class-by-class (classes 1-7).
- Our catalog is a **superset** that also targets the version normale: codes
  like `D10..D73`, `R1B..R6X`, `V5x`, `V6x` are not present in the allégée
  templates but appear in the underlying nomenclature.

**Known gap — version normale not audited.** The BCEAO publishes a separate
"version normale" document with more granular postes than the allégée. Our
granular codes are *consistent* with what the nomenclature implies, but the
official version normale templates have not been line-checked.

**Hors-Bilan microfinance has no regulatory basis.** The allégée referential
stops at class 7; Annexe 4 ("États annexes", DIMF 2005-2014) contains no
off-balance-sheet engagement statement for SFDs. The `hors_bilan` path
exists in code for bank statements (PCB BCEAO) but should be considered
out-of-scope for microfinance until the version normale is reviewed or the
team gets a real off-balance-sheet annex to model against.

**Synthetic Z* codes.** The codes `Z01/Z02/Z03` (under MFA_*) and
`Z21..Z37` (under MFC_*/MFP_*) are **NOT** part of the BCEAO referential.
They are internal codes we coined for sub-totals that the referential prints
as unnumbered labels (`Prêts immobilisés`, soldes intermédiaires de gestion,
etc.). Never present them as official BCEAO postes in the UI.

**On naming.** "SYSCOA" is the OHADA accounting system for non-financial
companies — it has nothing to do with SFDs. Earlier comments calling the
SFD plan "SYSCOA-IMF" were renamed to **Référentiel SFD BCEAO** (or the
full name, *Référentiel comptable spécifique des SFD de l'UMOA*).

## Known technical debt — prioritized

### P0 — verify microfinance income-statement signs (2-3 h)

The bank income statement was found to double-negate expense lines because
the IRP structure used `sign: '-'` against already-negative values stored
verbatim from the PDF. Fixed in commit `b3ed5fc` for `incomeStatementStructureBank`
(see `src/lib/irp/structures.ts`).

**The same pattern exists for microfinance** (`incomeStatementStructureMicro`,
~line 180). It was deliberately left untouched because we had no real
microfinance income statement to verify against. The fix is mechanically the
same — flip `sign: '-'` → `sign: '+'` on every line that subtracts an
already-signed expense — but it must be validated against a real SFD PDF before
shipping. Add a regression test mirroring
`src/__tests__/lib/irp-income-statement-bank.test.ts`.

If you have access to a published SFD compte de résultat (UM-PAMECAS,
ACEP, etc.), the verification takes ~30 min: extract the file, export IRP,
compare every subtotal against the printed PNB / résultat net.

### P1 — period-resolver fallback when no closing date is readable (3-4 h)

Today, when Claude fails to read the "Date d'arrêté" on every page of a PDF,
the consensus pass cannot resolve relative labels. The literal `"exercice N"`
strings reach the database, the periods column count looks wrong, and the
UI period-asymmetry warning fires. The app still works, but the analyst has
to clean up by hand.

Two ways to fix:

- **Cheap** — ask the analyst to confirm the closing date in the page picker
  before extraction (one new input box, prefilled if Claude reads it). Pass
  this as a request parameter to `/api/extract-from-pages` and use it as the
  consensus fallback.
- **Robust** — fine-tune a small vision model on the BCEAO checkered-box date
  format. Probably overkill until usage proves it matters.

I'd start with the cheap path.

### P1 — extraction quality on large noisy scanned PDFs (1-2 days)

A real-world case (DIM-FADI Senegal, 30 MB scan with a pink security pattern
and stamps) produced 14 line items instead of 60. Root cause not fully
diagnosed; most likely Claude either:

- silently truncated its response on a large sub-PDF, or
- gave up on heavily watermarked rows.

Two mitigations to test:

1. **Split per page** before sending to Claude (today we send all tagged pages
   for one type in a single call). Costs ~30 % more Claude tokens but caps the
   per-call complexity. Estimated impact: high.
2. **Pre-rasterize the page** to a clean JPEG via pdf-lib + sharp before
   sending. Strips watermarks/stamps. Risk: loses fine text fidelity.

Reproduce the bug with the DIM-FADI PDF (not in the repo — ask the author)
before deciding which mitigation to ship.

### P2 — coverage of bank Hors-Bilan codes (1 day)

There is no codified catalog for bank Hors-Bilan, so the code picker falls
back to a free-text input for that section. The data is extracted and stored
correctly, but analyst friction is higher there than on the other three
statement types. Mirror the structure in `microfinance/catalog.ts` and add
entries for the standard PCB BCEAO off-balance-sheet codes
(engagements donnés / reçus de financement, de garantie, sur titres).

### P2 — passifs labels validation (0.5 day)

The microfinance passif labels in `microfinance/catalog.ts` (entries
`F2A`, `F60`, `G70`…) were reconstructed from the Référentiel SFD BCEAO standard, not
from `description-map.ts`, because the latter intentionally omits ambiguous
descriptions. Spot-check against a real SFD passif page; the rare labels may
need wording adjustments.

### P2 — capture the schema in a migration (1 h)

`financial_statements` is the central table but lives in nobody's migration
folder. The three supporting tables have SQL files in `supabase/`. Add the
core table's SQL there (and the RLS policy) so a fresh environment can be
bootstrapped from one command.

### P3 — Sonnet 4 model pin (0.5 h)

The model is hardcoded `claude-sonnet-4-20250514` in
`/api/extract-from-pages/route.ts`. Move to an env var so the team can A/B
test newer Claude releases without a code change.

### P3 — Excel flow modernization (1 day)

`/api/process-excel` does not yet benefit from the page-picker UX, the period
resolver, or the consensus pass. Excel is a far rarer format in practice
(only the BCEAO Etat 167 reporting form ships as `.xlsx`), but the divergence
makes maintenance harder. Consider funneling Excel through the same
`/api/extract-from-pages` shape.

### P3 — TAFIRE and annexes (variable)

The annual report PDFs include TAFIRE (Tableau Financier des Ressources et
Emplois) and several detail annexes that the app does not parse. CAMELS does
not need them today, but if you expand toward LiqStress or scenario analysis
they become relevant.

## How to debug an extraction

1. **Vercel logs** — every PDF upload produces a trace ID. Search for it:
   ```
   [extract-from-pages][<traceId>]
   ```
   You will see for each statement type: sub-PDF size, raw periods returned
   by Claude, closing date, resolved periods, line count, elapsed ms.
2. **Save logs** — `[save][<company>|<type>]` lines show the merge before/
   after periods so you can spot e.g. a literal `"exercice N-1"` leaking into
   the database.
3. **Look at `result.warnings` / `result.summary`** in the
   `/api/extract-from-pages` response. The upload page already surfaces both
   in the verification card and as notifications.
4. **Reproduce locally** by saving the PDF to a fixture and writing a unit
   test that drives `/api/extract-from-pages` end-to-end with a mocked Claude
   response. The existing tests under `src/__tests__/api/` show the pattern.

## How to add support for a new chart of accounts

If a new format comes in (e.g. CIMA Insurance):

1. Add new normalizer files under `src/lib/normalization/<plan>/` mirroring
   `banks/` or `microfinance/`.
2. Add a new `InstitutionType` value in
   `src/lib/normalization/microfinance/catalog.ts` (rename that file at the
   same time — it has long outgrown its microfinance origin).
3. Add the new codes + labels to the catalog so the code picker can render
   them.
4. Add an IRP structure under `src/lib/irp/structures.ts` and wire it through
   `irp/calculator.ts`.
5. Add tests against a real published statement for the new plan.

## How to add a regression test for an IRP signing bug

Copy `src/__tests__/lib/irp-income-statement-bank.test.ts`. The pattern:

- Hard-code `LineItem`s with `poste` and `amounts` from a real PDF (signed
  exactly as printed).
- Feed them through `calculateAllLines(structure, lineItems, numPeriods)`.
- Assert each named subtotal against the printed value.

If the assertion fails, the structure or the calculator is wrong — never
"adjust" the test value to match wrong code.

## What I'd touch first if I were you

1. **Day 1** — run the app locally, upload a real PDF you own (bank or
   SFD), look at the verification recap. Open `actifs`, click a UNDEFI row,
   pick a code. Get the feel.
2. **Day 1-2** — pick P0 (microfinance signs) and ship it. Small win,
   measurable, and it lets you internalize the IRP calculation engine.
3. **Day 3+** — P1 (closing-date fallback) and then P1 (DIM-FADI extraction
   robustness). These two are where actual users will hit walls; everything
   else is polish.

## Contact / context

This branch (`claude/project-status-review-V4AcN`) was built iteratively from
the production state of `main`. Every commit message explains why the change
was made — `git log --reverse main..HEAD --format='%h %s%n%b'` is a good way
to read the rationale in order. There are no "wip" or "fix typo" commits in
this range; every commit corresponds to a defended decision.

Good luck.
