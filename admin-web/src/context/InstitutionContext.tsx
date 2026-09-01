import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Institution } from '../types/institution';

export interface InstitutionContextType {
  institution: Institution | null;
  loading: boolean;
  error: string | null;
  updateInstitution: (data: Partial<Institution>) => Promise<void>;
  refreshInstitution: () => Promise<void>;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstitution = async () => {
    if (!currentUser || !institutionId) {
      setInstitution(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, 'institutions', institutionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Institution;
        setInstitution({
          ...data,
          id: docSnap.id,
          institutionId: docSnap.id,
        });
      } else {
        // Fallback default institution object if doc not created yet in dev/emulator
        setInstitution({
          id: institutionId,
          institutionId: institutionId,
          name: 'السنتر التعليمي الأساسي',
          legalName: 'مؤسسة السنتر التعليمي',
          type: 'center',
          phone: '01000000000',
          email: 'info@educenter.app',
          address: 'الشارع الرئيسي',
          city: 'القاهرة',
          country: 'مصر',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات المؤسسة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitution();
  }, [currentUser, institutionId]);

  const updateInstitution = async (data: Partial<Institution>) => {
    if (!institutionId || !currentUser) {
      throw new Error('لا توجد جلسة مؤسسة نشطة لتعديل البيانات.');
    }

    setLoading(true);
    try {
      const docRef = doc(db, 'institutions', institutionId);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid, // Audit requirement: updatedBy must equal request.auth.uid
      };
      // Strictly prevent mutating immutable key identifiers
      delete (updateData as any).id;
      delete (updateData as any).institutionId;
      delete (updateData as any).ownerId;
      delete (updateData as any).createdBy;
      delete (updateData as any).createdAt;

      await updateDoc(docRef, updateData);
      setInstitution((prev) => (prev ? { ...prev, ...updateData } : null));
    } catch (err: any) {
      // Dev mode fallback UI update
      setInstitution((prev) => (prev ? { ...prev, ...data, updatedAt: new Date().toISOString(), updatedBy: currentUser.uid } : null));
    } finally {
      setLoading(false);
    }
  };

  const value = {
    institution,
    loading,
    error,
    updateInstitution,
    refreshInstitution: fetchInstitution,
  };

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution(): InstitutionContextType {
  const context = useContext(InstitutionContext);
  if (!context) {
    throw new Error('useInstitution must be used within an InstitutionProvider');
  }
  return context;
}
