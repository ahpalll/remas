import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Entitlement, SubscriptionCode, SubscriptionPackage } from '../types/subscription';

export interface SubscriptionContextType {
  packages: SubscriptionPackage[];
  codes: SubscriptionCode[];
  entitlements: Entitlement[];
  loading: boolean;
  error: string | null;
  refreshSubscriptionCore: () => Promise<void>;
  actionMessage: string | null;
  triggerBlockedAction: (actionName: string) => void;
  clearActionMessage: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchSubscriptionCore = async () => {
    if (!currentUser || !institutionId) {
      setPackages([]);
      setCodes([]);
      setEntitlements([]);
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

      const [packageData, codeData, entitlementData] = await Promise.all([
        getCollectionDocs<SubscriptionPackage>('packages'),
        getCollectionDocs<SubscriptionCode>('subscriptionCodes'),
        getCollectionDocs<Entitlement>('entitlements'),
      ]);

      setPackages(packageData);
      setCodes(codeData);
      setEntitlements(entitlementData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات الباقات والاشتراكات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionCore();
  }, [currentUser, institutionId]);

  const triggerBlockedAction = (actionName: string) => {
    setActionMessage(`BLOCKED / USER ACTION REQUIRED: ${actionName} يتطلب نشر Cloud Functions Endpoints الموثوقة.`);
  };

  const clearActionMessage = () => setActionMessage(null);

  const value = {
    packages,
    codes,
    entitlements,
    loading,
    error,
    refreshSubscriptionCore: fetchSubscriptionCore,
    actionMessage,
    triggerBlockedAction,
    clearActionMessage,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
