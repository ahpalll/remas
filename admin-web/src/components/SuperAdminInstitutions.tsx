import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InstitutionType } from '../types/institution';

export function SuperAdminInstitutions() {
  const { currentUser, role } = useAuth();

  const [newInstId, setNewInstId] = useState('');
  const [newInstName, setNewInstName] = useState('');
  const [newInstType, setNewInstType] = useState<InstitutionType>('center');
  const [newOwnerId, setNewOwnerId] = useState('');
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (role !== 'superAdmin') {
    return null; // Authorization is enforced by Firestore Rules; UI guard prevents unnecessary rendering
  }

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!newInstId.trim() || !newInstName.trim()) {
      setError('معرف السنتر واسم المؤسسة حقول مطلوبة.');
      return;
    }

    if (!currentUser) {
      setError('لا توجد جلسة موثقة لإنشاء المؤسسة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanInstId = newInstId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const docRef = doc(db, 'institutions', cleanInstId);
      
      const newInstData: any = {
        id: cleanInstId,
        institutionId: cleanInstId, // Structural requirement: institutionId MUST equal document ID
        name: newInstName.trim(),
        type: newInstType,
        status: 'ACTIVE',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.uid, // Audit requirement: createdBy MUST equal request.auth.uid
        updatedBy: currentUser.uid, // Audit requirement: updatedBy MUST equal request.auth.uid
      };

      if (newOwnerId.trim()) {
        newInstData.ownerId = newOwnerId.trim();
      }

      await setDoc(docRef, newInstData);
      setMessage(`تم إنشاء المؤسسة (${newInstName}) بنجاح بمعرف: ${cleanInstId}`);
      setNewInstId('');
      setNewInstName('');
      setNewOwnerId('');
    } catch (err: any) {
      setError(err?.message || 'فشل إنشاء المؤسسة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ background: '#fff3e0', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ffe0b2', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, color: '#e65100' }}>إدارة المنصة الكلية (Super Admin Console)</h3>
      <p style={{ fontSize: '0.9rem', color: '#5d4037' }}>إنشاء مؤسسة / سنتر جديد في النظام. (ملاحظة: ownerId اختياري ويربط بمستخدم موثوق).</p>

      {message && <div style={{ color: '#2e7d32', background: '#e8f5e9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{message}</div>}
      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleCreateInstitution}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>معرف المؤسسة (Id) *</label>
            <input
              type="text"
              placeholder="مثال: inst_cairo_01"
              value={newInstId}
              onChange={(e) => setNewInstId(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>اسم المؤسسة *</label>
            <input
              type="text"
              placeholder="مثال: سنتر الأوائل"
              value={newInstName}
              onChange={(e) => setNewInstName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>النوع</label>
            <select
              value={newInstType}
              onChange={(e) => setNewInstType(e.target.value as InstitutionType)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              <option value="center">سنتر تعليمي</option>
              <option value="school">مدرسة</option>
              <option value="academy">أكاديمية</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>معرف المالك (Owner UID - اختياري)</label>
            <input
              type="text"
              placeholder="UID للمالك الموثق"
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ padding: '0.6rem 1.2rem', background: '#e65100', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء مؤسسة جديدة'}
        </button>
      </form>
    </div>
  );
}
