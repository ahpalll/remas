import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider, useBranding } from './context/BrandingContext';
import { LoginForm } from './components/LoginForm';

function ParentDashboardView() {
  const { currentUser, role, institutionId, logout } = useAuth();
  const { branding } = useBranding();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto', backgroundColor: branding.backgroundColor }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${branding.primaryColor}`, paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.centerName} style={{ height: '48px', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: branding.primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              REMAS
            </div>
          )}
          <div>
            <h2 style={{ margin: 0, color: branding.primaryColor }}>{branding.centerName}</h2>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>{branding.welcomeMessage}</span>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ padding: '0.5rem 1rem', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          تسجيل الخروج
        </button>
      </header>

      <main style={{ background: '#fafafa', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${branding.primaryColor}33` }}>
        <h3 style={{ color: branding.primaryColor }}>بيانات الحساب الموثق (Authenticated Parent Session)</h3>
        <p><strong>المركز التعليمي:</strong> {branding.centerName}</p>
        <p><strong>البريد الإلكتروني:</strong> {currentUser?.email}</p>
        <p><strong>معرف المستخدم (UID):</strong> {currentUser?.uid}</p>
        <p><strong>الدور (Role Claim):</strong> {role || 'parent'}</p>
        <p><strong>معرف المؤسسة (Tenant ID):</strong> {institutionId || 'غير محدد'}</p>
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: `${branding.secondaryColor}15`, borderRadius: '4px', color: branding.secondaryColor, border: `1px solid ${branding.secondaryColor}40` }}>
          ✅ تم إثبات الهوية والجلسة وتطبيق الهوية البصرية لبوابة أولياء الأمور (Phase 39 Dynamic Branding Active)
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
      <BrandingProvider>
        <MainContent />
      </BrandingProvider>
    </AuthProvider>
  );
}

export default App;
