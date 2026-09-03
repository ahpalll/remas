import { useState } from 'react';
import { useMedia } from '../../context/MediaContext';

export function MediaManager() {
  const { requestUploadSession, actionMessage, clearActionMessage } = useMedia();
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [selectedContentType, setSelectedContentType] = useState<string>('VIDEO');

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestUploadSession(selectedContentId || 'cnt_sample', selectedContentType, 'video/mp4', 10485760);
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>إدارة وسائط Cloudflare R2 المشفرة (Secure Media Manager)</h3>

      {actionMessage && (
        <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>
          {actionMessage}
          <button onClick={clearActionMessage} style={{ marginRight: '1rem', background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>✕ إغلاق</button>
        </div>
      )}

      <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>معرف عنصر المحتوى (Content ID):</label>
          <input
            type="text"
            placeholder="مثال: cnt_math_101"
            value={selectedContentId}
            onChange={(e) => setSelectedContentId(e.target.value)}
            style={{ padding: '0.5rem', width: '220px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>نوع الوسائط (Media Type):</label>
          <select value={selectedContentType} onChange={(e) => setSelectedContentType(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="VIDEO">فيديو (VIDEO)</option>
            <option value="PDF">مستند PDF</option>
            <option value="AUDIO">صوت (AUDIO)</option>
            <option value="IMAGE">صورة (IMAGE)</option>
            <option value="DOCUMENT">مستند (DOCUMENT)</option>
          </select>
        </div>

        <div>
          <button type="submit" style={{ padding: '0.5rem 1.25rem', background: '#00838f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            طلب جلسة رفع آمنة إلى R2 (Request R2 Upload Session)
          </button>
        </div>
      </form>
    </div>
  );
}
