# HPLC/UPLC Column Management System

A GMP-compliant, full-stack web application for managing HPLC/UPLC columns in a pharmaceutical API QC laboratory.

**Stack:** Next.js 14 (App Router) · Supabase (PostgreSQL + Auth) · Tailwind CSS · shadcn/ui

---

## Features

- **4-Role System:** Analyst → QC Supervisor → QC Head → QA with full approval chains
- **Complete Column Lifecycle:** Receipt → Qualification → Issuance → Usage → Regeneration → Discard
- **GMP Compliance:** Immutable audit trail, no hard deletes, all changes logged with who/when/IP
- **Approval Workflows:** Every critical action requires 4-step approval chain
- **Reports:** Excel and PDF export for inventory, usage, qualification, discard, and audit trail
- **Real-time:** Supabase Postgres backing with RLS enforced at the database level
- **Timestamps:** UTC stored, IST displayed throughout

---

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

---

## Setup Instructions

### 1. Clone and install dependencies

```bash
cd column-management
npm install
```

### 2. Set up environment variables

Your `.env.local` is already pre-configured. If you need to update it:

```
NEXT_PUBLIC_SUPABASE_URL=https://bxhkatdxfyoqhtgkqqmn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_cII6rtWOTOd1AlQT6N7UCg_ufQ3SnE_
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. Run the Supabase SQL migrations

Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/bxhkatdxfyoqhtgkqqmn/sql/new) and run the files **in this order**:

**Step 1:** Run `supabase/schema.sql`
```sql
-- Creates all tables, sequences, enums, functions, and updated_at triggers
```

**Step 2:** Run `supabase/rls_policies.sql`
```sql
-- Enables RLS and creates all Row Level Security policies
```

**Step 3:** Run `supabase/triggers.sql`
```sql
-- Creates audit triggers, injection counter, and lock mechanisms
```

**Step 4:** Run `supabase/seed.sql`
```sql
-- Seeds demo column types and 3 sample columns in different lifecycle stages
-- NOTE: You must create auth users first (see below)
```

### 4. Create demo users in Supabase Auth

Go to **Supabase Dashboard → Authentication → Users → Add user** and create these accounts:

| Email | Password | Role | Full Name |
|-------|----------|------|-----------|
| analyst@pharma.com | Test@1234 | analyst | Priya Sharma |
| supervisor@pharma.com | Test@1234 | supervisor | Rahul Verma |
| qchead@pharma.com | Test@1234 | qc_head | Dr. Sunita Rao |
| qa@pharma.com | Test@1234 | qa | Amit Patel |

**Important:** When creating users, add `user_metadata`:
```json
{
  "full_name": "Priya Sharma",
  "role": "analyst",
  "department": "QC Laboratory"
}
```
The trigger will auto-create the profile record.

**Alternative:** Use the Supabase CLI:
```bash
# Install Supabase CLI first: https://supabase.com/docs/guides/cli
supabase login
supabase db execute --project-ref bxhkatdxfyoqhtgkqqmn --file supabase/seed.sql
```

Or use the service role key to create users via API:
```bash
curl -X POST 'https://bxhkatdxfyoqhtgkqqmn.supabase.co/auth/v1/admin/users' \
  -H 'apikey: <service-role-key>' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "analyst@pharma.com",
    "password": "Test@1234",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "Priya Sharma",
      "role": "analyst",
      "department": "QC Laboratory"
    }
  }'
```

### 5. Create Supabase Storage bucket

Go to **Supabase Dashboard → Storage → New Bucket**:
- Bucket name: `column-documents`
- Public: `true` (for CoA file viewing)

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Application Flow

### Login
- Navigate to `/login`
- Use demo credentials from the login page
- Auto-redirects to role-specific dashboard

### Analyst Workflow
1. **Register Column** → `/columns/new` → Submits receipt for Supervisor approval
2. **Perform Qualification** → `/qualification/[columnId]` → After receipt approved
3. **Log Usage** → `/usage/new` → After column is Active and issued
4. **Initiate Regeneration** → `/regeneration/[columnId]` → After SST failure
5. **Request Transfer** → `/transfers` → For product/method/location changes

### Supervisor Workflow
1. **Approvals Queue** → `/approvals` → Approve/reject pending items
2. **Issue Column** → `/issuance` → Assign active column to analyst

### QC Head Workflow
1. **Approvals Queue** → `/approvals` → Second-step approvals
2. **Column Types** → `/column-types` → Manage dynamic type catalog
3. **Initiate Discard** → `/discard` → Only QC Head can initiate

### QA Workflow
1. **Approvals Queue** → `/approvals` → Final sign-off on all critical actions
2. **Audit Trail** → `/audit` → Review all system changes
3. **Reports** → `/reports` → Export Excel/PDF reports

---

## Approval Chain Logic

All critical actions follow this chain:

```
Analyst submits → Supervisor approves → QC Head approves → QA final sign-off
```

Column status changes only happen after full approval:
- Receipt → `qualification_pending` (after QA approves receipt)
- Qualification → `active` (after QA approves qualification)
- Discard → `discarded` (after QA approves discard)

---

## Database Schema Overview

```
profiles          ← extends auth.users (role, department)
column_types      ← dynamic type catalog (managed by QC Head)
columns           ← master inventory with lifecycle status
column_qualification ← SST-based qualification records
column_issuance   ← column-to-analyst assignment records
column_usage_log  ← per-session usage with SST results
column_regeneration ← regeneration workflow records
column_transfers  ← product/method/location transfer requests
column_discard    ← discard records with destruction details
audit_log         ← immutable change log (trigger-based)
```

---

## GMP Compliance Notes

- **No Hard Deletes:** All data is retained. Status changes only.
- **Audit Trail:** Every INSERT/UPDATE on every table triggers an audit log entry via database trigger. The log is append-only (no UPDATE/DELETE RLS policies on audit_log).
- **Column ID Immutability:** `column_id_number` is set on INSERT via trigger and cannot be changed.
- **Discarded Column Lock:** Database trigger prevents any new usage logs, regeneration, or transfer records for discarded columns.
- **Timestamps:** All timestamps stored as `TIMESTAMPTZ` (UTC). Frontend displays in IST (UTC+5:30).
- **Mandatory Remarks:** All approval/rejection actions require remarks (validated at form level).
- **Role-Based Access:** Supabase RLS policies enforce access at the database level, not just the UI.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/
│   │   ├── layout.tsx         # Auth guard + sidebar layout
│   │   ├── dashboard/         # Role-specific dashboard
│   │   ├── columns/           # Inventory + detail + new
│   │   ├── qualification/     # Qualification form
│   │   ├── usage/new/         # Usage log entry
│   │   ├── regeneration/      # Regeneration workflow
│   │   ├── transfers/         # Transfer requests
│   │   ├── discard/           # Discard (QC Head only)
│   │   ├── approvals/         # Pending approvals queue
│   │   ├── issuance/          # Column issuance (Supervisor)
│   │   ├── column-types/      # Type management (QC Head)
│   │   ├── reports/           # Excel + PDF export
│   │   └── audit/             # Audit trail viewer
│   └── auth/callback/         # Supabase auth callback
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Sidebar, Header
│   ├── columns/               # StatusBadge, etc.
│   └── approval/              # ApprovalStepper, ApprovalModal
├── lib/
│   ├── supabase/              # Client + Server Supabase instances
│   ├── validations/           # Zod schemas
│   ├── utils.ts               # Formatters, status configs
│   └── constants.ts           # Nav items, role labels
├── middleware.ts               # Auth session refresh
└── types/index.ts              # All TypeScript types
supabase/
├── schema.sql                 # All tables, enums, sequences
├── rls_policies.sql           # Row Level Security
├── triggers.sql               # Audit + business logic triggers
└── seed.sql                   # Demo data
```

---

## Adding to Navigation (issuance page)

The column issuance page at `/issuance` needs to be added to `src/lib/constants.ts` for Supervisor and QC Head:

```typescript
{ href: '/issuance', label: 'Issue Column', icon: 'Package', roles: ['supervisor', 'qc_head'] },
```

---

## Troubleshooting

**"profiles" table not found:**
Make sure to run `schema.sql` first before `rls_policies.sql`.

**Users can't log in:**
Ensure users are created in Supabase Auth with `email_confirm: true`. Check the Auth logs in Supabase dashboard.

**Column ID not generating:**
The `generate_column_id()` function requires the `column_id_seq` sequence. Re-run `schema.sql`.

**Audit logs not being created:**
The audit trigger runs as `SECURITY DEFINER`. Ensure `triggers.sql` was run after `schema.sql`.

**RLS blocking data access:**
Check the user's `role` in the `profiles` table. The `get_user_role()` function reads from profiles. If the trigger didn't create a profile, insert it manually.

---

## Production Deployment

1. Deploy to Vercel: `vercel deploy`
2. Add environment variables in Vercel dashboard
3. Update Supabase Auth redirect URLs to include your production domain
4. Enable Supabase realtime for live approval notifications (optional)

---

## License

Internal use only — Pharmaceutical QC Laboratory System
