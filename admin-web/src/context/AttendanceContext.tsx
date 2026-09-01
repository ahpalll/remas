import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { AttendanceCorrection, AttendanceSession } from '../types/attendance';

export interface AttendanceContextType {
  sessions: AttendanceSession[];
  corrections: AttendanceCorrection[];
  loading: boolean;
  error: string | null;
  refreshAttendanceCore: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendanceCore = async () => {
    if (!currentUser || !institutionId) {
      setSessions([]);
      setCorrections([]);
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

      const [sessionsData, correctionsData] = await Promise.all([
        getCollectionDocs<AttendanceSession>('attendanceSessions'),
        getCollectionDocs<AttendanceCorrection>('attendanceCorrections'),
      ]);

      setSessions(sessionsData);
      setCorrections(correctionsData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات الحضور والغياب.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceCore();
  }, [currentUser, institutionId]);

  const value = {
    sessions,
    corrections,
    loading,
    error,
    refreshAttendanceCore: fetchAttendanceCore,
  };

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance(): AttendanceContextType {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
