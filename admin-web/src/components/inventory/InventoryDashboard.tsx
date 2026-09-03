import { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';

export function InventoryDashboard() {
  const { books, suppliers, purchases, sales, deliveries, returns, stockMovements, inventoryItems, loading, error } = useInventory();
  const [activeTab, setActiveTab] = useState<'books' | 'suppliers' | 'purchases' | 'sales' | 'deliveries' | 'returns' | 'movements' | 'inventory'>('books');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const triggerBlockedAction = (actionName: string) => {
    setActionMessage(`BLOCKED / USER ACTION REQUIRED: ${actionName} يتطلب نشر Cloud Functions Trusted Endpoints في البيئة الحقيقية.`);
  };

  const formatMoney = (amountMinor: number) => {
    return (amountMinor / 100).toFixed(2) + ' ج.م';
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>نظام الكتب والمخزون (Books & Inventory System)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {actionMessage && <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>{actionMessage}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setActiveTab('books'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'books' ? '#1976d2' : '#f5f5f5', color: activeTab === 'books' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            الكتب ({books.length})
          </button>
          <button
            onClick={() => { setActiveTab('suppliers'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'suppliers' ? '#1976d2' : '#f5f5f5', color: activeTab === 'suppliers' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            الموردون ({suppliers.length})
          </button>
          <button
            onClick={() => { setActiveTab('purchases'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'purchases' ? '#1976d2' : '#f5f5f5', color: activeTab === 'purchases' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            المشتريات ({purchases.length})
          </button>
          <button
            onClick={() => { setActiveTab('sales'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'sales' ? '#1976d2' : '#f5f5f5', color: activeTab === 'sales' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            المبيعات ({sales.length})
          </button>
          <button
            onClick={() => { setActiveTab('deliveries'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'deliveries' ? '#1976d2' : '#f5f5f5', color: activeTab === 'deliveries' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            تسليم الطلاب ({deliveries.length})
          </button>
          <button
            onClick={() => { setActiveTab('returns'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'returns' ? '#1976d2' : '#f5f5f5', color: activeTab === 'returns' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            المرتجعات ({returns.length})
          </button>
          <button
            onClick={() => { setActiveTab('movements'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'movements' ? '#1976d2' : '#f5f5f5', color: activeTab === 'movements' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            سجل الحركات ({stockMovements.length})
          </button>
          <button
            onClick={() => { setActiveTab('inventory'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'inventory' ? '#1976d2' : '#f5f5f5', color: activeTab === 'inventory' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            حالة المخزون ({inventoryItems.length})
          </button>
        </div>

        <button
          onClick={() => triggerBlockedAction('إضافة كتاب جديد (createBook)')}
          style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + إضافة كتاب جديد
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل بيانات المخزون والكتب...</div>
      ) : (
        <div>
          {activeTab === 'books' && (
            <div>
              <h4>دليل الكتب والمذكرات الدراسية (Book Catalog)</h4>
              {books.length === 0 ? <p style={{ color: '#666' }}>لا توجد كتب مسجلة حالياً في النظام.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رمز الكتاب (SKU)</th>
                      <th style={{ padding: '0.5rem' }}>العنوان</th>
                      <th style={{ padding: '0.5rem' }}>سعر التكلفة</th>
                      <th style={{ padding: '0.5rem' }}>سعر البيع</th>
                      <th style={{ padding: '0.5rem' }}>حد إعادة الطلب</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{b.code}</td>
                        <td style={{ padding: '0.5rem' }}>{b.title}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(b.unitCostMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(b.salePriceMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{b.reorderLevel}</td>
                        <td style={{ padding: '0.5rem' }}>{b.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div>
              <h4>دليل الموردين والدور النشر (Suppliers)</h4>
              {suppliers.length === 0 ? <p style={{ color: '#666' }}>لا يوجد موردون مسجلون حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>اسم المورد</th>
                      <th style={{ padding: '0.5rem' }}>الهاتف</th>
                      <th style={{ padding: '0.5rem' }}>الرقم الضريبي</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{s.name}</td>
                        <td style={{ padding: '0.5rem' }}>{s.phone || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{s.taxNumber || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'purchases' && (
            <div>
              <h4>فواتير المشتريات والتوريد (Purchases)</h4>
              {purchases.length === 0 ? <p style={{ color: '#666' }}>لا توجد عمليات توريد/مشتريات مسجلة.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رقم الفاتورة</th>
                      <th style={{ padding: '0.5rem' }}>المورد</th>
                      <th style={{ padding: '0.5rem' }}>إجمالي الفاتورة</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{p.referenceNumber}</td>
                        <td style={{ padding: '0.5rem' }}>{p.supplierId}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(p.totalAmountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'sales' && (
            <div>
              <h4>عمليات مبيعات الكتب (Book Sales)</h4>
              {sales.length === 0 ? <p style={{ color: '#666' }}>لا توجد عمليات مبيعات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رقم الإيصال</th>
                      <th style={{ padding: '0.5rem' }}>العميل / الطالب</th>
                      <th style={{ padding: '0.5rem' }}>الإجمالي</th>
                      <th style={{ padding: '0.5rem' }}>التكلفة الإجمالية</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sal) => (
                      <tr key={sal.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{sal.receiptNumber}</td>
                        <td style={{ padding: '0.5rem' }}>{sal.customerName || sal.studentId || 'عام'}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(sal.totalAmountMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{formatMoney(sal.costTotalMinor)}</td>
                        <td style={{ padding: '0.5rem' }}>{sal.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div>
              <h4>سجلات تسليم الكتب للطلاب (Student Book Deliveries)</h4>
              {deliveries.length === 0 ? <p style={{ color: '#666' }}>لا توجد عمليات تسليم كتب مسجلة للطلاب.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رقم الإذن</th>
                      <th style={{ padding: '0.5rem' }}>الطالب</th>
                      <th style={{ padding: '0.5rem' }}>تاريخ التسليم</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{d.referenceNumber}</td>
                        <td style={{ padding: '0.5rem' }}>{d.studentId}</td>
                        <td style={{ padding: '0.5rem' }}>{d.deliveryDate}</td>
                        <td style={{ padding: '0.5rem' }}>{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'returns' && (
            <div>
              <h4>مرتجعات الكتب والمستندات (Inventory Returns)</h4>
              {returns.length === 0 ? <p style={{ color: '#666' }}>لا توجد مرتجعات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رقم الإذن</th>
                      <th style={{ padding: '0.5rem' }}>نوع الإرجاع</th>
                      <th style={{ padding: '0.5rem' }}>المرجع الأصلي</th>
                      <th style={{ padding: '0.5rem' }}>السبب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{r.referenceNumber}</td>
                        <td style={{ padding: '0.5rem' }}>{r.returnType}</td>
                        <td style={{ padding: '0.5rem' }}>{r.originalTransactionId}</td>
                        <td style={{ padding: '0.5rem' }}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'movements' && (
            <div>
              <h4>دفتر حركة المخزون المعاملاتي غير القابل للتعديل (Immutable Stock Movement Ledger)</h4>
              {stockMovements.length === 0 ? <p style={{ color: '#666' }}>لا توجد حركات مخزون مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>نوع الحركة</th>
                      <th style={{ padding: '0.5rem' }}>الكتاب</th>
                      <th style={{ padding: '0.5rem' }}>الكمية</th>
                      <th style={{ padding: '0.5rem' }}>نوع المرجع</th>
                      <th style={{ padding: '0.5rem' }}>المرجع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements.map((sm) => (
                      <tr key={sm.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: ['STOCK_IN', 'RETURN'].includes(sm.movementType) ? '#2e7d32' : '#c62828' }}>{sm.movementType}</td>
                        <td style={{ padding: '0.5rem' }}>{sm.bookId}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{sm.quantity}</td>
                        <td style={{ padding: '0.5rem' }}>{sm.referenceType}</td>
                        <td style={{ padding: '0.5rem' }}>{sm.referenceId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <h4>حالة أرصدة الكتب والمخزون الحالي (Stock Inventory Projections)</h4>
              {inventoryItems.length === 0 ? <p style={{ color: '#666' }}>لا توجد أرصدة مخزون مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>رمز الكتاب</th>
                      <th style={{ padding: '0.5rem' }}>الرصيد المتاح الحالي</th>
                      <th style={{ padding: '0.5rem' }}>حد إعادة الطلب</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems.map((inv) => (
                      <tr key={inv.bookId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{inv.bookId}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: inv.currentStock === 0 ? '#c62828' : '#2e7d32' }}>{inv.currentStock}</td>
                        <td style={{ padding: '0.5rem' }}>{inv.reorderLevel}</td>
                        <td style={{ padding: '0.5rem' }}>{inv.status}</td>
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
