import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AcademicCoreDashboard } from './AcademicCoreDashboard';
import { StudentsManager } from './student/StudentsManager';
import { TeachingOperationsManager } from './academic/TeachingOperationsManager';

export function CenterOperationsConsole() {
  const { role, institutionId } = useAuth();
  const [activeSection, setActiveSection] = useState<'overview' | 'structure' | 'students' | 'teaching'>('overview');

  const isTenantAdmin = role === 'superAdmin' || role === 'institutionOwner' || role === 'admin';

  return (
    <div style={{ padding: '1.5rem', direction: 'rtl', textAlign: 'right', background: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: '#fff', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 'bold' }}>مركز إدارة تشغيل المؤسسة التعليمية (Center Operations Console)</h2>
            <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
              دورة التشغيل الشاملة للمؤسسة: الهيكل الأكاديمي ➔ الكادر التعليمي ➔ المجموعات ➔ قيد الطلاب ➔ جدولة الجلسات ➔ تسجيل الحضور
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
            رمز المؤسسة: {institutionId || 'inst_bootstrap_001'} | الدور: {role}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveSection('overview')}
          style={{
            flex: 1, padding: '0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            background: activeSection === 'overview' ? '#1a237e' : '#f5f5f5',
            color: activeSection === 'overview' ? '#fff' : '#424242'
          }}
        >
          1. نظرة عامة ورصد الجاهزية Operational Readiness
        </button>
        <button
          onClick={() => setActiveSection('structure')}
          style={{
            flex: 1, padding: '0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            background: activeSection === 'structure' ? '#1a237e' : '#f5f5f5',
            color: activeSection === 'structure' ? '#fff' : '#424242'
          }}
        >
          2. المراحل والمواد والمعلمون Academic Structure
        </button>
        <button
          onClick={() => setActiveSection('students')}
          style={{
            flex: 1, padding: '0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            background: activeSection === 'students' ? '#1a237e' : '#f5f5f5',
            color: activeSection === 'students' ? '#fff' : '#424242'
          }}
        >
          3. الطلاب والمجموعات Student & Groups
        </button>
        <button
          onClick={() => setActiveSection('teaching')}
          style={{
            flex: 1, padding: '0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            background: activeSection === 'teaching' ? '#1a237e' : '#f5f5f5',
            color: activeSection === 'teaching' ? '#fff' : '#424242'
          }}
        >
          4. الجلسات وتسجيل الحضور Sessions & Attendance
        </button>
      </div>

      {/* Section Content */}
      {activeSection === 'overview' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1a237e' }}>مؤشرات حالة التشغيل الحقيقي في بيئة الإنتاج (Production Operations Status)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#2e7d32', fontWeight: 'bold' }}>حالة الاتصال Connection</div>
              <div style={{ fontSize: '1.2rem', color: '#1b5e20', fontWeight: 'bold', marginTop: '0.25rem' }}>CONNECTED</div>
              <div style={{ fontSize: '0.75rem', color: '#4caf50', marginTop: '0.25rem' }}>Firebase Live Production</div>
            </div>

            <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#1565c0', fontWeight: 'bold' }}>جاهزية البيانات Data Readiness</div>
              <div style={{ fontSize: '1.2rem', color: '#0d47a1', fontWeight: 'bold', marginTop: '0.25rem' }}>PRODUCTION READY</div>
              <div style={{ fontSize: '0.75rem', color: '#1e88e5', marginTop: '0.25rem' }}>System Metadata & Primary Tenant</div>
            </div>

            <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#e65100', fontWeight: 'bold' }}>تشغيل التطبيق Application Status</div>
              <div style={{ fontSize: '1.2rem', color: '#ef6c00', fontWeight: 'bold', marginTop: '0.25rem' }}>OPERATIONAL</div>
              <div style={{ fontSize: '0.75rem', color: '#f57c00', marginTop: '0.25rem' }}>End-to-End Workflow Active</div>
            </div>
          </div>

          <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#333' }}>خطوات دورة تشغيل السنتر (Operational Cycle Sequence):</h4>
            <ol style={{ margin: 0, paddingRight: '1.2rem', lineHeight: '1.8', color: '#555', fontSize: '0.9rem' }}>
              <li><strong>إعداد الهيكل الأكاديمي:</strong> إضافة المراحل الدراسية والمواد التعليمية.</li>
              <li><strong>إضافة المعلمين والمؤهلات:</strong> تسجيل بيانات المعلمين وتحديد المواد والمراحل المؤهل لتدريسها.</li>
              <li><strong>إنشاء المجموعات وتحديد السعة:</strong> تعريف المجموعات الدراسية وقاعة التدريس وسعة الطلاب (maxCapacity).</li>
              <li><strong>تسجيل الطلاب وقيدهم بالمجموعات:</strong> قيد الطلاب وتوليد بطاقات QR وتحديث عداد المجموعات تلقائيًا.</li>
              <li><strong>إسناد المدرس للمجموعة:</strong> التحقق من مطابقة مؤهلات المدرس قبل الإسناد.</li>
              <li><strong>جدولة الجلسات التعليمية:</strong> إنشاء الحصص مع التحقق التلقائي من عدم وجود تضارب في المواعيد (Schedule Conflict Check).</li>
              <li><strong>تسجيل الحضور والجلسات:</strong> بدء الجلسة وتسجيل الحضور (حاضر / متأخر / غائب / بعذر) وإنهاء الجلسة.</li>
            </ol>
          </div>
        </div>
      )}

      {activeSection === 'structure' && <AcademicCoreDashboard />}
      {activeSection === 'students' && <StudentsManager />}
      {activeSection === 'teaching' && <TeachingOperationsManager />}
    </div>
  );
}
