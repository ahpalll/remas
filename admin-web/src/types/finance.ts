export type FeeFrequency = 'ONE_TIME' | 'MONTHLY' | 'TERM' | 'ANNUAL';
export type ChargeStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
export type DerivedPaymentStatus = 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED';
export type ExpenseStatus = 'RECORDED' | 'APPROVED' | 'CANCELLED';
export type CashboxStatus = 'OPEN' | 'CLOSED';
export type EntryType = 'DEBIT' | 'CREDIT';
export type AccountingCategory = 'STUDENT_FEE' | 'PAYMENT' | 'DISCOUNT' | 'WAIVER' | 'REFUND' | 'EXPENSE' | 'OTHER_INCOME' | 'TEACHER_SETTLEMENT' | 'EXPENSE_REVERSAL';
export type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface FeeStructure {
  id: string;
  institutionId: string;
  academicYearId: string;
  termId?: string;
  groupId?: string;
  stageId?: string;
  name: string;
  amountMinor: number;
  currency: string;
  frequency: FeeFrequency;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface StudentCharge {
  id: string;
  institutionId: string;
  studentId: string;
  feeStructureId: string;
  academicYearId: string;
  termId?: string;
  groupId?: string;
  stageId?: string;
  description: string;
  amountMinor: number;
  discountMinor: number;
  waiverMinor: number;
  netAmountMinor: number;
  paidAmountMinor: number;
  dueAmountMinor: number;
  status: ChargeStatus;
  dueDate: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface StudentPayment {
  id: string;
  institutionId: string;
  studentId: string;
  chargeId: string;
  receiptId: string;
  receiptNumber: string;
  cashboxPeriodId?: string;
  amountMinor: number;
  method: PaymentMethod;
  paidAt?: any;
  createdAt?: any;
  createdBy?: string;
  refundedAmountMinor: number;
  status: DerivedPaymentStatus;
}

export interface PaymentReceipt {
  id: string;
  institutionId: string;
  receiptNumber: string;
  paymentId: string;
  studentId: string;
  amountMinor: number;
  payerName: string;
  issuedAt?: any;
  issuedBy?: string;
}

export interface FinancialRefund {
  id: string;
  institutionId: string;
  paymentId: string;
  studentId: string;
  chargeId: string;
  amountMinor: number;
  reason: string;
  refundedAt?: any;
  refundedBy?: string;
}

export interface Expense {
  id: string;
  institutionId: string;
  category: string;
  description: string;
  amountMinor: number;
  method: PaymentMethod;
  cashboxPeriodId?: string;
  status: ExpenseStatus;
  paidTo: string;
  paidAt?: any;
  createdAt?: any;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: any;
}

export interface CashboxPeriod {
  id: string;
  institutionId: string;
  date: string;
  openingBalanceMinor: number;
  cashInflowMinor: number;
  cashOutflowMinor: number;
  closingBalanceMinor: number;
  status: CashboxStatus;
  openedAt?: any;
  closedAt?: any;
  openedBy?: string;
  closedBy?: string;
}

export interface FinancialLedgerEntry {
  id: string;
  institutionId: string;
  entryType: EntryType;
  category: AccountingCategory;
  amountMinor: number;
  currency: string;
  studentId?: string;
  chargeId?: string;
  paymentId?: string;
  refundId?: string;
  expenseId?: string;
  incomeId?: string;
  settlementId?: string;
  description: string;
  entryDate?: any;
  createdBy?: string;
}

export interface IdempotencyRecord {
  id: string;
  institutionId: string;
  operationType: string;
  idempotencyKey: string;
  requestHash: string;
  status: IdempotencyStatus;
  resultReference?: any;
  createdAt?: any;
  expiresAt?: any;
}
