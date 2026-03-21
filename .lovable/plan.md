

# Add Realtors as a Deal Type in the Pipeline

## What We'll Build

A dedicated `realtors` table to store realtor profiles (name, phone, email, notes) that can be reused across multiple deals. Deals can then be linked to a realtor via a `realtor_id` column. On the Kanban board, realtor-linked deals will appear with a distinct visual style. The New Deal modal gets a fourth tab for creating or selecting a realtor deal.

## Changes

### 1. Database: New `realtors` table + deal linkage

- Create `realtors` table: `id`, `company_id`, `name`, `phone`, `email`, `notes`, `created_at`, `updated_at`
- RLS policies scoped to company (same pattern as other tables)
- Add `realtor_id` (nullable uuid) column to the `deals` table for linking a deal to a realtor

### 2. New hook: `src/hooks/useRealtors.ts`

- `useRealtors()` -- fetch all realtors for the company
- `useAddRealtor()` -- create a new realtor
- `useUpdateRealtor()` -- edit realtor info
- `useDeleteRealtor()` -- remove a realtor

### 3. Update `src/types/index.ts`

- Add `Realtor` interface: `id`, `companyId`, `name`, `phone?`, `email?`, `notes?`, `createdAt`, `updatedAt`
- Add `realtorId?` to the `Deal` type

### 4. Update `NewDealModal.tsx`

- Add a 4th tab: "Realtor" with a form for name, phone, email, notes
- Include a searchable dropdown to pick an existing realtor or create a new one inline
- On submit, creates the realtor (if new), then creates a deal linked via `realtor_id`

### 5. Update `KanbanBoard.tsx`

- Realtor-linked deals get a distinct badge (e.g. "Realtor Deal" in a different color) and show the realtor's name/phone
- No structural changes needed -- they're still `Deal` cards

### 6. Update `useDeals.ts` and `MainApp.tsx`

- `useDeals` maps the new `realtor_id` field
- `useAddDeal` accepts optional `realtorId`
- `MainApp` passes the new `onCreateRealtorDeal` callback to `NewDealModal`

## Technical Details

### Migration SQL

```sql
CREATE TABLE public.realtors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company realtors"
  ON public.realtors FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert realtors for their company"
  ON public.realtors FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can update their company realtors"
  ON public.realtors FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete their company realtors"
  ON public.realtors FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

ALTER TABLE public.deals ADD COLUMN realtor_id uuid;
```

### Kanban card differentiation

Deals with a `realtor_id` show a teal "Realtor Deal" badge (vs blue "Contact Deal" for standard contact-only deals). The realtor's name displays prominently on the card.

