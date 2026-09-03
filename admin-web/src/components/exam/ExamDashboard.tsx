import { useState } from 'react';
import { useExam } from '../../context/ExamContext';

export function ExamDashboard() {
  const { questionBanks, questions, exams, snapshots, grades, revisions, loading, error } = useExam();
  const [activeTab, setActiveTab] = useState<'banks' | 'questions' | 'exams' | 'snapshots' | 'grades' | 'revisions' | 'reports'>('exams');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const triggerBlockedAction = (actionName: string) => {
    setActionMessage(`BLOCKED / USER ACTION REQUIRED: ${actionName} يتطلب نشر Cloud Functions Trusted Endpoints في البيئة الحقيقية.`);
  };

  const formatScore = (scoreHundredths: number) => {
    return (scoreHundredths / 100).toFixed(2);
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>نظام الامتحانات والدرجات (Exams & Grades Foundation)</h3>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
      {actionMessage && <div style={{ color: '#c62828', background: '#fff8e1', border: '1px solid #ffe082', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontWeight: 'bold' }}>{actionMessage}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setActiveTab('exams'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'exams' ? '#1976d2' : '#f5f5f5', color: activeTab === 'exams' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            الامتحانات ({exams.length})
          </button>
          <button
            onClick={() => { setActiveTab('banks'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'banks' ? '#1976d2' : '#f5f5f5', color: activeTab === 'banks' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            بنوك الأسئلة ({questionBanks.length})
          </button>
          <button
            onClick={() => { setActiveTab('questions'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'questions' ? '#1976d2' : '#f5f5f5', color: activeTab === 'questions' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            الأسئلة ({questions.length})
          </button>
          <button
            onClick={() => { setActiveTab('snapshots'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'snapshots' ? '#1976d2' : '#f5f5f5', color: activeTab === 'snapshots' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            لقطات أسئلة الامتحان ({snapshots.length})
          </button>
          <button
            onClick={() => { setActiveTab('grades'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'grades' ? '#1976d2' : '#f5f5f5', color: activeTab === 'grades' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            سجلات الدرجات ({grades.length})
          </button>
          <button
            onClick={() => { setActiveTab('revisions'); setActionMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'revisions' ? '#1976d2' : '#f5f5f5', color: activeTab === 'revisions' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            سجل تدقيق التعديلات ({revisions.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => triggerBlockedAction('استيراد بنك أسئلة (importQuestionBank)')}
            style={{ padding: '0.5rem 1rem', background: '#0288d1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📥 استيراد أسئلة (CSV/XLSX)
          </button>
          <button
            onClick={() => triggerBlockedAction('إنشاء امتحان جديد (createExam)')}
            style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + إنشاء امتحان جديد
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل بيانات الامتحانات والدرجات...</div>
      ) : (
        <div>
          {activeTab === 'exams' && (
            <div>
              <h4>جدول الامتحانات والتقييمات (Exam Definitions)</h4>
              {exams.length === 0 ? <p style={{ color: '#666' }}>لا توجد امتحانات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>عنوان الامتحان</th>
                      <th style={{ padding: '0.5rem' }}>النوع</th>
                      <th style={{ padding: '0.5rem' }}>المادة</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة الكلية</th>
                      <th style={{ padding: '0.5rem' }}>درجة النجاح</th>
                      <th style={{ padding: '0.5rem' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((ex) => (
                      <tr key={ex.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{ex.title}</td>
                        <td style={{ padding: '0.5rem' }}>{ex.examType}</td>
                        <td style={{ padding: '0.5rem' }}>{ex.subjectId}</td>
                        <td style={{ padding: '0.5rem' }}>{formatScore(ex.totalMarksHundredths)}</td>
                        <td style={{ padding: '0.5rem' }}>{formatScore(ex.passingMarksHundredths)}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: ex.status === 'PUBLISHED' ? '#2e7d32' : '#ed6c02' }}>{ex.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'banks' && (
            <div>
              <h4>بنوك الأسئلة المتاحة (Question Banks)</h4>
              {questionBanks.length === 0 ? <p style={{ color: '#666' }}>لا توجد بنوك أسئلة مسجلة.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>اسم البنك</th>
                      <th style={{ padding: '0.5rem' }}>المادة</th>
                      <th style={{ padding: '0.5rem' }}>المرحلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionBanks.map((qb) => (
                      <tr key={qb.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{qb.name}</td>
                        <td style={{ padding: '0.5rem' }}>{qb.subjectId}</td>
                        <td style={{ padding: '0.5rem' }}>{qb.stageId || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'questions' && (
            <div>
              <h4>قائمة الأسئلة (Question Catalog)</h4>
              {questions.length === 0 ? <p style={{ color: '#666' }}>لا توجد أسئلة مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>نص السؤال</th>
                      <th style={{ padding: '0.5rem' }}>نوع السؤال</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة</th>
                      <th style={{ padding: '0.5rem' }}>المادة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr key={q.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{q.prompt}</td>
                        <td style={{ padding: '0.5rem' }}>{q.questionType}</td>
                        <td style={{ padding: '0.5rem' }}>{formatScore(q.marksHundredths)}</td>
                        <td style={{ padding: '0.5rem' }}>{q.subjectId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'snapshots' && (
            <div>
              <h4>لقطات أسئلة الامتحان المعتمدة (Exam Question Snapshots)</h4>
              {snapshots.length === 0 ? <p style={{ color: '#666' }}>لا توجد لقطات أسئلة معتمدة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>معرف الامتحان</th>
                      <th style={{ padding: '0.5rem' }}>الترتيب</th>
                      <th style={{ padding: '0.5rem' }}>نص السؤال</th>
                      <th style={{ padding: '0.5rem' }}>نوع السؤال</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{s.examId}</td>
                        <td style={{ padding: '0.5rem' }}>{s.order}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{s.prompt}</td>
                        <td style={{ padding: '0.5rem' }}>{s.questionType}</td>
                        <td style={{ padding: '0.5rem' }}>{formatScore(s.marksHundredths)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'grades' && (
            <div>
              <h4>سجلات درجات الطلاب (Student Exam Grades)</h4>
              {grades.length === 0 ? <p style={{ color: '#666' }}>لا توجد درجات مسجلة حالياً.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>الطالب</th>
                      <th style={{ padding: '0.5rem' }}>الامتحان</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة المكتسبة</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة الكلية</th>
                      <th style={{ padding: '0.5rem' }}>النسبة</th>
                      <th style={{ padding: '0.5rem' }}>النتيجة</th>
                      <th style={{ padding: '0.5rem' }}>حالة التصحيح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{g.studentId}</td>
                        <td style={{ padding: '0.5rem' }}>{g.examId}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{formatScore(g.earnedMarksHundredths)}</td>
                        <td style={{ padding: '0.5rem' }}>{formatScore(g.totalMarksHundredths)}</td>
                        <td style={{ padding: '0.5rem' }}>{(g.percentageHundredths / 100).toFixed(1)}%</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: g.resultStatus === 'PASS' ? '#2e7d32' : '#c62828' }}>{g.resultStatus}</td>
                        <td style={{ padding: '0.5rem' }}>{g.gradingStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'revisions' && (
            <div>
              <h4>سجل تدقيق تعديل ومراجعة الدرجات (Grade Revisions Audit Log)</h4>
              {revisions.length === 0 ? <p style={{ color: '#666' }}>لا توجد تعديلات درجات مسجلة.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem' }}>معرف الدرجة</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة السابقة</th>
                      <th style={{ padding: '0.5rem' }}>الدرجة الجديدة</th>
                      <th style={{ padding: '0.5rem' }}>سبب التعديل</th>
                      <th style={{ padding: '0.5rem' }}>بواسطة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.map((rev) => (
                      <tr key={rev.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{rev.gradeId}</td>
                        <td style={{ padding: '0.5rem' }}>{formatScore(rev.previousEarnedMarksHundredths)}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#2e7d32' }}>{formatScore(rev.newEarnedMarksHundredths)}</td>
                        <td style={{ padding: '0.5rem' }}>{rev.reason}</td>
                        <td style={{ padding: '0.5rem' }}>{rev.changedBy}</td>
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
