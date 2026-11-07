# Role-Based Access Control (RBAC) Architecture

## Overview
To provide a professional experience suitable for enterprise, the platform incorporates a three-tier access control structure. This separates functionality between standard daily users, departmental managers, and root-level system administrators.

## Roles

### 1. Admin (`role: 'admin'`)
The administrator has platform control.
- **Capabilities**: Manage all system users, assign roles, define global platform variables, view system audit logs.
- **Routing Rules**: They bypass standard application workflows (e.g. creating personal books) to focus exclusively on macro-level administration via `/admin/*`.
- **Pages Added**: `UserManagement.jsx` (Active directory mapping), `SystemSettings.jsx` (Billing and LLM constraints).

### 2. Manager (`role: 'manager'`)
Managers govern specific departmental units while retaining their ability to use standard user apps.
- **Capabilities**: View their team's simulations, approve/reject generated outputs, create private simulations, and track specific department telemetry data.
- **Routing Rules**: AppShell displays standard user tools ("Library") along with specific Manager suites `/manager/*`.
- **Pages Added**: `TeamAnalytics.jsx` (metric forecasting charts) and `Approvals.jsx`.

### 3. User (`role: 'user'`)
The standard, daily consumer footprint.
- **Capabilities**: View own drafts, create single workspaces, generate character simulations, run chat queries.
- **Routing Rules**: Cannot escape `/`, `/workspace/:id`, `/chat/:id`. Requesting manager or admin roots redirects back to base `Library`.

## Frontend Implementation details
- **State Provider**: Defined in `frontend/src/lib/RoleProvider.jsx`. This wraps the global routing sequence.
- **Development Toggle**: Because the backend does not yet natively yield JWT role signatures, the frontend UI supports a **Role Toggle Switch** baked directly inside the header's User Profile menu. Changing this value reacts globally across `AppShell` and nested route evaluations via `useRole()`.
- **Role Guards**: Used strictly around standard App components to evaluate URL patterns. Currently implemented as a local `RoleGuard` shell directly instantiated inside `App.jsx` to shield invalid component tree loads.
