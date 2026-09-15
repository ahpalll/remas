/**
 * REMAS Educational Center SaaS — Windows Desktop Client Renderer Controller
 * Production-Grade Renderer connected to Real Backend & SuperAdmin Platform Console
 * Version: 1.0.0-release.45.0
 */

let activeRole = null;
let activeView = 'dashboard';
let currentCallerToken = null;

document.addEventListener('DOMContentLoaded', () => {
  initDesktopApp();
});

async function initDesktopApp() {
  setupNetworkMonitoring();

  if (!currentCallerToken) {
    const loginOverlay = document.getElementById('loginScreenOverlay');
    if (loginOverlay) loginOverlay.style.display = 'flex';
    const mainView = document.getElementById('mainView');
    if (mainView) mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">الرجاء تسجيل الدخول أولاً للوصول للنظام.</div>';
    return;
  }

  renderSidebarNav();

  if (window.electronAPI) {
    try {
      await checkDeviceStatus();
    } catch (err) {}
  }

  await renderActiveView(activeView);
}

async function handleLoginSubmit() {
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const loginAlert = document.getElementById('loginAlert');
  const loginForm = document.getElementById('loginForm');
  const spinner = document.getElementById('loginLoadingSpinner');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  loginAlert.style.display = 'none';
  loginForm.style.display = 'none';
  spinner.style.display = 'block';

  try {
    const session = await callBackend('authenticateUser', { email, password });
    currentCallerToken = session;
    activeRole = session.role;

    // Update Header Badges
    const emailBadge = document.getElementById('userEmailBadge');
    if (emailBadge) emailBadge.innerText = session.email;
    
    const roleBadge = document.getElementById('userRoleBadge');
    const roleTitle = session.role === 'superAdmin' ? 'SuperAdmin Platform' : (session.role === 'admin' ? 'مدير النظام' : 'مالك السنتر');
    if (roleBadge) roleBadge.innerText = roleTitle;

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.style.display = 'inline-block';

    // Hide Login Screen Overlay
    const loginOverlay = document.getElementById('loginScreenOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';

    // Set Active View based on Authorized Role
    if (session.role === 'superAdmin') {
      activeView = 'superadmin_dashboard';
    } else {
      activeView = 'dashboard';
    }

    renderSidebarNav();
    await renderActiveView(activeView);
    showToast(`تم تسجيل الدخول بنجاح بحساب ${session.email}`);
  } catch (err) {
    spinner.style.display = 'none';
    loginForm.style.display = 'block';
    loginAlert.innerText = err.message || 'فشل تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.';
    loginAlert.style.display = 'block';
  }
}

async function logoutAction() {
  try {
    await callBackend('logoutUser', currentCallerToken);
  } catch (err) {}

  currentCallerToken = null;
  activeRole = null;

  const emailBadge = document.getElementById('userEmailBadge');
  if (emailBadge) emailBadge.innerText = 'مستخدم غير مسجل';
  const roleBadge = document.getElementById('userRoleBadge');
  if (roleBadge) roleBadge.innerText = 'غير موثق';
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.style.display = 'none';

  const loginForm = document.getElementById('loginForm');
  const spinner = document.getElementById('loginLoadingSpinner');
  const loginAlert = document.getElementById('loginAlert');
  if (loginForm) loginForm.style.display = 'block';
  if (spinner) spinner.style.display = 'none';
  if (loginAlert) loginAlert.style.display = 'none';

  const loginOverlay = document.getElementById('loginScreenOverlay');
  if (loginOverlay) loginOverlay.style.display = 'flex';
  const mainView = document.getElementById('mainView');
  if (mainView) mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">تم تسجيل الخروج. الرجاء تسجيل الدخول أولاً للوصول للنظام.</div>';
  showToast('تم تسجيل الخروج بنجاح.');
}

function renderSidebarNav() {
  const title = document.getElementById('sidebarTitle');
  const nav = document.getElementById('sidebarNav');

  if (activeRole === 'superAdmin') {
    if (title) title.innerText = 'لوحة المنصة (SuperAdmin Platform)';
    if (nav) nav.innerHTML = `
      <li class="nav-item ${activeView === 'superadmin_dashboard' ? 'active' : ''}" onclick="navigate('superadmin_dashboard')">📊 لوحة المنصة الشاملة</li>
      <li class="nav-item ${activeView === 'superadmin_institutions' ? 'active' : ''}" onclick="navigate('superadmin_institutions')">🏢 إدارة المراكز والمؤسسات</li>
      <li class="nav-item ${activeView === 'superadmin_devices' ? 'active' : ''}" onclick="navigate('superadmin_devices')">💻 الأجهزة والتراخيص</li>
      <li class="nav-item ${activeView === 'superadmin_ai' ? 'active' : ''}" onclick="navigate('superadmin_ai')">🤖 مزودات الذكاء الاصطناعي</li>
      <li class="nav-item ${activeView === 'superadmin_branding' ? 'active' : ''}" onclick="navigate('superadmin_branding')">🎨 إدارة الهوية والمؤسسات</li>
      <li class="nav-item ${activeView === 'superadmin_audit' ? 'active' : ''}" onclick="navigate('superadmin_audit')">📜 سجل أحداث المنصة Audit Logs</li>
    `;
  } else {
    if (title) title.innerText = 'إدارة السنتر (Center Admin)';
    if (nav) nav.innerHTML = `
      <li class="nav-item ${activeView === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">📈 لوحة التحكم</li>
      <li class="nav-item ${activeView === 'students' ? 'active' : ''}" onclick="navigate('students')">🎓 إدارة الطلاب</li>
      <li class="nav-item ${activeView === 'teachers' ? 'active' : ''}" onclick="navigate('teachers')">👨‍🏫 المعلمون</li>
      <li class="nav-item ${activeView === 'groups' ? 'active' : ''}" onclick="navigate('groups')">📚 المجموعات والمواد</li>
      <li class="nav-item ${activeView === 'attendance' ? 'active' : ''}" onclick="navigate('attendance')">📋 كشك الحضور والغياب</li>
      <li class="nav-item ${activeView === 'schedule' ? 'active' : ''}" onclick="navigate('schedule')">🗓️ جدول الحصص</li>
      <li class="nav-item ${activeView === 'finance' ? 'active' : ''}" onclick="navigate('finance')">💰 المالية والحسابات</li>
      <li class="nav-item ${activeView === 'content' ? 'active' : ''}" onclick="navigate('content')">📖 المحتوى التعليمي</li>
      <li class="nav-item ${activeView === 'exams' ? 'active' : ''}" onclick="navigate('exams')">📝 الاختبارات والدرجات</li>
      <li class="nav-item ${activeView === 'subscriptions' ? 'active' : ''}" onclick="navigate('subscriptions')">🎟️ الاشتراكات والباقات</li>
      <li class="nav-item ${activeView === 'parents' ? 'active' : ''}" onclick="navigate('parents')">👨‍👩‍👧 أولياء الأمور</li>
      <li class="nav-item ${activeView === 'branding' ? 'active' : ''}" onclick="navigate('branding')">🎨 الهوية والعلامة التجارية</li>
      <li class="nav-item ${activeView === 'center_info' ? 'active' : ''}" onclick="navigate('center_info')">⚙️ معلومات السنتر</li>
      <li class="nav-item ${activeView === 'license' ? 'active' : ''}" onclick="navigate('license')">🔒 الترخيص والجهاز</li>
    `;
  }
}

function navigate(viewName) {
  activeView = viewName;
  renderSidebarNav();
  renderActiveView(activeView);
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
    throw new Error(res ? res.error : 'فشل تنفيذ الخدمة على الخادم');
  }

  // Simulation mode fallback if electronAPI bridge is absent
  console.log(`[Simulation] ${method}:`, args);
  return null;
}

function showToast(msg, isError = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  if (isError) {
    toast.style.background = '#7f1d1d';
    toast.style.borderColor = '#ef4444';
    toast.style.color = '#fca5a5';
  }
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ----------------------------------------------------------------------------
// VIEW RENDERERS
// ----------------------------------------------------------------------------

async function renderActiveView(view) {
  const mainView = document.getElementById('mainView');
  mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">جاري تحميل البيانات من Firestore...</div>';

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
      case 'finance':
        await renderFinanceView(mainView);
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
      case 'branding':
        await renderBrandingView(mainView);
        break;
      case 'center_info':
        await renderCenterInfoView(mainView);
        break;
      case 'license':
        await renderLicenseView(mainView);
        break;
      // SuperAdmin Platform Views
      case 'superadmin_dashboard':
        await renderSuperAdminDashboardView(mainView);
        break;
      case 'superadmin_institutions':
        await renderSuperAdminInstitutionsView(mainView);
        break;
      case 'superadmin_devices':
        await renderSuperAdminDevicesView(mainView);
        break;
      case 'superadmin_ai':
        await renderSuperAdminAIView(mainView);
        break;
      case 'superadmin_branding':
        await renderSuperAdminBrandingView(mainView);
        break;
      case 'superadmin_audit':
        await renderSuperAdminAuditView(mainView);
        break;
      default:
        mainView.innerHTML = '<div style="padding:2rem;">الصفحة غير موجودة</div>';
    }
  } catch (err) {
    mainView.innerHTML = `<div class="card" style="border-color:#ef4444;"><h3 style="color:#ef4444;">خطأ في تحميل البيانات</h3><p>${err.message}</p></div>`;
  }
}

// 1. Center Dashboard
async function renderDashboardView(container) {
  const summary = await callBackend('getDashboardSummary', currentCallerToken, currentCallerToken.institutionId);

  container.innerHTML = `
    <div class="view-title">
      <span>📈 لوحة التحكم والإحصائيات الحقيقية</span>
      <button class="btn" onclick="renderActiveView('dashboard')">🔄 تحديث البيانات</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">إجمالي الطلاب النشطين</div>
        <div class="value">${summary ? summary.studentsCount : 0}</div>
      </div>
      <div class="stat-card">
        <div class="label">إجمالي المعلمين</div>
        <div class="value">${summary ? summary.teachersCount : 0}</div>
      </div>
      <div class="stat-card">
        <div class="label">المجموعات الدراسية</div>
        <div class="value">${summary ? summary.groupsCount : 0}</div>
      </div>
      <div class="stat-card">
        <div class="label">تحصيل اليوم (جنيه)</div>
        <div class="value" style="color:#22c55e;">${summary ? summary.todayIncome : 0} ج.م</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
      <div class="card">
        <div class="card-title">آخر عمليات التحصيل المالي (Firestore)</div>
        ${renderPaymentsTable(summary ? summary.recentPayments : [])}
      </div>
      <div class="card">
        <div class="card-title">آخر سجلات الحضور والغياب (Firestore)</div>
        ${renderAttendanceTable(summary ? summary.recentAttendance : [])}
      </div>
    </div>
  `;
}

// 2. Students View
async function renderStudentsView(container) {
  const students = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId });

  container.innerHTML = `
    <div class="view-title">
      <span>🎓 إدارة الطلاب وسجلات التسجيل</span>
      <button class="btn btn-success" onclick="openAddStudentModal()">+ إضافة طالب جديد</button>
    </div>
    ${students && students.length > 0 ? `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>كود الطالب</th>
              <th>الاسم الكامل</th>
              <th>رقم الهاتف</th>
              <th>هاتف ولي الأمر</th>
              <th>الصف الدراسي</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td><span class="code-box">${s.studentCode || s.id}</span></td>
                <td><strong>${s.name}</strong></td>
                <td>${s.phone || '-'}</td>
                <td>${s.guardianPhone || '-'}</td>
                <td>${s.grade}</td>
                <td><span class="badge">${s.status}</span></td>
                <td>
                  <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openEditStudentModal('${s.id}')">تعديل</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveStudentAction('${s.id}')">أرشفة</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎓</div>
        <h3 style="color: #f8fafc; margin:0 0 0.5rem 0;">لا يوجد طلاب حتى الآن</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">اضغط على زر "إضافة طالب جديد" لإنشاء أول سجل طالب حقيقي في Firestore.</p>
        <button class="btn btn-success" onclick="openAddStudentModal()">+ إضافة طالب جديد الآن</button>
      </div>
    `}
  `;
}

// 3. Teachers View
async function renderTeachersView(container) {
  const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId });

  container.innerHTML = `
    <div class="view-title">
      <span>👨‍🏫 أعضاء هيئة التدريس والمعلمون</span>
      <button class="btn btn-success" onclick="openAddTeacherModal()">+ إضافة معلم جديد</button>
    </div>
    ${teachers && teachers.length > 0 ? `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>معرف المعلم</th>
              <th>اسم المعلم</th>
              <th>رقم الهاتف</th>
              <th>المادة التخصصية</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${teachers.map(t => `
              <tr>
                <td><span class="code-box">${t.id}</span></td>
                <td><strong>${t.name}</strong></td>
                <td>${t.phone || '-'}</td>
                <td>${t.subject}</td>
                <td><span class="badge">${t.status}</span></td>
                <td>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveTeacherAction('${t.id}')">أرشفة</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">👨‍🏫</div>
        <h3 style="color: #f8fafc; margin:0 0 0.5rem 0;">لا يوجد معلمون حتى الآن</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">قم بإضافة المعلمين لتخصيص المجموعات والمواد الدراسية.</p>
        <button class="btn btn-success" onclick="openAddTeacherModal()">+ إضافة معلم جديد</button>
      </div>
    `}
  `;
}

// 4. Groups View
async function renderGroupsView(container) {
  const groups = await callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId });

  container.innerHTML = `
    <div class="view-title">
      <span>📚 المجموعات والقاعات الدراسية</span>
      <button class="btn btn-success" onclick="openAddGroupModal()">+ إنشاء مجموعة جديدة</button>
    </div>
    ${groups && groups.length > 0 ? `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>كود المجموعة</th>
              <th>اسم المجموعة</th>
              <th>المادة</th>
              <th>المعلم المسؤول</th>
              <th>السعة القصوى</th>
              <th>المواعيد والقاعة</th>
              <th>الرسوم الشهري</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map(g => `
              <tr>
                <td><span class="code-box">${g.id}</span></td>
                <td><strong>${g.name}</strong></td>
                <td>${g.subjectName || '-'}</td>
                <td>${g.teacherName || '-'}</td>
                <td>${g.maxCapacity} طالب</td>
                <td>${g.schedule} (${g.room})</td>
                <td>${g.monthlyFee} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">📚</div>
        <h3 style="color: #f8fafc; margin:0 0 0.5rem 0;">لا توجد مجموعات دراسية مسجلة</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">أنشئ المجموعات وتحديد السعة القصوى لضبط تسجيل الطلاب.</p>
        <button class="btn btn-success" onclick="openAddGroupModal()">+ إنشاء مجموعة جديدة</button>
      </div>
    `}
  `;
}

// 5. Attendance View
async function renderAttendanceView(container) {
  const records = await callBackend('getAttendanceRecords', currentCallerToken, { institutionId: currentCallerToken.institutionId });

  container.innerHTML = `
    <div class="view-title">
      <span>📋 كشك الحضور والغياب والسحب السريع</span>
      <button class="btn btn-success" onclick="openRecordAttendanceModal()">+ تسجيل حضور يدوي / باركود</button>
    </div>
    <div class="card">
      <div class="card-title">سجلات الحضور لليوم (Firestore)</div>
      ${renderAttendanceTable(records || [])}
    </div>
  `;
}

// 6. Finance View
async function renderFinanceView(container) {
  const payments = await callBackend('getPayments', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  const expenses = await callBackend('getExpenses', currentCallerToken, { institutionId: currentCallerToken.institutionId });

  const totalInc = (payments || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalExp = (expenses || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);

  container.innerHTML = `
    <div class="view-title">
      <span>💰 المالية والحسابات السندات الإيصالات</span>
      <div>
        <button class="btn btn-success" onclick="openRecordPaymentModal()">+ تسجيل تحصيل نقدية</button>
        <button class="btn btn-warning" onclick="openRecordExpenseModal()">+ تسجيل مصروفات</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">إجمالي المقبوضات</div><div class="value" style="color:#22c55e;">${totalInc} ج.م</div></div>
      <div class="stat-card"><div class="label">إجمالي المصروفات</div><div class="value" style="color:#ef4444;">${totalExp} ج.م</div></div>
      <div class="stat-card"><div class="label">صافي الخزينة</div><div class="value" style="color:#38bdf8;">${totalInc - totalExp} ج.م</div></div>
    </div>
    <div class="card">
      <div class="card-title">سجل المقبوضات المالية والإيصالات</div>
      ${renderPaymentsTable(payments || [])}
    </div>
  `;
}

// 7. Schedule View
async function renderScheduleView(container) {
  const sessions = await callBackend('getSessions', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  container.innerHTML = `
    <div class="view-title">
      <span>🗓️ جدول الحصص اليومية والأسبوعية</span>
    </div>
    <div class="card">
      ${sessions && sessions.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>عنوان الحصة</th><th>التاريخ والوقت</th><th>القاعة</th><th>الحالة</th></tr></thead>
          <tbody>
            ${sessions.map(s => `<tr><td>${s.title}</td><td>${s.date} (${s.startTime} - ${s.endTime})</td><td>${s.room}</td><td><span class="badge">${s.status}</span></td></tr>`).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا توجد حصص مجدولة لليوم.</p>'}
    </div>
  `;
}

// 8. Content View
async function renderContentView(container) {
  const content = await callBackend('getContent', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  container.innerHTML = `
    <div class="view-title"><span>📖 المحتوى التعليمي والوسائط</span></div>
    <div class="card">
      ${content && content.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>عنوان المحتوى</th><th>النوع</th><th>تاريخ الرفع</th></tr></thead>
          <tbody>${content.map(c => `<tr><td>${c.title}</td><td>${c.type}</td><td>${c.createdAt}</td></tr>`).join('')}</tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا يوجد محتوى متاح حالياً.</p>'}
    </div>
  `;
}

// 9. Exams View
async function renderExamsView(container) {
  const exams = await callBackend('getExams', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  container.innerHTML = `
    <div class="view-title"><span>📝 الاختبارات والنتائج</span></div>
    <div class="card">
      ${exams && exams.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>عنوان الاختبار</th><th>الدرجة النهائية</th><th>تاريخ الاختبار</th></tr></thead>
          <tbody>${exams.map(x => `<tr><td>${x.title}</td><td>${x.maxScore} درجة</td><td>${x.examDate}</td></tr>`).join('')}</tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا توجد اختبارات مسجلة.</p>'}
    </div>
  `;
}

// 10. Subscriptions View
async function renderSubscriptionsView(container) {
  const subs = await callBackend('getSubscriptions', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  container.innerHTML = `
    <div class="view-title"><span>🎟️ الاشتراكات الأكواد الحزم</span></div>
    <div class="card">
      ${subs && subs.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>كود الاشتراك</th><th>الباقة</th><th>اسم الطالب</th><th>الحالة</th></tr></thead>
          <tbody>${subs.map(s => `<tr><td><span class="code-box">${s.code}</span></td><td>${s.packageName}</td><td>${s.studentName}</td><td><span class="badge">${s.status}</span></td></tr>`).join('')}</tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا توجد اشتراكات مفعّلة.</p>'}
    </div>
  `;
}

// 11. Parents View
async function renderParentsView(container) {
  const parents = await callBackend('getParents', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  container.innerHTML = `
    <div class="view-title"><span>👨‍👩‍👧 أولياء الأمور والربط</span></div>
    <div class="card">
      ${parents && parents.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>اسم ولي الأمر</th><th>رقم الهاتف</th><th>الطلاب المرتبطين</th></tr></thead>
          <tbody>${parents.map(p => `<tr><td>${p.name}</td><td>${p.phone}</td><td>${(p.linkedStudentNames || []).join(', ')}</td></tr>`).join('')}</tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا توجد حسابات أولياء أمور مسجلة.</p>'}
    </div>
  `;
}

// 12. Center Info View
async function renderCenterInfoView(container) {
  const info = await callBackend('getCenterInfo', currentCallerToken, currentCallerToken.institutionId);
  container.innerHTML = `
    <div class="view-title"><span>⚙️ معلومات السنتر والترويس</span></div>
    <div class="card" style="max-width:600px;">
      <div class="form-group"><label>اسم السنتر</label><input type="text" id="infoName" value="${info ? info.name : ''}"></div>
      <div class="form-group"><label>رقم الهاتف</label><input type="text" id="infoPhone" value="${info ? info.phone : ''}"></div>
      <div class="form-group"><label>العنوان</label><input type="text" id="infoAddress" value="${info ? info.address : ''}"></div>
      <div class="form-group"><label>ترويسة الإيصال</label><input type="text" id="infoReceipt" value="${info ? info.receiptHeader : ''}"></div>
      <button class="btn btn-success" onclick="saveCenterInfoAction()">حفظ التغيرات في Firestore</button>
    </div>
  `;
}

// 13. License View
async function renderLicenseView(container) {
  const lic = await callBackend('getLicenseStatus', currentCallerToken, currentCallerToken.institutionId);
  container.innerHTML = `
    <div class="view-title"><span>🔒 الترخيص وبصمة الجهاز</span></div>
    <div class="card" style="max-width:600px;">
      <p><strong>معرف المؤسسة:</strong> <span class="code-box">${currentCallerToken.institutionId}</span></p>
      <p><strong>حالة الترخيص:</strong> <span class="badge">${lic ? lic.status : 'ACTIVE'}</span></p>
      <p><strong>فترة السماح الأوفلاين:</strong> ${lic ? lic.graceHoursRemaining : 72} ساعة</p>
    </div>
  `;
}

// ============================================================================
// SUPERADMIN PLATFORM CONSOLE VIEW RENDERERS
// ============================================================================

async function renderSuperAdminDashboardView(container) {
  const ov = await callBackend('getSuperAdminPlatformOverview', currentCallerToken);

  container.innerHTML = `
    <div class="view-title">
      <span>👑 لوحة المنصة الشاملة (SuperAdmin Platform Overview)</span>
      <button class="btn" onclick="renderActiveView('superadmin_dashboard')">🔄 تحديث مؤشرات المنصة</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">إجمالي المراكز بالمنصة</div><div class="value" style="color:#38bdf8;">${ov ? ov.totalInstitutions : 0}</div></div>
      <div class="stat-card"><div class="label">المراكز النشطة</div><div class="value" style="color:#22c55e;">${ov ? ov.activeInstitutions : 0}</div></div>
      <div class="stat-card"><div class="label">المراكز المجمدة</div><div class="value" style="color:#ef4444;">${ov ? ov.suspendedInstitutions : 0}</div></div>
      <div class="stat-card"><div class="label">الأجهزة المربوطة</div><div class="value">${ov ? ov.totalDevices : 0}</div></div>
    </div>
    <div class="card">
      <div class="card-title">حالة المنصة والذكاء الاصطناعي</div>
      <p><strong>مزود AI النشط:</strong> ${ov ? ov.activeProvider : '-'}</p>
      <p><strong>استهلاك تخزين R2:</strong> ${ov ? ov.storageUsageGb : 0} GB</p>
      <p><strong>حالة تشغيل النظام:</strong> <span class="badge">${ov ? ov.platformStatus : 'OPERATIONAL'}</span></p>
    </div>
  `;
}

async function renderSuperAdminInstitutionsView(container) {
  const insts = await callBackend('getInstitutions', currentCallerToken);

  container.innerHTML = `
    <div class="view-title">
      <span>🏢 إدارة المراكز والمؤسسات المسجلة بالمنصة</span>
      <button class="btn btn-success" onclick="openCreateInstitutionModal()">+ إنشاء سنتر / مؤسسة جديدة</button>
    </div>
    ${insts && insts.length > 0 ? `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>معرف السنتر</th>
              <th>اسم المؤسسة</th>
              <th>اسم المالك</th>
              <th>الباقة</th>
              <th>الحالة</th>
              <th>إجراءات SuperAdmin</th>
            </tr>
          </thead>
          <tbody>
            ${insts.map(i => `
              <tr>
                <td><span class="code-box">${i.id}</span></td>
                <td><strong>${i.name}</strong></td>
                <td>${i.ownerName || '-'}</td>
                <td>${i.plan || 'ENTERPRISE'}</td>
                <td><span class="badge ${i.status === 'SUSPENDED' ? 'revoked' : ''}">${i.status}</span></td>
                <td>
                  ${i.status === 'SUSPENDED' ? `
                    <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="activateInstAction('${i.id}')">تفعيل الحساب</button>
                  ` : `
                    <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="suspendInstAction('${i.id}')">تجميد السنتر</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="text-align:center; padding:3.5rem;">
        <h3 style="color:#f8fafc;">لا توجد مؤسسات مسجلة في المنصة</h3>
        <button class="btn btn-success" onclick="openCreateInstitutionModal()">+ إنشاء أول سنتر بالمنصة</button>
      </div>
    `}
  `;
}

async function renderSuperAdminDevicesView(container) {
  const devices = await callBackend('getDevices', currentCallerToken);
  container.innerHTML = `
    <div class="view-title"><span>💻 تراخيص الأجهزة وبصمات الكمبيوتر</span></div>
    <div class="card">
      ${devices && devices.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>معرف الجهاز</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${devices.map(d => `
              <tr>
                <td><span class="code-box">${d.deviceId}</span></td>
                <td><span class="badge ${d.status === 'REVOKED' ? 'revoked' : ''}">${d.status}</span></td>
                <td>
                  ${d.status === 'REVOKED' ? `
                    <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="rebindDeviceAction('${d.deviceId}')">إعادة الربط</button>
                  ` : `
                    <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="revokeDeviceAction('${d.deviceId}')">إلغاء الربط</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا توجد تراخيص أجهزة مسجلة حالياً.</p>'}
    </div>
  `;
}

async function renderSuperAdminAIView(container) {
  container.innerHTML = `
    <div class="view-title"><span>🤖 إعدادات مزودات الذكاء الاصطناعي بالمنصة</span></div>
    <div class="card">
      <div class="card-title">Google Gemini + OpenRouter Routing Engine</div>
      <p><strong>Primary Provider:</strong> Google Gemini (gemini-2.5-flash)</p>
      <p><strong>Fallback Provider:</strong> OpenRouter (Auto-Failover on 5xx/429)</p>
      <p><strong>Secret Storage:</strong> Server-Side Secret Manager Vault (Zero Client Exposure)</p>
    </div>
  `;
}

async function renderSuperAdminAuditView(container) {
  const logs = await callBackend('getPlatformAuditLogs', currentCallerToken);
  container.innerHTML = `
    <div class="view-title"><span>📜 سجل أحداث المنصة الأمنية Audit Logs</span></div>
    <div class="card">
      ${logs && logs.length > 0 ? `
        <table class="data-table">
          <thead><tr><th>الحدث</th><th>المستخدم والفاعل</th><th>المؤسسة Target</th><th>التاريخ</th></tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td><strong>${l.action}</strong></td>
                <td>${l.actorUid} (${l.actorRole})</td>
                <td><span class="code-box">${l.institutionId}</span></td>
                <td>${l.timestamp}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#94a3b8; text-align:center;">لا توجد أحداث مسجلة في سجل التدقيق.</p>'}
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODALS AND FORM HANDLERS
// ----------------------------------------------------------------------------

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

// Student Modal
function openAddStudentModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إضافة طالب جديد في Firestore</div>
        <div class="form-group"><label>الاسم الكامل للطالب *</label><input type="text" id="mStudentName" placeholder="مثال: أحمد محمد علي"></div>
        <div class="form-group"><label>رقم هاتف الطالب</label><input type="text" id="mStudentPhone" placeholder="01011112222"></div>
        <div class="form-group"><label>هاتف ولي الأمر</label><input type="text" id="mGuardianPhone" placeholder="01122223333"></div>
        <div class="form-group"><label>اسم ولي الأمر</label><input type="text" id="mGuardianName" placeholder="محمد علي"></div>
        <div class="form-group">
          <label>الصف الدراسي</label>
          <select id="mStudentGrade">
            <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
            <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
            <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitAddStudent()">حفظ الطالب في Firestore</button>
        </div>
      </div>
    </div>
  `;
}

async function submitAddStudent() {
  const name = document.getElementById('mStudentName').value;
  const phone = document.getElementById('mStudentPhone').value;
  const guardianPhone = document.getElementById('mGuardianPhone').value;
  const guardianName = document.getElementById('mGuardianName').value;
  const grade = document.getElementById('mStudentGrade').value;

  try {
    const res = await callBackend('createStudent', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name,
      phone,
      guardianPhone,
      guardianName,
      grade
    });

    closeModal();
    showToast(`تم حفظ الطالب ${res.name} بنجاح في Firestore!`);
    await renderActiveView('students');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function archiveStudentAction(id) {
  if (!confirm('هل أنت تأكد من أرشفة سجل الطالب؟')) return;
  try {
    await callBackend('archiveStudent', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة الطالب بنجاح');
    await renderActiveView('students');
  } catch (err) {
    showToast(err.message, true);
  }
}

// Teacher Modal
function openAddTeacherModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إضافة معلم جديد في Firestore</div>
        <div class="form-group"><label>اسم المعلم *</label><input type="text" id="mTchName" placeholder="أ.د/ إبراهيم عبد الرحمن"></div>
        <div class="form-group"><label>رقم الهاتف</label><input type="text" id="mTchPhone" placeholder="01099998888"></div>
        <div class="form-group"><label>المادة التخصصية</label><input type="text" id="mTchSubject" placeholder="الرياضيات المشتقات والتفاضل"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitAddTeacher()">حفظ المعلم</button>
        </div>
      </div>
    </div>
  `;
}

async function submitAddTeacher() {
  const name = document.getElementById('mTchName').value;
  const phone = document.getElementById('mTchPhone').value;
  const subject = document.getElementById('mTchSubject').value;

  try {
    const res = await callBackend('createTeacher', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name,
      phone,
      subject
    });

    closeModal();
    showToast(`تم حفظ المعلم ${res.name} بنجاح في Firestore!`);
    await renderActiveView('teachers');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function archiveTeacherAction(id) {
  if (!confirm('أرشفة سجل المعلم؟')) return;
  try {
    await callBackend('archiveTeacher', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة المعلم');
    await renderActiveView('teachers');
  } catch (err) { showToast(err.message, true); }
}

// Group Modal
function openAddGroupModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إنشاء مجموعة دراسية جديدة</div>
        <div class="form-group"><label>اسم المجموعة *</label><input type="text" id="mGrpName" placeholder="رياضيات - ثانوية عامة (أ)"></div>
        <div class="form-group"><label>السعة القصوى (عدد الطلاب)</label><input type="number" id="mGrpCapacity" value="30"></div>
        <div class="form-group"><label>المواعيد والقاعة</label><input type="text" id="mGrpSchedule" value="الأحد والأربعاء 04:00 مساءً (قاعة 1)"></div>
        <div class="form-group"><label>الرسوم الشهري (جنيه)</label><input type="number" id="mGrpFee" value="350"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitAddGroup()">إنشاء المجموعة في Firestore</button>
        </div>
      </div>
    </div>
  `;
}

async function submitAddGroup() {
  const name = document.getElementById('mGrpName').value;
  const maxCapacity = document.getElementById('mGrpCapacity').value;
  const schedule = document.getElementById('mGrpSchedule').value;
  const monthlyFee = document.getElementById('mGrpFee').value;

  try {
    const res = await callBackend('createGroup', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name,
      maxCapacity,
      schedule,
      monthlyFee
    });

    closeModal();
    showToast(`تم إنشاء المجموعة ${res.name} بنجاح!`);
    await renderActiveView('groups');
  } catch (err) { showToast(err.message, true); }
}

// Attendance Modal
function openRecordAttendanceModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ تسجيل حضور طالب (باركود / يدوي)</div>
        <div class="form-group"><label>كود / معرف الطالب (Student ID / QR) *</label><input type="text" id="mAttStudentId" placeholder="STU_1001"></div>
        <div class="form-group"><label>اسم الطالب</label><input type="text" id="mAttStudentName" placeholder="أحمد محمد علي"></div>
        <div class="form-group">
          <label>الحالة</label>
          <select id="mAttStatus">
            <option value="PRESENT">حاضر (PRESENT)</option>
            <option value="LATE">متأخر (LATE)</option>
            <option value="EXCUSED">بعذر (EXCUSED)</option>
            <option value="ABSENT">غائب (ABSENT)</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitRecordAttendance()">تسجيل الحضور</button>
        </div>
      </div>
    </div>
  `;
}

async function submitRecordAttendance() {
  const studentId = document.getElementById('mAttStudentId').value;
  const studentName = document.getElementById('mAttStudentName').value;
  const status = document.getElementById('mAttStatus').value;

  try {
    const res = await callBackend('recordAttendance', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      studentId,
      studentName,
      status
    });

    closeModal();
    showToast(`تم تسجيل حضور الطالب (${res.studentId}) بنجاح!`);
    await renderActiveView('attendance');
  } catch (err) { showToast(err.message, true); }
}

// Finance Modals
function openRecordPaymentModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ تسجيل تحصيل نقدية وإصدار إيصال</div>
        <div class="form-group"><label>اسم الطالب</label><input type="text" id="mPayStudentName" placeholder="أحمد محمد علي"></div>
        <div class="form-group"><label>المبلغ (جنيه) *</label><input type="number" id="mPayAmount" value="350"></div>
        <div class="form-group"><label>البيان / الفئة</label><input type="text" id="mPayCategory" value="مصاريف دراسية شهرية"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitRecordPayment()">حفظ وحفظ الإيصال</button>
        </div>
      </div>
    </div>
  `;
}

async function submitRecordPayment() {
  const studentName = document.getElementById('mPayStudentName').value;
  const amount = document.getElementById('mPayAmount').value;
  const category = document.getElementById('mPayCategory').value;

  try {
    const res = await callBackend('recordPayment', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      studentName,
      amount,
      category
    });

    closeModal();
    showToast(`تم تحصيل مبلغ ${res.amount} ج.م وإصدار إيصال (${res.receiptNumber})!`);
    await renderActiveView('finance');
  } catch (err) { showToast(err.message, true); }
}

function openRecordExpenseModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ تسجيل مصروف تشغيلي للسنتر</div>
        <div class="form-group"><label>بند المصروفات</label><input type="text" id="mExpCategory" placeholder="إيجار القاعات / كهرباء"></div>
        <div class="form-group"><label>المبلغ (جنيه) *</label><input type="number" id="mExpAmount" placeholder="1000"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-warning" onclick="submitRecordExpense()">تسجيل المصروف</button>
        </div>
      </div>
    </div>
  `;
}

async function submitRecordExpense() {
  const category = document.getElementById('mExpCategory').value;
  const amount = document.getElementById('mExpAmount').value;

  try {
    const res = await callBackend('recordExpense', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      category,
      amount
    });

    closeModal();
    showToast(`تم تسجيل مصروف ${res.amount} ج.م بنجاح!`);
    await renderActiveView('finance');
  } catch (err) { showToast(err.message, true); }
}

// SuperAdmin Institution Modal
function openCreateInstitutionModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إنشاء سنتر / مؤسسة تعليمية بالمنصة</div>
        <div class="form-group"><label>اسم المؤسسة / السنتر *</label><input type="text" id="mInstName" placeholder="سنتر التفوق التعليمي"></div>
        <div class="form-group"><label>اسم مالك السنتر</label><input type="text" id="mInstOwner" placeholder="أ.د/ إبراهيم عبد الرحمن"></div>
        <div class="form-group"><label>رقم الهاتف</label><input type="text" id="mInstPhone" placeholder="01012345678"></div>
        <div class="form-group">
          <label>باقة الاشتراك</label>
          <select id="mInstPlan">
            <option value="ENTERPRISE">ENTERPRISE (باقة كاملة)</option>
            <option value="PRO">PRO</option>
            <option value="BASIC">BASIC</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitCreateInstitution()">إنشاء المؤسسة بالمنصة</button>
        </div>
      </div>
    </div>
  `;
}

async function submitCreateInstitution() {
  const name = document.getElementById('mInstName').value;
  const ownerName = document.getElementById('mInstOwner').value;
  const phone = document.getElementById('mInstPhone').value;
  const plan = document.getElementById('mInstPlan').value;

  try {
    const res = await callBackend('createInstitution', currentCallerToken, {
      name,
      ownerName,
      phone,
      plan
    });

    closeModal();
    showToast(`تم إنشاء السنتر (${res.name}) وتخصيص المعرف ${res.id}!`);
    await renderActiveView('superadmin_institutions');
  } catch (err) { showToast(err.message, true); }
}

async function suspendInstAction(id) {
  if (!confirm(`هل أنت تأكد من تجميد حساب السنتر ${id}؟`)) return;
  try {
    await callBackend('suspendInstitution', currentCallerToken, id);
    showToast(`تم تجميد حساب المؤسسة ${id}`);
    await renderActiveView('superadmin_institutions');
  } catch (err) { showToast(err.message, true); }
}

async function activateInstAction(id) {
  try {
    await callBackend('activateInstitution', currentCallerToken, id);
    showToast(`تم إعادة تفعيل حساب المؤسسة ${id}`);
    await renderActiveView('superadmin_institutions');
  } catch (err) { showToast(err.message, true); }
}

async function revokeDeviceAction(deviceId) {
  if (!confirm('إلغاء ربط كود الترخيص من هذا الكمبيوتر؟')) return;
  try {
    await callBackend('revokeDeviceBinding', currentCallerToken, deviceId);
    showToast('تم إلغاء ترخيص الجهاز');
    await renderActiveView('superadmin_devices');
  } catch (err) { showToast(err.message, true); }
}

async function rebindDeviceAction(deviceId) {
  try {
    await callBackend('rebindDeviceBinding', currentCallerToken, deviceId);
    showToast('تمت إعادة تفعيل ربط الجهاز');
    await renderActiveView('superadmin_devices');
  } catch (err) { showToast(err.message, true); }
}

async function saveCenterInfoAction() {
  const name = document.getElementById('infoName').value;
  const phone = document.getElementById('infoPhone').value;
  const address = document.getElementById('infoAddress').value;
  const receiptHeader = document.getElementById('infoReceipt').value;

  try {
    await callBackend('updateCenterInfo', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name,
      phone,
      address,
      receiptHeader
    });
    showToast('تم حفظ بيانات السنتر في Firestore بنجاح');
  } catch (err) { showToast(err.message, true); }
}

// Helpers
function renderPaymentsTable(list) {
  if (!list || list.length === 0) return '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">لا توجد مدفوعات مسجلة.</p>';
  return `
    <table class="data-table">
      <thead><tr><th>رقم الإيصال</th><th>اسم الطالب</th><th>البيان</th><th>المبلغ</th></tr></thead>
      <tbody>${list.map(p => `<tr><td><span class="code-box">${p.receiptNumber || p.id}</span></td><td>${p.studentName}</td><td>${p.category}</td><td style="color:#22c55e; font-weight:bold;">${p.amount} ج.م</td></tr>`).join('')}</tbody>
    </table>
  `;
}

function renderAttendanceTable(list) {
  if (!list || list.length === 0) return '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">لا توجد سجلات حضور لاليوم.</p>';
  return `
    <table class="data-table">
      <thead><tr><th>اسم الطالب</th><th>الوقت</th><th>الحالة</th><th>الوسيلة</th></tr></thead>
      <tbody>${list.map(a => `<tr><td>${a.studentName || a.studentId}</td><td>${a.time}</td><td><span class="badge">${a.status}</span></td><td>${a.method}</td></tr>`).join('')}</tbody>
    </table>
  `;
}

async function checkDeviceStatus() {
  if (window.electronAPI && typeof window.electronAPI.getDeviceStatus === 'function') {
    const st = await window.electronAPI.getDeviceStatus();
    const badge = document.getElementById('deviceBindingBadge');
    const lock = document.getElementById('lockScreen');

    if (st && st.status === 'REVOKED') {
      badge.innerText = 'الجهاز ملغى 🛑';
      badge.className = 'badge revoked';
      lock.style.display = 'flex';
    } else {
      badge.innerText = 'جهاز مفعل ومربوط 🔒';
      badge.className = 'badge';
      lock.style.display = 'none';
    }
  }
}

// ----------------------------------------------------------------------------
// BRANDING VIEW RENDERERS & ACTIONS (PHASE 39)
// ----------------------------------------------------------------------------

async function renderBrandingView(container) {
  let b = {};
  try {
    b = await callBackend('getBranding', currentCallerToken, currentCallerToken.institutionId);
  } catch (e) {
    b = {
      centerName: 'سنتر التفوق التعليمي',
      colors: { primary: '#0F172A', secondary: '#0284C7', accent: '#D97706', backgroundColor: '#FFFFFF' },
      loginTitle: 'مرحباً بكم في المنظومة التعليمية',
      loginSubtitle: 'منظومة المتابعة والإدارة',
      welcomeMessage: 'إدارة أذكى.. تعليم أفضل'
    };
  }

  container.innerHTML = `
    <div class="view-title">
      <span>🎨 الهوية والعلامة التجارية (White-Label Branding)</span>
      <span class="badge" style="background:#0284C7; color:#fff;">REMAS EDU Platform Powered</span>
    </div>
    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div class="stat-card">
        <div class="card-title">تخصيص هوية السنتر</div>
        <form onsubmit="event.preventDefault(); saveBrandingAction();">
          <div class="form-group">
            <label>اسم السنتر الظاهر:</label>
            <input type="text" id="brandCenterName" value="${b.centerName || ''}" required>
          </div>
          <div class="form-group" style="display:flex; gap:1rem;">
            <div style="flex:1;">
              <label>اللون الرئيسي (Primary):</label>
              <input type="color" id="brandPrimaryColor" value="${b.colors ? b.colors.primary : '#0F172A'}" style="height:40px; padding:2px; cursor:pointer;" onchange="updateLivePreview()">
            </div>
            <div style="flex:1;">
              <label>اللون الثانوي (Secondary):</label>
              <input type="color" id="brandSecondaryColor" value="${b.colors ? b.colors.secondary : '#0284C7'}" style="height:40px; padding:2px; cursor:pointer;" onchange="updateLivePreview()">
            </div>
            <div style="flex:1;">
              <label>لون التمييز (Accent):</label>
              <input type="color" id="brandAccentColor" value="${b.colors ? b.colors.accent : '#D97706'}" style="height:40px; padding:2px; cursor:pointer;" onchange="updateLivePreview()">
            </div>
          </div>
          <div class="form-group">
            <label>عنوان شاشة الدخول:</label>
            <input type="text" id="brandLoginTitle" value="${b.loginTitle || ''}" oninput="updateLivePreview()">
          </div>
          <div class="form-group">
            <label>الوصف الفرعي لشاشة الدخول:</label>
            <input type="text" id="brandLoginSubtitle" value="${b.loginSubtitle || ''}" oninput="updateLivePreview()">
          </div>
          <div class="form-group">
            <label>رسالة الترحيب:</label>
            <input type="text" id="brandWelcomeMessage" value="${b.welcomeMessage || ''}" oninput="updateLivePreview()">
          </div>
          <div class="form-group">
            <label>رفع الشعار (PNG, JPEG, WebP - max 5MB):</label>
            <input type="file" id="brandLogoFile" accept="image/png,image/jpeg,image/webp">
          </div>
          <button type="submit" class="btn btn-success" style="width:100%; margin-top:1rem;">💾 حفظ الهوية وتفعيل التغييرات في Firestore</button>
        </form>
      </div>

      <div class="stat-card">
        <div class="card-title">معاينة حية للواجهة (Live Branding Preview)</div>
        <div id="brandingLivePreview" style="background:#0a192f; border:2px solid #0284c7; border-radius:10px; padding:1.5rem; text-align:center; color:#fff;">
          <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.5rem;">REMAS EDU Platform Identity</div>
          <div id="previewCenterName" style="font-size:1.4rem; font-weight:bold; color:#38bdf8; margin-bottom:0.5rem;">${b.centerName || 'اسم السنتر'}</div>
          <div id="previewLoginTitle" style="font-size:1.1rem; font-weight:600; margin-bottom:0.25rem;">${b.loginTitle || 'عنوان شاشة الدخول'}</div>
          <div id="previewLoginSubtitle" style="font-size:0.85rem; color:#94a3b8; margin-bottom:1rem;">${b.loginSubtitle || 'الوصف الفرعي'}</div>
          <div id="previewWelcome" style="background:#0f172a; padding:0.75rem; border-radius:6px; border-right:4px solid #d97706; font-size:0.9rem; margin-bottom:1rem;">
            ${b.welcomeMessage || 'رسالة الترحيب'}
          </div>
          <div style="display:flex; gap:0.5rem; justify-content:center;">
            <button id="previewBtnPrimary" style="background:#0f172a; color:#fff; border:none; padding:0.5rem 1rem; border-radius:4px; font-weight:bold;">الزر الرئيسي</button>
            <button id="previewBtnSecondary" style="background:#0284c7; color:#fff; border:none; padding:0.5rem 1rem; border-radius:4px; font-weight:bold;">الزر الثانوي</button>
            <button id="previewBtnAccent" style="background:#d97706; color:#fff; border:none; padding:0.5rem 1rem; border-radius:4px; font-weight:bold;">تمييز</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateLivePreview() {
  const name = document.getElementById('brandCenterName').value || 'اسم السنتر';
  const primary = document.getElementById('brandPrimaryColor').value || '#0F172A';
  const secondary = document.getElementById('brandSecondaryColor').value || '#0284C7';
  const accent = document.getElementById('brandAccentColor').value || '#D97706';
  const title = document.getElementById('brandLoginTitle').value || 'عنوان الدخول';
  const subtitle = document.getElementById('brandLoginSubtitle').value || 'الوصف الفرعي';
  const welcome = document.getElementById('brandWelcomeMessage').value || 'رسالة الترحيب';

  const previewName = document.getElementById('previewCenterName');
  if (previewName) previewName.innerText = name;
  const previewTitle = document.getElementById('previewLoginTitle');
  if (previewTitle) previewTitle.innerText = title;
  const previewSubtitle = document.getElementById('previewLoginSubtitle');
  if (previewSubtitle) previewSubtitle.innerText = subtitle;
  const previewWelcome = document.getElementById('previewWelcome');
  if (previewWelcome) {
    previewWelcome.innerText = welcome;
    previewWelcome.style.borderRightColor = accent;
  }
  const btnP = document.getElementById('previewBtnPrimary');
  if (btnP) btnP.style.background = primary;
  const btnS = document.getElementById('previewBtnSecondary');
  if (btnS) btnS.style.background = secondary;
  const btnA = document.getElementById('previewBtnAccent');
  if (btnA) btnA.style.background = accent;
}

async function saveBrandingAction() {
  const centerName = document.getElementById('brandCenterName').value;
  const primaryColor = document.getElementById('brandPrimaryColor').value;
  const secondaryColor = document.getElementById('brandSecondaryColor').value;
  const accentColor = document.getElementById('brandAccentColor').value;
  const loginTitle = document.getElementById('brandLoginTitle').value;
  const loginSubtitle = document.getElementById('brandLoginSubtitle').value;
  const welcomeMessage = document.getElementById('brandWelcomeMessage').value;

  try {
    let logoAssetId = undefined;
    const fileInput = document.getElementById('brandLogoFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const uploaded = await callBackend('uploadBrandingAsset', currentCallerToken, {
        institutionId: currentCallerToken.institutionId,
        assetType: 'logo',
        fileMeta: { fileName: file.name, mimeType: file.type, sizeBytes: file.size }
      });
      logoAssetId = uploaded.assetId;
    }

    await callBackend('updateBranding', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      centerName,
      primaryColor,
      secondaryColor,
      accentColor,
      loginTitle,
      loginSubtitle,
      welcomeMessage,
      logoAssetId
    });

    showToast('تم حفظ واختبار هوية السنتر بنجاح في Firestore');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function renderSuperAdminBrandingView(container) {
  let list = [];
  try {
    list = await callBackend('getInstitutions', currentCallerToken);
  } catch (err) { list = []; }

  container.innerHTML = `
    <div class="view-title">
      <span>🎨 لوحة منصة رِماس - إدارة الهوية والمؤسسات</span>
      <span class="badge" style="background:#d97706; color:#000;">SuperAdmin Authority</span>
    </div>

    <div class="stat-card" style="margin-bottom: 1.5rem; border-right: 4px solid #0284c7;">
      <div class="card-title">REMAS EDU Official Brand Assets Status</div>
      <div style="font-weight:bold; color:#ef4444; margin-bottom:0.5rem;">BLOCKED — REQUIRED BRAND ASSET FILES</div>
      <p style="color:#94a3b8; font-size:0.85rem; margin:0;">
        الأصول البصرية المطلوبة للهوية المنصية الرسمية:
        <code>remas_logo_primary</code>, <code>remas_logo_horizontal</code>, <code>remas_logo_arabic</code>, <code>remas_icon</code>, <code>remas_splash_logo</code>, <code>remas_app_icon</code>
      </p>
    </div>

    <div class="stat-card">
      <div class="card-title">هويات المراكز المسجلة على المنصة (${list.length})</div>
      ${list.length === 0 ? '<p style="color:#94a3b8; padding:1rem; text-align:center;">لا توجد مؤسسات مسجلة.</p>' : `
        <table class="data-table">
          <thead>
            <tr><th>معرف المؤسسة</th><th>اسم السنتر</th><th>الحالة</th><th>إعادة ضبط الهوية (Reset)</th></tr>
          </thead>
          <tbody>
            ${list.map(inst => `
              <tr>
                <td><span class="code-box">${inst.id}</span></td>
                <td><strong>${inst.name}</strong></td>
                <td><span class="badge">${inst.status}</span></td>
                <td>
                  <button class="btn btn-warning" onclick="resetInstitutionBrandingAction('${inst.id}')">🔄 Reset to REMAS Default</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

async function resetInstitutionBrandingAction(instId) {
  try {
    await callBackend('resetBranding', currentCallerToken, instId);
    showToast('تمت إعادة ضبط هوية المؤسسة لإعدادات منصة رِماس الافتراضية');
    await renderSuperAdminBrandingView(document.getElementById('mainView'));
  } catch (err) {
    showToast(err.message, true);
  }
}

