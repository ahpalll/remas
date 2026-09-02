import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InstitutionProvider, useInstitution } from './context/InstitutionContext';
import { UserManagementProvider } from './context/UserManagementContext';
import { AcademicProvider } from './context/AcademicContext';
import { StudentProvider } from './context/StudentContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { FinanceProvider } from './context/FinanceContext';
import { LoginForm } from './components/LoginForm';
import { PasswordResetForm } from './components/PasswordResetForm';
import { InstitutionSettings } from './components/InstitutionSettings';
import { SuperAdminInstitutions } from './components/SuperAdminInstitutions';
import { UserList } from './components/UserList';
import { AcademicCoreDashboard } from './components/AcademicCoreDashboard';
import { StudentsManager } from './components/student/StudentsManager';
import { AttendanceSessionManager } from './components/attendance/AttendanceSessionManager';
import { FinanceDashboard } from './components/finance/FinanceDashboard';

function DashboardView() {
  const { currentUser, role, institutionId, logout } = useAuth();
  const { institution } = useInstitution();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1050px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>لوحة إدارة المؤسسة التعليمية</h2>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            المؤسسة الحالية: <strong>{institution?.name || institutionId || 'غير محدد'}</strong>
          </span>
        </div>
        <button
          onClick={logout}
          style={{ padding: '0.5rem 1rem', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          تسجيل الخروج
        </button>
      </header>

      <main style={{ background: '#fafafa', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
        <h3>بيانات الجلسة الموثقة (Tenant & Auth Session)</h3>
        <p><strong>البريد الإلكتروني:</strong> {currentUser?.email}</p>
        <p><strong>معرف المستخدم (UID):</strong> {currentUser?.uid}</p>
        <p><strong>الدور (Role Claim):</strong> {role || 'غير محدد'}</p>
        <p><strong>معرف السنتر (Tenant ID):</strong> {institutionId || 'غير محدد'}</p>
        <p><strong>حالة المؤسسة الحالية:</strong> {institution?.status || 'ACTIVE'}</p>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#e8f5e9', borderRadius: '4px', color: '#2e7d32' }}>
          ✅ تم تفعيل النظام المالي بنجاح (Phase 8 Finance System Foundation Active)
        </div>
      </main>

      <UserManagementProvider>
        <UserList />
      </UserManagementProvider>

      <AcademicProvider>
        <AcademicCoreDashboard />
      </AcademicProvider>

      <StudentProvider>
        <StudentsManager />
      </StudentProvider>

      <AttendanceProvider>
        <AttendanceSessionManager />
      </AttendanceProvider>

      <FinanceProvider>
        <FinanceDashboard />
      </FinanceProvider>

      <InstitutionSettings />
      <SuperAdminInstitutions />
    </div>
  );
}

function MainContent() {
  const { currentUser } = useAuth();
  const [view, setView] = useState<'login' | 'reset'>('login');

  if (currentUser) {
    return (
      <InstitutionProvider>
        <DashboardView />
      </InstitutionProvider>
    );
  }

  return (
    <div>
      {view === 'login' ? (
        <LoginForm onShowReset={() => setView('reset')} />
      ) : (
        <PasswordResetForm onBack={() => setView('login')} />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
