import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { AcademicYear, Group, Room, Schedule, Stage, Subject, Teacher, Term } from '../types/academic';

export interface AcademicContextType {
  academicYears: AcademicYear[];
  terms: Term[];
  subjects: Subject[];
  teachers: Teacher[];
  stages: Stage[];
  rooms: Room[];
  groups: Group[];
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  refreshAcademicCore: () => Promise<void>;
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined);

export function AcademicProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAcademicCore = async () => {
    if (!currentUser || !institutionId) {
      setAcademicYears([]);
      setTerms([]);
      setSubjects([]);
      setTeachers([]);
      setStages([]);
      setRooms([]);
      setGroups([]);
      setSchedules([]);
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

      const [yearsData, termsData, subjectsData, teachersData, stagesData, roomsData, groupsData, schedulesData] =
        await Promise.all([
          getCollectionDocs<AcademicYear>('academicYears'),
          getCollectionDocs<Term>('terms'),
          getCollectionDocs<Subject>('subjects'),
          getCollectionDocs<Teacher>('teachers'),
          getCollectionDocs<Stage>('stages'),
          getCollectionDocs<Room>('rooms'),
          getCollectionDocs<Group>('groups'),
          getCollectionDocs<Schedule>('schedules'),
        ]);

      setAcademicYears(yearsData);
      setTerms(termsData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
      setStages(stagesData);
      setRooms(roomsData);
      setGroups(groupsData);
      setSchedules(schedulesData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل البيانات الأكاديمية.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicCore();
  }, [currentUser, institutionId]);

  const value = {
    academicYears,
    terms,
    subjects,
    teachers,
    stages,
    rooms,
    groups,
    schedules,
    loading,
    error,
    refreshAcademicCore: fetchAcademicCore,
  };

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic(): AcademicContextType {
  const context = useContext(AcademicContext);
  if (!context) {
    throw new Error('useAcademic must be used within an AcademicProvider');
  }
  return context;
}
