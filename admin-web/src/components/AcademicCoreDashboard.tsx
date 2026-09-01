import { useState } from 'react';
import { useAcademic } from '../context/AcademicContext';

export function AcademicCoreDashboard() {
  const {
    academicYears,
    terms,
    subjects,
    teachers,
    stages,
    rooms,
    groups,
    schedules,
    loading,
    error,
  } = useAcademic();

  const [activeTab, setActiveTab] = useState<'years' | 'subjects' | 'teachers' | 'stages' | 'rooms' | 'groups' | 'schedules'>('subjects');

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>إدارة النواة الأكاديمية (Academic Core Manager)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('subjects')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'subjects' ? '#1976d2' : '#f5f5f5', color: activeTab === 'subjects' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المواد الدراسية ({subjects.length})
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'teachers' ? '#1976d2' : '#f5f5f5', color: activeTab === 'teachers' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المعلمون ({teachers.length})
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'stages' ? '#1976d2' : '#f5f5f5', color: activeTab === 'stages' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المراحل ({stages.length})
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'rooms' ? '#1976d2' : '#f5f5f5', color: activeTab === 'rooms' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          القاعات ({rooms.length})
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'groups' ? '#1976d2' : '#f5f5f5', color: activeTab === 'groups' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المجموعات ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'schedules' ? '#1976d2' : '#f5f5f5', color: activeTab === 'schedules' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          الجداول ({schedules.length})
        </button>
        <button
          onClick={() => setActiveTab('years')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'years' ? '#1976d2' : '#f5f5f5', color: activeTab === 'years' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          السنوات والفصول ({academicYears.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل البيانات الأكاديمية...</div>
      ) : (
        <div>
          {activeTab === 'subjects' && (
            <div>
              <h4>المواد الدراسية المسجلة</h4>
              {subjects.length === 0 ? <p style={{ color: '#666' }}>لا توجد مواد مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الكود</th>
                      <th style={{ padding: '0.5rem' }}>الاسم</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{s.code}</td>
                        <td style={{ padding: '0.5rem' }}>{s.name}</td>
                        <td style={{ padding: '0.5rem' }}>{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'teachers' && (
            <div>
              <h4>المعلمون والملفات الأكاديمية</h4>
              {teachers.length === 0 ? <p style={{ color: '#666' }}>لا يوجد معلمون مسجلون حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الاسم</th>
                      <th style={{ padding: '0.5rem' }}>التخصص</th>
                      <th style={{ padding: '0.5rem' }}>المواد المعتمدة</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{t.fullName}</td>
                        <td style={{ padding: '0.5rem' }}>{t.specialization || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{t.subjectIds?.length || 0} مواد</td>
                        <td style={{ padding: '0.5rem' }}>{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'stages' && (
            <div>
              <h4>المراحل الدراسية</h4>
              {stages.length === 0 ? <p style={{ color: '#666' }}>لا توجد مراحل مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الكود</th>
                      <th style={{ padding: '0.5rem' }}>الاسم</th>
                      <th style={{ padding: '0.5rem' }}>الترتيب</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((st) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{st.code}</td>
                        <td style={{ padding: '0.5rem' }}>{st.name}</td>
                        <td style={{ padding: '0.5rem' }}>{st.order}</td>
                        <td style={{ padding: '0.5rem' }}>{st.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <div>
              <h4>القاعات والفصول الدراسية</h4>
              {rooms.length === 0 ? <p style={{ color: '#666' }}>لا توجد قاعات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>اسم القاعة</th>
                      <th style={{ padding: '0.5rem' }}>السعة الاستيعابية</th>
                      <th style={{ padding: '0.5rem' }}>الموقع</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{r.name}</td>
                        <td style={{ padding: '0.5rem' }}>{r.capacity} مقعد</td>
                        <td style={{ padding: '0.5rem' }}>{r.location || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div>
              <h4>المجموعات الدراسية (Groups)</h4>
              {groups.length === 0 ? <p style={{ color: '#666' }}>لا توجد مجموعات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>كود المجموعة</th>
                      <th style={{ padding: '0.5rem' }}>اسم المجموعة</th>
                      <th style={{ padding: '0.5rem' }}>السعة القصوى</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{g.code}</td>
                        <td style={{ padding: '0.5rem' }}>{g.name}</td>
                        <td style={{ padding: '0.5rem' }}>{g.maxCapacity} طالب</td>
                        <td style={{ padding: '0.5rem' }}>{g.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'schedules' && (
            <div>
              <h4>الجداول الزمنية المعتمدة (Schedules)</h4>
              {schedules.length === 0 ? <p style={{ color: '#666' }}>لا توجد مواعيد جدول مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>اليوم</th>
                      <th style={{ padding: '0.5rem' }}>الوقت</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((sc) => (
                      <tr key={sc.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>يوم {sc.dayOfWeek}</td>
                        <td style={{ padding: '0.5rem' }}>{sc.startTime} - {sc.endTime}</td>
                        <td style={{ padding: '0.5rem' }}>{sc.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'years' && (
            <div>
              <h4>السنوات والأترام الدراسية</h4>
              {academicYears.length === 0 ? <p style={{ color: '#666' }}>لا توجد سنوات دراسية مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>كود السنة</th>
                      <th style={{ padding: '0.5rem' }}>اسم السنة</th>
                      <th style={{ padding: '0.5rem' }}>الفترة</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicYears.map((ay) => (
                      <tr key={ay.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{ay.code}</td>
                        <td style={{ padding: '0.5rem' }}>{ay.name}</td>
                        <td style={{ padding: '0.5rem' }}>{ay.startDate} إلى {ay.endDate}</td>
                        <td style={{ padding: '0.5rem' }}>{ay.status}</td>
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
