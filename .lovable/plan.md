

# Add Contact-Only Deals to Pipeline

## What We'll Build

A new `deals` table that allows adding contact-based leads (name, phone, email) to the pipeline without requiring a property. These deals appear alongside property-based deals on the Kanban board. A property can be linked later.

## How It Works

- The Kanban board currently only shows properties with a `stage_id`. We'll introduce a `deals` table for standalone contact deals.
- Each deal has a contact name, phone, email, notes, an assigned pipeline stage, and an optional `property_id` to link a property later.
- The Kanban board will merge both property cards and deal cards in each stage column.
- Deal cards will look slightly different -- showing contact info instead of address, with a label like "Contact Deal".

## Changes

### 1. Database: New `deals` table

Create a `deals` table with columns:
- `id`, `company_id`, `stage_id` (required), `property_id` (optional, for linking later)
- `contact_name`, `contact_phone`, `contact_email`
- `notes`, `deal_value` (optional dollar amount)
- `created_at`, `updated_at`, `created_by`

RLS policies scoped to company like all other tables.

### 2. New hook: `src/hooks/useDeals.ts`

- `useDeals()` -- fetch all deals for the company
- `useAddDeal()` -- create a new contact deal
- `useUpdateDeal()` -- update stage, link property, edit contact info
- `useDeleteDeal()` -- remove a deal

### 3. Update `NewDealModal`

Add a third option alongside "Search existing property" and "Create new property":
- **"Contact-only deal"** -- a simple form with contact name, phone, email, optional notes, optional deal value, and stage selector
- Clicking this option shows the contact form instead of property search

### 4. Update `KanbanBoard`

- Accept a new `deals` prop alongside `properties`
- Render deal cards in the appropriate stage columns, styled differently (contact icon instead of map pin, no address line)
- Support drag-and-drop to move deals between stages (calls `onMoveDeal`)
- Clicking a deal card could open a detail view or inline edit (phase 2)

### 5. Update `MainApp.tsx`

- Fetch deals using the new hook
- Pass deals to KanbanBoard
- Wire up handlers for adding, moving, and selecting deals

## Technical Details

### Database migration SQL

```sql
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  property_id uuid,
  contact_name text NOT NULL DEFAULT '',
  contact_phone text,
  contact_email text,
  notes text,
  deal_value numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- RLS policies (same company-scoped pattern)
CREATE POLICY "Users can view their company deals"
  ON public.deals FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert deals for their company"
  ON public.deals FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company deals"
  ON public.deals FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company deals"
  ON public.deals FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));
```

### KanbanBoard changes

- New `Deal` type: `{ id, stageId, contactName, contactPhone, contactEmail, notes, dealValue, propertyId? }`
- Props add: `deals: Deal[]`, `onMoveDeal: (dealId, newStageId) => void`, `onSelectDeal: (id) => void`
- Each stage column merges `stageProperties` and `stageDeals`, rendering different card components
- Deal cards show a User icon, contact name, phone, and optional deal value

### NewDealModal changes

- Add a "Contact-only" button/tab at the top of the modal
- When selected, show: contact name (required), phone, email, notes, deal value, stage picker
- On submit, calls a new `onCreateDeal` callback instead of `onCreateProperty`

