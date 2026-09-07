import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InstitutionType } from '../types/institution';

interface InstitutionDoc {
  institutionId: string;
  name: string;
  type: InstitutionType;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt?: string;
  createdBy?: string;
}

export function SuperAdminInstitutions() {
  const { currentUser, role } = useAuth();

  const [institutions, setInstitutions] = useState<InstitutionDoc[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Form State
  const [newInstId, setNewInstId] = useState('');
  const [newInstName, setNewInstName] = useState('');
  const [newInstType, setNewInstType] = useState<InstitutionType>('center');
  const [initialAdminEmail, setInitialAdminEmail] = useState('');
  
  // Dialog / Action State
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; instId: string; action: 'SUSPEND' | 'ACTIVATE' } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (role === 'superAdmin') {
      fetchInstitutions();
    }
  }, [role]);

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'institutions'));
      const list: InstitutionDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as InstitutionDoc;
        list.push({
          institutionId: d.id,
          name: data.name || d.id,
          type: data.type || 'center',
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt,
          createdBy: data.createdBy
        });
      });
      setInstitutions(list);
    } catch (err: any) {
      // Non-blocking in demo/emulator environments
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'superAdmin') {
    return null; // Authorization enforced by Firestore rules
  }

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!newInstId.trim() || !newInstName.trim()) {
      setError('معرف المؤسسة واسم المؤسسة حقول مطلوبة.');
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
        institutionId: cleanInstId,
        name: newInstName.trim(),
        type: newInstType,
        status: 'ACTIVE',
        environment: 'PRODUCTION',
        targetProjectId: 'educenter-saas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid,
      };

      if (initialAdminEmail.trim()) {
        newInstData.initialAdminEmail = initialAdminEmail.trim();
      }

      await setDoc(docRef, newInstData);

      setMessage(`تم إنشاء وتفعيل المؤسسة (${newInstName}) بنجاح بمعرف: ${cleanInstId}`);
      setNewInstId('');
      setNewInstName('');
      setInitialAdminEmail('');
      await fetchInstitutions();
    } catch (err: any) {
      setError(err?.message || 'فشل إنشاء المؤسسة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (instId: string, currentStatus: string) => {
    const targetStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setConfirmModal({ open: true, instId, action: targetStatus === 'SUSPENDED' ? 'SUSPEND' : 'ACTIVATE' });
  };

  const confirmToggleStatus = async () => {
    if (!confirmModal) return;
    const { instId, action } = confirmModal;
    const targetStatus = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
    setConfirmModal(null);
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const docRef = doc(db, 'institutions', instId);
      await updateDoc(docRef, {
        status: targetStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.uid
      });
      setMessage(`تم تغيير حالة المؤسسة ${instId} إلى ${targetStatus}`);
      await fetchInstitutions();
    } catch (err: any) {
      setError(err?.message || 'فشل تحديث حالة المؤسسة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ background: '#fff3e0', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ffe0b2', marginTop: '1.5rem', direction: 'rtl' }}>
      <h3 style={{ marginTop: 0, color: '#e65100' }}>إدارة المنصة والمؤسسات (Super Admin Console)</h3>
      <p style={{ fontSize: '0.9rem', color: '#5d4037' }}>إنشاء وتفعيل وإيقاف المؤسسات التعليمية وتعيين المسؤول الأول (First Admin Onboarding).</p>

      {message && <div style={{ color: '#2e7d32', background: '#e8f5e9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{message}</div>}
      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleCreateInstitution} style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '6px', marginBottom: '1.5rem', border: '1px solid #ffcc80' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#e65100' }}>إنشاء مؤسسة جديدة وتهيئتها</h4>
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
              placeholder="مثال: سنتر الأوائل التعليمي"
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
              <option value="center">سنتر تعليمي (Center)</option>
              <option value="school">مدرسة (School)</option>
              <option value="academy">أكاديمية (Academy)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>بريد المسؤول الأول (Initial Admin Email)</label>
            <input
              type="email"
              placeholder="admin@center.com"
              value={initialAdminEmail}
              onChange={(e) => setInitialAdminEmail(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ padding: '0.6rem 1.2rem', background: '#e65100', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSubmitting ? 'جاري الإنشاء والتهيئة...' : 'إنشاء وتفعيل المؤسسة'}
        </button>
      </form>

      <h4 style={{ color: '#5d4037', margin: '0 0 0.75rem 0' }}>قائمة المؤسسات المسجلة</h4>
      {loading ? (
        <p style={{ color: '#888' }}>جاري تحميل المؤسسات...</p>
      ) : institutions.length === 0 ? (
        <div style={{ background: '#fff', padding: '1rem', borderRadius: '4px', textAlign: 'center', color: '#777' }}>
          لا توجد مؤسسات مسجلة حاليًا. يمكنك إنشاء المؤسسة الأولى أعلاه.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#ffe0b2', textAlign: 'right' }}>
              <th style={{ padding: '0.6rem' }}>معرف المؤسسة</th>
              <th style={{ padding: '0.6rem' }}>الاسم</th>
              <th style={{ padding: '0.6rem' }}>النوع</th>
              <th style={{ padding: '0.6rem' }}>الحالة</th>
              <th style={{ padding: '0.6rem' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((inst) => (
              <tr key={inst.institutionId} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>{inst.institutionId}</td>
                <td style={{ padding: '0.6rem', fontWeight: 600 }}>{inst.name}</td>
                <td style={{ padding: '0.6rem' }}>{inst.type}</td>
                <td style={{ padding: '0.6rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    background: inst.status === 'ACTIVE' ? '#e8f5e9' : '#ffebee',
                    color: inst.status === 'ACTIVE' ? '#2e7d32' : '#c62828'
                  }}>
                    {inst.status}
                  </span>
                </td>
                <td style={{ padding: '0.6rem' }}>
                  <button
                    onClick={() => toggleStatus(inst.institutionId, inst.status)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      background: inst.status === 'ACTIVE' ? '#c62828' : '#2e7d32',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    {inst.status === 'ACTIVE' ? 'إيقاف المؤسسة' : 'تفعيل المؤسسة'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Confirmation Dialog */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', maxWidth: '400px', width: '90%', direction: 'rtl' }}>
            <h4 style={{ marginTop: 0, color: '#c62828' }}>تأكيد العملية الحساسة</h4>
            <p>هل أنت أكتد من رغبتك في {confirmModal.action === 'SUSPEND' ? 'إيقاف' : 'تفعيل'} المؤسسة ({confirmModal.instId})؟</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{ padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <button
                onClick={confirmToggleStatus}
                style={{ padding: '0.5rem 1rem', background: confirmModal.action === 'SUSPEND' ? '#c62828' : '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
