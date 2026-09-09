import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export interface DeviceBinding {
  bindingId: string;
  institutionId: string;
  deviceId: string;
  deviceName: string;
  osVersion: string;
  appVersion: string;
  bindingStatus: 'ACTIVE' | 'REVOKED' | 'PENDING_ACTIVATION' | 'REPLACED';
  activatedAt: string;
  lastSeenAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  activatedByUserId: string;
}

export function SuperAdminDevices() {
  const { currentUser } = useAuth();
  const [devices, setDevices] = useState<DeviceBinding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceBinding | null>(null);
  const [revokeModalOpen, setRevokeModalOpen] = useState<boolean>(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState<boolean>(false);
  const [revocationReason, setRevocationReason] = useState<string>('');
  const [newFingerprintInput, setNewFingerprintInput] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mock initial demo data for SuperAdmin console
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    // Simulated devices payload matching backend schema
    setTimeout(() => {
      const demoDevices: DeviceBinding[] = [
        {
          bindingId: 'bind_inst_bootstrap_001_1725800001',
          institutionId: 'inst_bootstrap_001',
          deviceId: 'win_fp_8f3a9e01b2c3d4e5f678901234567890abcdef1234567890abcdef12345678',
          deviceName: 'REMAS-CENTER-MAIN-PC',
          osVersion: 'Windows 11 Enterprise (10.0.22631)',
          appVersion: '1.0.0-release.31',
          bindingStatus: 'ACTIVE',
          activatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          lastSeenAt: new Date().toISOString(),
          activatedByUserId: 'superadmin_owner'
        },
        {
          bindingId: 'bind_inst_alpha_1725800002',
          institutionId: 'inst_alpha_center',
          deviceId: 'win_fp_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
          deviceName: 'CAIRO-NORTH-RECEPTION-01',
          osVersion: 'Windows 10 Pro (10.0.19045)',
          appVersion: '1.0.0-release.31',
          bindingStatus: 'ACTIVE',
          activatedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
          lastSeenAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          activatedByUserId: 'admin_cairo'
        },
        {
          bindingId: 'bind_inst_beta_1725800003',
          institutionId: 'inst_beta_center',
          deviceId: 'win_fp_9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a',
          deviceName: 'ALEX-MAIN-TERMINAL-02',
          osVersion: 'Windows 11 Pro (10.0.22621)',
          appVersion: '1.0.0-release.30',
          bindingStatus: 'REVOKED',
          activatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          lastSeenAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          revokedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          revocationReason: 'إلغاء الترخيص بسبب نقل أجهزة السنتر بدون مراجعة الدعم الفني',
          activatedByUserId: 'superadmin_owner'
        }
      ];
      setDevices(demoDevices);
      setLoading(false);
    }, 300);
  };

  const handleRevokeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    if (!revocationReason.trim()) {
      setActionMessage({ type: 'error', text: 'يرجى إدخال سبب إلغاء التفعيل الموثق.' });
      return;
    }

    setDevices(prev => prev.map(d => {
      if (d.bindingId === selectedDevice.bindingId) {
        return {
          ...d,
          bindingStatus: 'REVOKED',
          revokedAt: new Date().toISOString(),
          revocationReason: revocationReason.trim()
        };
      }
      return d;
    }));

    setActionMessage({ type: 'success', text: `تم إلغاء تفعيل جهاز السنتر (${selectedDevice.institutionId}) بنجاح.` });
    setRevokeModalOpen(false);
    setRevocationReason('');
    setSelectedDevice(null);
  };

  const handleReplaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    if (!newFingerprintInput.trim() || !newFingerprintInput.startsWith('win_fp_')) {
      setActionMessage({ type: 'error', text: 'يرجى إدخال بصمة جهاز صالحة تبدأ بـ win_fp_' });
      return;
    }

    const timestamp = new Date().toISOString();
    setDevices(prev => {
      const updated = prev.map(d => {
        if (d.bindingId === selectedDevice.bindingId) {
          return {
            ...d,
            bindingStatus: 'REPLACED' as const,
            revokedAt: timestamp,
            revocationReason: `تم استبداله بالجهاز الجديد (${newFingerprintInput.substring(0, 16)}...)`
          };
        }
        return d;
      });

      const newRecord: DeviceBinding = {
        bindingId: `bind_${selectedDevice.institutionId}_${Date.now()}`,
        institutionId: selectedDevice.institutionId,
        deviceId: newFingerprintInput.trim(),
        deviceName: `${selectedDevice.deviceName}-REPLACED`,
        osVersion: selectedDevice.osVersion,
        appVersion: '1.0.0-release.31',
        bindingStatus: 'ACTIVE',
        activatedAt: timestamp,
        lastSeenAt: timestamp,
        activatedByUserId: currentUser?.uid || 'superadmin'
      };

      return [newRecord, ...updated];
    });

    setActionMessage({ type: 'success', text: `تم استبدال جهاز المؤسسة (${selectedDevice.institutionId}) بالجهاز الجديد بنجاح.` });
    setReplaceModalOpen(false);
    setNewFingerprintInput('');
    setSelectedDevice(null);
  };

  const handleActivate = (device: DeviceBinding) => {
    setDevices(prev => prev.map(d => {
      if (d.bindingId === device.bindingId) {
        return {
          ...d,
          bindingStatus: 'ACTIVE',
          revokedAt: null,
          revocationReason: null,
          lastSeenAt: new Date().toISOString()
        };
      }
      return d;
    }));
    setActionMessage({ type: 'success', text: `تم تفعيل تصفح السنتر (${device.institutionId}) بنجاح.` });
  };

  const filteredDevices = devices.filter(d =>
    d.institutionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.deviceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div dir="rtl" style={{ background: '#0f172a', color: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1e293b', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🖥️ لوحة إدارة أجهزة السناتر (Center Windows Single Device Licensing)
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            إدارة تفعيل، إلغاء، واستبدال أجهزة Windows المرتبطة بكل سنتر عن بُعد (SuperAdmin Authority)
          </p>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث بمعرف السنتر أو البصمة..."
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
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>جاري تحميل أجهزة السناتر المفعّلة...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#cbd5e1', borderBottom: '2px solid #334155' }}>
                <th style={{ padding: '0.75rem 1rem' }}>معرف السنتر (Tenant)</th>
                <th style={{ padding: '0.75rem 1rem' }}>اسم الجهاز / Hostname</th>
                <th style={{ padding: '0.75rem 1rem' }}>بصمة الجهاز (Hardware SHA-256)</th>
                <th style={{ padding: '0.75rem 1rem' }}>الحالة</th>
                <th style={{ padding: '0.75rem 1rem' }}>نظام التشغيل / الإصدار</th>
                <th style={{ padding: '0.75rem 1rem' }}>تاريخ التفعيل</th>
                <th style={{ padding: '0.75rem 1rem' }}>آخر تواجد (Last Seen)</th>
                <th style={{ padding: '0.75rem 1rem' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>لا توجد أجهزة مسجلة تنطبق على البحث.</td>
                </tr>
              ) : (
                filteredDevices.map((dev) => {
                  let badgeBg = '#14532d';
                  let badgeText = '#86efac';
                  let statusLabel = 'نشط (ACTIVE)';

                  if (dev.bindingStatus === 'REVOKED') {
                    badgeBg = '#7f1d1d';
                    badgeText = '#fca5a5';
                    statusLabel = 'ملغى (REVOKED)';
                  } else if (dev.bindingStatus === 'REPLACED') {
                    badgeBg = '#7c2d12';
                    badgeText = '#fdba74';
                    statusLabel = 'مستبدل (REPLACED)';
                  }

                  return (
                    <tr key={dev.bindingId} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#38bdf8' }}>{dev.institutionId}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#f1f5f9' }}>{dev.deviceName}</td>
                      <td style={{ padding: '0.75rem 1rem', direction: 'ltr', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                        {dev.deviceId.substring(0, 18)}...{dev.deviceId.substring(dev.deviceId.length - 8)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: badgeBg, color: badgeText, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{dev.osVersion}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{new Date(dev.activatedAt).toLocaleDateString('ar-EG')}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{new Date(dev.lastSeenAt).toLocaleTimeString('ar-EG')}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {dev.bindingStatus === 'ACTIVE' ? (
                            <>
                              <button
                                onClick={() => { setSelectedDevice(dev); setRevokeModalOpen(true); }}
                                style={{ padding: '0.25rem 0.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                🔴 إلغاء التفعيل
                              </button>
                              <button
                                onClick={() => { setSelectedDevice(dev); setReplaceModalOpen(true); }}
                                style={{ padding: '0.25rem 0.5rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                🔄 استبدال الجهاز
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleActivate(dev)}
                              style={{ padding: '0.25rem 0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              🟢 إعادة التفعيل
                            </button>
                          )}
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

      {/* Revoke Modal Dialog */}
      {revokeModalOpen && selectedDevice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '1.5rem', width: '450px', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#f87171' }}>🔴 إثبات إلغاء تفعيل جهاز السنتر</h3>
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
              أنت على وشك إلغاء صلاحية الجهاز المفعّل للمؤسسة (<strong>{selectedDevice.institutionId}</strong>). سيتم قفل تطبيق Windows لدى السنتر فوراً.
            </p>
            <form onSubmit={handleRevokeSubmit}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                سبب إلغاء التفعيل (الموثق في السجل):
              </label>
              <textarea
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="اكتب سبب إلغاء التفعيل..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', marginBottom: '1rem' }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setRevokeModalOpen(false); setSelectedDevice(null); }}
                  style={{ padding: '0.5rem 1rem', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  تأكيد الإلغاء الفوري
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replace Device Modal Dialog */}
      {replaceModalOpen && selectedDevice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '1.5rem', width: '480px', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#38bdf8' }}>🔄 استبدال جهاز السنتر بجهاز جديد</h3>
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
              سيتم إلغاء تفعيل الجهاز الحالي للمؤسسة (<strong>{selectedDevice.institutionId}</strong>) وترخيص الجهاز الجديد المحدد ببصمة Hardware المشتقة.
            </p>
            <form onSubmit={handleReplaceSubmit}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                بصمة الجهاز الجديد (New Hardware Fingerprint Hash):
              </label>
              <input
                type="text"
                value={newFingerprintInput}
                onChange={(e) => setNewFingerprintInput(e.target.value)}
                placeholder="win_fp_..."
                style={{ width: '100%', padding: '0.5rem', background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'monospace', direction: 'ltr' }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setReplaceModalOpen(false); setSelectedDevice(null); }}
                  style={{ padding: '0.5rem 1rem', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  تأكيد استبدال الجهاز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
