import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginForm } from './components/LoginForm';

function ParentDashboardView() {
  const { currentUser, role, institutionId, logout } = useAuth();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>بوابة أولياء الأمور</h2>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>نظام إدارة السناتر التعليمية</span>
        </div>
        <button
          onClick={logout}
          style={{ padding: '0.5rem 1rem', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          تسجيل الخروج
        </button>
      </header>

      <main style={{ background: '#fafafa', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
        <h3>بيانات الحساب الموثق (Authenticated Parent Session)</h3>
        <p><strong>البريد الإلكتروني:</strong> {currentUser?.email}</p>
        <p><strong>معرف المستخدم (UID):</strong> {currentUser?.uid}</p>
        <p><strong>الدور (Role Claim):</strong> {role || 'parent'}</p>
        <p><strong>معرف المؤسسة (Tenant ID):</strong> {institutionId || 'غير محدد'}</p>
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#eef9f2', borderRadius: '4px', color: '#2e7d32' }}>
          ✅ تم إثبات الهوية والجلسة لبوابة أولياء الأمور (Phase 2 Identity Foundation Active)
        </div>
      </main>
    </div>
  );
}

function MainContent() {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <ParentDashboardView />;
  }

  return <LoginForm />;
}

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
