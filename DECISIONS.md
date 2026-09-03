# Architectural Decision Records (ADR)

## ADR-009: Phase 9 Books & Inventory Architecture & Costing Model

### Context
Educational centers manage books, study notes, and materials. Inventory levels must be accurate, traceable, and protected from arbitrary direct client manipulation or negative balances.

### Decision
1. **Single-Entry Immutable Stock Ledger (`StockMovement`)**: Stock movements (`STOCK_IN`, `STOCK_OUT`, `SALE`, `STUDENT_DELIVERY`, `RETURN`, `ADJUSTMENT`) are the sole source of truth for stock quantities. Direct client writes are denied (`allow create, update, delete: if false`).
2. **Non-Negative Stock Invariant**: Available stock MUST NEVER become negative. Atomic checks in trusted backend logic enforce `availableStock >= quantity`.
3. **Per-Sale Cost Snapshot**: Unit cost snapshot (`unitCostSnapshotMinor`) is captured at posting time for accurate gross profit estimation without floating-point errors.
4. **Tenant-Scoped Reference Numbers**: Reference numbers (`PUR-inst_A-2026-000001`, `SAL-inst_A-2026-000001`, `DEL-inst_A-2026-000001`, `RET-inst_A-2026-000001`) are institution-scoped.
5. **Idempotency Locks**: Inventory mutations support SHA-256 idempotency locks to prevent duplicate stock movements upon network retries.
