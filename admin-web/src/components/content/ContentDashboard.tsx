import { useState } from 'react';
import { useContent } from '../../context/ContentContext';

export function ContentDashboard() {
  const { lessons, contents, loading, error } = useContent();
  const [activeTab, setActiveTab] = useState<'lessons' | 'contents'>('lessons');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const triggerBlockedAction = (actionName: string) => {
    setActionMessage(`BLOCKED / USER ACTION REQUIRED: ${actionName} يتطلب نشر Cloud Functions Trusted Endpoints في البيئة الحقيقية.`);
  };

  const filteredContents = contents.filter((c) => {
    if (selectedType !== 'ALL' && c.contentType !== selectedType) return false;
    if (selectedStatus !== 'ALL' && c.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>إدارة المحتوى التعليمي والدروس (Educational Content Management)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {actionMessage && <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>{actionMessage}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setActiveTab('lessons'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'lessons' ? '#1976d2' : '#f5f5f5', color: activeTab === 'lessons' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            قائمة الدروس ({lessons.length})
          </button>
          <button
            onClick={() => { setActiveTab('contents'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'contents' ? '#1976d2' : '#f5f5f5', color: activeTab === 'contents' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            كتالوج المحتوى التعليمي ({contents.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => triggerBlockedAction('إنشاء درس جديد (createLesson)')}
            style={{ padding: '0.5rem 1rem', background: '#0288d1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + إضافة درس جديد
          </button>
          <button
            onClick={() => triggerBlockedAction('إضافة محتوى تعليمي (createContent)')}
            style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + إضافة عنصر محتوى
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل بيانات المحتوى التعليمي والدروس...</div>
      ) : (
        <div>
          {activeTab === 'lessons' && (
            <div>
              <h4>قائمة الدروس والوحدات التعليمية (Lessons Hierarchy)</h4>
              {lessons.length === 0 ? <p style={{ color: '#666' }}>لا توجد دروس مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>عنوان الدرس</th>
                      <th style={{ padding: '0.5rem' }}>المادة</th>
                      <th style={{ padding: '0.5rem' }}>رقم الدرس</th>
                      <th style={{ padding: '0.5rem' }}>الترتيب</th>
                      <th style={{ padding: '0.5rem' }}>الإصدار</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((les) => (
                      <tr key={les.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{les.title}</td>
                        <td style={{ padding: '0.5rem' }}>{les.subjectId}</td>
                        <td style={{ padding: '0.5rem' }}>{les.lessonNumber}</td>
                        <td style={{ padding: '0.5rem' }}>{les.sortOrder}</td>
                        <td style={{ padding: '0.5rem' }}>v{les.version}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: les.status === 'PUBLISHED' ? '#2e7d32' : (les.status === 'DRAFT' ? '#ed6c02' : '#757575') }}>{les.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'contents' && (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', background: '#f8f9fa', padding: '0.75rem', borderRadius: '4px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>نوع المحتوى:</label>
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ padding: '0.25rem 0.5rem' }}>
                    <option value="ALL">الكل</option>
                    <option value="VIDEO">فيديو (VIDEO)</option>
                    <option value="PDF">مستند PDF</option>
                    <option value="IMAGE">صورة (IMAGE)</option>
                    <option value="AUDIO">صوت (AUDIO)</option>
                    <option value="DOCUMENT">مستند (DOCUMENT)</option>
                    <option value="LESSON_NOTE">ملاحظات الدرس</option>
                    <option value="LINK">رابط خارجي (LINK)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>الحالة:</label>
                  <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ padding: '0.25rem 0.5rem' }}>
                    <option value="ALL">الكل</option>
                    <option value="DRAFT">مسودة (DRAFT)</option>
                    <option value="PUBLISHED">منشور (PUBLISHED)</option>
                    <option value="ARCHIVED">مؤرشف (ARCHIVED)</option>
                  </select>
                </div>
              </div>

              <h4>كتالوج عناصر المحتوى التعليمي (Educational Content Catalog)</h4>
              {filteredContents.length === 0 ? <p style={{ color: '#666' }}>لا توجد عناصر محتوى تطابق الفلتر المSelected.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>عنوان المحتوى</th>
                      <th style={{ padding: '0.5rem' }}>النوع</th>
                      <th style={{ padding: '0.5rem' }}>الدرس</th>
                      <th style={{ padding: '0.5rem' }}>المادة</th>
                      <th style={{ padding: '0.5rem' }}>المدة / الحجم</th>
                      <th style={{ padding: '0.5rem' }}>الإصدار</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContents.map((cnt) => (
                      <tr key={cnt.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{cnt.title}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#0288d1' }}>{cnt.contentType}</td>
                        <td style={{ padding: '0.5rem' }}>{cnt.lessonId}</td>
                        <td style={{ padding: '0.5rem' }}>{cnt.subjectId}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {cnt.durationSeconds ? `${Math.floor(cnt.durationSeconds / 60)} دقيقة` : (cnt.fileSizeBytes ? `${(cnt.fileSizeBytes / 1048576).toFixed(1)} MB` : '-')}
                        </td>
                        <td style={{ padding: '0.5rem' }}>v{cnt.version}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: cnt.status === 'PUBLISHED' ? '#2e7d32' : (cnt.status === 'DRAFT' ? '#ed6c02' : '#757575') }}>{cnt.status}</td>
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
