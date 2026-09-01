import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserManagement } from '../context/UserManagementContext';
import { UserRole } from '../types/user';

export function CreateUserModal({ onClose }: { onClose: () => void }) {
  const { currentUser, role: callerRole, institutionId } = useAuth();
  const { refreshUsers } = useUserManagement();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>('student');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allowedRolesToCreate: UserRole[] = [];
  if (callerRole === 'superAdmin') {
    allowedRolesToCreate.push('institutionOwner', 'admin', 'student', 'parent');
  } else if (callerRole === 'institutionOwner') {
    allowedRolesToCreate.push('admin', 'student', 'parent');
  } else if (callerRole === 'admin') {
    allowedRolesToCreate.push('student', 'parent');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !email.trim()) {
      setError('جميع الحقول المطلوبة يجب تعبئتها.');
      return;
    }

    if (!currentUser) {
      setError('لا توجد جلسة موثقة لإنشاء حساب جديد.');
      return;
    }

    setIsSubmitting(true);
    try {
      // In production/emulator, invoke trusted provisioning service API endpoint
      // Client code DOES NOT call createUserWithEmailAndPassword() to protect current session
      const callerToken = {
        uid: currentUser.uid,
        role: callerRole,
        institutionId: institutionId,
      };

      const payload = {
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        targetRole: targetRole,
        targetInstitutionId: institutionId,
      };

      // Mock backend call wrapper for Admin Web UI demo
      setSuccess(`تم طلب إنشاء حساب (${fullName}) بنجاح بدور ${targetRole}. (جاري معالجة الـ Provisioning Saga)`);
      await refreshUsers();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'فشل إنشاء الحساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '500px', boxSizing: 'border-box' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>إضافة مستخدم جديد في السنتر</h3>

        {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
        {success && <div style={{ color: '#2e7d32', background: '#e8f5e9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>الاسم بالكامل *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>البريد الإلكتروني *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>رقم الهاتف</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>الدور (Role) *</label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              {allowedRolesToCreate.map((r) => (
                <option key={r} value={r}>
                  {r === 'institutionOwner' ? 'مالك السنتر (Owner)' : r === 'admin' ? 'مدير (Admin)' : r === 'student' ? 'طالب (Student)' : 'ولي أمر (Parent)'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.2rem', background: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '0.6rem 1.2rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isSubmitting ? 'جاري التلقين...' : 'إرسال طلب التلقين'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
