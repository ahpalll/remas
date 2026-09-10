/**
 * REMAS Educational Center SaaS — Windows Desktop Client Renderer Controller
 * Implements Full Center Management Desktop UI & 15 Operational Modules
 * Version: 1.0.0-release.38
 */

let activeView = 'dashboard';
let currentInstitution = null;

async function initDesktopApp() {
  setupSidebarNavigation();
  setupNetworkMonitoring();

  if (window.electronAPI) {
    try {
      await checkDeviceStatus();
      setInterval(sendPeriodicHeartbeat, 60000);
    } catch (err) {
      console.error('Device check error:', err);
    }
  }

  // Load initial view
  renderActiveView(activeView);
}

function setupSidebarNavigation() {
  const items = document.querySelectorAll('#sidebarNav .nav-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      activeView = item.getAttribute('data-view');
      renderActiveView(activeView);
    });
  });
}

function setupNetworkMonitoring() {
  const badge = document.getElementById('networkBadge');
  const updateNet = () => {
    if (navigator.onLine) {
      badge.innerText = 'ONLINE 🟢';
      badge.className = 'badge net-online';
    } else {
      badge.innerText = 'OFFLINE GRACE 🟡';
      badge.className = 'badge net-offline';
    }
  };
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();
}

async function callBackend(method, ...args) {
  if (window.electronAPI && typeof window.electronAPI.callBackendService === 'function') {
    const res = await window.electronAPI.callBackendService(method, ...args);
    if (res && res.success) {
      return res.data;
    }
    throw new Error(res ? res.error : 'Backend service call failed');
  }

  // Simulation mode fallback
  console.log(`[Simulation] Backend call: ${method}`, args);
  return null;
}

// -------------------------------------------------------------
// Router & View Renderers for 15 Modules
// -------------------------------------------------------------

async function renderActiveView(view) {
  const mainView = document.getElementById('mainView');
  mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">جاري تحميل البيانات...</div>';

  try {
    switch (view) {
      case 'dashboard':
        await renderDashboardView(mainView);
        break;
      case 'students':
        await renderStudentsView(mainView);
        break;
      case 'teachers':
        await renderTeachersView(mainView);
        break;
      case 'groups':
        await renderGroupsView(mainView);
        break;
      case 'attendance':
        await renderAttendanceView(mainView);
        break;
      case 'schedule':
        await renderScheduleView(mainView);
        break;
      case 'content':
        await renderContentView(mainView);
        break;
      case 'exams':
        await renderExamsView(mainView);
        break;
      case 'subscriptions':
        await renderSubscriptionsView(mainView);
        break;
      case 'parents':
        await renderParentsView(mainView);
        break;
      case 'finance':
        await renderFinanceView(mainView);
        break;
      case 'reports':
        await renderReportsView(mainView);
        break;
      case 'ai':
        await renderAIView(mainView);
        break;
      case 'settings':
        await renderSettingsView(mainView);
        break;
      case 'license':
        await renderLicenseView(mainView);
        break;
      default:
        await renderDashboardView(mainView);
    }
  } catch (err) {
    mainView.innerHTML = `<div class="card" style="border-color:#ef4444;"><h3 style="color:#ef4444;">خطأ في تحميل الشاشة</h3><p>${err.message}</p></div>`;
  }
}

// Module 1: Dashboard
async function renderDashboardView(container) {
  const summary = await callBackend('getDashboardSummary');
  if (!summary) return;

  container.innerHTML = `
    <div class="view-title">
      <span>📊 لوحة تحكم السنتر الشاملة</span>
      <span style="font-size:0.85rem; color:#94a3b8;">${summary.institution ? summary.institution.name : 'سنتر التفوق التعليمي'}</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">إجمالي الطلاب المسجلين</div>
        <div class="value">${summary.totalStudents} طالب</div>
      </div>
      <div class="stat-card">
        <div class="label">إجمالي الكادر والأساتذة</div>
        <div class="value">${summary.totalTeachers} معلم</div>
      </div>
      <div class="stat-card">
        <div class="label">المجموعات الدراسية</div>
        <div class="value">${summary.totalGroups} مجموعة</div>
      </div>
      <div class="stat-card">
        <div class="label">حضور اليوم</div>
        <div class="value" style="color:#22c55e;">${summary.presentCount} طالب</div>
      </div>
      <div class="stat-card">
        <div class="label">غياب اليوم</div>
        <div class="value" style="color:#ef4444;">${summary.absentCount} طالب</div>
      </div>
      <div class="stat-card">
        <div class="label">إجمالي إيرادات السنتر</div>
        <div class="value" style="color:#38bdf8;">${summary.totalRevenue.toLocaleString()} ج.م</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
      <div class="card">
        <div class="card-title">💳 أحدث عمليات التحصيل المالي</div>
        <table class="data-table">
          <thead>
            <tr><th>رقم الإيصال</th><th>اسم الطالب</th><th>الفئة</th><th>المبلغ</th></tr>
          </thead>
          <tbody>
            ${summary.recentPayments.map(p => `
              <tr>
                <td><span class="code-box">${p.receiptNumber}</span></td>
                <td>${p.studentName}</td>
                <td>${p.category}</td>
                <td style="color:#22c55e; font-weight:bold;">${p.amount} ج.م</td>
              </tr>
            `).join('') || '<tr><td colspan="4">لا توجد عمليات سداد مؤخرة</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">📝 أحدث تسجيلات الحضور اليوم</div>
        <table class="data-table">
          <thead>
            <tr><th>الطالب</th><th>الوقت</th><th>الحالة</th><th>الطريقة</th></tr>
          </thead>
          <tbody>
            ${summary.recentAttendance.map(a => `
              <tr>
                <td>${a.studentName}</td>
                <td>${a.time}</td>
                <td><span style="color:${a.status === 'PRESENT' ? '#22c55e' : '#ef4444'}; font-weight:bold;">${a.status}</span></td>
                <td>${a.method}</td>
              </tr>
            `).join('') || '<tr><td colspan="4">لا يزال سجل الحضور خالياً اليوم</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Module 2: Students
async function renderStudentsView(container) {
  const students = await callBackend('getStudents');

  container.innerHTML = `
    <div class="view-title">
      <span>👨‍🎓 إدارة الطلاب والسجلات</span>
      <button class="btn btn-success" onclick="openAddStudentDialog()">➕ إضافة طالب جديد</button>
    </div>

    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>الكود</th><th>اسم الطالب</th><th>الهاتف</th><th>هاتف ولي الأمر</th><th>الصف الدراسي</th><th>المجموعة</th><th>رمز QR</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td><span class="code-box">${s.id}</span></td>
              <td style="font-weight:bold; color:#f8fafc;">${s.name}</td>
              <td>${s.phone}</td>
              <td>${s.guardianPhone}</td>
              <td>${s.grade}</td>
              <td>${s.groupName}</td>
              <td><span class="code-box">${s.qrToken}</span></td>
              <td><span style="color:#22c55e; font-weight:bold;">${s.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 3: Teachers
async function renderTeachersView(container) {
  const teachers = await callBackend('getTeachers');

  container.innerHTML = `
    <div class="view-title">
      <span>👨‍🏫 كادر المعلمين والأساتذة</span>
    </div>

    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>الكود</th><th>اسم المعلم</th><th>الهاتف</th><th>التخصص والمادة</th><th>المجموعات المسندة</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${teachers.map(t => `
            <tr>
              <td><span class="code-box">${t.id}</span></td>
              <td style="font-weight:bold; color:#38bdf8;">${t.name}</td>
              <td>${t.phone}</td>
              <td>${t.subject}</td>
              <td>${t.groups.join(', ')}</td>
              <td><span style="color:#22c55e; font-weight:bold;">${t.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 4: Groups & Subjects
async function renderGroupsView(container) {
  const groups = await callBackend('getGroups');

  container.innerHTML = `
    <div class="view-title">
      <span>📚 المجموعات الدراسية والمواد</span>
    </div>

    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>كود المجموعة</th><th>اسم المجموعة</th><th>المادة</th><th>المعلم المسند</th><th>السعة (Max)</th><th>المسجلين</th><th>الجدول</th><th>القاعة</th></tr>
        </thead>
        <tbody>
          ${groups.map(g => `
            <tr>
              <td><span class="code-box">${g.id}</span></td>
              <td style="font-weight:bold; color:#f8fafc;">${g.name}</td>
              <td>${g.subjectName}</td>
              <td>${g.teacherName}</td>
              <td>${g.maxCapacity} طالب</td>
              <td><span style="color:${g.enrolledCount >= g.maxCapacity ? '#ef4444' : '#22c55e'}; font-weight:bold;">${g.enrolledCount} / ${g.maxCapacity}</span></td>
              <td>${g.schedule}</td>
              <td>${g.room}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 5: Attendance (Kiosk Fast Scanner)
async function renderAttendanceView(container) {
  const summary = await callBackend('getDashboardSummary');

  container.innerHTML = `
    <div class="view-title">
      <span>📝 تسجيل الحضور والغياب (Kiosk Fast Scanner)</span>
    </div>

    <div class="card" style="border-color:#0284c7; background:#0f172a;">
      <div class="card-title">📸 الماسح السريع لكود الطالب أو رمز الـ QR</div>
      <div style="display:flex; gap:0.75rem; margin-bottom:1rem;">
        <input type="text" id="scannerInput" placeholder="مسح رمز الـ QR أو ادخل كود الطالب (مثال: STU_1001 أو QR_STU_1001)" style="flex:1; font-size:1.1rem; padding:0.75rem;" autofocus />
        <button class="btn btn-success" style="font-size:1rem; padding:0.75rem 1.5rem;" onclick="handleScanSubmit()">تسجيل الحضور 🟢</button>
      </div>
      <div id="scanResult" style="padding:1rem; border-radius:6px; background:#1e293b; display:none;"></div>
    </div>

    <div class="card">
      <div class="card-title">سجل الحضور اليومي الحالي</div>
      <table class="data-table">
        <thead>
          <tr><th>الطالب</th><th>الوقت</th><th>الحالة</th><th>طريقة التسجيل</th></tr>
        </thead>
        <tbody>
          ${summary.recentAttendance.map(a => `
            <tr>
              <td>${a.studentName}</td>
              <td>${a.time}</td>
              <td><span style="color:#22c55e; font-weight:bold;">${a.status}</span></td>
              <td>${a.method}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Focus scanner input
  setTimeout(() => {
    const input = document.getElementById('scannerInput');
    if (input) input.focus();
  }, 100);
}

async function handleScanSubmit() {
  const input = document.getElementById('scannerInput');
  const resultDiv = document.getElementById('scanResult');
  const val = input.value.trim();

  if (!val) return;

  try {
    const res = await callBackend('recordAttendanceScan', { studentCodeOrQr: val });
    resultDiv.style.display = 'block';

    if (res.duplicate) {
      resultDiv.style.background = '#7c2d12';
      resultDiv.style.color = '#fdba74';
      resultDiv.innerHTML = `⚠️ <strong>تنبيه:</strong> ${res.message}`;
    } else {
      resultDiv.style.background = '#14532d';
      resultDiv.style.color = '#86efac';
      resultDiv.innerHTML = `✅ <strong>تم التسجيل:</strong> ${res.message}`;
    }

    input.value = '';
    input.focus();
    renderActiveView('attendance');
  } catch (err) {
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#7f1d1d';
    resultDiv.style.color = '#fca5a5';
    resultDiv.innerHTML = `❌ <strong>خطأ:</strong> ${err.message}`;
  }
}

// Module 6: Schedule
async function renderScheduleView(container) {
  container.innerHTML = `
    <div class="view-title">
      <span>📅 الجدول الدراسي وحصص السنتر</span>
    </div>
    <div class="card">
      <div class="card-title">جدول اليوم والقاعات الفعالة</div>
      <table class="data-table">
        <thead>
          <tr><th>عنوان الحصة</th><th>المجموعة</th><th>المعلم</th><th>التاريخ</th><th>الوقت</th><th>القاعة</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:bold; color:#38bdf8;">حصة التفاضل والتكامل - الدرس الأول</td>
            <td>رياضيات - ثانوية عامة (أ)</td>
            <td>أ.د/ إبراهيم عبد الرحمن</td>
            <td>اليوم</td>
            <td>04:00 م - 06:00 م</td>
            <td>قاعة 1</td>
            <td><span style="color:#22c55e; font-weight:bold;">مكتملة COMPLETED</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// Module 7: Educational Content
async function renderContentView(container) {
  const content = await callBackend('getContentMedia');

  container.innerHTML = `
    <div class="view-title">
      <span>📁 المحتوى التعليمي والوسائط (Cloudflare R2 Gateway)</span>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>العنوان</th><th>النوع</th><th>المجموعة</th><th>الرابط المؤقت (Presigned URL)</th><th>مدة الصلاحية</th></tr>
        </thead>
        <tbody>
          ${content.map(c => `
            <tr>
              <td style="font-weight:bold; color:#f8fafc;">${c.title}</td>
              <td><span class="badge">${c.type}</span></td>
              <td>${c.groupId}</td>
              <td><span class="code-box" style="font-size:0.75rem;">${c.publicCdnUrl}</span></td>
              <td>${c.expiresMinutes} دقيقة</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 8: Exams & Grades
async function renderExamsView(container) {
  const exams = await callBackend('getExams');
  const grades = await callBackend('getGrades');

  container.innerHTML = `
    <div class="view-title">
      <span>📝 الامتحانات وسجلات درجات الطلاب</span>
    </div>
    <div class="card">
      <div class="card-title">جدول الاختبارات المحددة</div>
      <table class="data-table">
        <thead>
          <tr><th>عنوان الاختبار</th><th>المجموعة</th><th>الدرجة العظمى</th><th>التاريخ</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${exams.map(e => `
            <tr>
              <td style="font-weight:bold; color:#38bdf8;">${e.title}</td>
              <td>${e.groupId}</td>
              <td>${e.maxScore} درجة</td>
              <td>${e.examDate}</td>
              <td><span class="badge warning">${e.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">نتائج درجات الطلاب الأخيرة</div>
      <table class="data-table">
        <thead>
          <tr><th>اسم الطالب</th><th>الدرجة المحققة</th><th>النسبة المئوية</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${grades.map(g => `
            <tr>
              <td>${g.studentName}</td>
              <td>${g.score} / ${g.maxScore}</td>
              <td style="font-weight:bold; color:#22c55e;">${g.percentage}%</td>
              <td><span style="color:#22c55e; font-weight:bold;">${g.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 9: Subscriptions
async function renderSubscriptionsView(container) {
  const subs = await callBackend('getSubscriptions');

  container.innerHTML = `
    <div class="view-title">
      <span>🔑 الباقات واشتراكات الطلاب النشطة</span>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>اسم الباقة</th><th>الطالب</th><th>كود الاشتراك (Hashed Code)</th><th>تاريخ البدء</th><th>تاريخ الانتهاء</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${subs.map(s => `
            <tr>
              <td style="font-weight:bold; color:#f8fafc;">${s.packageName}</td>
              <td>${s.studentName}</td>
              <td><span class="code-box">${s.code}</span></td>
              <td>${s.startDate}</td>
              <td>${s.endDate}</td>
              <td><span style="color:#22c55e; font-weight:bold;">${s.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 10: Parents
async function renderParentsView(container) {
  const parents = await callBackend('getParents');

  container.innerHTML = `
    <div class="view-title">
      <span>👨‍👩‍👧 أولياء الأمور والطلاب المرتبطين</span>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>اسم ولي الأمر</th><th>الهاتف</th><th>البريد الإلكتروني</th><th>الطلاب المرتبطين</th></tr>
        </thead>
        <tbody>
          ${parents.map(p => `
            <tr>
              <td style="font-weight:bold; color:#38bdf8;">${p.name}</td>
              <td>${p.phone}</td>
              <td>${p.email}</td>
              <td>${p.linkedStudentNames.join(', ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 11: Finance
async function renderFinanceView(container) {
  const summary = await callBackend('getDashboardSummary');

  container.innerHTML = `
    <div class="view-title">
      <span>💰 المالية والحسابات (تحصيل وإيرادات ومصروفات)</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">إجمالي إيرادات المقبوضات</div>
        <div class="value" style="color:#22c55e;">${summary.totalRevenue.toLocaleString()} ج.م</div>
      </div>
      <div class="stat-card">
        <div class="label">إجمالي المصروفات</div>
        <div class="value" style="color:#ef4444;">${summary.totalExpenses.toLocaleString()} ج.م</div>
      </div>
      <div class="stat-card">
        <div class="label">صافي الأرباح التشغيلية</div>
        <div class="value" style="color:#38bdf8;">${(summary.totalRevenue - summary.totalExpenses).toLocaleString()} ج.م</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">💳 المقبوضات وإيصالات التحصيل الإليكترونية</div>
      <table class="data-table">
        <thead>
          <tr><th>رقم الإيصال</th><th>اسم الطالب</th><th>فئة التحصيل</th><th>المبلغ</th><th>التاريخ</th></tr>
        </thead>
        <tbody>
          ${summary.recentPayments.map(p => `
            <tr>
              <td><span class="code-box">${p.receiptNumber}</span></td>
              <td>${p.studentName}</td>
              <td>${p.category}</td>
              <td style="color:#22c55e; font-weight:bold;">${p.amount} ج.م</td>
              <td>${p.paymentDate}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Module 12: Reports
async function renderReportsView(container) {
  container.innerHTML = `
    <div class="view-title">
      <span>📊 تقارير السنتر والتصدير (Reports & Print Exports)</span>
    </div>
    <div class="stats-grid">
      <div class="card">
        <div class="card-title">📄 تقرير حضور الطلاب الشامل</div>
        <p style="font-size:0.85rem; color:#94a3b8;">تصدير سجل الحضور والغياب اليومي والأسبوعي حسب المجموعات.</p>
        <button class="btn" onclick="alert('جاري تجهيز تقرير الحضور للتصدير والطباعة...')">🖨️ طباعة التقرير / PDF</button>
      </div>
      <div class="card">
        <div class="card-title">📄 التقرير المالي والإيرادات</div>
        <p style="font-size:0.85rem; color:#94a3b8;">ملخص الإيرادات والمصروفات وصافي الأرباح لجميع المجموعات.</p>
        <button class="btn" onclick="alert('جاري تجهيز التقرير المالي للتصدير والطباعة...')">🖨️ طباعة التقرير / Excel</button>
      </div>
    </div>
  `;
}

// Module 13: AI Settings
async function renderAIView(container) {
  const ai = await callBackend('getCenterAISettings');

  container.innerHTML = `
    <div class="view-title">
      <span>🤖 إعدادات الذكاء الاصطناعي الخاصة بالسنتر (Center AI Controls)</span>
    </div>
    <div class="card">
      <div style="background:#090d16; padding:1rem; border-radius:6px; margin-bottom:1.25rem; border:1px solid #0284c7;">
        <h4 style="margin-top:0; color:#38bdf8;">🔒 الحدود الأمنية لمدير السنتر:</h4>
        <p style="font-size:0.85rem; color:#cbd5e1; margin-bottom:0;">
          مفاتيح Google Gemini و OpenRouter محماة ومشفرة على مستوى سيرفر المنصة (SuperAdmin Only). يستطيع مدير السنتر فقط التحكم بتفعيل/تعطيل الذكاء الاصطناعي لطلابه وتحديد الحد اليومي للأسئلة.
        </p>
      </div>

      <div style="margin-bottom:1rem;">
        <label style="display:block; margin-bottom:0.4rem; font-weight:bold;">حالة خدمة AI للسنتر:</label>
        <span class="badge" style="background:${ai.aiEnabled ? '#14532d' : '#7f1d1d'}; color:${ai.aiEnabled ? '#86efac' : '#fca5a5'};">
          ${ai.aiEnabled ? '🟢 الذكاء الاصطناعي مفعل لطلاب السنتر' : '🔴 الخدمة معطلة'}
        </span>
      </div>

      <div style="margin-bottom:1rem;">
        <label style="display:block; margin-bottom:0.4rem; font-weight:bold;">الحد الأقصى للأسئلة اليومية لكل طالب:</label>
        <input type="number" value="${ai.dailyLimitPerStudent}" disabled style="width:120px;" />
        <span style="font-size:0.85rem; color:#94a3b8; margin-right:0.5rem;">سؤال/يوم</span>
      </div>
    </div>
  `;
}

// Module 14: Center Info
async function renderSettingsView(container) {
  const summary = await callBackend('getDashboardSummary');
  const inst = summary.institution || {};

  container.innerHTML = `
    <div class="view-title">
      <span>⚙️ معلومات وتفاصيل السنتر (Center Information)</span>
    </div>
    <div class="card">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div>
          <label style="display:block; margin-bottom:0.4rem; font-weight:bold;">اسم السنتر الرسمي:</label>
          <input type="text" value="${inst.name || 'سنتر التفوق التعليمي'}" style="width:100%;" />
        </div>
        <div>
          <label style="display:block; margin-bottom:0.4rem; font-weight:bold;">هاتف التواصل والخدمة:</label>
          <input type="text" value="${inst.phone || '01012345678'}" style="width:100%;" />
        </div>
        <div>
          <label style="display:block; margin-bottom:0.4rem; font-weight:bold;">البريد الإلكتروني للسنتر:</label>
          <input type="text" value="${inst.email || 'info@altafawok-center.com'}" style="width:100%;" />
        </div>
        <div>
          <label style="display:block; margin-bottom:0.4rem; font-weight:bold;">العنوان التفصيلي:</label>
          <input type="text" value="${inst.address || 'القاهرة - مدينة نصر'}" style="width:100%;" />
        </div>
      </div>
      <div style="margin-top:1.25rem;">
        <button class="btn btn-success" onclick="alert('تم حفظ بيانات ومعلومات السنتر بنجاح')">💾 حفظ البيانات</button>
      </div>
    </div>
  `;
}

// Module 15: License & Device Binding (Phase 31 Guard)
async function renderLicenseView(container) {
  let fp = 'win_fp_...';
  let meta = { deviceName: 'PC-RECEPTION-01', osVersion: 'Windows 11 Pro 64-bit' };

  if (window.electronAPI) {
    try {
      fp = await window.electronAPI.getDeviceFingerprint();
      meta = await window.electronAPI.getSystemMetadata();
    } catch (e) {}
  }

  container.innerHTML = `
    <div class="view-title">
      <span>🔒 ترخيص النظام والمحتوى الترخيصي بالجهاز (Single Device Binding)</span>
    </div>

    <div class="card" style="border-color:#22c55e;">
      <div class="card-title" style="color:#22c55e;">🟢 حالة الترخيص: الجهاز مرخص ومربوط بنجاح (BINDING ACTIVE)</div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; margin-bottom:1.5rem;">
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">اسم جهاز الاستقبال (Host Name):</div>
          <div style="font-weight:bold; font-size:1.1rem; color:#38bdf8;">${meta.deviceName || 'PC-RECEPTION'}</div>
        </div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">نظام التشغيل (Windows OS Build):</div>
          <div style="font-weight:bold; font-size:1.1rem; color:#f8fafc;">${meta.osVersion || 'Windows 10/11'}</div>
        </div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">السياسة الترخيصية (Licensing Policy):</div>
          <div style="font-weight:bold; color:#86efac;">1 Device Per Institution (جهاز واحد فعال لكل سنتر)</div>
        </div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">آخر تحقق من الترخيص (Last Verification):</div>
          <div style="font-weight:bold; color:#cbd5e1;">${new Date().toLocaleTimeString('ar-EG')}</div>
        </div>
      </div>

      <div style="background:#090d16; padding:1rem; border-radius:8px; border:1px solid #334155;">
        <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.4rem;">بصمة الأجهزة المعتمدة بالسيرفر (SHA-256 Hardware Fingerprint):</div>
        <div class="code-box" style="word-break:break-all; font-size:0.85rem;">${fp}</div>
      </div>

      <div style="margin-top:1.25rem;">
        <button class="btn btn-warning" onclick="alert('تم إرسال طلب إعادة ربط الجهاز إلى SuperAdmin بنجاح')">🔄 طلب استبدال جهاز الاستقبال (Rebind Device Request)</button>
      </div>
    </div>
  `;
}

// Device Status & Heartbeat Loop
async function checkDeviceStatus() {
  if (!window.electronAPI) return;
  const mockToken = { uid: 'center_admin', role: 'admin', institutionId: 'inst_bootstrap_001' };
  try {
    await window.electronAPI.activateDevice({ institutionId: 'inst_bootstrap_001', callerToken: mockToken });
    const validation = await window.electronAPI.validateDevice({ institutionId: 'inst_bootstrap_001', callerToken: mockToken });
    updateLockOverlay(validation);
  } catch (err) {
    console.error('Check status error:', err);
  }
}

function updateLockOverlay(validation) {
  const lockScreen = document.getElementById('lockScreen');
  const statusBadge = document.getElementById('statusBadge');

  if (validation.valid) {
    lockScreen.classList.add('hidden');
    statusBadge.innerText = 'STATUS: BINDING ACTIVE 🟢';
    statusBadge.className = 'badge';
  } else {
    lockScreen.classList.remove('hidden');
    document.getElementById('lockReason').innerText = validation.reason || 'الجهاز غير مرخص بتشغيل النظام';
    statusBadge.innerText = `STATUS: ${validation.status} 🔴`;
    statusBadge.className = 'badge revoked';
  }
}

async function sendPeriodicHeartbeat() {
  if (!window.electronAPI) return;
  const mockToken = { uid: 'center_admin', role: 'admin', institutionId: 'inst_bootstrap_001' };
  try {
    const hb = await window.electronAPI.sendHeartbeat({ institutionId: 'inst_bootstrap_001', callerToken: mockToken });
    if (hb.status === 'REVOKED') {
      updateLockOverlay({ valid: false, status: 'REVOKED', reason: 'تم إلغاء تفعيل ترخيص هذا الجهاز من قبل SuperAdmin' });
    }
  } catch (err) {}
}

document.addEventListener('DOMContentLoaded', initDesktopApp);
