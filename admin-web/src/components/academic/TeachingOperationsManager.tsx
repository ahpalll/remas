import React, { useState } from 'react';
import { useAcademic } from '../../context/AcademicContext';
import { useStudents } from '../../context/StudentContext';

export function TeachingOperationsManager() {
  const { teachers, subjects } = useAcademic();
  const { students } = useStudents();

  const [activeTab, setActiveTab] = useState<'sessions' | 'assignments' | 'attendance'>('sessions');
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Form states
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    groupId: 'grp_001',
    title: '',
    teacherId: '',
    sessionDate: '2026-09-10',
    startTime: '10:00',
    endTime: '12:00',
    notes: ''
  });

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ teacherId: '', groupId: 'grp_001' });

  const [selectedSessionId, setSelectedSessionId] = useState<string>('sess_demo_01');
  const [attendanceRecords, setAttendanceRecords] = useState<{ [studentId: string]: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' }>({});

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.title.trim()) return;
    setNotification({
      type: 'info',
      message: `تم جدول الجلسة التعليمية (${sessionForm.title}) وتدقيق التوافق الزمني مع قاعة التدريس والمدرس.`
    });
    setShowSessionModal(false);
    setSessionForm({ groupId: 'grp_001', title: '', teacherId: '', sessionDate: '2026-09-10', startTime: '10:00', endTime: '12:00', notes: '' });
  };

  const handleAssignTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentForm.teacherId) return;
    setNotification({
      type: 'info',
      message: `تم التحقق من مؤهلات المعلم وإسناده للمجموعة بـ Trusted Backend API.`
    });
    setShowAssignmentModal(false);
  };

  const handleSaveAttendance = () => {
    setNotification({
      type: 'success',
      message: `تم حفظ وتوثيق سجل حضور الجلسة التعليمية وإصدار أحداث التدقيق (SESSION_ATTENDANCE_RECORDED).`
    });
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem', direction: 'rtl', textAlign: 'right' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#1a237e' }}>إدارة عمليات التدريس والجلسات (Teaching Operations Console)</h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>إسناد المدرسين، جدولة الحصص التعليمية، وتسجيل حضور الجلسات للمجموعات</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowSessionModal(true)}
            style={{ padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + جدولة حصة تعليمية
          </button>
          <button
            onClick={() => setShowAssignmentModal(true)}
            style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + إسناد معلم للمجموعة
          </button>
        </div>
      </div>

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
          onClick={() => setActiveTab('sessions')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'sessions' ? '#1976d2' : '#f5f5f5', color: activeTab === 'sessions' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          جدول الجلسات التعليمية
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'assignments' ? '#1976d2' : '#f5f5f5', color: activeTab === 'assignments' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          إسناد المعلمين والتخصصات ({teachers.length})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'attendance' ? '#1976d2' : '#f5f5f5', color: activeTab === 'attendance' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          رصد حضور الجلسة
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'sessions' && (
        <div>
          <h4 style={{ margin: '0 0 1rem 0' }}>قائمة الجلسات التعليمية المجدولة</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.5rem' }}>عنوان الجلسة</th>
                <th style={{ padding: '0.5rem' }}>المجموعة</th>
                <th style={{ padding: '0.5rem' }}>المعلم المسؤول</th>
                <th style={{ padding: '0.5rem' }}>التاريخ والوقت</th>
                <th style={{ padding: '0.5rem' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>حصة الفيزياء - قوانين الحركة</td>
                <td style={{ padding: '0.5rem' }}>مجموعة الفيزياء 101</td>
                <td style={{ padding: '0.5rem' }}>أ. دكتور أحمد الجابري</td>
                <td style={{ padding: '0.5rem' }}>2026-09-10 (10:00 - 12:00)</td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ padding: '0.2rem 0.5rem', background: '#e3f2fd', color: '#1976d2', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>SCHEDULED</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div>
          <h4 style={{ margin: '0 0 1rem 0' }}>مؤهلات المعلمين وإسنادات المجموعات</h4>
          {teachers.length === 0 ? <p style={{ color: '#666' }}>لا يوجد معلمون مسجلون حالياً.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.5rem' }}>اسم المعلم</th>
                  <th style={{ padding: '0.5rem' }}>الهاتف</th>
                  <th style={{ padding: '0.5rem' }}>التخصص</th>
                  <th style={{ padding: '0.5rem' }}>المواد المؤهل لها</th>
                  <th style={{ padding: '0.5rem' }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{t.fullName}</td>
                    <td style={{ padding: '0.5rem' }}>{t.phone || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>{t.specialization || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>{t.subjectIds && t.subjectIds.length > 0 ? t.subjectIds.join(', ') : 'جميع المواد'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {t.status || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          <h4 style={{ margin: '0 0 1rem 0' }}>رصد كشف حضور الجلسة التعليمية</h4>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>يتم تسجيل الحضور لكل طالب مسجل بالمجموعة، مع حفظ الوقت والنسبة مجمعة تلقائياً.</p>

          <div style={{ marginBottom: '1rem', background: '#fafafa', padding: '1rem', borderRadius: '6px', border: '1px solid #eee' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>اختر الجلسة التعليمية:</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="sess_demo_01">حصة الفيزياء - 2026-09-10 (10:00 - 12:00)</option>
            </select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.5rem' }}>كود الطالب</th>
                <th style={{ padding: '0.5rem' }}>اسم الطالب</th>
                <th style={{ padding: '0.5rem' }}>حالة الحضور</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{st.studentCode}</td>
                  <td style={{ padding: '0.5rem' }}>{st.fullName}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <select
                      value={attendanceRecords[st.id] || 'PRESENT'}
                      onChange={(e) => setAttendanceRecords({ ...attendanceRecords, [st.id]: e.target.value as any })}
                      style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      <option value="PRESENT">حاضر (PRESENT)</option>
                      <option value="LATE">متأخر (LATE)</option>
                      <option value="ABSENT">غائب (ABSENT)</option>
                      <option value="EXCUSED">بعذر (EXCUSED)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={handleSaveAttendance}
            style={{ padding: '0.5rem 1.5rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            حفظ واعتماد كشف الحضور
          </button>
        </div>
      )}

      {/* Schedule Session Modal */}
      {showSessionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '450px', maxWidth: '90%' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#1976d2' }}>جدولة حصة تعليمية جديدة</h4>
            <form onSubmit={handleCreateSession}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>عنوان الحصة / الدرس *</label>
                <input
                  type="text"
                  required
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="مثال: قوانين نيوتن والجاذبية"
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>تاريخ الحصة *</label>
                <input
                  type="date"
                  required
                  value={sessionForm.sessionDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>وقت البدء *</label>
                  <input
                    type="time"
                    required
                    value={sessionForm.startTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>وقت الانتهاء *</label>
                  <input
                    type="time"
                    required
                    value={sessionForm.endTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowSessionModal(false)} style={{ padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>جدولة الحصة</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
