import React, { useState } from 'react';
import { useAcademic } from '../context/AcademicContext';
import { useAuth } from '../context/AuthContext';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TeachingOperationsManager } from './academic/TeachingOperationsManager';

export function AcademicCoreDashboard() {
  const { currentUser, institutionId, role } = useAuth();
  const {
    subjects,
    teachers,
    stages,
    loading,
    error: contextError,
    refreshAcademicCore,
  } = useAcademic();

  const [activeTab, setActiveTab] = useState<'stages' | 'subjects' | 'teachers' | 'operations'>('stages');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Stage Form State
  const [newStageName, setNewStageName] = useState('');
  const [newStageCode, setNewStageCode] = useState('');
  const [newStageOrder, setNewStageOrder] = useState(1);

  // New Subject Form State
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectStageId, setNewSubjectStageId] = useState('');
  const [newSubjectDescription, setNewSubjectDescription] = useState('');

  // New Teacher Form State
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherSpecialization, setNewTeacherSpecialization] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const isTenantAdmin = role === 'superAdmin' || role === 'institutionOwner' || role === 'admin';

  // Add Academic Stage / Level
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!newStageName.trim()) {
      setFormError('اسم المرحلة الدراسية مطلوب.');
      return;
    }
    if (!currentUser || !institutionId) {
      setFormError('لا توجد جلسة موثقة للمؤسسة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanCode = (newStageCode.trim() || newStageName.trim().toLowerCase()).replace(/[^a-z0-9_]/g, '_');
      const stageId = `stg_${Date.now().toString(36)}`;
      const docRef = doc(db, 'institutions', institutionId, 'stages', stageId);

      await setDoc(docRef, {
        id: stageId,
        code: cleanCode,
        name: newStageName.trim(),
        order: Number(newStageOrder) || 1,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid,
      });

      setSuccessMsg(`تم إضافة المرحلة الدراسية (${newStageName}) بنجاح.`);
      setNewStageName('');
      setNewStageCode('');
      setNewStageOrder(stages.length + 1);
      await refreshAcademicCore();
    } catch (err: any) {
      setFormError(err?.message || 'فشل إضافة المرحلة الدراسية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Subject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!newSubjectName.trim()) {
      setFormError('اسم المادة الدراسية مطلوب.');
      return;
    }
    if (!currentUser || !institutionId) {
      setFormError('لا توجد جلسة موثقة للمؤسسة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanCode = (newSubjectCode.trim() || newSubjectName.trim().toLowerCase()).replace(/[^a-z0-9_]/g, '_');
      const subjectId = `subj_${Date.now().toString(36)}`;
      const docRef = doc(db, 'institutions', institutionId, 'subjects', subjectId);

      await setDoc(docRef, {
        id: subjectId,
        code: cleanCode,
        name: newSubjectName.trim(),
        stageId: newSubjectStageId || null,
        description: newSubjectDescription.trim(),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid,
      });

      setSuccessMsg(`تم إضافة المادة الدراسية (${newSubjectName}) بنجاح.`);
      setNewSubjectName('');
      setNewSubjectCode('');
      setNewSubjectDescription('');
      await refreshAcademicCore();
    } catch (err: any) {
      setFormError(err?.message || 'فشل إضافة المادة الدراسية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Teacher
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!newTeacherName.trim() || !newTeacherEmail.trim()) {
      setFormError('اسم المعلم والبريد الإلكتروني حقول مطلوبة.');
      return;
    }
    if (!currentUser || !institutionId) {
      setFormError('لا توجد جلسة موثقة للمؤسسة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const teacherId = `tch_${Date.now().toString(36)}`;
      const docRef = doc(db, 'institutions', institutionId, 'teachers', teacherId);

      await setDoc(docRef, {
        id: teacherId,
        fullName: newTeacherName.trim(),
        phone: newTeacherPhone.trim(),
        email: newTeacherEmail.trim().toLowerCase(),
        specialization: newTeacherSpecialization.trim(),
        subjectIds: selectedSubjectIds,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid,
      });

      setSuccessMsg(`تم تسجيل ملف المعلم (${newTeacherName}) بنجاح.`);
      setNewTeacherName('');
      setNewTeacherPhone('');
      setNewTeacherEmail('');
      setNewTeacherSpecialization('');
      setSelectedSubjectIds([]);
      await refreshAcademicCore();
    } catch (err: any) {
      setFormError(err?.message || 'فشل إضافة ملف المعلم.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status for Stage / Subject / Teacher
  const handleToggleStatus = async (colName: 'stages' | 'subjects' | 'teachers', docId: string, currentStatus: string) => {
    if (!currentUser || !institutionId) return;
    const targetStatus = currentStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    setFormError(null);
    setSuccessMsg(null);

    try {
      const docRef = doc(db, 'institutions', institutionId, colName, docId);
      await updateDoc(docRef, {
        status: targetStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid,
      });
      setSuccessMsg(`تم تغيير حالة العنصر إلى ${targetStatus}`);
      await refreshAcademicCore();
    } catch (err: any) {
      setFormError(err?.message || 'فشل تحديث الحالة.');
    }
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem', direction: 'rtl' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem', color: '#1565c0' }}>
        الهيكل الأكاديمي وإدارة المعلمين (Academic Structure & Teachers)
      </h3>

      {contextError && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{contextError}</div>}
      {formError && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{formError}</div>}
      {successMsg && <div style={{ color: '#2e7d32', background: '#e8f5e9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{successMsg}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('stages')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'stages' ? '#1565c0' : '#f5f5f5', color: activeTab === 'stages' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المراحل/الصفوف ({stages.length})
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'subjects' ? '#1565c0' : '#f5f5f5', color: activeTab === 'subjects' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المواد الدراسية ({subjects.length})
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'teachers' ? '#1565c0' : '#f5f5f5', color: activeTab === 'teachers' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          المعلمون والمواد ({teachers.length})
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'operations' ? '#1565c0' : '#f5f5f5', color: activeTab === 'operations' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          عمليات التدريس والجلسات
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>جاري تحميل الهيكل الأكاديمي...</div>
      ) : (
        <div>
          {/* STAGES / LEVELS TAB */}
          {activeTab === 'stages' && (
            <div>
              {isTenantAdmin && (
                <form onSubmit={handleAddStage} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', border: '1px solid #e9ecef' }}>
                  <h5 style={{ margin: '0 0 0.75rem 0', color: '#1565c0' }}>إضافة مرحلة/صف دراسي جديد</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>اسم المرحلة *</label>
                      <input
                        type="text"
                        placeholder="مثال: الصف الأول الثانوي"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>الكود (اختر أو اتركه تلقائي)</label>
                      <input
                        type="text"
                        placeholder="sec_1"
                        value={newStageCode}
                        onChange={(e) => setNewStageCode(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>الترتيب الأكاديمي</label>
                      <input
                        type="number"
                        value={newStageOrder}
                        onChange={(e) => setNewStageOrder(Number(e.target.value))}
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ padding: '0.5rem 1rem', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {isSubmitting ? 'جاري الإضافة...' : 'حفظ المرحلة الدراسية'}
                  </button>
                </form>
              )}

              <h4>المراحل والصفوف المسجلة</h4>
              {stages.length === 0 ? (
                <p style={{ color: '#666' }}>لا توجد مراحل دراسية مسجلة حالياً.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', background: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.6rem' }}>الترتيب</th>
                      <th style={{ padding: '0.6rem' }}>الكود</th>
                      <th style={{ padding: '0.6rem' }}>اسم المرحلة</th>
                      <th style={{ padding: '0.6rem' }}>الحالة</th>
                      {isTenantAdmin && <th style={{ padding: '0.6rem' }}>الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stages.sort((a, b) => (a.order || 0) - (b.order || 0)).map((st) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>{st.order}</td>
                        <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>{st.code}</td>
                        <td style={{ padding: '0.6rem', fontWeight: 600 }}>{st.name}</td>
                        <td style={{ padding: '0.6rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            background: st.status === 'DISABLED' ? '#ffebee' : '#e8f5e9',
                            color: st.status === 'DISABLED' ? '#c62828' : '#2e7d32'
                          }}>
                            {st.status || 'ACTIVE'}
                          </span>
                        </td>
                        {isTenantAdmin && (
                          <td style={{ padding: '0.6rem' }}>
                            <button
                              onClick={() => handleToggleStatus('stages', st.id, st.status || 'ACTIVE')}
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: st.status === 'DISABLED' ? '#2e7d32' : '#c62828', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              {st.status === 'DISABLED' ? 'تفعيل' : 'تعطيل'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* SUBJECTS TAB */}
          {activeTab === 'subjects' && (
            <div>
              {isTenantAdmin && (
                <form onSubmit={handleAddSubject} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', border: '1px solid #e9ecef' }}>
                  <h5 style={{ margin: '0 0 0.75rem 0', color: '#1565c0' }}>إضافة مادة دراسية جديدة</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>اسم المادة *</label>
                      <input
                        type="text"
                        placeholder="مثال: الرياضيات التطبيقية"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>الكود (اختر أو اتركه تلقائي)</label>
                      <input
                        type="text"
                        placeholder="math_app"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>المرحلة المربوطة بها (اختياري)</label>
                      <select
                        value={newSubjectStageId}
                        onChange={(e) => setNewSubjectStageId(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      >
                        <option value="">جميع المراحل</option>
                        {stages.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ padding: '0.5rem 1rem', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {isSubmitting ? 'جاري الإضافة...' : 'حفظ المادة الدراسية'}
                  </button>
                </form>
              )}

              <h4>المواد الدراسية المسجلة</h4>
              {subjects.length === 0 ? (
                <p style={{ color: '#666' }}>لا توجد مواد دراسية مسجلة حالياً.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', background: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.6rem' }}>الكود</th>
                      <th style={{ padding: '0.6rem' }}>اسم المادة</th>
                      <th style={{ padding: '0.6rem' }}>المرحلة</th>
                      <th style={{ padding: '0.6rem' }}>الحالة</th>
                      {isTenantAdmin && <th style={{ padding: '0.6rem' }}>الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s) => {
                      const linkedStage = stages.find((st) => st.id === s.stageId);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>{s.code}</td>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{s.name}</td>
                          <td style={{ padding: '0.6rem' }}>{linkedStage ? linkedStage.name : 'عام / غير محدد'}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              background: s.status === 'DISABLED' ? '#ffebee' : '#e8f5e9',
                              color: s.status === 'DISABLED' ? '#c62828' : '#2e7d32'
                            }}>
                              {s.status || 'ACTIVE'}
                            </span>
                          </td>
                          {isTenantAdmin && (
                            <td style={{ padding: '0.6rem' }}>
                              <button
                                onClick={() => handleToggleStatus('subjects', s.id, s.status || 'ACTIVE')}
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: s.status === 'DISABLED' ? '#2e7d32' : '#c62828', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                              >
                                {s.status === 'DISABLED' ? 'تفعيل' : 'تعطيل'}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TEACHERS TAB */}
          {activeTab === 'teachers' && (
            <div>
              {isTenantAdmin && (
                <form onSubmit={handleAddTeacher} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', border: '1px solid #e9ecef' }}>
                  <h5 style={{ margin: '0 0 0.75rem 0', color: '#1565c0' }}>تسجيل ملف معلم جديد وربطه بالمواد</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>اسم المعلم *</label>
                      <input
                        type="text"
                        placeholder="أ.د. أحمد محمود"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>البريد الإلكتروني *</label>
                      <input
                        type="email"
                        placeholder="teacher@center.com"
                        value={newTeacherEmail}
                        onChange={(e) => setNewTeacherEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>رقم الهاتف</label>
                      <input
                        type="text"
                        placeholder="01000000000"
                        value={newTeacherPhone}
                        onChange={(e) => setNewTeacherPhone(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>التخصص الأكاديمي</label>
                      <input
                        type="text"
                        placeholder="فيزياء وفلك"
                        value={newTeacherSpecialization}
                        onChange={(e) => setNewTeacherSpecialization(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ padding: '0.5rem 1rem', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {isSubmitting ? 'جاري الإضافة...' : 'حفظ ملف المعلم'}
                  </button>
                </form>
              )}

              <h4>قائمة المعلمين المسجلين</h4>
              {teachers.length === 0 ? (
                <p style={{ color: '#666' }}>لا يوجد معلمون مسجلون حالياً.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', background: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.6rem' }}>الاسم</th>
                      <th style={{ padding: '0.6rem' }}>البريد الإلكتروني</th>
                      <th style={{ padding: '0.6rem' }}>التخصص</th>
                      <th style={{ padding: '0.6rem' }}>الحالة</th>
                      {isTenantAdmin && <th style={{ padding: '0.6rem' }}>الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.6rem', fontWeight: 600 }}>{t.fullName}</td>
                        <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>{t.email}</td>
                        <td style={{ padding: '0.6rem' }}>{t.specialization || '-'}</td>
                        <td style={{ padding: '0.6rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            background: t.status === 'DISABLED' ? '#ffebee' : '#e8f5e9',
                            color: t.status === 'DISABLED' ? '#c62828' : '#2e7d32'
                          }}>
                            {t.status || 'ACTIVE'}
                          </span>
                        </td>
                        {isTenantAdmin && (
                          <td style={{ padding: '0.6rem' }}>
                            <button
                              onClick={() => handleToggleStatus('teachers', t.id, t.status || 'ACTIVE')}
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: t.status === 'DISABLED' ? '#2e7d32' : '#c62828', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              {t.status === 'DISABLED' ? 'تفعيل' : 'تعطيل'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TEACHING OPERATIONS TAB */}
          {activeTab === 'operations' && <TeachingOperationsManager />}
        </div>
      )}
    </div>
  );
}
