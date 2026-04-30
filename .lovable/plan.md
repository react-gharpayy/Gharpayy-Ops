## Goal

Tie the bottom-left **"View as"** dropdown in the sidebar to the **real logged-in role** so each role only sees the personas they're allowed to use, and add a brand-new **`owner` (Property Owner)** top-level role that Super Admin can create credentials for.

## Role → "View as" visibility matrix

| Logged-in DB role | Dropdown options shown                  | Default selection |
|-------------------|------------------------------------------|-------------------|
| `super_admin`     | Super Admin only (dropdown hidden / locked) | Super Admin       |
| `manager`         | HR / Leadership only                     | HR / Leadership   |
| `admin`           | HR / Leadership only                     | HR / Leadership   |
| `member`          | Flow Ops, TCM                            | Flow Ops          |
| `owner` (NEW)     | Property Owner only                      | Property Owner    |

The dropdown becomes a plain label whenever there is only one option.

## Changes

### 1. Add `owner` as a 4th top-level DB role

- `src/contracts/roles.ts` — add `"owner"` to the `TopRole` enum and give it a sensible scope set (read-only on inventory/tours for their own property; no lead/user admin).
- `server/src/modules/users/routes.ts` — accept `"owner"` in the `CreateBody.role` enum and the `roleList` helper so `/api/users` create + filter works.
- `server/src/auth/auth.ts` — make sure `createManagedUser` accepts `owner` and `DEFAULT_SCOPES` covers it (no special zone requirement).
- `src/components/settings/AddUserForm.tsx` — add `<SelectItem value="owner">Property Owner</SelectItem>`. Owner does **not** require a zone (skip the zone block for `role === "owner"`).
- `src/components/settings/RolesTab.tsx` — add an "Owners" section/tab listing all owner accounts (same card style as Admins/Members, no zone chip).
- `src/components/settings/UsersTab.tsx` — render `owner` in the role filter / badge.

### 2. Wire the sidebar persona switcher to the real role

File: `src/components/AppShell.tsx` (the `View as` Select around line 268-292).

- Read `authUser.role` from `useAuthUser`.
- Compute `allowedPersonas` from the matrix above:
  ```ts
  const allowed: Record<DbRole, PersonaRole[]> = {
    super_admin: ["super-admin"],
    manager:     ["hr"],
    admin:       ["hr"],
    member:      ["flow-ops", "tcm"],
    owner:       ["owner"],
  };
  ```
- On hydrate, if current `role` is not in `allowed[authUser.role]`, call `setRole(allowed[authUser.role][0])`. Replace the existing super-admin-only effect with this generic one.
- Render the `<Select>` only when `allowed[...]` has length > 1. Otherwise show a static read-only chip with the persona label (same styling as the current "View as" hint).
- Same treatment in the mobile version (`MobileNavContent` in `src/myt/components/AppSidebar.tsx`) — gate the role buttons by the same `allowed` set.

### 3. Login + routing for owner

- `src/routes/login.tsx` — no change needed; existing JWT login already returns `user.role`.
- `src/components/AuthGate.tsx` — confirm it allows `owner` through (no role-based redirect that bounces them).
- When an `owner` lands on `/`, default them into the existing `/owner` route (the owner persona's nav already exists in `AppShell.navByRole.owner`).

### 4. Memory

Update `mem://index.md` Core line to record the 5 top-level DB roles (`super_admin, manager, admin, member, owner`) and the View-as visibility matrix so future sessions don't regress this.

## Technical notes

- The legacy `Role` type in `src/lib/types.ts` (`"flow-ops" | "tcm" | "hr" | "owner" | "super-admin"`) is the **persona/view** enum used by mock data, NOT the DB role. We keep it as-is — the matrix maps DB `TopRole` → persona `Role`.
- Persona registry already has `OWNERS` entries in `src/lib/personas.ts`, so the owner view works out of the box.
- Backend: existing `requireScope` middleware stays; we just extend `DEFAULT_SCOPES` for `owner`.
- No DB migration needed — `users.role` is a free string in Mongo; adding `"owner"` is purely a schema-validation change in zod.

## Out of scope

- Building the owner-facing property dashboard data flows (the routes exist; data is mock). Only auth + sidebar wiring is in this change.
- Per-property scoping for owner accounts (which property they own) — can be a follow-up; for now the owner sees the same `/owner/*` routes as the persona view.