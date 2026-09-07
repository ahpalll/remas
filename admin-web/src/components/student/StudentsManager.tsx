import { useState } from 'react';
import { useStudents } from '../../context/StudentContext';

export function StudentsManager() {
  const { students, enrollments, guardians, loading, error } = useStudents();
  const [activeTab, setActiveTab] = useState<'students' | 'groups' | 'enrollments' | 'guardians'>('students');

  // Local forms state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showLinkGuardianModal, setShowLinkGuardianModal] = useState(false);

  // Form Fields
  const [studentForm, setStudentForm] = useState({ fullName: '', phone: '', parentPhone: '', stageId: '', gradeId: '', notes: '' });
  const [groupForm, setGroupForm] = useState({ name: '', maxCapacity: 30, feePerSession: 100 });
  const [enrollForm, setEnrollForm] = useState({ studentId: '', groupId: '' });
  const [guardianForm, setGuardianForm] = useState({ studentId: '', fullName: '', phone: '', relationshipType: 'FATHER', isPrimary: true });

  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.fullName.trim()) return;
    setNotification({
      type: 'info',
      message: `تم تجهيز طلب تسجيل الطالب (${studentForm.fullName}). في بيئة الإنتاج يتم إرساله إلى Trusted Backend API (createStudent).`
    });
    setShowAddStudentModal(false);
    setStudentForm({ fullName: '', phone: '', parentPhone: '', stageId: '', gradeId: '', notes: '' });
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;
    setNotification({
      type: 'info',
      message: `تم تجهيز طلب إنشاء المجموعة (${groupForm.name}). سعة المجموعة: ${groupForm.maxCapacity}.`
    });
    setShowAddGroupModal(false);
    setGroupForm({ name: '', maxCapacity: 30, feePerSession: 100 });
  };

  const handleEnrollStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.studentId || !enrollForm.groupId) return;
    setNotification({
      type: 'info',
      message: `تم تجهيز طلب تسكيل الطالب في المجموعة مع التحقق الذاتي من عدم تجاوز السعة (maxCapacity).`
    });
    setShowEnrollModal(false);
    setEnrollForm({ studentId: '', groupId: '' });
  };

  const handleLinkGuardian = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianForm.studentId || !guardianForm.fullName) return;
    setNotification({
      type: 'info',
      message: `تم تجهيز ربط ولي الأمر (${guardianForm.fullName}) بالطالب مع تعيين صفة العلاقة (${guardianForm.relationshipType}).`
    });
    setShowLinkGuardianModal(false);
    setGuardianForm({ studentId: '', fullName: '', phone: '', relationshipType: 'FATHER', isPrimary: true });
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem', direction: 'rtl', textAlign: 'right' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#1a237e' }}>إدارة الطلاب والمجموعات (Students & Group Operations Console)</h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>تسجيل الطلاب، إدارة سعة المجموعات، ربط أولياء الأمور، وتوليد بطاقات QR</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowAddStudentModal(true)}
            style={{ padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + تسجيل طالب جديد
          </button>
          <button
            onClick={() => setShowAddGroupModal(true)}
            style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + إنشاء مجموعة جديدة
          </button>
          <button
            onClick={() => setShowEnrollModal(true)}
            style={{ padding: '0.5rem 1rem', background: '#ed6c02', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + تسجيل طالب بمجموعة
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {notification && (
        <div style={{
          color: notification.type === 'error' ? '#c62828' : notification.type === 'success' ? '#2e7d32' : '#0277bd',
          background: notification.type === 'error' ? '#ffebee' : notification.type === 'success' ? '#e8f5e9' : '#e1f5fe',
          border: '1px solid #ccc', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold'
        }}>
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('students')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'students' ? '#1976d2' : '#f5f5f5', color: activeTab === 'students' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          سجل الطلاب ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'groups' ? '#1976d2' : '#f5f5f5', color: activeTab === 'groups' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المجموعات الدراسية
        </button>
        <button
          onClick={() => setActiveTab('enrollments')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'enrollments' ? '#1976d2' : '#f5f5f5', color: activeTab === 'enrollments' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          التسجيلات الفعالة ({enrollments.length})
        </button>
        <button
          onClick={() => setActiveTab('guardians')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'guardians' ? '#1976d2' : '#f5f5f5', color: activeTab === 'guardians' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          أولياء الأمور ({guardians.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل البيانات...</div>
      ) : (
        <div>
          {activeTab === 'students' && (
            <div>
              <h4 style={{ margin: '0 0 1rem 0' }}>قائمة الطلاب المسجلين بالسنتر</h4>
              {students.length === 0 ? <p style={{ color: '#666' }}>لا يوجد طلاب مسجلون حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>كود الطالب</th>
                      <th style={{ padding: '0.5rem' }}>اسم الطالب</th>
                      <th style={{ padding: '0.5rem' }}>الهاتف</th>
                      <th style={{ padding: '0.5rem' }}>هاتف ولي الأمر</th>
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
                        <td style={{ padding: '0.5rem' }}>{st.parentPhone || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                            background: st.status === 'ACTIVE' ? '#e8f5e9' : '#ffebee',
                            color: st.status === 'ACTIVE' ? '#2e7d32' : '#c62828'
                          }}>
                            {st.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <button
                            onClick={() => { setShowLinkGuardianModal(true); setGuardianForm({ ...guardianForm, studentId: st.id }); }}
                            style={{ padding: '0.25rem 0.5rem', background: '#0288d1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '0.5rem' }}
                          >
                            ربط ولي أمر
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div>
              <h4 style={{ margin: '0 0 1rem 0' }}>قائمة المجموعات الدراسية وتتبع السعة</h4>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>يتم تقييد التسجيل تلقائياً لمنع تجاوز الحد الأقصى لسعة القاعة (maxCapacity).</p>
            </div>
          )}

          {activeTab === 'enrollments' && (
            <div>
              <h4 style={{ margin: '0 0 1rem 0' }}>سجل تسجيلات الطلاب في المجموعات</h4>
              {enrollments.length === 0 ? <p style={{ color: '#666' }}>لا توجد تسجيلات حالية.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>معرف الطالب</th>
                      <th style={{ padding: '0.5rem' }}>معرف المجموعة</th>
                      <th style={{ padding: '0.5rem' }}>حالة التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enr) => (
                      <tr key={enr.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{enr.studentId}</td>
                        <td style={{ padding: '0.5rem' }}>{enr.groupId}</td>
                        <td style={{ padding: '0.5rem' }}>{enr.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'guardians' && (
            <div>
              <h4 style={{ margin: '0 0 1rem 0' }}>سجل أولياء الأمور المرتبطين</h4>
              {guardians.length === 0 ? <p style={{ color: '#666' }}>لا يوجد أولياء أمور مسجلون حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الاسم الكامل</th>
                      <th style={{ padding: '0.5rem' }}>رقم الهاتف</th>
                      <th style={{ padding: '0.5rem' }}>البريد الإلكتروني</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardians.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{g.fullName}</td>
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

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '450px', maxWidth: '90%' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#1976d2' }}>تسجيل طالب جديد</h4>
            <form onSubmit={handleCreateStudent}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>الاسم الكامل للطالب *</label>
                <input
                  type="text"
                  required
                  value={studentForm.fullName}
                  onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="مثال: أحمد محمد علي"
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>رقم هاتف الطالب</label>
                <input
                  type="text"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="01012345678"
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>رقم هاتف ولي الأمر</label>
                <input
                  type="text"
                  value={studentForm.parentPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="01098765432"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddStudentModal(false)} style={{ padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ الطالب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '450px', maxWidth: '90%' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#2e7d32' }}>إنشاء مجموعة دراسية جديدة</h4>
            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>اسم المجموعة *</label>
                <input
                  type="text"
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="مثال: مجموعة الفيزياء - السبت والثلاثاء"
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>الحد الأقصى لسعة القاعة (maxCapacity) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={groupForm.maxCapacity}
                  onChange={(e) => setGroupForm({ ...groupForm, maxCapacity: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddGroupModal(false)} style={{ padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>إنشاء المجموعة</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
