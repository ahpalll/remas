import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export interface CenterLicenseRecord {
  licenseId: string;
  institutionId: string;
  licenseCode: string;
  status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  issuedAt: string;
  activatedAt?: string | null;
  expiresAt: string;
  deviceBindingStatus: 'UNBOUND' | 'BOUND' | 'REVOKED' | 'SUSPENDED';
  deviceInstallationId?: string | null;
  deviceFingerprintHash?: string | null;
  deviceName?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export function SuperAdminLicenses() {
  const { currentUser } = useAuth();
  const [licenses, setLicenses] = useState<CenterLicenseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLicense, setSelectedLicense] = useState<CenterLicenseRecord | null>(null);
  const [actionType, setActionType] = useState<'REVOKE' | 'SUSPEND' | 'UNBIND' | 'RENEW' | null>(null);
  const [modalReason, setModalReason] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    setLoading(true);
    setTimeout(() => {
      const demoData: CenterLicenseRecord[] = [
        {
          licenseId: 'lic_inst_bootstrap_001_1725800001',
          institutionId: 'inst_bootstrap_001',
          licenseCode: 'REMAS-BOOTSTRAP-2026-X9Y8Z7',
          status: 'ACTIVE',
          issuedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          activatedAt: new Date(Date.now() - 86400000 * 29).toISOString(),
          expiresAt: new Date(Date.now() + 86400000 * 335).toISOString(),
          deviceBindingStatus: 'BOUND',
          deviceInstallationId: 'inst_uuid_001',
          deviceFingerprintHash: 'win_fp_8f3a9e01b2c3d4e5f678901234567890abcdef1234567890abcdef12345678',
          deviceName: 'REMAS-CENTER-MAIN-PC',
          osVersion: 'Windows 11 Enterprise (10.0.22631)',
          appVersion: '1.0.0-release.31',
          lastSeenAt: new Date().toISOString()
        },
        {
          licenseId: 'lic_inst_cairo_1725800002',
          institutionId: 'inst_cairo_center',
          licenseCode: 'REMAS-CAIRO-2026-A1B2C3',
          status: 'ACTIVE',
          issuedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          activatedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
          expiresAt: new Date(Date.now() + 86400000 * 350).toISOString(),
          deviceBindingStatus: 'BOUND',
          deviceInstallationId: 'inst_uuid_002',
          deviceFingerprintHash: 'win_fp_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
          deviceName: 'CAIRO-RECEPTION-01',
          osVersion: 'Windows 10 Pro (10.0.19045)',
          appVersion: '1.0.0-release.31',
          lastSeenAt: new Date(Date.now() - 3600000 * 3).toISOString()
        },
        {
          licenseId: 'lic_inst_alex_1725800003',
          institutionId: 'inst_alex_center',
          licenseCode: 'REMAS-ALEX-2026-D4E5F6',
          status: 'REVOKED',
          issuedAt: new Date(Date.now() - 86400000 * 60).toISOString(),
          activatedAt: new Date(Date.now() - 86400000 * 59).toISOString(),
          expiresAt: new Date(Date.now() + 86400000 * 300).toISOString(),
          deviceBindingStatus: 'REVOKED',
          deviceInstallationId: 'inst_uuid_003',
          deviceFingerprintHash: 'win_fp_9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a',
          deviceName: 'ALEX-MAIN-TERMINAL',
          osVersion: 'Windows 11 Pro',
          appVersion: '1.0.0-release.30',
          lastSeenAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          revokedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          revocationReason: 'إلغاء الترخيص بسبب مخالفة شروط استخدام النسخة على أكثر من جهاز'
        }
      ];
      setLicenses(demoData);
      setLoading(false);
    }, 300);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !actionType) return;

    const timestamp = new Date().toISOString();
    const reason = modalReason.trim() || 'قرار إداري من SuperAdmin';

    setLicenses(prev => prev.map(lic => {
      if (lic.licenseId === selectedLicense.licenseId) {
        if (actionType === 'REVOKE') {
          return {
            ...lic,
            status: 'REVOKED',
            deviceBindingStatus: 'REVOKED',
            revokedAt: timestamp,
            revocationReason: reason
          };
        } else if (actionType === 'SUSPEND') {
          return {
            ...lic,
            status: 'SUSPENDED',
            revocationReason: reason
          };
        } else if (actionType === 'UNBIND') {
          return {
            ...lic,
            deviceBindingStatus: 'UNBOUND',
            deviceFingerprintHash: null,
            deviceInstallationId: null,
            deviceName: null
          };
        } else if (actionType === 'RENEW') {
          const newExpiry = new Date(Date.now() + 86400000 * 365).toISOString();
          return {
            ...lic,
            status: 'ACTIVE',
            expiresAt: newExpiry
          };
        }
      }
      return lic;
    }));

    setActionMessage({
      type: 'success',
      text: `تم تنفيذ عملية (${actionType}) بنجاح للمؤسسة (${selectedLicense.institutionId}).`
    });

    setActionType(null);
    setSelectedLicense(null);
    setModalReason('');
  };

  const filteredLicenses = licenses.filter(l =>
    l.institutionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.licenseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.deviceName && l.deviceName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div dir="rtl" style={{ background: '#0f172a', color: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1e293b', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔑 Center Licenses & Single Device Controls (SuperAdmin Dashboard)
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            لوحة التحكم المركزية لإدارة تراخيص السناتر وربط الأجهزة عن بُعد (Activate, Suspend, Revoke, Rebind, Renew)
          </p>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث بكود الترخيص أو السنتر..."
          style={{
            padding: '0.5rem 1rem',
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #475569',
            borderRadius: '6px',
            fontSize: '0.875rem',
            width: '280px'
          }}
        />
      </div>

      {actionMessage && (
        <div style={{
          background: actionMessage.type === 'success' ? '#14532d' : '#7f1d1d',
          border: `1px solid ${actionMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: '#fff',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>جاري تحميل تراخيص السناتر...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#cbd5e1', borderBottom: '2px solid #334155' }}>
                <th style={{ padding: '0.75rem 1rem' }}>السنتر (Tenant ID)</th>
                <th style={{ padding: '0.75rem 1rem' }}>كود الترخيص (License Code)</th>
                <th style={{ padding: '0.75rem 1rem' }}>حالة الترخيص</th>
                <th style={{ padding: '0.75rem 1rem' }}>ربط الجهاز</th>
                <th style={{ padding: '0.75rem 1rem' }}>بصمة الجهاز المربوط</th>
                <th style={{ padding: '0.75rem 1rem' }}>تاريخ الانتهاء</th>
                <th style={{ padding: '0.75rem 1rem' }}>آخر تواجد</th>
                <th style={{ padding: '0.75rem 1rem' }}>الإجراءات الإدارية</th>
              </tr>
            </thead>
            <tbody>
              {filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>لا توجد تراخيص مسجلة تنطبق على البحث.</td>
                </tr>
              ) : (
                filteredLicenses.map((lic) => {
                  let statusBg = '#14532d';
                  let statusText = '#86efac';
                  if (lic.status === 'REVOKED') { statusBg = '#7f1d1d'; statusText = '#fca5a5'; }
                  else if (lic.status === 'SUSPENDED') { statusBg = '#7c2d12'; statusText = '#fdba74'; }
                  else if (lic.status === 'PENDING_ACTIVATION') { statusBg = '#713f12'; statusText = '#fef08a'; }

                  let bindingBg = lic.deviceBindingStatus === 'BOUND' ? '#14532d' : (lic.deviceBindingStatus === 'REVOKED' ? '#7f1d1d' : '#334155');
                  let bindingText = lic.deviceBindingStatus === 'BOUND' ? '#86efac' : (lic.deviceBindingStatus === 'REVOKED' ? '#fca5a5' : '#cbd5e1');

                  return (
                    <tr key={lic.licenseId} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#38bdf8' }}>{lic.institutionId}</td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#f1f5f9', direction: 'ltr', textAlign: 'right' }}>{lic.licenseCode}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: statusBg, color: statusText, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {lic.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: bindingBg, color: bindingText, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {lic.deviceBindingStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#94a3b8', direction: 'ltr', textAlign: 'right' }}>
                        {lic.deviceFingerprintHash ? `${lic.deviceFingerprintHash.substring(0, 16)}...` : 'غير مرتبط'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{new Date(lic.expiresAt).toLocaleDateString('ar-EG')}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{lic.lastSeenAt ? new Date(lic.lastSeenAt).toLocaleTimeString('ar-EG') : '—'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {lic.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => { setSelectedLicense(lic); setActionType('SUSPEND'); setModalReason(''); }}
                                style={{ padding: '0.25rem 0.5rem', background: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                🟠 تعليق
                              </button>
                              <button
                                onClick={() => { setSelectedLicense(lic); setActionType('REVOKE'); setModalReason(''); }}
                                style={{ padding: '0.25rem 0.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                🔴 إلغاء الترخيص
                              </button>
                            </>
                          )}

                          {lic.deviceBindingStatus === 'BOUND' && (
                            <button
                              onClick={() => { setSelectedLicense(lic); setActionType('UNBIND'); setModalReason(''); }}
                              style={{ padding: '0.25rem 0.5rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              🔄 إتاحة جهاز جديد (Unbind)
                            </button>
                          )}

                          <button
                            onClick={() => { setSelectedLicense(lic); setActionType('RENEW'); setModalReason(''); }}
                            style={{ padding: '0.25rem 0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            📅 تجديد (1 سنة)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {actionType && selectedLicense && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '1.5rem', width: '450px', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: actionType === 'REVOKE' ? '#f87171' : '#38bdf8' }}>
              إجراء إداري: {actionType} الترخيص للمؤسسة ({selectedLicense.institutionId})
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
              سيتم تطبيق هذا الإجراء فوراً وتحديث حالة الترخيص والجهاز المربوط.
            </p>
            <form onSubmit={handleModalSubmit}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                السبب الموثق (Audit Reason):
              </label>
              <textarea
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder="ادخل السبب الموثق في سجل العمليات..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', marginBottom: '1rem' }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setActionType(null); setSelectedLicense(null); }}
                  style={{ padding: '0.5rem 1rem', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    background: actionType === 'REVOKE' ? '#dc2626' : (actionType === 'SUSPEND' ? '#d97706' : '#0284c7'),
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  تأكيد التنفيذ الفوري
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
