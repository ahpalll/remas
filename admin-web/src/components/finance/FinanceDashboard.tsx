import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';

export function FinanceDashboard() {
  const { feeStructures, charges, payments, expenses, ledgerEntries, loading, error } = useFinance();
  const [activeTab, setActiveTab] = useState<'fees' | 'charges' | 'payments' | 'expenses' | 'ledger'>('fees');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const triggerBlockedAction = (actionName: string) => {
    setActionMessage(`BLOCKED / USER ACTION REQUIRED: ${actionName} يتطلب نشر Cloud Functions Trusted Endpoints في البيئة الحقيقية.`);
  };

  const formatMoney = (amountMinor: number) => {
    return (amountMinor / 100).toFixed(2) + ' ج.م';
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>النظام المالي (Finance System Dashboard)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {actionMessage && <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>{actionMessage}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { setActiveTab('fees'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'fees' ? '#1976d2' : '#f5f5f5', color: activeTab === 'fees' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            هياكل الرسوم ({feeStructures.length})
          </button>
          <button
            onClick={() => { setActiveTab('charges'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'charges' ? '#1976d2' : '#f5f5f5', color: activeTab === 'charges' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            مطالبات الطلاب ({charges.length})
          </button>
          <button
            onClick={() => { setActiveTab('payments'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'payments' ? '#1976d2' : '#f5f5f5', color: activeTab === 'payments' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            مدفوعات الطلاب ({payments.length})
          </button>
          <button
            onClick={() => { setActiveTab('expenses'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'expenses' ? '#1976d2' : '#f5f5f5', color: activeTab === 'expenses' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            المصروفات ({expenses.length})
          </button>
          <button
            onClick={() => { setActiveTab('ledger'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'ledger' ? '#1976d2' : '#f5f5f5', color: activeTab === 'ledger' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            دفتر الأستاذ المعاملاتي ({ledgerEntries.length})
          </button>
        </div>

        <button
          onClick={() => triggerBlockedAction('تسجيل عملية دفع جديدة (recordStudentPayment)')}
          style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + تسجيل سند قبض / دفع
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل البيانات المالية...</div>
      ) : (
        <div>
          {activeTab === 'fees' && (
            <div>
              <h4>هياكل الرسوم الدراسية المعتمدة</h4>
              {feeStructures.length === 0 ? <p style={{ color: '#666' }}>لا توجد هياكل رسوم مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>اسم الرسوم</th>
                      <th style={{ padding: '0.5rem' }}>المبلغ</th>
                      <th style={{ padding: '0.5rem' }}>التكرار</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeStructures.map((fee) => (
                      <tr key={fee.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{fee.name}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(fee.amountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{fee.frequency}</td>
                        <td style={{ padding: '0.5rem' }}>{fee.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'charges' && (
            <div>
              <h4>مطالبات رسوم الطلاب (Student Charges & Balances)</h4>
              {charges.length === 0 ? <p style={{ color: '#666' }}>لا توجد مطالبات رسوم مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>معرف الطالب</th>
                      <th style={{ padding: '0.5rem' }}>المبلغ الأصلي</th>
                      <th style={{ padding: '0.5rem' }}>الصافي بعد الخصم</th>
                      <th style={{ padding: '0.5rem' }}>المدفوع</th>
                      <th style={{ padding: '0.5rem' }}>المتبقي</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((chg) => (
                      <tr key={chg.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{chg.studentId}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(chg.amountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(chg.netAmountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(chg.paidAmountMinor)}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#c62828' }}>{formatMoney(chg.dueAmountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{chg.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <h4>سندات القبض والمدفوعات المسجلة</h4>
              {payments.length === 0 ? <p style={{ color: '#666' }}>لا توجد مدفوعات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رقم الإيصال</th>
                      <th style={{ padding: '0.5rem' }}>المبلغ</th>
                      <th style={{ padding: '0.5rem' }}>طريقة الدفع</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                      <th style={{ padding: '0.5rem' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{pay.receiptNumber}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(pay.amountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{pay.method}</td>
                        <td style={{ padding: '0.5rem' }}>{pay.status}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <button
                            onClick={() => triggerBlockedAction(`استرداد الدفعة (${pay.id})`)}
                            style={{ padding: '0.25rem 0.5rem', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            استرداد (Refund)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div>
              <h4>المصروفات والتكاليف التشغيلية</h4>
              {expenses.length === 0 ? <p style={{ color: '#666' }}>لا توجد مصروفات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الفئة</th>
                      <th style={{ padding: '0.5rem' }}>الوصف</th>
                      <th style={{ padding: '0.5rem' }}>المبلغ</th>
                      <th style={{ padding: '0.5rem' }}>طريقة الدفع</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{exp.category}</td>
                        <td style={{ padding: '0.5rem' }}>{exp.description}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(exp.amountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{exp.method}</td>
                        <td style={{ padding: '0.5rem' }}>{exp.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div>
              <h4>دفتر الأستاذ المعاملاتي غير القابل للتعديل (Immutable Single-Entry Transactional Ledger)</h4>
              {ledgerEntries.length === 0 ? <p style={{ color: '#666' }}>لا توجد قيود أستاذ مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>نوع القيد</th>
                      <th style={{ padding: '0.5rem' }}>الفئة الحسابية</th>
                      <th style={{ padding: '0.5rem' }}>المبلغ</th>
                      <th style={{ padding: '0.5rem' }}>الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((led) => (
                      <tr key={led.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: led.entryType === 'DEBIT' ? '#c62828' : '#2e7d32' }}>{led.entryType}</td>
                        <td style={{ padding: '0.5rem' }}>{led.category}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(led.amountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{led.description}</td>
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
