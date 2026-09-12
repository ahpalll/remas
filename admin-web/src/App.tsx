import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InstitutionProvider, useInstitution } from './context/InstitutionContext';
import { UserManagementProvider } from './context/UserManagementContext';
import { AcademicProvider } from './context/AcademicContext';
import { StudentProvider } from './context/StudentContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { FinanceProvider } from './context/FinanceContext';
import { InventoryProvider } from './context/InventoryContext';
import { ExamProvider } from './context/ExamContext';
import { ContentProvider } from './context/ContentContext';
import { MediaProvider } from './context/MediaContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { LoginForm } from './components/LoginForm';
import { PasswordResetForm } from './components/PasswordResetForm';
import { InstitutionSettings } from './components/InstitutionSettings';
import { SuperAdminInstitutions } from './components/SuperAdminInstitutions';
import { UserList } from './components/UserList';
import { AcademicCoreDashboard } from './components/AcademicCoreDashboard';
import { StudentsManager } from './components/student/StudentsManager';
import { AttendanceSessionManager } from './components/attendance/AttendanceSessionManager';
import { FinanceDashboard } from './components/finance/FinanceDashboard';
import { InventoryDashboard } from './components/inventory/InventoryDashboard';
import { ExamDashboard } from './components/exam/ExamDashboard';
import { ContentDashboard } from './components/content/ContentDashboard';
import { MediaManager } from './components/media/MediaManager';
import { SubscriptionDashboard } from './components/subscription/SubscriptionDashboard';
import { NotificationDashboard } from './components/notifications/NotificationDashboard';
import { CenterOperationsConsole } from './components/CenterOperationsConsole';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SuperAdminDevices } from './components/SuperAdminDevices';
import { SuperAdminLicenses } from './components/SuperAdminLicenses';
import { SuperAdminAISettings } from './components/SuperAdminAISettings';
import { SuperAdminUsage } from './components/SuperAdminUsage';
import { SuperAdminHealth } from './components/SuperAdminHealth';
import { SuperAdminAudit } from './components/SuperAdminAudit';

function DashboardView() {
  const { currentUser, role, institutionId, logout } = useAuth();
  const { institution } = useInstitution();
  const [adminTab, setAdminTab] = useState<'dashboard' | 'institutions' | 'licenses' | 'devices' | 'ai' | 'usage' | 'health' | 'audit'>('dashboard');

  const isSuperAdminUser = role === 'superadmin' || role === 'superAdmin' || currentUser?.email?.includes('superadmin');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a' }}>
            {isSuperAdminUser ? '👑 منصة السوبر أدمن — REMAS EDU SuperAdmin Control Center' : 'لوحة إدارة المؤسسة التعليمية'}
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {isSuperAdminUser ? `المستخدم: ${currentUser?.email} (SuperAdmin Identity)` : `المؤسسة الحالية: ${institution?.name || institutionId || 'غير محدد'}`}
          </span>
        </div>
        <button
          onClick={logout}
          style={{ padding: '0.5rem 1.2rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          تسجيل الخروج
        </button>
      </header>

      {/* SuperAdmin Mobile-First Responsive Navigation Bar */}
      {isSuperAdminUser && (
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #0284c7' }}>
          {[
            { id: 'dashboard', label: '📊 الرئيسية' },
            { id: 'institutions', label: '🏛️ المؤسسات' },
            { id: 'licenses', label: '🔑 التراخيص' },
            { id: 'devices', label: '💻 الأجهزة' },
            { id: 'ai', label: '🤖 الذكاء الاصطناعي' },
            { id: 'usage', label: '📈 الاستهلاك' },
            { id: 'health', label: '🏥 سلامة النظام' },
            { id: 'audit', label: '📜 سجل الأمان' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '6px 6px 0 0',
                border: 'none',
                background: adminTab === tab.id ? '#0284c7' : '#f1f5f9',
                color: adminTab === tab.id ? '#fff' : '#334155',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '0.85rem'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {isSuperAdminUser ? (
        <div>
          {adminTab === 'dashboard' && <SuperAdminDashboard />}
          {adminTab === 'institutions' && <SuperAdminInstitutions />}
          {adminTab === 'licenses' && <SuperAdminLicenses />}
          {adminTab === 'devices' && <SuperAdminDevices />}
          {adminTab === 'ai' && <SuperAdminAISettings />}
          {adminTab === 'usage' && <SuperAdminUsage />}
          {adminTab === 'health' && <SuperAdminHealth />}
          {adminTab === 'audit' && <SuperAdminAudit />}
        </div>
      ) : (
        <div>
          <main style={{ background: '#fafafa', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
            <h3>بيانات الجلسة الموثقة (Tenant & Auth Session)</h3>
            <p><strong>البريد الإلكتروني:</strong> {currentUser?.email}</p>
            <p><strong>معرف المستخدم (UID):</strong> {currentUser?.uid}</p>
            <p><strong>الدور (Role Claim):</strong> {role || 'غير محدد'}</p>
            <p><strong>معرف السنتر (Tenant ID):</strong> {institutionId || 'غير محدد'}</p>
            <p><strong>حالة المؤسسة الحالية:</strong> {institution?.status || 'ACTIVE'}</p>
          </main>

          <AcademicProvider>
            <StudentProvider>
              <CenterOperationsConsole />
            </StudentProvider>
          </AcademicProvider>

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

          <InventoryProvider>
            <InventoryDashboard />
          </InventoryProvider>

          <ExamProvider>
            <ExamDashboard />
          </ExamProvider>

          <ContentProvider>
            <ContentDashboard />
          </ContentProvider>

          <MediaProvider>
            <MediaManager />
          </MediaProvider>

          <SubscriptionProvider>
            <SubscriptionDashboard />
          </SubscriptionProvider>

          <NotificationDashboard />
          <InstitutionSettings />
        </div>
      )}
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
