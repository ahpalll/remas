import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Expense, FeeStructure, FinancialLedgerEntry, StudentCharge, StudentPayment } from '../types/finance';

export interface FinanceContextType {
  feeStructures: FeeStructure[];
  charges: StudentCharge[];
  payments: StudentPayment[];
  expenses: Expense[];
  ledgerEntries: FinancialLedgerEntry[];
  loading: boolean;
  error: string | null;
  refreshFinanceCore: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [charges, setCharges] = useState<StudentCharge[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<FinancialLedgerEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFinanceCore = async () => {
    if (!currentUser || !institutionId) {
      setFeeStructures([]);
      setCharges([]);
      setPayments([]);
      setExpenses([]);
      setLedgerEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const getCollectionDocs = async <T,>(colName: string): Promise<T[]> => {
        const ref = collection(db, 'institutions', institutionId, colName);
        const snap = await getDocs(query(ref));
        const items: T[] = [];
        snap.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as T), id: docSnap.id });
        });
        return items;
      };

      const [feeData, chargesData, paymentsData, expensesData, ledgerData] = await Promise.all([
        getCollectionDocs<FeeStructure>('feeStructures'),
        getCollectionDocs<StudentCharge>('studentCharges'),
        getCollectionDocs<StudentPayment>('studentPayments'),
        getCollectionDocs<Expense>('expenses'),
        getCollectionDocs<FinancialLedgerEntry>('financialLedger'),
      ]);

      setFeeStructures(feeData);
      setCharges(chargesData);
      setPayments(paymentsData);
      setExpenses(expensesData);
      setLedgerEntries(ledgerData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل البيانات المالية.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceCore();
  }, [currentUser, institutionId]);

  const value = {
    feeStructures,
    charges,
    payments,
    expenses,
    ledgerEntries,
    loading,
    error,
    refreshFinanceCore: fetchFinanceCore,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
