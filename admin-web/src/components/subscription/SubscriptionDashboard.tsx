import { useState } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';

export function SubscriptionDashboard() {
  const { packages, codes, entitlements, loading, error, actionMessage, triggerBlockedAction, clearActionMessage } = useSubscription();
  const [activeTab, setActiveTab] = useState<'packages' | 'codes' | 'entitlements'>('packages');

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>إدارة باقات واكواد الاشتراكات (Subscription & Content Entitlement Management)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {actionMessage && (
        <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>
          {actionMessage}
          <button onClick={clearActionMessage} style={{ marginRight: '1rem', background: 'none', border: 'none', color: '#000', cursor: 'cursor', fontWeight: 'bold' }}>✕ إغلاق</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setActiveTab('packages'); clearActionMessage(); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'packages' ? '#1976d2' : '#f5f5f5', color: activeTab === 'packages' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            باقات الاشتراكات ({packages.length})
          </button>
          <button
            onClick={() => { setActiveTab('codes'); clearActionMessage(); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'codes' ? '#1976d2' : '#f5f5f5', color: activeTab === 'codes' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            أكواد الاشتراكات ({codes.length})
          </button>
          <button
            onClick={() => { setActiveTab('entitlements'); clearActionMessage(); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'entitlements' ? '#1976d2' : '#f5f5f5', color: activeTab === 'entitlements' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            الصلاحيات الفعلية ({entitlements.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => triggerBlockedAction('إنشاء باقة اشتراك جديدة (createPackage)')}
            style={{ padding: '0.5rem 1rem', background: '#0288d1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + إنشاء باقة
          </button>
          <button
            onClick={() => triggerBlockedAction('توليد أكواد اشتراك مشفرة (generateSubscriptionCodes)')}
            style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + توليد أكواد مشفرة
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل بيانات الاشتراكات والباقات...</div>
      ) : (
        <div>
          {activeTab === 'packages' && (
            <div>
              <h4>قائمة باقات الاشتراكات (Subscription Packages)</h4>
              {packages.length === 0 ? <p style={{ color: '#666' }}>لا توجد باقات اشتراك مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>اسم الباقة</th>
                      <th style={{ padding: '0.5rem' }}>المدة (أيام)</th>
                      <th style={{ padding: '0.5rem' }}>السعر</th>
                      <th style={{ padding: '0.5rem' }}>نطاق الصلاحية</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{pkg.name}</td>
                        <td style={{ padding: '0.5rem' }}>{pkg.durationDays} يوم</td>
                        <td style={{ padding: '0.5rem' }}>{(pkg.priceMinor / 100).toFixed(2)} {pkg.currency}</td>
                        <td style={{ padding: '0.5rem', color: '#0288d1', fontWeight: 'bold' }}>{pkg.scopeType}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: pkg.status === 'ACTIVE' ? '#2e7d32' : '#757575' }}>{pkg.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'codes' && (
            <div>
              <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', color: '#1b5e20', fontSize: '0.85rem' }}>
                🔒 <strong>تنبيه أمني:</strong> لا تُحفظ الأكواد النصية الصريحة في قاعدة البيانات اطلاقاً؛ يتم حفظ الهاش المشفر (SHA-256) فقط. تُعرض الأكواد النصية الصريحة مرة واحدة فقط فور التوليد للحفظ أو التصدير.
              </div>

              <h4>قائمة الأكواد المشفرة (Subscription Codes Status)</h4>
              {codes.length === 0 ? <p style={{ color: '#666' }}>لا توجد أكواد اشتراك مولدة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>بادئة الكود</th>
                      <th style={{ padding: '0.5rem' }}>SHA-256 Hash</th>
                      <th style={{ padding: '0.5rem' }}>نوع الاستخدام</th>
                      <th style={{ padding: '0.5rem' }}>الطالب المستفيد</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{c.codePrefix}-****</td>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#666' }}>{c.codeHash.substring(0, 16)}...</td>
                        <td style={{ padding: '0.5rem' }}>{c.redemptionMode}</td>
                        <td style={{ padding: '0.5rem' }}>{c.redeemedBy || c.assignedStudentId || '-'}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: c.status === 'AVAILABLE' ? '#2e7d32' : (c.status === 'REDEEMED' ? '#0288d1' : '#d32f2f') }}>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'entitlements' && (
            <div>
              <h4>قائمة الصلاحيات الأكاديمية النشطة (Active Student Entitlements)</h4>
              {entitlements.length === 0 ? <p style={{ color: '#666' }}>لا توجد صلاحيات نشطة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>معرف الطالب</th>
                      <th style={{ padding: '0.5rem' }}>الباقة</th>
                      <th style={{ padding: '0.5rem' }}>النطاق</th>
                      <th style={{ padding: '0.5rem' }}>تاريخ الانتهاء</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entitlements.map((e) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{e.studentId}</td>
                        <td style={{ padding: '0.5rem' }}>{e.packageId}</td>
                        <td style={{ padding: '0.5rem', color: '#0288d1', fontWeight: 'bold' }}>{e.scopeType}</td>
                        <td style={{ padding: '0.5rem' }}>{new Date(e.expiresAt).toLocaleDateString('ar-EG')}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: e.status === 'ACTIVE' ? '#2e7d32' : '#d32f2f' }}>{e.status}</td>
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
