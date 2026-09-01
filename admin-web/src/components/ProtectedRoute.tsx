import React from 'react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ 
  allowedRoles, 
  children 
}: { 
  allowedRoles?: string[]; 
  children: React.ReactNode; 
}) {
  const { currentUser, role, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحقق من الجلسة...</div>;
  }

  if (!currentUser) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>يرجى تسجيل الدخول للوصول لهذه الصفحة.</div>;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>عذراً، لا تملك الصلاحيات المطلوبة لدخول هذه الصفحة.</div>;
  }

  return <>{children}</>;
}
