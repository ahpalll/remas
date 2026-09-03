export type BookStatus = 'ACTIVE' | 'ARCHIVED';
export type SupplierStatus = 'ACTIVE' | 'ARCHIVED';
export type PurchaseStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type SaleStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type StudentDeliveryStatus = 'DELIVERED' | 'RETURNED' | 'CANCELLED';
export type ReturnType = 'SALE_RETURN' | 'DELIVERY_RETURN' | 'PURCHASE_RETURN';
export type StockMovementType = 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'STUDENT_DELIVERY' | 'RETURN' | 'ADJUSTMENT';
export type InventoryStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Book {
  id: string;
  institutionId: string;
  title: string;
  code: string; // SKU (unique per institution)
  isbn?: string;
  description?: string;
  subjectId?: string;
  stageId?: string;
  academicYearId?: string;
  publisher?: string;
  unitCostMinor: number;
  salePriceMinor: number;
  reorderLevel: number;
  status: BookStatus;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Supplier {
  id: string;
  institutionId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  status: SupplierStatus;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface PurchaseLine {
  bookId: string;
  quantity: number;
  unitCostMinor: number;
  lineTotalMinor: number;
}

export interface Purchase {
  id: string;
  institutionId: string;
  supplierId: string;
  referenceNumber: string; // PUR-inst_A-2026-000001
  purchaseDate: string;
  status: PurchaseStatus;
  notes?: string;
  totalAmountMinor: number;
  lines: PurchaseLine[];
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface SaleLine {
  bookId: string;
  quantity: number;
  unitPriceMinor: number;
  unitCostSnapshotMinor: number;
  lineTotalMinor: number;
}

export interface BookSale {
  id: string;
  institutionId: string;
  receiptNumber: string; // SAL-inst_A-2026-000001
  saleDate: string;
  status: SaleStatus;
  studentId?: string;
  customerName?: string;
  paymentMethod: string;
  discountMinor: number;
  subtotalMinor: number;
  totalAmountMinor: number;
  costTotalMinor: number;
  lines: SaleLine[];
  createdAt?: any;
  createdBy?: string;
}

export interface DeliveryLine {
  bookId: string;
  quantity: number;
}

export interface StudentBookDelivery {
  id: string;
  institutionId: string;
  studentId: string;
  referenceNumber: string; // DEL-inst_A-2026-000001
  deliveryDate: string;
  status: StudentDeliveryStatus;
  notes?: string;
  lines: DeliveryLine[];
  createdAt?: any;
  createdBy?: string;
}

export interface ReturnLine {
  bookId: string;
  quantity: number;
}

export interface InventoryReturn {
  id: string;
  institutionId: string;
  returnType: ReturnType;
  referenceNumber: string; // RET-inst_A-2026-000001
  originalTransactionId: string;
  studentId?: string;
  supplierId?: string;
  reason: string;
  lines: ReturnLine[];
  createdAt?: any;
  createdBy?: string;
}

export interface StockMovement {
  id: string;
  institutionId: string;
  bookId: string;
  movementType: StockMovementType;
  quantity: number;
  unitCostMinor?: number;
  referenceType: string;
  referenceId: string;
  notes?: string;
  occurredAt?: any;
  createdAt?: any;
  createdBy?: string;
}

export interface InventoryItem {
  bookId: string;
  institutionId: string;
  currentStock: number;
  reorderLevel: number;
  status: InventoryStockStatus;
}
