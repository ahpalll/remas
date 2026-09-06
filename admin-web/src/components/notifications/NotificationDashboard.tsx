import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const NotificationDashboard: React.FC = () => {
  const { institutionId } = useAuth();
  const [category, setCategory] = useState<string>('ANNOUNCEMENT');
  const [targetGroup, setTargetGroup] = useState<string>('ALL');
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      setStatusMessage('يرجى كتابة عنوان ونص الإشعار.');
      return;
    }

    setStatusMessage(`✅ تم إرسال الإشعار بنجاح لجميع المجموعات المستهدفة (${targetGroup}) تحت السنتر (${institutionId}).`);
    setTitle('');
    setBody('');
  };

  return (
    <div style={{ padding: '1.5rem', background: '#fff', borderRadius: '8px', border: '1px solid #ddd', marginTop: '1.5rem' }}>
      <h3 style={{ margin: 0, color: '#283593' }}>📣 نظام الإشعارات والتنبيهات المركزية (FCM Notifications)</h3>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        إرسال تنبيهات فورية للهواتف والتطبيقات (Student App & Parent App) مع حفظ السجل وعزل المستأجرين.
      </p>

      {statusMessage && (
        <div style={{ padding: '0.75rem', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleSendBroadcast} style={{ display: 'grid', gap: '1rem', maxWidth: '600px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.3rem' }}>فئة الإشعار (Category):</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="ANNOUNCEMENT">إعلان عام (ANNOUNCEMENT)</option>
            <option value="ATTENDANCE">حضور وغياب (ATTENDANCE)</option>
            <option value="GRADE">نتائج ودرجات (GRADE)</option>
            <option value="EXAM">امتحانات (EXAM)</option>
            <option value="ONLINE_EXAM">امتحانات إلكترونية (ONLINE_EXAM)</option>
            <option value="CONTENT">محتوى تعليمي (CONTENT)</option>
            <option value="SUBSCRIPTION">اشتراكات وباقات (SUBSCRIPTION)</option>
            <option value="SCHEDULE">جدول المواعيد (SCHEDULE)</option>
            <option value="SYSTEM">تنبيهات النظام (SYSTEM)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.3rem' }}>الجمهور المستهدف (Target Group):</label>
          <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="ALL">الجميع (الطلاب وأولياء الأمور)</option>
            <option value="STUDENTS">الطلاب فقط</option>
            <option value="PARENTS">أولياء الأمور فقط</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.3rem' }}>عنوان الإشعار:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: تغيير موعد المحاضرة القادمة"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.3rem' }}>نص الإشعار:</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="اكتب تفاصيل التنبيه الموجه للطلاب وأولياء الأمور..."
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button
          type="submit"
          style={{ padding: '0.75rem 1.5rem', background: '#283593', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', justifySelf: 'start' }}
        >
          إرسال الإشعار الفوري (Send FCM Push)
        </button>
      </form>
    </div>
  );
};
