import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Enrollment, Guardian, Student, StudentGuardian } from '../types/student';

export interface StudentContextType {
  students: Student[];
  enrollments: Enrollment[];
  guardians: Guardian[];
  studentGuardians: StudentGuardian[];
  loading: boolean;
  error: string | null;
  refreshStudentCore: () => Promise<void>;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [studentGuardians, setStudentGuardians] = useState<StudentGuardian[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudentCore = async () => {
    if (!currentUser || !institutionId) {
      setStudents([]);
      setEnrollments([]);
      setGuardians([]);
      setStudentGuardians([]);
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

      const [studentsData, enrollmentsData, guardiansData, sgData] = await Promise.all([
        getCollectionDocs<Student>('students'),
        getCollectionDocs<Enrollment>('enrollments'),
        getCollectionDocs<Guardian>('guardians'),
        getCollectionDocs<StudentGuardian>('studentGuardians'),
      ]);

      setStudents(studentsData);
      setEnrollments(enrollmentsData);
      setGuardians(guardiansData);
      setStudentGuardians(sgData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات الطلاب.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentCore();
  }, [currentUser, institutionId]);

  const value = {
    students,
    enrollments,
    guardians,
    studentGuardians,
    loading,
    error,
    refreshStudentCore: fetchStudentCore,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudents(): StudentContextType {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudents must be used within a StudentProvider');
  }
  return context;
}
