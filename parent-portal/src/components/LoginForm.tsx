import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

export function LoginForm() {
  const { login } = useAuth();
  const { branding } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول. يرجى التثبت من بيانات حساب ولي الأمر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto', padding: '2rem', border: `1px solid ${branding.primaryColor}33`, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.centerName} style={{ height: '56px', marginBottom: '12px' }} />
        ) : (
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: branding.primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 'bold', fontSize: '18px' }}>
            REMAS
          </div>
        )}
        <h2 style={{ color: branding.primaryColor, margin: '0 0 6px 0', fontSize: '1.4rem' }}>{branding.loginTitle}</h2>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>{branding.welcomeMessage}</span>
      </div>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>البريد الإلكتروني / اسم المستخدم</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{ width: '100%', padding: '0.75rem', background: branding.primaryColor, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSubmitting ? 'جاري الدخول...' : 'تسجيل دخول ولي الأمر'}
        </button>
      </form>
    </div>
  );
}
