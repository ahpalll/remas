import React from 'react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحقق من الجلسة...</div>;
  }

  if (!currentUser) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>يرجى تسجيل الدخول لبوابة أولياء الأمور.</div>;
  }

  return <>{children}</>;
}
