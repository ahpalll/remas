# REMAS Educational SaaS — Firestore Security Rules Matrix

## Tenant Isolation Matrix

| Caller Context | Resource / Target Path | Evaluation Result | Rule Description |
| :--- | :--- | :---: | :--- |
| `SuperAdmin` | `institutions/{instId}` | **ALLOW** | `isSuperAdmin()` global read/write |
| `Institution Owner A` | `institutions/inst_A` | **ALLOW** | `isTenantAdmin('inst_A')` |
| `Institution Owner A` | `institutions/inst_B` | **DENY** | `isTenantUser` check fails |
| `Teacher A` | `institutions/inst_A/teachers` | **ALLOW** | `isTenantUser('inst_A')` |
| `Teacher A` | `institutions/inst_B/teachers` | **DENY** | `isTenantUser` check fails |
| `Student A` | `institutions/inst_A/students/stu_A` | **ALLOW** | `authUid == resource.data.authUid` |
| `Student A` | `institutions/inst_B/students/stu_B` | **DENY** | `authUid` mismatch + tenant mismatch |
| `Parent A` | `institutions/inst_A/studentGuardians` | **ALLOW** | `isTenantAdmin` or linked parent read |
| `Unauthenticated` | Any Collection | **DENY** | Default Deny (`isAuthenticated() == false`) |

## Rules Verification Execution
- Test Suite: [firebase/phase_43_auth_rules.test.js](file:///f:/remas/firebase/phase_43_auth_rules.test.js) (12/12 Matrix Tests PASS)
- Monorepo Suite: [firebase/firestore_rules.test.js](file:///f:/remas/firebase/firestore_rules.test.js) (192/192 Rules Tests PASS)
