import { useState } from 'react';
import { useStudents } from '../../context/StudentContext';

export function StudentsManager() {
  const { students, enrollments, guardians, loading, error } = useStudents();
  const [activeTab, setActiveTab] = useState<'students' | 'enrollments' | 'guardians'>('students');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const triggerBlockedAction = (actionName: string) => {
    setActionMessage(`BLOCKED / USER ACTION REQUIRED: ${actionName} يتطلب نشر Cloud Functions Trusted Endpoints في البيئة الحقيقية.`);
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>إدارة الطلاب وتسجيلات المجموعات (Students & Enrollment Manager)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {actionMessage && <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>{actionMessage}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { setActiveTab('students'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'students' ? '#1976d2' : '#f5f5f5', color: activeTab === 'students' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            الطلاب المسجلون ({students.length})
          </button>
          <button
            onClick={() => { setActiveTab('enrollments'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'enrollments' ? '#1976d2' : '#f5f5f5', color: activeTab === 'enrollments' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            التسجيلات في المجموعات ({enrollments.length})
          </button>
          <button
            onClick={() => { setActiveTab('guardians'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'guardians' ? '#1976d2' : '#f5f5f5', color: activeTab === 'guardians' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            أولياء الأمور ({guardians.length})
          </button>
        </div>

        <button
          onClick={() => triggerBlockedAction('إضافة طالب جديد (createStudent)')}
          style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + إضافة طالب جديد
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل بيانات الطلاب...</div>
      ) : (
        <div>
          {activeTab === 'students' && (
            <div>
              <h4>سجل الطلاب المعتمد</h4>
              {students.length === 0 ? <p style={{ color: '#666' }}>لا يوجد طلاب مسجلون حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>كود الطالب</th>
                      <th style={{ padding: '0.5rem' }}>الاسم الكامل</th>
                      <th style={{ padding: '0.5rem' }}>الهاتف</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                      <th style={{ padding: '0.5rem' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{st.studentCode}</td>
                        <td style={{ padding: '0.5rem' }}>{st.fullName}</td>
                        <td style={{ padding: '0.5rem' }}>{st.phone || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{st.status}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <button
                            onClick={() => triggerBlockedAction(`تغيير حالة الطالب ${st.studentCode}`)}
                            style={{ padding: '0.25rem 0.5rem', background: '#ed6c02', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '0.5rem' }}
                          >
                            تغيير الحالة
                          </button>
                          <button
                            onClick={() => triggerBlockedAction(`توليد QR جديد للطالب ${st.studentCode}`)}
                            style={{ padding: '0.25rem 0.5rem', background: '#0288d1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            بطاقة QR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'enrollments' && (
            <div>
              <h4>سجل تسجيلات المجموعات (Active & Historical Enrollments)</h4>
              {enrollments.length === 0 ? <p style={{ color: '#666' }}>لا توجد تسجيلات في المجموعات حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>معرف الطالب</th>
                      <th style={{ padding: '0.5rem' }}>معرف المجموعة</th>
                      <th style={{ padding: '0.5rem' }}>حالة التسجيل</th>
                      <th style={{ padding: '0.5rem' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enr) => (
                      <tr key={enr.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{enr.studentId}</td>
                        <td style={{ padding: '0.5rem' }}>{enr.groupId}</td>
                        <td style={{ padding: '0.5rem' }}>{enr.status}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {enr.status === 'ENROLLED' && (
                            <button
                              onClick={() => triggerBlockedAction(`انسحاب الطالب من المجموعة (${enr.id})`)}
                              style={{ padding: '0.25rem 0.5rem', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              انسحاب (Withdraw)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'guardians' && (
            <div>
              <h4>سجل أولياء الأمور (Guardians)</h4>
              {guardians.length === 0 ? <p style={{ color: '#666' }}>لا يوجد أولياء أمور مسجلون حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الاسم</th>
                      <th style={{ padding: '0.5rem' }}>الهاتف</th>
                      <th style={{ padding: '0.5rem' }}>البريد الإلكتروني</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardians.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{g.fullName}</td>
                        <td style={{ padding: '0.5rem' }}>{g.phone}</td>
                        <td style={{ padding: '0.5rem' }}>{g.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
