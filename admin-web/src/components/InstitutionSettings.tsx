import React, { useState, useEffect } from 'react';
import { useInstitution } from '../context/InstitutionContext';
import { InstitutionType, InstitutionStatus } from '../types/institution';

export function InstitutionSettings() {
  const { institution, loading, error, updateInstitution } = useInstitution();
  
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [type, setType] = useState<InstitutionType>('center');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState<InstitutionStatus>('ACTIVE');

  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (institution) {
      setName(institution.name || '');
      setLegalName(institution.legalName || '');
      setType(institution.type || 'center');
      setPhone(institution.phone || '');
      setEmail(institution.email || '');
      setAddress(institution.address || '');
      setCity(institution.city || '');
      setCountry(institution.country || '');
      setStatus(institution.status || 'ACTIVE');
    }
  }, [institution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setFormError('');

    if (!name.trim()) {
      setFormError('اسم المؤسسة مطلوب.');
      return;
    }

    setIsSaving(true);
    try {
      await updateInstitution({
        name,
        legalName,
        type,
        phone,
        email,
        address,
        city,
        country,
        status,
      });
      setMessage('تم حفظ إعدادات المؤسسة بنجاح.');
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !institution) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري تحميل بيانات المؤسسة...</div>;
  }

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
        إعدادات المؤسسة التعليمية (Tenant Settings)
      </h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {message && <div style={{ color: '#2e7d32', background: '#e8f5e9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{message}</div>}
      {formError && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{formError}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>اسم السنتر / المؤسسة *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>الاسم القانوني / التجاري</label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>نوع المؤسسة</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InstitutionType)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              <option value="center">سنتر تعليمي (Center)</option>
              <option value="school">مدرسة خاصة (School)</option>
              <option value="academy">أكاديمية (Academy)</option>
              <option value="private">دروس خاصة (Private)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>رقم الهاتف</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>البريد الإلكتروني للمؤسسة</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>العنوان التفصيلي</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>المدينة</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>الدولة</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>حالة المؤسسة (Lifecycle Status)</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InstitutionStatus)}
            style={{ width: '100%', maxWidth: '300px', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          >
            <option value="ACTIVE">نشط (ACTIVE)</option>
            <option value="SUSPENDED">موقف مؤقتاً (SUSPENDED)</option>
            <option value="ARCHIVED">مؤرشف (ARCHIVED)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          style={{ padding: '0.75rem 1.5rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ بيانات المؤسسة'}
        </button>
      </form>
    </div>
  );
}
