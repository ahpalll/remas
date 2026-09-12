import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  institutionId: string;
  target: string;
  details: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipMetadata: string;
}

export function SuperAdminAudit() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const records: AuditLogRecord[] = [
        {
          id: 'aud_101',
          timestamp: new Date().toISOString(),
          actor: 'SuperAdmin (sa_admin@remas.edu)',
          action: 'LICENSE_RENEWED',
          institutionId: 'inst_bootstrap_001',
          target: 'lic_inst_bootstrap_001',
          details: 'تجديد ترخيص مؤسسة البداية لمدة 365 يوماً إضافية',
          result: 'SUCCESS',
          ipMetadata: '197.34.12.89 (Cairo, EG)'
        },
        {
          id: 'aud_102',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          actor: 'SuperAdmin (sa_admin@remas.edu)',
          action: 'DEVICE_UNBOUND',
          institutionId: 'inst_cairo_center',
          target: 'win_fp_8f3a9e01b2c3d4e5f678901234567890abcdef1234567890abcdef12345678',
          details: 'فك ربط جهاز كمبيوتر السنتر بناءً على طلب المالك',
          result: 'SUCCESS',
          ipMetadata: '197.34.12.89 (Cairo, EG)'
        },
        {
          id: 'aud_103',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          actor: 'Center Owner (owner_cairo@remas.edu)',
          action: 'ACTIVATION_ATTEMPT_FAILED',
          institutionId: 'inst_cairo_center',
          target: 'win_fp_secondary_device_hash_xyz',
          details: 'محاولة تفعيل غير مصرح بها لجهاز ثانوي (DEVICE_LIMIT_EXCEEDED)',
          result: 'DENIED',
          ipMetadata: '156.204.11.45 (Cairo, EG)'
        },
        {
          id: 'aud_104',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          actor: 'SuperAdmin (sa_admin@remas.edu)',
          action: 'LICENSE_SUSPENDED',
          institutionId: 'inst_alex_center',
          target: 'lic_inst_alex_1725800003',
          details: 'تعليق ترخيص مؤسسة الإسكندرية بسبب مخالفة شروط الاستخدام',
          result: 'SUCCESS',
          ipMetadata: '197.34.12.89 (Cairo, EG)'
        }
      ];
      setLogs(records);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.institutionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || log.result === actionFilter;
    return matchesSearch && matchesAction;
  });

  if (role !== 'superadmin' && role !== 'superAdmin') {
    return (
      <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', margin: '1rem 0' }}>
        ⚠️ غير مصرح: الوصول لسجلات التدقيق خاص بـ SuperAdmin فقط.
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>⏳ جاري تحميل سجلات التدقيق...</div>;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>📜 سجلات التدقيق والأمان (Audit & Security Logs)</h3>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>مراقبة العمليات الحساسة وتغييرات التراخيص والأجهزة</span>
        </div>
        <button
          onClick={fetchAuditLogs}
          style={{ padding: '0.5rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          🔄 تحديث السجلات
        </button>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 بحث باسم المنفذ، العملية، أو المؤسسة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '240px', padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', background: '#fff' }}
        >
          <option value="ALL">جميع النتائج</option>
          <option value="SUCCESS">ناجحة (SUCCESS)</option>
          <option value="DENIED">مرفوضة (DENIED)</option>
          <option value="FAILED">فاشلة (FAILED)</option>
        </select>
      </div>

      {/* Mobile-Friendly Audit List / Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {filteredLogs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
            لا توجد سجلات تدقيق تطابق معايير البحث
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', borderRight: `4px solid ${log.result === 'SUCCESS' ? '#16a34a' : log.result === 'DENIED' ? '#dc2626' : '#d97706'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1rem' }}>{log.action}</span>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: log.result === 'SUCCESS' ? '#dcfce7' : '#fee2e2', color: log.result === 'SUCCESS' ? '#166534' : '#991b1b' }}>
                  {log.result}
                </span>
              </div>
              <p style={{ margin: '0.3rem 0', color: '#334155', fontSize: '0.9rem' }}>{log.details}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b', marginTop: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                <span>👤 المنفّذ: <strong>{log.actor}</strong></span>
                <span>🏛️ المؤسسة: <code>{log.institutionId}</code></span>
                <span>🕒 {new Date(log.timestamp).toLocaleString('ar-EG')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
