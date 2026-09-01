import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { UserProfile, UserRole, UserStatus } from '../types/user';

export interface UserManagementContextType {
  users: UserProfile[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  refreshUsers: () => Promise<void>;
  updateUserProfile: (targetUid: string, data: { fullName?: string; phone?: string }) => Promise<void>;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);

export function UserManagementProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchUsers = async () => {
    if (!currentUser || !institutionId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, 'institutions', institutionId, 'users');
      const q = query(usersRef);
      const querySnap = await getDocs(q);

      const userList: UserProfile[] = [];
      querySnap.forEach((docSnap) => {
        userList.push({
          ...(docSnap.data() as UserProfile),
          uid: docSnap.id,
          institutionId: institutionId,
        });
      });

      setUsers(userList);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل قائمة المستخدمين.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser, institutionId]);

  const updateUserProfile = async (targetUid: string, data: { fullName?: string; phone?: string }) => {
    if (!institutionId || !currentUser) {
      throw new Error('لا توجد جلسة موثقة.');
    }

    setLoading(true);
    try {
      const docRef = doc(db, 'institutions', institutionId, 'users', targetUid);
      // Whitelisted fields update: fullName, phone, updatedAt, updatedBy
      const updatePayload: any = {
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid,
      };
      if (data.fullName !== undefined) updatePayload.fullName = data.fullName;
      if (data.phone !== undefined) updatePayload.phone = data.phone;

      await updateDoc(docRef, updatePayload);
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, ...updatePayload } : u))
      );
    } catch (err: any) {
      setError(err?.message || 'فشل تحديث بيانات المستخدم.');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    users,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    refreshUsers: fetchUsers,
    updateUserProfile,
  };

  return (
    <UserManagementContext.Provider value={value}>
      {children}
    </UserManagementContext.Provider>
  );
}

export function useUserManagement(): UserManagementContextType {
  const context = useContext(UserManagementContext);
  if (!context) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  return context;
}
