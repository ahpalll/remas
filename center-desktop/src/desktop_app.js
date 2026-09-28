/**
 * REMAS Educational Center SaaS — Windows Desktop Client Renderer Controller
 * Production-Grade Renderer connected to Real Backend & SuperAdmin Platform Console
 * Version: 1.0.0-release.50.4.0 — Batch A Students+Groups+Enrollment
 */

let activeRole = null;
let activeView = 'dashboard';
let currentCallerToken = null;

function isPasswordChangeRequired() {
  return currentCallerToken && currentCallerToken.mustChangePassword === true;
}

function hideAllBlockingOverlays() {
  const loginOverlay = document.getElementById('loginScreenOverlay');
  const mandatoryOverlay = document.getElementById('mandatoryPasswordOverlay');
  const lockScreen = document.getElementById('lockScreen');
  if (loginOverlay) loginOverlay.style.display = 'none';
  if (mandatoryOverlay) mandatoryOverlay.style.display = 'none';
  if (lockScreen) lockScreen.style.display = 'none';
}

function showMandatoryPasswordScreen() {
  hideAllBlockingOverlays();
  const overlay = document.getElementById('mandatoryPasswordOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.zIndex = '1000';
  }
  // Ensure lockScreen does not cover mandatory
  const lockScreen = document.getElementById('lockScreen');
  if (lockScreen) lockScreen.style.display = 'none';
  const mainView = document.getElementById('mainView');
  if (mainView) mainView.innerHTML = '<div style="color:#f59e0b; text-align:center; padding:3rem;">🔒 مطلوب تغيير كلمة المرور أولاً للمتابعة. يرجى إكمال النموذج أعلاه.</div>';
  renderSidebarNav();
  setTimeout(() => {
    const cur = document.getElementById('currentPasswordInput');
    if (cur) cur.focus();
  }, 100);
}

function showLoginScreen() {
  hideAllBlockingOverlays();
  const loginOverlay = document.getElementById('loginScreenOverlay');
  if (loginOverlay) {
    loginOverlay.style.display = 'flex';
    loginOverlay.style.zIndex = '998';
  }
  setTimeout(() => {
    const email = document.getElementById('loginEmail');
    if (email) email.focus();
  }, 100);
}

function hideMandatoryPasswordScreen() {
  const overlay = document.getElementById('mandatoryPasswordOverlay');
  if (overlay) overlay.style.display = 'none';
  const alertEl = document.getElementById('pwdChangeAlert');
  if (alertEl) { alertEl.style.display = 'none'; alertEl.innerText = ''; }
  const successEl = document.getElementById('pwdChangeSuccess');
  if (successEl) { successEl.style.display = 'none'; successEl.innerText = ''; }
  const form = document.getElementById('mandatoryPasswordForm');
  if (form) form.reset();
}

document.addEventListener('DOMContentLoaded', () => {
  initDesktopApp();
});

async function initDesktopApp() {
  setupNetworkMonitoring();

  if (!currentCallerToken) {
    showLoginScreen();
    const mainView = document.getElementById('mainView');
    if (mainView) mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">الرجاء تسجيل الدخول أولاً للوصول للنظام.</div>';
    return;
  }

  renderSidebarNav();

  if (window.electronAPI) {
    try {
      await checkDeviceStatus();
    } catch (err) {
      console.error('[initDesktopApp] checkDeviceStatus error:', err.message);
    }
  }

  if (isPasswordChangeRequired()) {
    showMandatoryPasswordScreen();
    return;
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

    // Set Active View based on Authorized Role — enforce mandatory password change before any dashboard access
    if (session.mustChangePassword === true) {
      // DO NOT render dashboard/modules — force password change screen
      activeView = 'dashboard';
      renderSidebarNav();
      // Ensure login overlay hidden, show mandatory screen
      spinner.style.display = 'none';
      loginForm.style.display = 'block';
      const loginOverlay = document.getElementById('loginScreenOverlay');
      if (loginOverlay) loginOverlay.style.display = 'none';
      showMandatoryPasswordScreen();
      showToast('يجب تغيير كلمة المرور المؤقتة قبل المتابعة', true);
      return;
    }

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
    // Show technical error type in console for debugging, but keep Arabic user message
    const errorCode = err.code || err.message ? err.message.split(':')[0] : 'UNKNOWN';
    console.error('[Login Error] code:', errorCode, 'message:', err.message);
    switch (errorCode) {
      case 'ELECTRON_BRIDGE_UNAVAILABLE':
        loginAlert.innerText = 'تعذر الاتصال بالخادم — اتصال الجسر الإلكتروني غير متاح';
        break;
      case 'INVALID_CREDENTIALS':
        loginAlert.innerText = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        break;
      case 'TENANT_RESOLUTION_FAILED':
        loginAlert.innerText = 'تعذر تحديد المؤسسة — ملف المستخدم غير صحيح';
        break;
      case 'UNAUTHORIZED_ROLE':
        loginAlert.innerText = 'هذا الحساب غير مصرح له بالدخول لتطبيق سطح المكتب';
        break;
      default:
        loginAlert.innerText = err.message || 'فشل تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.';
    }
    loginAlert.style.display = 'block';
    setTimeout(() => {
      const email = document.getElementById('loginEmail');
      if (email) email.focus();
    }, 100);
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

  hideMandatoryPasswordScreen();
  showLoginScreen();
  const mainView = document.getElementById('mainView');
  if (mainView) mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">تم تسجيل الخروج. الرجاء تسجيل الدخول أولاً للوصول للنظام.</div>';
  showToast('تم تسجيل الخروج بنجاح.');
}

async function handleMandatoryPasswordChange() {
  const currentInput = document.getElementById('currentPasswordInput');
  const newInput = document.getElementById('newPasswordInput');
  const confirmInput = document.getElementById('confirmPasswordInput');
  const alertEl = document.getElementById('pwdChangeAlert');
  const successEl = document.getElementById('pwdChangeSuccess');
  const spinner = document.getElementById('pwdChangeSpinner');
  const form = document.getElementById('mandatoryPasswordForm');
  const btn = document.getElementById('btnChangePassword');

  if (!currentInput || !newInput || !confirmInput) return;

  const currentPassword = currentInput.value;
  const newPassword = newInput.value;
  const confirmPassword = confirmInput.value;

  alertEl.style.display = 'none';
  successEl.style.display = 'none';

  // Client-side validation (no password logging)
  if (!currentPassword || !newPassword || !confirmPassword) {
    alertEl.innerText = 'جميع الحقول مطلوبة';
    alertEl.style.display = 'block';
    return;
  }
  if (newPassword.length < 6) {
    alertEl.innerText = 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل';
    alertEl.style.display = 'block';
    return;
  }
  if (newPassword !== confirmPassword) {
    alertEl.innerText = 'تأكيد كلمة المرور غير متطابق';
    alertEl.style.display = 'block';
    return;
  }
  if (newPassword === currentPassword) {
    alertEl.innerText = 'كلمة المرور الجديدة يجب أن تختلف عن الحالية';
    alertEl.style.display = 'block';
    return;
  }

  form.style.display = 'none';
  spinner.style.display = 'block';
  btn.disabled = true;

  try {
    // Order: Firebase Auth update MUST succeed before Firestore flag clear (handled in service)
    const res = await callBackend('changeOwnerPassword', { currentPassword, newPassword, confirmPassword });
    // Success: clear flag, update local token, hide overlay, proceed to dashboard
    if (currentCallerToken) currentCallerToken.mustChangePassword = false;
    hideMandatoryPasswordScreen();
    // Re-render navigation and dashboard
    renderSidebarNav();
    await renderActiveView('dashboard');
    showToast('تم تغيير كلمة المرور بنجاح — مرحباً بك في لوحة التحكم');
    if (res && res.warning) {
      showToast(res.warning, true);
    }
  } catch (err) {
    // DO NOT clear mustChangePassword on failure — remain blocked
    spinner.style.display = 'none';
    form.style.display = 'block';
    btn.disabled = false;
    // Safe error message without exposing credentials
    let msg = err.message || 'فشل تغيير كلمة المرور';
    // Sanitize: never include password values
    if (msg.includes('INVALID_CURRENT_PASSWORD')) msg = 'كلمة المرور الحالية غير صحيحة';
    else if (msg.includes('INVALID_PASSWORD')) msg = 'كلمة المرور الجديدة ضعيفة — يجب أن تكون 6 أحرف على الأقل';
    else if (msg.includes('PASSWORD_MISMATCH')) msg = 'تأكيد كلمة المرور غير متطابق';
    else if (msg.includes('SAME_PASSWORD')) msg = 'كلمة المرور الجديدة يجب أن تختلف عن الحالية';
    else if (msg.includes('requires-recent-login') || msg.includes('auth/requires-recent-login')) msg = 'انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى ثم المحاولة';
    alertEl.innerText = msg;
    alertEl.style.display = 'block';
  } finally {
    spinner.style.display = 'none';
    if (form.style.display === 'none' && alertEl.style.display === 'block') {
      form.style.display = 'block';
    }
    btn.disabled = false;
  }
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
    // Block full navigation when mandatory password change is pending
    if (isPasswordChangeRequired()) {
      if (title) title.innerText = 'إدارة السنتر — تغيير كلمة المرور مطلوب';
      if (nav) nav.innerHTML = `
        <li class="nav-item active" style="background:#7c2d12; color:#fdba74;">🔒 تغيير كلمة المرور مطلوب</li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;">📈 لوحة التحكم (مغلق)</li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;">🏫 الإعداد الأكاديمي (مغلق)</li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;">🎓 إدارة الطلاب (مغلق)</li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;">👨‍🏫 المعلمون (مغلق)</li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;">📚 المجموعات والمواد (مغلق)</li>
      `;
      return;
    }
    if (title) title.innerText = 'إدارة السنتر (Center Admin)';
    if (nav) nav.innerHTML = `
      <li class="nav-item ${activeView === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">📈 لوحة التحكم</li>
      <li class="nav-item ${activeView === 'academic' ? 'active' : ''}" onclick="navigate('academic')">🏫 الإعداد الأكاديمي</li>
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
  if (isPasswordChangeRequired()) {
    showMandatoryPasswordScreen();
    showToast('يجب تغيير كلمة المرور المؤقتة أولاً قبل الوصول لأي قسم', true);
    return;
  }
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

  // Production: electronAPI bridge is required — do not silently fall back
  throw new Error(`ELECTRON_BRIDGE_UNAVAILABLE: electron bridge service unavailable for '${method}'`);
}

function showToast(msg, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) { alert(msg); return; }
  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  if (isError) {
    toast.style.background = '#7f1d1d';
    toast.style.borderColor = '#ef4444';
    toast.style.color = '#fca5a5';
  }
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ----------------------------------------------------------------------------
// BATCH A HELPERS (Phase 50.4) — canonical IDs, Arabic errors, name resolution
// ----------------------------------------------------------------------------
function friendlyBatchAError(err) {
  const raw = (err && err.message) ? err.message : String(err || 'حدث خطأ');
  if (raw.includes('GROUP_FULL') || raw.includes('GROUP_CAPACITY_EXCEEDED') || raw.includes('FULL_GROUP')) {
    const m = raw.match(/\((\d+)\/(\d+)\)/);
    return m ? `المجموعة ممتلئة ولا توجد مقاعد متاحة (${m[1]}/${m[2]})` : 'المجموعة ممتلئة ولا توجد مقاعد متاحة';
  }
  if (raw.includes('DUPLICATE_ENROLLMENT')) return 'الطالب مسجل بالفعل في هذه المجموعة';
  if (raw.includes('STAGE_GROUP_MISMATCH') || raw.includes('STAGE_ACADEMIC_YEAR_MISMATCH')) return 'المجموعة المحددة تنتمي لمرحلة مختلفة — يلزم معالجة صريحة قبل الحفظ';
  if (raw.includes('CROSS_TENANT')) return 'لا يمكن استخدام سجل من مؤسسة أخرى';
  if (raw.includes('INACTIVE_GROUP')) return 'المجموعة غير نشطة أو مؤرشفة ولا تقبل تسجيلات جديدة';
  if (raw.includes('INACTIVE_STUDENT')) return 'الطالب مؤرشف ولا يمكن تسجيله في مجموعات';
  if (raw.includes('INACTIVE_TEACHER')) return 'المعلم المحدد غير نشط أو مؤرشف';
  if (raw.includes('INACTIVE_SUBJECT')) return 'المادة الدراسية المحددة مؤرشفة';
  if (raw.includes('INACTIVE_STAGE')) return 'المرحلة الدراسية المحددة مؤرشفة';
  if (raw.includes('INACTIVE_ROOM')) return 'القاعة المحددة مؤرشفة';
  if (raw.includes('CAPACITY_BELOW_ENROLLED')) return raw.split(':')[1] || 'لا يمكن تقليل السعة عن عدد المسجلين حالياً';
  if (raw.includes('HAS_DEPENDENCIES')) return 'لا يمكن الحذف لأن هناك سجلات مرتبطة بهذا العنصر. استخدم الأرشفة بدلاً من الحذف';
  if (raw.includes('DUPLICATE_STUDENT')) return 'يوجد طالب بنفس رقم الهاتف مسجل مسبقاً في هذا المركز';
  if (raw.includes('INVALID_PHONE') || raw.includes('INVALID_GUARDIAN_PHONE')) return 'رقم الهاتف غير صالح — يجب أن يكون رقماً مصرياً صحيحاً (مثال: 01012345678)';
  if (raw.includes('NOT_FOUND')) return 'السجل المطلوب غير موجود';
  if (raw.includes('PERMISSION') || raw.includes('UNAUTHENTICATED') || raw.includes('UNAUTHORIZED')) return 'غير مصرح — تحقق من الصلاحيات وتسجيل الدخول';
  if (raw.includes('NETWORK') || raw.includes('unavailable')) return 'تعذر الاتصال — تحقق من الإنترنت وحاول مجدداً';
  const parts = raw.split(':');
  return parts.length > 1 ? parts.slice(1).join(':').trim() : raw;
}

function escapeHtmlAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function canonicalIdsOf(student) {
  if (student && Array.isArray(student.groupIds)) return student.groupIds;
  if (student && typeof student.groupId === 'string' && student.groupId) return [student.groupId];
  return [];
}

// ----------------------------------------------------------------------------
// VIEW RENDERERS
// ----------------------------------------------------------------------------

async function renderActiveView(view) {
  // Enforce mandatory password change — block all center modules
  if (isPasswordChangeRequired()) {
    showMandatoryPasswordScreen();
    return;
  }
  const mainView = document.getElementById('mainView');
  mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">جاري تحميل البيانات من Firestore...</div>';

  try {
    switch (view) {
      case 'dashboard':
        await renderDashboardView(mainView);
        break;
      case 'academic':
        await renderAcademicView(mainView);
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

// 1.5 Academic Structure View (Academic Years, Stages, Subjects, Rooms)
let currentAcademicTab = 'years';
let academicSearchQuery = '';

async function renderAcademicView(container) {
  try {
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];

    const q = (academicSearchQuery || '').toLowerCase().trim();

    const filteredYears = years.filter(y => !q || (y.name || '').toLowerCase().includes(q) || (y.id || '').toLowerCase().includes(q) || (y.status || '').toLowerCase().includes(q));
    const filteredStages = stages.filter(s => !q || (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q) || (s.status || '').toLowerCase().includes(q));
    const filteredSubjects = subjects.filter(sb => !q || (sb.name || '').toLowerCase().includes(q) || (sb.code || '').toLowerCase().includes(q) || (sb.status || '').toLowerCase().includes(q));
    const filteredRooms = rooms.filter(r => !q || (r.name || '').toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q) || (r.status || '').toLowerCase().includes(q));

    container.innerHTML = `
      <div class="view-title">
        <span>🏫 الإعداد الأكاديمي للمركز التعليمي</span>
        <div>
          ${currentAcademicTab === 'years' ? `<button class="btn btn-success" onclick="openAddAcademicYearModal()">+ إضافة سنة دراسية</button>` : ''}
          ${currentAcademicTab === 'stages' ? `<button class="btn btn-success" onclick="openAddStageModal()">+ إضافة مرحلة دراسية</button>` : ''}
          ${currentAcademicTab === 'subjects' ? `<button class="btn btn-success" style="background:#8b5cf6;" onclick="openAddSubjectModal()">+ إضافة مادة دراسية</button>` : ''}
          ${currentAcademicTab === 'rooms' ? `<button class="btn btn-success" style="background:#0284c7;" onclick="openAddRoomModal()">+ إضافة قاعة جديدة</button>` : ''}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn ${currentAcademicTab === 'years' ? 'btn-primary' : ''}" style="background:${currentAcademicTab === 'years' ? '#0284c7' : '#334155'};" onclick="switchAcademicTab('years')">📅 السنوات الدراسية (${years.length})</button>
          <button class="btn ${currentAcademicTab === 'stages' ? 'btn-primary' : ''}" style="background:${currentAcademicTab === 'stages' ? '#0284c7' : '#334155'};" onclick="switchAcademicTab('stages')">🏫 المراحل الدراسية (${stages.length})</button>
          <button class="btn ${currentAcademicTab === 'subjects' ? 'btn-primary' : ''}" style="background:${currentAcademicTab === 'subjects' ? '#0284c7' : '#334155'};" onclick="switchAcademicTab('subjects')">📖 المواد الدراسية (${subjects.length})</button>
          <button class="btn ${currentAcademicTab === 'rooms' ? 'btn-primary' : ''}" style="background:${currentAcademicTab === 'rooms' ? '#0284c7' : '#334155'};" onclick="switchAcademicTab('rooms')">🏛️ القاعات (${rooms.length})</button>
        </div>
        <div style="min-width:240px;">
          <input type="text" id="academicSearchInput" value="${academicSearchQuery}" placeholder="🔍 بحث بالسجل..." style="width:100%; padding:0.55rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="onAcademicSearch(this.value)">
        </div>
      </div>

      ${currentAcademicTab === 'years' ? renderYearsSection(filteredYears) : ''}
      ${currentAcademicTab === 'stages' ? renderStagesSection(filteredStages, years) : ''}
      ${currentAcademicTab === 'subjects' ? renderSubjectsSection(filteredSubjects, stages, years) : ''}
      ${currentAcademicTab === 'rooms' ? renderRoomsSection(filteredRooms) : ''}
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="border-color:#ef4444;"><h3 style="color:#ef4444;">خطأ في تحميل الإعداد الأكاديمي</h3><p>${err.message}</p></div>`;
  }
}

function switchAcademicTab(tabName) {
  currentAcademicTab = tabName;
  const mainView = document.getElementById('mainView');
  renderAcademicView(mainView);
}

function onAcademicSearch(val) {
  academicSearchQuery = val;
  const mainView = document.getElementById('mainView');
  renderAcademicView(mainView);
}

function renderYearsSection(years) {
  return `
    <div class="card">
      <div class="card-title">السنوات الدراسية والأكاديمية بالسنتر</div>
      ${years && years.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>معرف السنة</th>
              <th>اسم السنة الدراسية</th>
              <th>تاريخ البداية</th>
              <th>تاريخ النهاية</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${years.map(y => `
              <tr>
                <td><span class="code-box">${y.id}</span></td>
                <td><strong>${y.name}</strong></td>
                <td>${y.startDate || '-'}</td>
                <td>${y.endDate || '-'}</td>
                <td>
                  <span class="badge" style="background:${y.status === 'ACTIVE' ? '#14532d' : '#7f1d1d'}; color:${y.status === 'ACTIVE' ? '#86efac' : '#fca5a5'};">
                    ${y.status === 'ACTIVE' ? 'نشطة (ACTIVE)' : 'معطلة (INACTIVE)'}
                  </span>
                </td>
                <td style="display:flex; gap:0.4rem;">
                  <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openEditAcademicYearModal('${y.id}')">تعديل</button>
                  <button class="btn ${y.status === 'ACTIVE' ? 'btn-warning' : 'btn-success'}" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="toggleAcademicYearStatusAction('${y.id}', '${y.status}')">
                    ${y.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveAcademicYearAction('${y.id}')">أرشفة</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#7f1d1d; border:1px solid #ef4444;" onclick="deleteAcademicYearAction('${y.id}')">حذف</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align:center; padding:3rem;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📅</div>
          <p style="color:#94a3b8;">لا توجد سنوات دراسية مسجلة حتى الآن.</p>
          <button class="btn btn-success" onclick="openAddAcademicYearModal()">+ إضافة سنة دراسية الآن</button>
        </div>
      `}
    </div>
  `;
}

function renderStagesSection(stages, years) {
  const yearMap = (years || []).reduce((acc, y) => { acc[y.id] = y.name; return acc; }, {});
  return `
    <div class="card">
      <div class="card-title">المراحل الدراسية المسجلة بالسنتر</div>
      ${stages && stages.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>كود المرحلة</th>
              <th>اسم المرحلة الدراسية</th>
              <th>السنة الدراسية التابعة</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${stages.map(stg => `
              <tr>
                <td><span class="code-box">${stg.code || stg.id}</span></td>
                <td><strong>${stg.name}</strong></td>
                <td>${yearMap[stg.academicYearId] || stg.academicYearId || '-'}</td>
                <td>
                  <span class="badge" style="background:${stg.status === 'ACTIVE' ? '#14532d' : '#7f1d1d'}; color:${stg.status === 'ACTIVE' ? '#86efac' : '#fca5a5'};">
                    ${stg.status === 'ACTIVE' ? 'نشطة (ACTIVE)' : 'معطلة (INACTIVE)'}
                  </span>
                </td>
                <td style="display:flex; gap:0.4rem;">
                  <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openEditStageModal('${stg.id}')">تعديل</button>
                  <button class="btn ${stg.status === 'ACTIVE' ? 'btn-warning' : 'btn-success'}" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="toggleStageStatusAction('${stg.id}', '${stg.status}')">
                    ${stg.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveStageAction('${stg.id}')">أرشفة</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#7f1d1d; border:1px solid #ef4444;" onclick="deleteStageAction('${stg.id}')">حذف</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align:center; padding:3rem;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🏫</div>
          <p style="color:#94a3b8;">لا توجد مراحل دراسية مسجلة حتى الآن.</p>
          <button class="btn btn-success" onclick="openAddStageModal()">+ إضافة مرحلة دراسية الآن</button>
        </div>
      `}
    </div>
  `;
}

function renderSubjectsSection(subjects, stages, years) {
  const stageMap = (stages || []).reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});
  const yearMap = (years || []).reduce((acc, y) => { acc[y.id] = y.name; return acc; }, {});
  return `
    <div class="card">
      <div class="card-title">المواد الدراسية التخصصية</div>
      ${subjects && subjects.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>كود المادة</th>
              <th>اسم المادة الدراسية</th>
              <th>المرحلة الدراسية</th>
              <th>السنة الدراسية</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map(sb => `
              <tr>
                <td><span class="code-box">${sb.code || sb.id}</span></td>
                <td><strong>${sb.name}</strong></td>
                <td>${stageMap[sb.stageId] || sb.stageId || '-'}</td>
                <td>${yearMap[sb.academicYearId] || sb.academicYearId || '-'}</td>
                <td>
                  <span class="badge" style="background:${sb.status === 'ACTIVE' ? '#14532d' : '#7f1d1d'}; color:${sb.status === 'ACTIVE' ? '#86efac' : '#fca5a5'};">
                    ${sb.status === 'ACTIVE' ? 'نشطة (ACTIVE)' : 'معطلة (INACTIVE)'}
                  </span>
                </td>
                <td style="display:flex; gap:0.4rem;">
                  <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openEditSubjectModal('${sb.id}')">تعديل</button>
                  <button class="btn ${sb.status === 'ACTIVE' ? 'btn-warning' : 'btn-success'}" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="toggleSubjectStatusAction('${sb.id}', '${sb.status}')">
                    ${sb.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveSubjectAction('${sb.id}')">أرشفة</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#7f1d1d; border:1px solid #ef4444;" onclick="deleteSubjectAction('${sb.id}')">حذف</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align:center; padding:3rem;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📖</div>
          <p style="color:#94a3b8;">لا توجد مواد دراسية مسجلة حتى الآن.</p>
          <button class="btn btn-success" style="background:#8b5cf6;" onclick="openAddSubjectModal()">+ إضافة مادة دراسية الآن</button>
        </div>
      `}
    </div>
  `;
}

function renderRoomsSection(rooms) {
  return `
    <div class="card">
      <div class="card-title">قاعات وصالات التدريس بالسنتر</div>
      ${rooms && rooms.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>معرف القاعة</th>
              <th>اسم القاعة</th>
              <th>السعة الاستيعابية</th>
              <th>الموقع / المكان</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${rooms.map(r => `
              <tr>
                <td><span class="code-box">${r.id}</span></td>
                <td><strong>${r.name}</strong></td>
                <td><span class="badge" style="background:#0369a1; color:#e0f2fe;">${r.capacity} مقعد</span></td>
                <td>${r.location || '-'}</td>
                <td>
                  <span class="badge" style="background:${r.status === 'ACTIVE' ? '#14532d' : '#7f1d1d'}; color:${r.status === 'ACTIVE' ? '#86efac' : '#fca5a5'};">
                    ${r.status === 'ACTIVE' ? 'متاحة (ACTIVE)' : 'معطلة (INACTIVE)'}
                  </span>
                </td>
                <td style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                  <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#0284c7;" onclick="openRoomGroupsModal('${r.id}')">المجموعات</button>
                  <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openEditRoomModal('${r.id}')">تعديل</button>
                  <button class="btn ${r.status === 'ACTIVE' ? 'btn-warning' : 'btn-success'}" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="toggleRoomStatusAction('${r.id}', '${r.status}')">
                    ${r.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveRoomAction('${r.id}')">أرشفة</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#7f1d1d; border:1px solid #ef4444;" onclick="deleteRoomAction('${r.id}')">حذف</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align:center; padding:3rem;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🏛️</div>
          <p style="color:#94a3b8;">لا توجد قاعات مسجلة حتى الآن.</p>
          <button class="btn btn-success" style="background:#0284c7;" onclick="openAddRoomModal()">+ إضافة قاعة الآن</button>
        </div>
      `}
    </div>
  `;
}

// 2. Students View — Batch A (search/filter real data, groups resolved from IDs)
let studentGroupFilter = '';
let studentAuthFilter = '';
async function renderStudentsView(container) {
  const students = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  const groups = await callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const stageMap = new Map((stages || []).map(s => [s.id, s.name]));
  const groupsById = new Map((groups || []).map(g => [g.id, g]));

  container.innerHTML = `
    <div class="view-title">
      <span>🎓 إدارة الطلاب وسجلات التسجيل (${students.length})</span>
      <button class="btn btn-success" onclick="openAddStudentModal()">+ إضافة طالب جديد</button>
    </div>

    <div class="card" style="padding:1rem; margin-bottom:1rem; display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
      <input type="text" id="studentSearchInput" placeholder="🔍 بحث بالكود، الاسم، هاتف الطالب أو ولي الأمر..." style="flex:2; min-width:240px; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="filterStudentsTable()">
      <select id="studentStageFilter" style="padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" onchange="filterStudentsTable()">
        <option value="">جميع المراحل الدراسية</option>
        ${(stages || []).map(stg => `<option value="${stg.id}">${stg.name}</option>`).join('')}
      </select>
      <select id="studentGroupFilterSel" style="padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" onchange="filterStudentsTable()">
        <option value="">جميع المجموعات</option>
        ${(groups || []).map(g => `<option value="${g.id}">${escapeHtmlAttr(g.name)}</option>`).join('')}
      </select>
      <select id="studentStatusFilter" style="padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" onchange="filterStudentsTable()">
        <option value="">جميع الحالات</option>
        <option value="ACTIVE">نشط (ACTIVE)</option>
        <option value="SUSPENDED">موقوف (SUSPENDED)</option>
        <option value="WITHDRAWN">منسحب (WITHDRAWN)</option>
        <option value="GRADUATED">متخرج (GRADUATED)</option>
      </select>
      <select id="studentAuthFilter" style="padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" onchange="filterStudentsTable()">
        <option value="">كل حالات Auth</option>
        <option value="provisioned">AUTH PROVISIONED 🟢</option>
        <option value="draft">PROFILE DRAFT 🟡</option>
      </select>
    </div>

    ${students && students.length > 0 ? `
      <div class="card">
        <table class="data-table" id="studentsDataTable">
          <thead>
            <tr>
              <th>كود الطالب</th>
              <th>الاسم الكامل</th>
              <th>رقم الهاتف</th>
              <th>هاتف ولي الأمر</th>
              <th>المرحلة</th>
              <th>الهوية Auth</th>
              <th>الحالة</th>
              <th>المجموعات</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => {
              const gIds = canonicalIdsOf(s);
              const stageLabel = (s.stageId && stageMap.get(s.stageId)) || s.stage || s.grade || '-';
              return `
              <tr data-name="${escapeHtmlAttr((s.name||'').toLowerCase())}" data-phone="${s.phone||''}" data-code="${escapeHtmlAttr((s.studentCode||s.id).toLowerCase())}" data-stage-id="${s.stageId||''}" data-status="${s.status||'ACTIVE'}" data-guardedian-phone="${s.guardianPhone||''}" data-groups="${gIds.join(',')}" data-auth="${s.authUid ? 'provisioned' : 'draft'}">
                <td><span class="code-box">${s.studentCode || s.id}</span></td>
                <td><strong>${escapeHtmlAttr(s.name)}</strong></td>
                <td>${s.phone || '-'}</td>
                <td>${s.guardianPhone || '-'}</td>
                <td>${escapeHtmlAttr(stageLabel)}</td>
                <td>
                  ${s.authUid ? `<span class="badge" style="background:#064e3b; color:#34d399;" title="${s.authUid}">AUTH PROVISIONED 🟢</span>` : `<span class="badge warning">PROFILE DRAFT 🟡</span>`}
                </td>
                <td><span class="badge">${s.status}</span></td>
                <td style="max-width:220px;"><div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
                  ${gIds.length > 0 ? gIds.slice(0,3).map(gId => {
                      const gr = groupsById.get(gId);
                      return `<span class="badge" style="background:#1e293b; color:#38bdf8; font-size:0.7rem;">${escapeHtmlAttr(gr ? gr.name : gId)}</span>`;
                    }).join('') + (gIds.length > 3 ? `<span class="badge" style="background:#1e293b; color:#38bdf8; font-size:0.7rem;">+${gIds.length - 3} أخرى</span>` : '') : `<span style="color:#64748b; font-size:0.8rem;">لا ينتمي لمجموعة</span>`}
                </div></td>
                <td><div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem; background:#8b5cf6;" onclick="viewStudentDetailsModal('${s.id}')">البروفايل</button>
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem;" onclick="openStudentGroupsModal('${s.id}')">المجموعات</button>
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem; background:#475569;" onclick="openEditStudentModal('${s.id}')">تعديل</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.72rem;" onclick="archiveStudentAction('${s.id}')">أرشفة</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎓</div>
        <h3 style="color: #f8fafc; margin:0 0 0.5rem 0;">لا يوجد طلاب حتى الآن</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">اضغط على زر "إضافة طالب جديد" لإنشاء أول سجل طالب حقيقي في Firestore.</p>
        <button class="btn btn-success" onclick="openAddStudentModal()">+ إضافة طالب جديد الآن</button>
      </div>`}
  `;
}

function filterStudentsTable() {
  const search = (document.getElementById('studentSearchInput')?.value || '').toLowerCase().trim();
  const stageId = document.getElementById('studentStageFilter')?.value || '';
  const groupId = document.getElementById('studentGroupFilterSel')?.value || '';
  const status = document.getElementById('studentStatusFilter')?.value || '';
  const auth = document.getElementById('studentAuthFilter')?.value || '';
  const rows = document.querySelectorAll('#studentsDataTable tbody tr');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    const phone = r.getAttribute('data-phone') || '';
    const code = r.getAttribute('data-code') || '';
    const rStageId = r.getAttribute('data-stage-id') || '';
    const rStatus = r.getAttribute('data-status') || '';
    const rGuardian = r.getAttribute('data-guardedian-phone') || '';
    const rGroups = (r.getAttribute('data-groups') || '').split(',').filter(Boolean);
    const rAuth = r.getAttribute('data-auth') || '';
    const matchesSearch = !search || name.includes(search) || phone.includes(search) || code.includes(search) || rGuardian.includes(search);
    const matchesStage = !stageId || rStageId === stageId;
    const matchesGroup = !groupId || rGroups.includes(groupId);
    const matchesStatus = !status || rStatus === status;
    const matchesAuth = !auth || rAuth === auth;
    r.style.display = (matchesSearch && matchesStage && matchesGroup && matchesStatus && matchesAuth) ? '' : 'none';
  });
}

// 3. Teachers View
let teacherSearchQuery = '';
async function renderTeachersView(container) {
  container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">جاري تحميل بيانات المعلمين من Firestore...</div>';
  try {
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    // Fetch assignments for each teacher (in parallel)
    const assignmentsMap = new Map();
    const stagesMap = new Map();
    for (const t of teachers) {
      try {
        const subs = await callBackend('getTeacherSubjects', currentCallerToken, t.id, currentCallerToken.institutionId) || [];
        assignmentsMap.set(t.id, subs);
        const sts = await callBackend('getTeacherStages', currentCallerToken, t.id, currentCallerToken.institutionId) || [];
        stagesMap.set(t.id, sts);
      } catch(e) { assignmentsMap.set(t.id, []); stagesMap.set(t.id, []); }
    }
    const subjectMap = subjects.reduce((a,s)=>{a[s.id]=s.name; return a;},{});
    const stageMap = stages.reduce((a,s)=>{a[s.id]=s.name; return a;},{});
    const q = (teacherSearchQuery||'').toLowerCase().trim();
    const filtered = teachers.filter(t => !q || (t.fullName||t.name||'').toLowerCase().includes(q) || (t.phone||'').includes(q) || (t.teacherCode||'').toLowerCase().includes(q) || (t.specialization||t.subject||'').toLowerCase().includes(q));

    container.innerHTML = `
    <div class="view-title">
      <span>👨‍🏫 أعضاء هيئة التدريس والمعلمون</span>
      <button class="btn btn-success" onclick="openAddTeacherModal()">+ إضافة معلم جديد</button>
    </div>
    <div class="card" style="padding:1rem; margin-bottom:1rem; display:flex; gap:1rem; align-items:center;">
      <input type="text" id="teacherSearchInput" value="${teacherSearchQuery}" placeholder="🔍 بحث بالاسم، الكود، الهاتف، التخصص..." style="flex:1; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="onTeacherSearch(this.value)">
      <span style="color:#94a3b8; font-size:0.85rem;">${filtered.length} / ${teachers.length} معلم</span>
    </div>
    ${filtered && filtered.length > 0 ? `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>كود المعلم</th>
              <th>اسم المعلم</th>
              <th>الهاتف</th>
              <th>التخصص</th>
              <th>المواد</th>
              <th>المراحل</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(t => {
              const subs = assignmentsMap.get(t.id) || [];
              const sts = stagesMap.get(t.id) || [];
              const subsNames = subs.map(a=>subjectMap[a.subjectId]||a.subjectId).join(', ') || '-';
              const stsNames = sts.map(a=>stageMap[a.stageId]||a.stageId).join(', ') || '-';
              const statusBadge = t.status==='ACTIVE' ? '<span class="badge" style="background:#14532d; color:#86efac;">نشط</span>' : t.status==='SUSPENDED' ? '<span class="badge" style="background:#7c2d12; color:#fdba74;">موقوف</span>' : '<span class="badge revoked">مؤرشف</span>';
              return `
              <tr>
                <td><span class="code-box">${t.teacherCode||t.id}</span></td>
                <td><strong>${t.fullName||t.name}</strong><div style="font-size:0.7rem; color:#94a3b8;">${t.email||''}</div></td>
                <td>${t.phone||'-'}</td>
                <td>${t.specialization||t.subject||'-'}</td>
                <td style="font-size:0.8rem; max-width:140px;">${subsNames}</td>
                <td style="font-size:0.8rem; max-width:140px;">${stsNames}</td>
                <td>${statusBadge}</td>
                <td style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                  <button class="btn" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#8b5cf6;" onclick="viewTeacherDetailsModal('${t.id}')">التفاصيل</button>
                  <button class="btn" style="padding:0.2rem 0.45rem; font-size:0.7rem;" onclick="openEditTeacherModal('${t.id}')">تعديل</button>
                  <button class="btn ${t.status==='ACTIVE'?'btn-warning':''}" style="padding:0.2rem 0.45rem; font-size:0.7rem;" onclick="toggleTeacherStatusAction('${t.id}','${t.status}')">${t.status==='ACTIVE'?'تعطيل':'تفعيل'}</button>
                  <button class="btn btn-danger" style="padding:0.2rem 0.45rem; font-size:0.7rem;" onclick="archiveTeacherAction('${t.id}')">أرشفة</button>
                  <button class="btn btn-danger" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#7f1d1d; border:1px solid #ef4444;" onclick="deleteTeacherAction('${t.id}')">حذف</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">👨‍🏫</div>
        <h3 style="color: #f8fafc; margin:0 0 0.5rem 0;">${teachers.length===0 ? 'لا يوجد معلمون حتى الآن' : 'لا توجد نتائج للبحث'}</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">${teachers.length===0 ? 'قم بإضافة المعلمين لتخصيص المجموعات والمواد الدراسية.' : 'جرب كلمات بحث أخرى'}</p>
        ${teachers.length===0 ? '<button class="btn btn-success" onclick="openAddTeacherModal()">+ إضافة معلم جديد</button>' : ''}
      </div>
    `}
  `;
  } catch(err){
    container.innerHTML = `<div class="card" style="border-color:#ef4444;"><h3 style="color:#ef4444;">خطأ في تحميل المعلمين</h3><p>${err.message}</p></div>`;
  }
}
function onTeacherSearch(val){ teacherSearchQuery = val; renderTeachersView(document.getElementById('mainView')); }

// 4. Groups View — Batch A (IDs resolved to names, capacity/remaining, full lifecycle)
let groupSearchQuery = '';
async function renderGroupsView(container) {
  const groups = await callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const yearMap = new Map((years || []).map(y => [y.id, y.name]));
  const stageMap = new Map((stages || []).map(s => [s.id, s.name]));
  const subjectMap = new Map((subjects || []).map(s => [s.id, s.name]));
  const teacherMap = new Map((teachers || []).map(t => [t.id, t.fullName || t.name]));
  const roomMap = new Map((rooms || []).map(r => [r.id, r.name]));
  const q = (groupSearchQuery || '').toLowerCase().trim();
  const filtered = (groups || []).filter(g => !q || (g.name || '').toLowerCase().includes(q) || (g.code || '').toLowerCase().includes(q) || (subjectMap.get(g.subjectId) || '').toLowerCase().includes(q) || (teacherMap.get(g.teacherId) || '').toLowerCase().includes(q));

  container.innerHTML = `
    <div class="view-title">
      <span>📚 المجموعات الدراسية (${filtered.length}/${(groups || []).length})</span>
      <button class="btn btn-success" onclick="openAddGroupModal()">+ إنشاء مجموعة جديدة</button>
    </div>
    <div class="card" style="padding:1rem; margin-bottom:1rem;">
      <input type="text" value="${escapeHtmlAttr(groupSearchQuery)}" placeholder="🔍 بحث باسم المجموعة، الكود، المادة أو المعلم..." style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="onGroupSearch(this.value)">
    </div>
    ${filtered && filtered.length > 0 ? `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>كود المجموعة</th>
              <th>اسم المجموعة</th>
              <th>المرحلة / المادة</th>
              <th>المعلم / القاعة</th>
              <th>المسجلين / السعة</th>
              <th>المتبقي</th>
              <th>الرسوم</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(g => {
              const enrolled = Number(g.enrolledCount || 0);
              const cap = Number(g.maxCapacity || g.capacity || 30);
              const remaining = Math.max(0, cap - enrolled);
              return `
              <tr>
                <td><span class="code-box">${g.code || g.id}</span></td>
                <td><strong>${escapeHtmlAttr(g.name)}</strong><div style="font-size:0.7rem; color:#64748b;">${yearMap.get(g.academicYearId) || ''}</div></td>
                <td><div>${escapeHtmlAttr(stageMap.get(g.stageId) || g.stageId || '-')}</div><div style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(subjectMap.get(g.subjectId) || g.subjectName || '-')}</div></td>
                <td><div>${escapeHtmlAttr(teacherMap.get(g.teacherId) || g.teacherName || '-')}</div><div style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(roomMap.get(g.roomId) || g.room || '-')}</div></td>
                <td><span class="badge" style="background:${enrolled >= cap ? '#7f1d1d' : '#1e293b'}; color:${enrolled >= cap ? '#fca5a5' : '#38bdf8'};">${enrolled} / ${cap}</span></td>
                <td><span class="badge" style="background:${remaining === 0 ? '#7f1d1d' : '#14532d'}; color:${remaining === 0 ? '#fca5a5' : '#86efac'};">${remaining === 0 ? 'ممتلئة' : remaining + ' متاح'}</span></td>
                <td>${g.monthlyFee || 0} ج.م</td>
                <td><span class="badge">${g.status || 'ACTIVE'}</span></td>
                <td><div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem; background:#8b5cf6;" onclick="openGroupDetailsModal('${g.id}')">التفاصيل</button>
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem; background:#0284c7;" onclick="openManageGroupStudentsModal('${g.id}')">الطلاب</button>
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem; background:#475569;" onclick="openEditGroupModal('${g.id}')">تعديل</button>
                  <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.72rem;" onclick="archiveGroupAction('${g.id}')">أرشفة</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">📚</div>
        <h3 style="color: #f8fafc; margin:0 0 0.5rem 0;">${(groups || []).length === 0 ? 'لا توجد مجموعات دراسية' : 'لا توجد نتائج للبحث'}</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">أنشئ المجموعات الدراسية وربط الطلاب والمعلمين بها.</p>
        ${(groups || []).length === 0 ? '<button class="btn btn-success" onclick="openAddGroupModal()">+ إنشاء مجموعة جديدة</button>' : ''}
      </div>
    `}
  `;
}
function onGroupSearch(val){ groupSearchQuery = val; const mv = document.getElementById('mainView'); if (mv && activeView === 'groups') renderGroupsView(mv); }

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

// Student Modal — Batch A: create with group selection during same workflow
async function openAddStudentModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل البيانات الأكاديمية...</p></div></div>';
  try {
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const groups = await callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    window._batchA = { years, stages, groups, subjects, teachers, rooms };
    const activeYears = (years || []).filter(y => y.status === 'ACTIVE');
    const activeStages = (stages || []).filter(s => s.status !== 'ARCHIVED');
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:640px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">+ إضافة طالب جديد — مع اختيار المجموعات</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group"><label>الاسم الكامل للطالب *</label><input type="text" id="mStudentName" placeholder="مثال: أحمد محمد علي"></div>
          <div class="form-group"><label>رقم هاتف الطالب * (مثال: 01012345678)</label><input type="text" id="mStudentPhone" placeholder="01011112222"><div id="mStudentPhoneErr" style="color:#fca5a5; font-size:0.75rem; display:none;"></div></div>
          <div class="form-group"><label>هاتف ولي الأمر *</label><input type="text" id="mGuardianPhone" placeholder="01122223333"></div>
          <div class="form-group"><label>اسم ولي الأمر *</label><input type="text" id="mGuardianName" placeholder="محمد علي"></div>
          <div class="form-group"><label>السنة الدراسية *</label><select id="mStudentYear" onchange="onStudentModalYearChange()">${activeYears.map(y => `<option value="${y.id}">${escapeHtmlAttr(y.name)}</option>`).join('') || '<option value="">لا توجد سنة نشطة — أضف من الإعداد الأكاديمي</option>'}</select></div>
          <div class="form-group"><label>المرحلة الدراسية *</label><select id="mStudentStage" onchange="onStudentModalStageChange()">${activeStages.map(s => `<option value="${s.id}" data-year="${s.academicYearId || ''}">${escapeHtmlAttr(s.name)}</option>`).join('') || '<option value="">لا توجد مراحل — أضف من الإعداد الأكاديمي</option>'}</select><div id="mStageGroupHint" style="color:#94a3b8; font-size:0.75rem; margin-top:0.25rem;"></div></div>
        </div>
        <div class="form-group"><label>بحث في المجموعات</label><input type="text" id="mGroupSearch" placeholder="🔍 ابحث باسم المجموعة، المادة أو المعلم..." oninput="onStudentModalGroupSearch(this.value)"></div>
        <div class="form-group"><label>المجموعات (اختيار متعدد — تظهر فقط مجموعات المرحلة المحددة)</label><div id="mStudentGroupsBox" style="max-height:220px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;"></div><div id="mGroupsErr" style="color:#fca5a5; font-size:0.75rem; margin-top:0.25rem;"></div></div>
        <div class="form-group"><label>ملاحظات</label><input type="text" id="mStudentNotes" placeholder="ملاحظات اختيارية"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnSaveStudent" onclick="submitAddStudent()">حفظ الطالب + التسجيل في المجموعات</button>
        </div>
      </div>
    </div>`;
    onStudentModalStageChange();
  } catch (err) {
    container.innerHTML = `<div class="modal-overlay"><div class="modal-card"><p style="color:#fca5a5;">${friendlyBatchAError(err)}</p><button class="btn" onclick="closeModal()">إغلاق</button></div></div>`;
  }
}

function onStudentModalYearChange() {
  const yearId = document.getElementById('mStudentYear')?.value || '';
  const stageSel = document.getElementById('mStudentStage');
  if (!stageSel || !window._batchA) return;
  const stages = (window._batchA.stages || []).filter(s => s.status !== 'ARCHIVED' && (!yearId || !s.academicYearId || s.academicYearId === yearId));
  const current = stageSel.value;
  stageSel.innerHTML = stages.map(s => `<option value="${s.id}" data-year="${s.academicYearId || ''}">${escapeHtmlAttr(s.name)}</option>`).join('');
  if (stages.some(s => s.id === current)) stageSel.value = current;
  onStudentModalStageChange();
}

function onStudentModalStageChange() {
  const stageId = document.getElementById('mStudentStage')?.value || '';
  const box = document.getElementById('mStudentGroupsBox');
  const hint = document.getElementById('mStageGroupHint');
  if (!box || !window._batchA) return;
  renderStudentGroupOptions(stageId, document.getElementById('mGroupSearch')?.value || '');
  const groups = window._batchA.groups || [];
  const valid = groups.filter(g => g.status === 'ACTIVE' && (!stageId || !g.stageId || g.stageId === stageId));
  if (hint) hint.innerText = stageId ? `المجموعات المتاحة لهذه المرحلة: ${valid.length}` : 'اختر المرحلة لعرض المجموعات المتاحة';
}

function onStudentModalGroupSearch(q) {
  const stageId = document.getElementById('mStudentStage')?.value || '';
  renderStudentGroupOptions(stageId, q || '');
}

function renderStudentGroupOptions(stageId, searchQ) {
  const box = document.getElementById('mStudentGroupsBox');
  if (!box || !window._batchA) return;
  const { groups = [], subjects = [], teachers = [], rooms = [] } = window._batchA;
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
  const teacherMap = new Map(teachers.map(t => [t.id, t.fullName || t.name]));
  const roomMap = new Map(rooms.map(r => [r.id, r.name]));
  const q = (searchQ || '').toLowerCase().trim();
  const list = groups.filter(g => {
    if (g.status === 'ARCHIVED') return false;
    if (stageId && g.stageId && g.stageId !== stageId) return false;
    if (q && !((g.name || '').toLowerCase().includes(q) || (subjectMap.get(g.subjectId) || '').toLowerCase().includes(q) || (teacherMap.get(g.teacherId) || '').toLowerCase().includes(q))) return false;
    return true;
  });
  if (list.length === 0) {
    box.innerHTML = '<p style="color:#94a3b8; font-size:0.85rem;">لا توجد مجموعات متاحة لهذه المرحلة. أنشئ مجموعة من شاشة المجموعات أولاً.</p>';
    return;
  }
  box.innerHTML = list.map(g => {
    const enrolled = Number(g.enrolledCount || 0);
    const cap = Number(g.maxCapacity || g.capacity || 30);
    const remaining = cap - enrolled;
    const full = remaining <= 0;
    const inactive = g.status !== 'ACTIVE';
    const disabled = full || inactive;
    const reason = inactive ? 'المجموعة غير نشطة' : (full ? 'المجموعة ممتلئة' : '');
    return `<label style="display:flex; gap:0.6rem; padding:0.55rem; border:1px solid #334155; border-radius:6px; margin-bottom:0.4rem; background:${disabled ? '#0b1220' : '#1e293b'}; opacity:${disabled ? 0.6 : 1}; cursor:${disabled ? 'not-allowed' : 'pointer'};">
      <input type="checkbox" value="${g.id}" class="mStudentGroupChk" ${disabled ? 'disabled' : ''}>
      <span style="flex:1;">
        <strong>المجموعة: ${escapeHtmlAttr(g.name)}</strong> <span class="code-box" style="font-size:0.65rem;">${g.code || g.id}</span><br>
        <span style="font-size:0.8rem; color:#94a3b8;">المادة: ${escapeHtmlAttr(subjectMap.get(g.subjectId) || g.subjectName || '-')} | المعلم: ${escapeHtmlAttr(teacherMap.get(g.teacherId) || g.teacherName || '-')} | القاعة: ${escapeHtmlAttr(roomMap.get(g.roomId) || g.room || '-')}</span><br>
        <span style="font-size:0.8rem; color:${full ? '#fca5a5' : '#86efac'};">الطلاب: ${enrolled} / ${cap} | المقاعد المتاحة: ${Math.max(0, remaining)}${reason ? ' — ' + reason : ''}</span>
      </span>
    </label>`;
  }).join('');
}

async function submitAddStudent() {
  const btn = document.getElementById('btnSaveStudent');
  const name = document.getElementById('mStudentName')?.value || '';
  const phone = document.getElementById('mStudentPhone')?.value || '';
  const guardianPhone = document.getElementById('mGuardianPhone')?.value || '';
  const guardianName = document.getElementById('mGuardianName')?.value || '';
  const academicYearId = document.getElementById('mStudentYear')?.value || '';
  const stageId = document.getElementById('mStudentStage')?.value || '';
  const notes = document.getElementById('mStudentNotes')?.value || '';
  const selectedGroups = Array.from(document.querySelectorAll('.mStudentGroupChk:checked')).map(c => c.value);
  const errBox = document.getElementById('mGroupsErr');
  if (errBox) errBox.innerText = '';
  if (!name.trim()) { showToast('اسم الطالب الكامل مطلوب', true); return; }
  if (!phone.trim()) { showToast('رقم هاتف الطالب مطلوب', true); return; }
  if (!guardianPhone.trim()) { showToast('هاتف ولي الأمر مطلوب', true); return; }
  if (!guardianName.trim()) { showToast('اسم ولي الأمر مطلوب', true); return; }
  if (btn) { btn.disabled = true; btn.innerText = 'جاري الحفظ... ⏳'; }
  try {
    const res = await callBackend('createStudent', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name: name.trim(), phone: phone.trim(), guardianPhone: guardianPhone.trim(), guardianName: guardianName.trim(),
      academicYearId, stageId, groupIds: selectedGroups, notes, status: 'ACTIVE'
    });
    closeModal();
    showToast(`تم حفظ الطالب ${res.name} بنجاح${selectedGroups.length ? ` مع التسجيل في ${selectedGroups.length} مجموعة` : ''}!`);
    await renderActiveView('students');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
    if (btn) { btn.disabled = false; btn.innerText = 'حفظ الطالب + التسجيل في المجموعات'; }
  }
}

async function archiveStudentAction(id) {
  if (!confirm('هل أنت متأكد من أرشفة سجل الطالب؟ سيتم سحب الطالب من مجموعاته أولاً للحفاظ على المقاعد.')) return;
  try {
    await callBackend('archiveStudent', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة الطالب بنجاح');
    await renderActiveView(activeView);
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function deleteStudentAction(id) {
  if (!confirm('هل أنت متأكد من حذف سجل الطالب نهائيًا؟ لا يمكن التراجع.')) return;
  if (!confirm('تأكيد نهائي: سيتم الحذف فقط إذا لم توجد سجلات مرتبطة. المتابعة؟')) return;
  try {
    await callBackend('deleteStudent', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف الطالب نهائياً');
    await renderActiveView(activeView);
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// Teacher Modal — Enhanced Phase 50.2 (code, phone validation, specialization, email, assignments)
async function openAddTeacherModal() {
  let subjects=[], stages=[];
  try { subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || []; } catch(e){ subjects=[]; }
  try { stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || []; } catch(e){ stages=[]; }
  const activeSubjects = subjects.filter(s=>s.status!=='ARCHIVED');
  const activeStages = stages.filter(s=>s.status!=='ARCHIVED');
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:580px; max-height:85vh; overflow-y:auto;">
        <div class="modal-header">+ إضافة معلم جديد — كود تلقائي</div>
        <div class="form-group"><label>اسم المعلم *</label><input type="text" id="mTchName" placeholder="أ.د/ إبراهيم عبد الرحمن"></div>
        <div class="form-group"><label>رقم الهاتف * (مثال: 01099998888)</label><input type="text" id="mTchPhone" placeholder="01012345678"></div>
        <div class="form-group"><label>البريد الإلكتروني (اختياري)</label><input type="email" id="mTchEmail" placeholder="teacher@center.com"></div>
        <div class="form-group"><label>التخصص * (مثال: الرياضيات، الفيزياء)</label><input type="text" id="mTchSpec" placeholder="الرياضيات"></div>
        <div class="form-group">
          <label>المواد التي يدرسها (اختياري — صفر أو أكثر)</label>
          ${activeSubjects.length>0 ? `<div style="max-height:100px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;">${activeSubjects.map(s=>`<label style="display:flex; align-items:center; gap:0.5rem; padding:0.25rem; cursor:pointer;"><input type="checkbox" value="${s.id}" class="mTchSubjectChk"> <span>${s.name} <span class="code-box" style="font-size:0.7rem;">${s.code||s.id}</span></span></label>`).join('')}</div>` : '<p style="color:#f59e0b; font-size:0.85rem;">لا توجد مواد دراسية نشطة. أضف المواد من الإعداد الأكاديمي أولاً.</p>'}
        </div>
        <div class="form-group">
          <label>المراحل التي يدرسها (اختياري — صفر أو أكثر)</label>
          ${activeStages.length>0 ? `<div style="max-height:100px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;">${activeStages.map(s=>`<label style="display:flex; align-items:center; gap:0.5rem; padding:0.25rem; cursor:pointer;"><input type="checkbox" value="${s.id}" class="mTchStageChk"> <span>${s.name} <span class="code-box" style="font-size:0.7rem;">${s.code||s.id}</span></span></label>`).join('')}</div>` : '<p style="color:#f59e0b; font-size:0.85rem;">لا توجد مراحل دراسية نشطة. أضف المراحل من الإعداد الأكاديمي أولاً.</p>'}
        </div>
        <p style="color:#94a3b8; font-size:0.75rem;">سيتم توليد كود المعلم تلقائياً (TCH-0001) وضمان عدم التكرار داخل المركز.</p>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitAddTeacher()">حفظ المعلم</button>
        </div>
      </div>
    </div>
  `;
}

async function submitAddTeacher() {
  const fullName = document.getElementById('mTchName').value;
  const phone = document.getElementById('mTchPhone').value;
  const email = document.getElementById('mTchEmail').value;
  const specialization = document.getElementById('mTchSpec').value;
  const selectedSubjects = Array.from(document.querySelectorAll('.mTchSubjectChk:checked')).map(cb=>cb.value);
  const selectedStages = Array.from(document.querySelectorAll('.mTchStageChk:checked')).map(cb=>cb.value);
  try {
    const res = await callBackend('createTeacher', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      fullName, name: fullName, phone, email, specialization
    });
    // Create relationships after teacher creation; report failures without silent success
    let failMessages = [];
    for (const sid of selectedSubjects) {
      try { await callBackend('assignTeacherSubject', currentCallerToken, { institutionId: currentCallerToken.institutionId, teacherId: res.id, subjectId: sid }); } catch(e){ failMessages.push('مادة '+sid+': '+e.message); }
    }
    for (const sid of selectedStages) {
      try { await callBackend('assignTeacherStage', currentCallerToken, { institutionId: currentCallerToken.institutionId, teacherId: res.id, stageId: sid }); } catch(e){ failMessages.push('مرحلة '+sid+': '+e.message); }
    }
    closeModal();
    if (failMessages.length>0) {
      showToast('تم حفظ المعلم لكن بعض التخصصات فشلت: '+failMessages.join(' | '), true);
    } else {
      showToast(`تم حفظ المعلم ${res.fullName||res.name} بكود ${res.teacherCode} بنجاح!${selectedSubjects.length||selectedStages.length ? ' (تم ربط '+(selectedSubjects.length+selectedStages.length)+' تخصص)' : ''}`);
    }
    await renderActiveView('teachers');
  } catch (err) { showToast(err.message, true); }
}

async function openEditTeacherModal(id) {
  try {
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId });
    const t = (teachers||[]).find(x=>x.id===id);
    if (!t) { showToast('المعلم غير موجود', true); return; }
    let subjects=[], stages=[], subjectAssignments=[], stageAssignments=[];
    try { subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || []; } catch(e){ subjects=[]; }
    try { stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || []; } catch(e){ stages=[]; }
    try { subjectAssignments = await callBackend('getTeacherSubjects', currentCallerToken, id, currentCallerToken.institutionId) || []; } catch(e){ subjectAssignments=[]; }
    try { stageAssignments = await callBackend('getTeacherStages', currentCallerToken, id, currentCallerToken.institutionId) || []; } catch(e){ stageAssignments=[]; }
    const activeSubjects = subjects.filter(s=>s.status!=='ARCHIVED');
    const activeStages = stages.filter(s=>s.status!=='ARCHIVED');
    const assignedSubjectIds = new Set(subjectAssignments.map(a=>a.subjectId));
    const assignedStageIds = new Set(stageAssignments.map(a=>a.stageId));
    const container = document.getElementById('modalContainer');
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:580px; max-height:85vh; overflow-y:auto;">
          <div class="modal-header">تعديل بيانات المعلم — ${t.teacherCode||t.id}</div>
          <div class="form-group"><label>اسم المعلم *</label><input type="text" id="mEditTchName" value="${(t.fullName||t.name||'').replace(/"/g,'&quot;')}"></div>
          <div class="form-group"><label>رقم الهاتف *</label><input type="text" id="mEditTchPhone" value="${(t.phone||'').replace(/"/g,'&quot;')}"></div>
          <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="mEditTchEmail" value="${(t.email||'').replace(/"/g,'&quot;')}"></div>
          <div class="form-group"><label>التخصص *</label><input type="text" id="mEditTchSpec" value="${(t.specialization||t.subject||'').replace(/"/g,'&quot;')}"></div>
          <div class="form-group"><label>كود المعلم (ثابت)</label><input type="text" value="${t.teacherCode||t.id}" disabled style="background:#0f172a; color:#94a3b8;"></div>
          <div class="form-group">
            <label>المواد التي يدرسها</label>
            ${activeSubjects.length>0 ? `<div style="max-height:110px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;">${activeSubjects.map(s=>`<label style="display:flex; align-items:center; gap:0.5rem; padding:0.25rem; cursor:pointer;"><input type="checkbox" value="${s.id}" class="mEditTchSubjectChk" ${assignedSubjectIds.has(s.id)?'checked':''}> <span>${s.name} <span class="code-box" style="font-size:0.7rem;">${s.code||s.id}</span></span></label>`).join('')}</div>` : '<p style="color:#f59e0b; font-size:0.85rem;">لا توجد مواد دراسية نشطة. أضف المواد من الإعداد الأكاديمي أولاً.</p>'}
          </div>
          <div class="form-group">
            <label>المراحل التي يدرسها</label>
            ${activeStages.length>0 ? `<div style="max-height:110px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;">${activeStages.map(s=>`<label style="display:flex; align-items:center; gap:0.5rem; padding:0.25rem; cursor:pointer;"><input type="checkbox" value="${s.id}" class="mEditTchStageChk" ${assignedStageIds.has(s.id)?'checked':''}> <span>${s.name} <span class="code-box" style="font-size:0.7rem;">${s.code||s.id}</span></span></label>`).join('')}</div>` : '<p style="color:#f59e0b; font-size:0.85rem;">لا توجد مراحل دراسية نشطة. أضف المراحل من الإعداد الأكاديمي أولاً.</p>'}
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
            <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
            <button class="btn btn-success" onclick="submitEditTeacher('${t.id}')">حفظ التعديلات</button>
          </div>
        </div>
      </div>
    `;
  } catch(err){ showToast(err.message,true); }
}

async function submitEditTeacher(id){
  const fullName = document.getElementById('mEditTchName').value;
  const phone = document.getElementById('mEditTchPhone').value;
  const email = document.getElementById('mEditTchEmail').value;
  const specialization = document.getElementById('mEditTchSpec').value;
  const selectedSubjects = Array.from(document.querySelectorAll('.mEditTchSubjectChk:checked')).map(cb=>cb.value);
  const selectedStages = Array.from(document.querySelectorAll('.mEditTchStageChk:checked')).map(cb=>cb.value);
  try {
    await callBackend('updateTeacher', currentCallerToken, id, { institutionId: currentCallerToken.institutionId, fullName, name: fullName, phone, email, specialization, subject: specialization });
    // Sync subject assignments: preserve existing, add new, remove deselected, avoid duplicates
    let existingSubjects=[], existingStages=[];
    try { existingSubjects = await callBackend('getTeacherSubjects', currentCallerToken, id, currentCallerToken.institutionId) || []; } catch(e){ existingSubjects=[]; }
    try { existingStages = await callBackend('getTeacherStages', currentCallerToken, id, currentCallerToken.institutionId) || []; } catch(e){ existingStages=[]; }
    const existingSubjectIds = new Set(existingSubjects.map(a=>a.subjectId));
    const existingStageIds = new Set(existingStages.map(a=>a.stageId));
    const toAddSubjects = selectedSubjects.filter(sid=>!existingSubjectIds.has(sid));
    const toRemoveSubjects = existingSubjects.filter(a=>!selectedSubjects.includes(a.subjectId));
    const toAddStages = selectedStages.filter(sid=>!existingStageIds.has(sid));
    const toRemoveStages = existingStages.filter(a=>!selectedStages.includes(a.stageId));
    let failMessages=[];
    for (const sid of toAddSubjects) { try { await callBackend('assignTeacherSubject', currentCallerToken, { institutionId: currentCallerToken.institutionId, teacherId: id, subjectId: sid }); } catch(e){ failMessages.push('مادة '+sid+': '+e.message); } }
    for (const a of toRemoveSubjects) { try { await callBackend('removeTeacherSubject', currentCallerToken, a.id, currentCallerToken.institutionId); } catch(e){ failMessages.push('إزالة مادة '+a.subjectId+': '+e.message); } }
    for (const sid of toAddStages) { try { await callBackend('assignTeacherStage', currentCallerToken, { institutionId: currentCallerToken.institutionId, teacherId: id, stageId: sid }); } catch(e){ failMessages.push('مرحلة '+sid+': '+e.message); } }
    for (const a of toRemoveStages) { try { await callBackend('removeTeacherStage', currentCallerToken, a.id, currentCallerToken.institutionId); } catch(e){ failMessages.push('إزالة مرحلة '+a.stageId+': '+e.message); } }
    closeModal();
    if (failMessages.length>0) showToast('تم تحديث المعلم لكن بعض التخصصات فشلت: '+failMessages.join(' | '), true);
    else showToast('تم تحديث بيانات المعلم والتخصصات بنجاح');
    await renderActiveView('teachers');
  } catch(err){ showToast(err.message,true); }
}

async function toggleTeacherStatusAction(id, currentStatus){
  const newStatus = currentStatus==='ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  if (currentStatus==='ARCHIVED'){ showToast('المعلم مؤرشف — لا يمكن تفعيله كنشط مباشرة', true); return; }
  try {
    await callBackend('setTeacherStatus', currentCallerToken, id, newStatus);
    showToast(newStatus==='ACTIVE' ? 'تم تفعيل المعلم' : 'تم تعطيل المعلم');
    await renderActiveView('teachers');
  } catch(err){ showToast(err.message,true); }
}

async function archiveTeacherAction(id) {
  if (!confirm('أرشفة سجل المعلم؟')) return;
  try {
    await callBackend('archiveTeacher', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة المعلم');
    await renderActiveView('teachers');
  } catch (err) { showToast(err.message, true); }
}

async function deleteTeacherAction(id){
  if (!confirm('هل أنت متأكد من حذف هذا السجل نهائيًا؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
  // Second confirmation for destructive
  if (!confirm('تأكيد نهائي: سيتم حذف المعلم نهائياً إذا لم يكن مرتبطاً بمواد/مراحل/مجموعات. المتابعة؟')) return;
  try {
    await callBackend('deleteTeacher', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف المعلم نهائياً');
    await renderActiveView('teachers');
  } catch(err){
    if (err.message.includes('HAS_DEPENDENCIES')){
      showToast('لا يمكن حذف هذا المعلم لأنه مرتبط بمواد/مراحل أو مجموعات/حصص. يمكنك أرشفته بدلًا من حذفه.', true);
    } else {
      showToast(err.message, true);
    }
  }
}

// Academic safe delete handlers
async function deleteAcademicYearAction(id){
  if (!confirm('هل أنت متأكد من حذف هذه السنة الدراسية نهائيًا؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
  try {
    await callBackend('deleteAcademicYear', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف السنة الدراسية نهائياً');
    await renderActiveView('academic');
  } catch(err){
    if (err.message.includes('HAS_DEPENDENCIES')) showToast('لا يمكن حذف هذه السنة الدراسية لأنها مرتبطة بمراحل/مواد. يمكنك أرشفتها بدلًا من حذفها.', true);
    else showToast(err.message,true);
  }
}
async function deleteStageAction(id){
  if (!confirm('هل أنت متأكد من حذف هذه المرحلة نهائيًا؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
  try {
    await callBackend('deleteStage', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف المرحلة نهائياً');
    await renderActiveView('academic');
  } catch(err){
    if (err.message.includes('HAS_DEPENDENCIES')) showToast('لا يمكن حذف هذه المرحلة لأنها مرتبطة بمواد. يمكنك أرشفتها بدلًا من حذفها.', true);
    else showToast(err.message,true);
  }
}
async function deleteSubjectAction(id){
  if (!confirm('هل أنت متأكد من حذف هذه المادة نهائيًا؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
  try {
    await callBackend('deleteSubject', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف المادة نهائياً');
    await renderActiveView('academic');
  } catch(err){
    if (err.message.includes('HAS_DEPENDENCIES')) showToast('لا يمكن حذف هذه المادة لأنها مرتبطة بمعلمين. يمكنك أرشفتها بدلًا من حذفها.', true);
    else showToast(err.message,true);
  }
}
async function deleteRoomAction(id){
  if (!confirm('هل أنت متأكد من حذف هذه القاعة نهائيًا؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
  try {
    await callBackend('deleteRoom', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف القاعة نهائياً');
    await renderActiveView('academic');
  } catch(err){ showToast(friendlyBatchAError(err), true); }
}

// Group Modal — Batch A: full academic relationships (IDs only)
async function openAddGroupModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل البيانات الأكاديمية...</p></div></div>';
  try {
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    window._batchAGroup = { years, stages, subjects, teachers, rooms };
    const activeYears = years.filter(y => y.status === 'ACTIVE');
    const activeStages = stages.filter(s => s.status !== 'ARCHIVED');
    const activeSubjects = subjects.filter(s => s.status !== 'ARCHIVED');
    const activeTeachers = teachers.filter(t => t.status === 'ACTIVE');
    const activeRooms = rooms.filter(r => r.status === 'ACTIVE');
    if (activeYears.length === 0 || activeStages.length === 0 || activeSubjects.length === 0 || activeTeachers.length === 0 || activeRooms.length === 0) {
      container.innerHTML = `<div class="modal-overlay"><div class="modal-card"><div class="modal-header">+ إنشاء مجموعة دراسية جديدة</div>
        <p style="color:#fbbf24; font-size:0.9rem;">يلزم استكمال الإعداد الأكاديمي أولاً (سنة نشطة + مرحلة + مادة + معلم نشط + قاعة متاحة) قبل إنشاء المجموعات.</p>
        <p style="color:#94a3b8; font-size:0.8rem;">السنوات: ${years.length} | المراحل: ${stages.length} | المواد: ${subjects.length} | المعلمون النشطون: ${activeTeachers.length} | القاعات المتاحة: ${activeRooms.length}</p>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button class="btn" style="background:#475569;" onclick="closeModal()">إغلاق</button><button class="btn" onclick="closeModal(); navigate('academic')">فتح الإعداد الأكاديمي</button></div></div></div>`;
      return;
    }
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:620px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">+ إنشاء مجموعة دراسية جديدة (علاقات حقيقية)</div>
        <div class="form-group"><label>اسم المجموعة *</label><input type="text" id="mGrpName" placeholder="الصف الثالث الثانوي — تاريخ (أ)"></div>
        <div class="form-group"><label>كود المجموعة (اختياري — يولد تلقائياً)</label><input type="text" id="mGrpCode" placeholder="GRP-1001"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group"><label>السنة الدراسية *</label><select id="mGrpYear" onchange="onGroupModalYearChange()">${activeYears.map(y => `<option value="${y.id}">${escapeHtmlAttr(y.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المرحلة الدراسية *</label><select id="mGrpStage" onchange="onGroupModalStageChange()">${activeStages.map(s => `<option value="${s.id}" data-year="${s.academicYearId || ''}">${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المادة الدراسية *</label><select id="mGrpSubject">${activeSubjects.map(s => `<option value="${s.id}" data-stage="${s.stageId || ''}" data-year="${s.academicYearId || ''}">${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المعلم *</label><select id="mGrpTeacher">${activeTeachers.map(t => `<option value="${t.id}">${escapeHtmlAttr(t.fullName || t.name)} (${t.teacherCode || t.id})</option>`).join('')}</select></div>
          <div class="form-group"><label>القاعة *</label><select id="mGrpRoom">${activeRooms.map(r => `<option value="${r.id}">${escapeHtmlAttr(r.name)} — ${r.capacity} مقعد</option>`).join('')}</select></div>
          <div class="form-group"><label>السعة القصوى *</label><input type="number" id="mGrpCapacity" value="20" min="1"><div style="color:#94a3b8; font-size:0.72rem;">يجب أن تكون رقماً صحيحاً موجباً</div></div>
        </div>
        <div class="form-group"><label>المواعيد (وصف حر)</label><input type="text" id="mGrpSchedule" placeholder="الأحد والأربعاء 04:00 مساءً"></div>
        <div class="form-group"><label>الرسوم الشهرية (جنيه)</label><input type="number" id="mGrpFee" value="350" min="0"></div>
        <div id="mGrpErr" style="color:#fca5a5; font-size:0.8rem;"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnSaveGroup" onclick="submitAddGroup()">إنشاء المجموعة في Firestore</button>
        </div>
      </div>
    </div>`;
    onGroupModalYearChange();
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

function onGroupModalYearChange() {
  const yearId = document.getElementById('mGrpYear')?.value || '';
  const stageSel = document.getElementById('mGrpStage');
  const subjSel = document.getElementById('mGrpSubject');
  if (!window._batchAGroup) return;
  if (stageSel) {
    Array.from(stageSel.options).forEach(o => { const y = o.getAttribute('data-year'); o.style.display = (!y || !yearId || y === yearId) ? '' : 'none'; });
    const first = Array.from(stageSel.options).find(o => o.style.display !== 'none');
    if (first && stageSel.value !== first.value && (stageSel.selectedOptions[0]?.style.display === 'none')) stageSel.value = first.value;
  }
  onGroupModalStageChange();
}

function onGroupModalStageChange() {
  const stageId = document.getElementById('mGrpStage')?.value || '';
  const subjSel = document.getElementById('mGrpSubject');
  if (!subjSel) return;
  Array.from(subjSel.options).forEach(o => { const st = o.getAttribute('data-stage'); o.style.display = (!st || !stageId || st === stageId) ? '' : 'none'; });
  const first = Array.from(subjSel.options).find(o => o.style.display !== 'none');
  if (first) subjSel.value = first.value;
}

async function submitAddGroup() {
  const btn = document.getElementById('btnSaveGroup');
  const name = document.getElementById('mGrpName')?.value || '';
  const code = document.getElementById('mGrpCode')?.value || '';
  const academicYearId = document.getElementById('mGrpYear')?.value || '';
  const stageId = document.getElementById('mGrpStage')?.value || '';
  const subjectId = document.getElementById('mGrpSubject')?.value || '';
  const teacherId = document.getElementById('mGrpTeacher')?.value || '';
  const roomId = document.getElementById('mGrpRoom')?.value || '';
  const maxCapacity = Number(document.getElementById('mGrpCapacity')?.value || 0);
  const schedule = document.getElementById('mGrpSchedule')?.value || '';
  const monthlyFee = Number(document.getElementById('mGrpFee')?.value || 0);
  if (!name.trim()) { showToast('اسم المجموعة مطلوب', true); return; }
  if (!academicYearId || !stageId || !subjectId || !teacherId || !roomId) { showToast('جميع العلاقات الأكاديمية مطلوبة (السنة، المرحلة، المادة، المعلم، القاعة)', true); return; }
  if (!Number.isInteger(maxCapacity) || maxCapacity <= 0) { showToast('سعة المجموعة يجب أن تكون رقماً صحيحاً موجباً', true); return; }
  if (btn) { btn.disabled = true; btn.innerText = 'جاري الإنشاء... ⏳'; }
  try {
    const res = await callBackend('createGroup', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name: name.trim(), code: code.trim(), academicYearId, stageId, subjectId, teacherId, roomId,
      maxCapacity, schedule, monthlyFee, status: 'ACTIVE'
    });
    closeModal();
    showToast(`تم إنشاء المجموعة ${res.name} بنجاح!`);
    await renderActiveView('groups');
  } catch (err) { showToast(friendlyBatchAError(err), true); if (btn) { btn.disabled = false; btn.innerText = 'إنشاء المجموعة في Firestore'; } }
}

async function archiveGroupAction(id) {
  if (!confirm('هل أنت متأكد من أرشفة هذه المجموعة؟ ستبقى بيانات الطلاب والتسجيلات للمراجعة.')) return;
  try {
    await callBackend('archiveGroup', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة المجموعة بنجاح');
    await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function deleteGroupAction(id) {
  if (!confirm('هل أنت متأكد من حذف هذه المجموعة نهائيًا؟ لا يمكن التراجع.')) return;
  if (!confirm('تأكيد نهائي: سيتم الحذف فقط إذا لم توجد طلاب أو تسجيلات مرتبطة. المتابعة؟')) return;
  try {
    await callBackend('deleteGroup', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تم حذف المجموعة نهائياً');
    await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); }
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
    // Mandatory password screen takes precedence over device lock for input usability, but device lock is security-critical.
    // Per spec: only REVOKED shows lock; PENDING_VALIDATION and CONNECTION_REQUIRED do NOT show lock.
    if (isPasswordChangeRequired()) {
      // Keep mandatory visible, ensure lock does not cover it
      if (lock) lock.style.display = 'none';
      if (badge) {
        badge.innerText = 'تغيير كلمة المرور مطلوب 🔑';
        badge.className = 'badge warning';
      }
      return;
    }
    if (st && st.status === 'REVOKED') {
      badge.innerText = 'الجهاز ملغى 🛑';
      badge.className = 'badge revoked';
      lock.style.display = 'flex';
      lock.style.zIndex = '999';
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

// ----------------------------------------------------------------------------
// PHASE 50.1 ACADEMIC SETUP MODALS & ACTIONS
// ----------------------------------------------------------------------------

// --- Academic Years ---

function openAddAcademicYearModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إضافة سنة دراسية جديدة</div>
        <div class="form-group"><label>اسم السنة الدراسية (مثال: العام الدراسي 2026 / 2027) *</label><input type="text" id="mYearName" placeholder="2026/2027"></div>
        <div class="form-group"><label>تاريخ البداية *</label><input type="date" id="mYearStart"></div>
        <div class="form-group"><label>تاريخ النهاية *</label><input type="date" id="mYearEnd"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitCreateAcademicYear()">حفظ السنة الدراسية</button>
        </div>
      </div>
    </div>
  `;
}

async function submitCreateAcademicYear() {
  const name = document.getElementById('mYearName').value;
  const startDate = document.getElementById('mYearStart').value;
  const endDate = document.getElementById('mYearEnd').value;
  try {
    const res = await callBackend('createAcademicYear', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name,
      startDate,
      endDate
    });
    closeModal();
    showToast(`تم إضافة السنة الدراسية (${res.name}) بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function openEditAcademicYearModal(id) {
  const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  const year = (years || []).find(y => y.id === id);
  if (!year) { showToast('السنة الدراسية غير موجودة', true); return; }

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">تعديل بيانات السنة الدراسية</div>
        <div class="form-group"><label>اسم السنة الدراسية *</label><input type="text" id="mEditYearName" value="${year.name || ''}"></div>
        <div class="form-group"><label>تاريخ البداية</label><input type="date" id="mEditYearStart" value="${year.startDate || ''}"></div>
        <div class="form-group"><label>تاريخ النهاية</label><input type="date" id="mEditYearEnd" value="${year.endDate || ''}"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitUpdateAcademicYear('${year.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>
  `;
}

async function submitUpdateAcademicYear(id) {
  const name = document.getElementById('mEditYearName').value;
  const startDate = document.getElementById('mEditYearStart').value;
  const endDate = document.getElementById('mEditYearEnd').value;
  try {
    await callBackend('updateAcademicYear', currentCallerToken, id, {
      institutionId: currentCallerToken.institutionId,
      name,
      startDate,
      endDate
    });
    closeModal();
    showToast('تم تحديث بيانات السنة الدراسية بنجاح!');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function toggleAcademicYearStatusAction(id, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await callBackend('setAcademicYearStatus', currentCallerToken, id, newStatus);
    showToast(`تم ${newStatus === 'ACTIVE' ? 'تفعيل' : 'تعطيل'} السنة الدراسية بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function archiveAcademicYearAction(id) {
  if (!confirm('هل أنت تأكد من أرشفة هذه السنة الدراسية؟')) return;
  try {
    await callBackend('archiveAcademicYear', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة السنة الدراسية');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

// --- Stages ---

async function openAddStageModal() {
  const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  if (!years || years.length === 0) {
    showToast('يجب إضافة سنة دراسية أولاً قبل إنشاء المراحل الدراسية', true);
    return;
  }

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إضافة مرحلة دراسية جديدة</div>
        <div class="form-group">
          <label>السنة الدراسية التابعة لها *</label>
          <select id="mStageYearId" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            ${years.map(y => `<option value="${y.id}">${y.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>اسم المرحلة (مثال: المرحلة الثانوية - الصف الثالث) *</label><input type="text" id="mStageName" placeholder="الصف الثالث الثانوي"></div>
        <div class="form-group"><label>كود المرحلة</label><input type="text" id="mStageCode" placeholder="SEC-3"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitCreateStage()">حفظ المرحلة</button>
        </div>
      </div>
    </div>
  `;
}

async function submitCreateStage() {
  const academicYearId = document.getElementById('mStageYearId').value;
  const name = document.getElementById('mStageName').value;
  const code = document.getElementById('mStageCode').value;
  try {
    const res = await callBackend('createStage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      academicYearId,
      name,
      code
    });
    closeModal();
    showToast(`تم إضافة المرحلة (${res.name}) بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function openEditStageModal(id) {
  const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  const stage = (stages || []).find(s => s.id === id);
  if (!stage) { showToast('المرحلة غير موجودة', true); return; }

  const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">تعديل بيانات المرحلة الدراسية</div>
        <div class="form-group">
          <label>السنة الدراسية *</label>
          <select id="mEditStageYearId" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            ${years.map(y => `<option value="${y.id}" ${y.id === stage.academicYearId ? 'selected' : ''}>${y.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>اسم المرحلة *</label><input type="text" id="mEditStageName" value="${stage.name || ''}"></div>
        <div class="form-group"><label>كود المرحلة</label><input type="text" id="mEditStageCode" value="${stage.code || ''}"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitUpdateStage('${stage.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>
  `;
}

async function submitUpdateStage(id) {
  const academicYearId = document.getElementById('mEditStageYearId').value;
  const name = document.getElementById('mEditStageName').value;
  const code = document.getElementById('mEditStageCode').value;
  try {
    await callBackend('updateStage', currentCallerToken, id, {
      institutionId: currentCallerToken.institutionId,
      academicYearId,
      name,
      code
    });
    closeModal();
    showToast('تم تحديث بيانات المرحلة بنجاح!');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function toggleStageStatusAction(id, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await callBackend('setStageStatus', currentCallerToken, id, newStatus);
    showToast(`تم ${newStatus === 'ACTIVE' ? 'تفعيل' : 'تعطيل'} المرحلة بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function archiveStageAction(id) {
  if (!confirm('أرشفة هذه المرحلة الدراسية؟')) return;
  try {
    await callBackend('archiveStage', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة المرحلة الدراسية');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

// --- Subjects ---

async function openAddSubjectModal() {
  const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];

  if (!years || years.length === 0) {
    showToast('يجب إضافة سنة دراسية ومرحلة قبل إضافة المواد الدراسية', true);
    return;
  }
  if (!stages || stages.length === 0) {
    showToast('يجب إضافة مرحلة دراسية واحدة على الأقل قبل إضافة المواد الدراسية', true);
    return;
  }

  const container = document.getElementById('modalContainer');
  const selectedYearId = years[0].id;
  const filteredStages = stages.filter(s => s.academicYearId === selectedYearId);

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إضافة مادة دراسية جديدة</div>
        <div class="form-group">
          <label>السنة الدراسية *</label>
          <select id="mSubjYearId" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" onchange="onModalSubjectYearChange()">
            ${years.map(y => `<option value="${y.id}">${y.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>المرحلة الدراسية *</label>
          <select id="mSubjStageId" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            ${stages.map(s => `<option value="${s.id}" data-year="${s.academicYearId}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>اسم المادة (مثال: الفيزياء الحديثة) *</label><input type="text" id="mSubjName" placeholder="الفيزياء"></div>
        <div class="form-group"><label>رمز / كود المادة</label><input type="text" id="mSubjCode" placeholder="PHY-101"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" style="background:#8b5cf6;" onclick="submitCreateSubject()">حفظ المادة</button>
        </div>
      </div>
    </div>
  `;
}

function onModalSubjectYearChange() {
  const yearId = document.getElementById('mSubjYearId')?.value;
  const stageSelect = document.getElementById('mSubjStageId');
  if (!yearId || !stageSelect) return;

  Array.from(stageSelect.options).forEach(opt => {
    const stgYear = opt.getAttribute('data-year');
    opt.style.display = (!stgYear || stgYear === yearId) ? 'block' : 'none';
  });

  const firstVisible = Array.from(stageSelect.options).find(opt => opt.style.display !== 'none');
  if (firstVisible) stageSelect.value = firstVisible.value;
}

async function submitCreateSubject() {
  const academicYearId = document.getElementById('mSubjYearId').value;
  const stageId = document.getElementById('mSubjStageId').value;
  const name = document.getElementById('mSubjName').value;
  const code = document.getElementById('mSubjCode').value;
  try {
    const res = await callBackend('createSubject', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      academicYearId,
      stageId,
      name,
      code
    });
    closeModal();
    showToast(`تم إضافة المادة (${res.name}) بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function openEditSubjectModal(id) {
  const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  const subject = (subjects || []).find(s => s.id === id);
  if (!subject) { showToast('المادة غير موجودة', true); return; }

  const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">تعديل بيانات المادة الدراسية</div>
        <div class="form-group">
          <label>السنة الدراسية *</label>
          <select id="mEditSubjYearId" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            ${years.map(y => `<option value="${y.id}" ${y.id === subject.academicYearId ? 'selected' : ''}>${y.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>المرحلة الدراسية *</label>
          <select id="mEditSubjStageId" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            ${stages.map(s => `<option value="${s.id}" ${s.id === subject.stageId ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>اسم المادة *</label><input type="text" id="mEditSubjName" value="${subject.name || ''}"></div>
        <div class="form-group"><label>رمز / كود المادة</label><input type="text" id="mEditSubjCode" value="${subject.code || ''}"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitUpdateSubject('${subject.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>
  `;
}

async function submitUpdateSubject(id) {
  const academicYearId = document.getElementById('mEditSubjYearId').value;
  const stageId = document.getElementById('mEditSubjStageId').value;
  const name = document.getElementById('mEditSubjName').value;
  const code = document.getElementById('mEditSubjCode').value;
  try {
    await callBackend('updateSubject', currentCallerToken, id, {
      institutionId: currentCallerToken.institutionId,
      academicYearId,
      stageId,
      name,
      code
    });
    closeModal();
    showToast('تم تحديث المادة الدراسية بنجاح!');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function toggleSubjectStatusAction(id, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await callBackend('setSubjectStatus', currentCallerToken, id, newStatus);
    showToast(`تم ${newStatus === 'ACTIVE' ? 'تفعيل' : 'تعطيل'} المادة الدراسية بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function archiveSubjectAction(id) {
  if (!confirm('أرشفة هذه المادة الدراسية؟')) return;
  try {
    await callBackend('archiveSubject', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة المادة الدراسية');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

// --- Rooms ---

function openAddRoomModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">+ إضافة قاعة أو صالة جديدة</div>
        <div class="form-group"><label>اسم القاعة (مثال: قاعة ابن الهيثم) *</label><input type="text" id="mRoomName" placeholder="قاعة 1"></div>
        <div class="form-group"><label>السعة الاستيعابية (عدد المقاعد) *</label><input type="number" id="mRoomCapacity" min="1" placeholder="40"></div>
        <div class="form-group"><label>الموقع / المكان (مثال: الدور الثاني - مبنى A)</label><input type="text" id="mRoomLocation" placeholder="الدور الأول"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" style="background:#0284c7;" onclick="submitCreateRoom()">حفظ القاعة</button>
        </div>
      </div>
    </div>
  `;
}

async function submitCreateRoom() {
  const name = document.getElementById('mRoomName').value;
  const capacity = document.getElementById('mRoomCapacity').value;
  const location = document.getElementById('mRoomLocation').value;
  try {
    const res = await callBackend('createRoom', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      name,
      capacity,
      location
    });
    closeModal();
    showToast(`تم إضافة القاعة (${res.name}) بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function openEditRoomModal(id) {
  const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  const room = (rooms || []).find(r => r.id === id);
  if (!room) { showToast('القاعة غير موجودة', true); return; }

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">تعديل بيانات القاعة</div>
        <div class="form-group"><label>اسم القاعة *</label><input type="text" id="mEditRoomName" value="${room.name || ''}"></div>
        <div class="form-group"><label>السعة الاستيعابية *</label><input type="number" id="mEditRoomCapacity" min="1" value="${room.capacity || ''}"></div>
        <div class="form-group"><label>الموقع / المكان</label><input type="text" id="mEditRoomLocation" value="${room.location || ''}"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitUpdateRoom('${room.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>
  `;
}

async function submitUpdateRoom(id) {
  const name = document.getElementById('mEditRoomName').value;
  const capacity = document.getElementById('mEditRoomCapacity').value;
  const location = document.getElementById('mEditRoomLocation').value;
  try {
    await callBackend('updateRoom', currentCallerToken, id, {
      institutionId: currentCallerToken.institutionId,
      name,
      capacity,
      location
    });
    closeModal();
    showToast('تم تحديث بيانات القاعة بنجاح!');
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function toggleRoomStatusAction(id, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await callBackend('setRoomStatus', currentCallerToken, id, newStatus);
    showToast(`تم ${newStatus === 'ACTIVE' ? 'تفعيل' : 'تعطيل'} القاعة بنجاح!`);
    await renderActiveView('academic');
  } catch (err) { showToast(err.message, true); }
}

async function archiveRoomAction(id) {
  if (!confirm('أرشفة هذه القاعة؟')) return;
  try {
    await callBackend('archiveRoom', currentCallerToken, id, currentCallerToken.institutionId);
    showToast('تمت أرشفة القاعة');
    await renderActiveView('academic');
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function openRoomGroupsModal(roomId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل مجموعات القاعة...</p></div></div>';
  try {
    const groups = await callBackend('getRoomGroups', currentCallerToken, roomId, currentCallerToken.institutionId) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const room = rooms.find(r => r.id === roomId);
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:560px;">
        <div class="modal-header">🏛️ المجموعات المسندة للقاعة — ${escapeHtmlAttr(room ? room.name : roomId)}</div>
        ${groups.length ? `<table class="data-table"><thead><tr><th>المجموعة</th><th>السعة</th><th>الحالة</th><th></th></tr></thead><tbody>${groups.map(g => `<tr><td><strong>${escapeHtmlAttr(g.name)}</strong></td><td>${g.enrolledCount || 0}/${g.maxCapacity || 30}</td><td>${g.status}</td><td><button class="btn" style="padding:0.2rem 0.5rem; font-size:0.72rem; background:#8b5cf6;" onclick="openGroupDetailsModal('${g.id}')">التفاصيل</button></td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;">لا توجد مجموعات مسندة لهذه القاعة.</p>'}
        <p style="color:#94a3b8; font-size:0.8rem;">قبل حذف/أرشفة القاعة: يجب إعادة إسناد هذه المجموعات لقاعة أخرى أو أرشفتها.</p>
        <div style="display:flex; justify-content:flex-end;"><button class="btn btn-primary" onclick="closeModal()">إغلاق</button></div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function viewStudentDetailsModal(studentId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل بروفايل الطالب...</p></div></div>';
  try {
    const student = await callBackend('getStudentById', currentCallerToken, studentId, currentCallerToken.institutionId);
    const groups = await callBackend('getStudentGroups', currentCallerToken, studentId, currentCallerToken.institutionId).catch(() => []) || [];
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const yearMap = new Map(years.map(y => [y.id, y.name]));
    const stageMap = new Map(stages.map(s => [s.id, s.name]));
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const teacherMap = new Map(teachers.map(t => [t.id, t.fullName || t.name]));
    const roomMap = new Map(rooms.map(r => [r.id, r.name]));
    const subjectSet = new Set(groups.map(g => g.subjectId).filter(Boolean));
    const teacherSet = new Set(groups.map(g => g.teacherId).filter(Boolean));
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:680px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">👤 بروفايل الطالب — ${escapeHtmlAttr(student.name)} <span class="code-box">${student.studentCode || student.id}</span></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">1) البيانات الأساسية</div>
            <p><strong>الاسم:</strong> ${escapeHtmlAttr(student.name)}</p>
            <p><strong>الكود:</strong> <span class="code-box">${student.studentCode || student.id}</span></p>
            <p><strong>الهاتف:</strong> ${student.phone || '-'} <span style="color:#64748b; font-size:0.75rem;">(${student.normalizedPhone || '-'})</span></p>
            <p><strong>الحالة:</strong> <span class="badge">${student.status}</span></p>
            <p><strong>QR:</strong> <span class="code-box">${student.qrToken || ('QR_' + student.id)}</span></p>
          </div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">2) ولي الأمر</div>
            <p><strong>الاسم:</strong> ${escapeHtmlAttr(student.guardianName || '-')}</p>
            <p><strong>الهاتف:</strong> ${student.guardianPhone || '-'}</p>
            <div class="card-title" style="margin-top:0.75rem;">3) حالة الهوية Auth</div>
            ${student.authUid ? `<span class="badge" style="background:#064e3b; color:#34d399;">AUTH PROVISIONED (${student.authUid})</span>` : `<span class="badge warning">PROFILE DRAFT 🟡</span>`}
          </div>
        </div>
        <div class="card" style="padding:0.9rem;"><div class="card-title">4) البيانات الأكاديمية</div>
          <p><strong>السنة:</strong> ${escapeHtmlAttr(yearMap.get(student.academicYearId) || student.academicYearId || '-')} | <strong>المرحلة:</strong> ${escapeHtmlAttr(stageMap.get(student.stageId) || student.stage || student.grade || '-')}</p>
        </div>
        <div class="card" style="padding:0.9rem;"><div class="card-title">5) المجموعات (${groups.length})</div>
          ${groups.length ? `<table class="data-table"><thead><tr><th>المجموعة</th><th>المادة</th><th>المعلم</th><th>القاعة</th><th>السعة</th></tr></thead><tbody>${groups.map(g => `<tr><td><strong>${escapeHtmlAttr(g.name)}</strong></td><td>${escapeHtmlAttr(subjectMap.get(g.subjectId) || g.subjectName || '-')}</td><td>${escapeHtmlAttr(teacherMap.get(g.teacherId) || g.teacherName || '-')}</td><td>${escapeHtmlAttr(roomMap.get(g.roomId) || g.room || '-')}</td><td>${g.enrolledCount || 0}/${g.maxCapacity || 30}</td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;">الطالب غير مسجل في أي مجموعة حالياً.</p>'}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">6) المواد (${subjectSet.size})</div>${subjectSet.size ? [...subjectSet].map(sid => `<span class="badge" style="background:#1e293b; color:#38bdf8; margin:0.15rem; display:inline-block;">${escapeHtmlAttr(subjectMap.get(sid) || sid)}</span>`).join('') : '<p style="color:#94a3b8; font-size:0.8rem;">لا توجد مواد مرتبطة بعد</p>'}</div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">7) المعلمون (${teacherSet.size})</div>${teacherSet.size ? [...teacherSet].map(tid => `<span class="badge" style="background:#1e293b; color:#a78bfa; margin:0.15rem; display:inline-block;">${escapeHtmlAttr(teacherMap.get(tid) || tid)}</span>`).join('') : '<p style="color:#94a3b8; font-size:0.8rem;">لا يوجد معلمون مرتبطون بعد</p>'}</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.75rem;">
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">8) الحضور</div><p style="color:#94a3b8; font-size:0.85rem;">لا توجد بيانات حضور حتى الآن</p></div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">9) الجدول</div><p style="color:#94a3b8; font-size:0.85rem;">لا توجد حصص مجدولة لهذا الطالب حتى الآن</p></div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">10) المدفوعات</div><p style="color:#94a3b8; font-size:0.85rem;">لا توجد مدفوعات مسجلة حتى الآن</p></div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">11) الدرجات</div><p style="color:#94a3b8; font-size:0.85rem;">لا توجد درجات مسجلة حتى الآن</p></div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">12) الاشتراكات</div><p style="color:#94a3b8; font-size:0.85rem;">لا توجد اشتراكات مفعلة حتى الآن</p></div>
          <div class="card" style="margin:0; padding:0.9rem;"><div class="card-title">13) ملاحظات</div><p style="color:#e2e8f0; font-size:0.85rem;">${escapeHtmlAttr(student.notes || '—')}</p></div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem; flex-wrap:wrap;">
          <button class="btn" style="background:#475569;" onclick="openEditStudentModal('${student.id}')">تعديل</button>
          <button class="btn" onclick="openStudentGroupsModal('${student.id}')">إدارة المجموعات</button>
          <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function openEditStudentModal(studentId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل بيانات الطالب...</p></div></div>';
  try {
    const student = await callBackend('getStudentById', currentCallerToken, studentId, currentCallerToken.institutionId);
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const groups = await callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const currentIds = canonicalIdsOf(student);
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:620px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">تعديل بيانات الطالب — ${escapeHtmlAttr(student.name)}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group"><label>الاسم *</label><input type="text" id="eStudentName" value="${escapeHtmlAttr(student.name || '')}"></div>
          <div class="form-group"><label>هاتف الطالب *</label><input type="text" id="eStudentPhone" value="${escapeHtmlAttr(student.phone || '')}"></div>
          <div class="form-group"><label>هاتف ولي الأمر *</label><input type="text" id="eGuardianPhone" value="${escapeHtmlAttr(student.guardianPhone || '')}"></div>
          <div class="form-group"><label>اسم ولي الأمر *</label><input type="text" id="eGuardianName" value="${escapeHtmlAttr(student.guardianName || '')}"></div>
          <div class="form-group"><label>السنة الدراسية</label><select id="eStudentYear">${years.map(y => `<option value="${y.id}" ${y.id === student.academicYearId ? 'selected' : ''}>${escapeHtmlAttr(y.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المرحلة الدراسية</label><select id="eStudentStage">${stages.map(s => `<option value="${s.id}" ${s.id === student.stageId ? 'selected' : ''}>${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
        </div>
        <div class="form-group"><label>الحالة</label><select id="eStudentStatus">${['ACTIVE','SUSPENDED','WITHDRAWN','GRADUATED'].map(st => `<option value="${st}" ${student.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select></div>
        <div class="form-group"><label>المجموعات (حدد المجموعات المطلوبة — سيتم تطبيق قواعد التسجيل الذرية)</label>
          <div style="max-height:180px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;">
          ${groups.filter(g => g.status === 'ACTIVE').map(g => {
            const enrolled = Number(g.enrolledCount || 0); const cap = Number(g.maxCapacity || 30);
            const isMember = currentIds.includes(g.id);
            const full = !isMember && enrolled >= cap;
            const stageMismatch = student.stageId && g.stageId && g.stageId !== document.getElementById('eStudentStage')?.value && false;
            return `<label style="display:flex; gap:0.5rem; padding:0.3rem; opacity:${full ? 0.55 : 1};"><input type="checkbox" value="${g.id}" class="eStudentGroupChk" ${isMember ? 'checked' : ''} ${full ? 'disabled' : ''}> <span>${escapeHtmlAttr(g.name)} (${enrolled}/${cap})${full ? ' — ممتلئة' : ''}${(student.stageId && g.stageId && g.stageId !== student.stageId && !isMember) ? ' — مرحلة مختلفة' : ''}</span></label>`;
          }).join('') || '<p style="color:#94a3b8;">لا توجد مجموعات نشطة</p>'}
          </div>
          <div style="color:#fbbf24; font-size:0.75rem; margin-top:0.3rem;">تنبيه: تغيير المرحلة مع بقاء مجموعات من مرحلة أخرى سيتطلب معالجة صريحة وسيتم رفض الحفظ.</div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnUpdateStudent" onclick="submitEditStudent('${student.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function submitEditStudent(studentId) {
  const btn = document.getElementById('btnUpdateStudent');
  const name = document.getElementById('eStudentName')?.value || '';
  const phone = document.getElementById('eStudentPhone')?.value || '';
  const guardianPhone = document.getElementById('eGuardianPhone')?.value || '';
  const guardianName = document.getElementById('eGuardianName')?.value || '';
  const academicYearId = document.getElementById('eStudentYear')?.value || '';
  const stageId = document.getElementById('eStudentStage')?.value || '';
  const status = document.getElementById('eStudentStatus')?.value || 'ACTIVE';
  const groupIds = Array.from(document.querySelectorAll('.eStudentGroupChk:checked')).map(c => c.value);
  if (btn) { btn.disabled = true; btn.innerText = 'جاري الحفظ... ⏳'; }
  try {
    await callBackend('updateStudent', currentCallerToken, studentId, { institutionId: currentCallerToken.institutionId, name: name.trim(), phone: phone.trim(), guardianPhone: guardianPhone.trim(), guardianName: guardianName.trim(), academicYearId, stageId, status, groupIds });
    closeModal();
    showToast('تم تحديث بيانات الطالب بنجاح');
    await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); if (btn) { btn.disabled = false; btn.innerText = 'حفظ التعديلات'; } }
}

async function viewTeacherDetailsModal(teacherId) {
  const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId });
  const teacher = (teachers || []).find(t => t.id === teacherId);
  if (!teacher) { showToast('المعلم غير موجود', true); return; }
  let subjectAssignments = [], stageAssignments = [], allSubjects=[], allStages=[];
  try { subjectAssignments = await callBackend('getTeacherSubjects', currentCallerToken, teacherId, currentCallerToken.institutionId) || []; } catch(e){ subjectAssignments=[]; }
  try { stageAssignments = await callBackend('getTeacherStages', currentCallerToken, teacherId, currentCallerToken.institutionId) || []; } catch(e){ stageAssignments=[]; }
  try { allSubjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || []; } catch(e){ allSubjects=[]; }
  try { allStages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || []; } catch(e){ allStages=[]; }
  const subjectMap = allSubjects.reduce((a,s)=>{a[s.id]=s.name; return a;},{});
  const stageMap = allStages.reduce((a,s)=>{a[s.id]=s.name; return a;},{});
  let teacherGroups = [];
  try { teacherGroups = await callBackend('getTeacherGroups', currentCallerToken, teacherId, currentCallerToken.institutionId) || []; } catch(e){ teacherGroups=[]; }
  const availableSubjects = allSubjects.filter(s => !subjectAssignments.some(a=>a.subjectId===s.id));
  const availableStages = allStages.filter(s => !stageAssignments.some(a=>a.stageId===s.id));
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:620px; max-height:85vh; overflow-y:auto;">
        <div class="modal-header">تفاصيل سجل المعلم — ${teacher.teacherCode||teacher.id} — ${teacher.fullName||teacher.name}</div>
        <p><strong>كود المعلم:</strong> <span class="code-box">${teacher.teacherCode||teacher.id}</span></p>
        <p><strong>اسم المعلم:</strong> ${teacher.fullName||teacher.name}</p>
        <p><strong>رقم الهاتف:</strong> ${teacher.phone||'-'} <span style="font-size:0.7rem; color:#94a3b8;">(${teacher.normalizedPhone||''})</span></p>
        <p><strong>البريد الإلكتروني:</strong> ${teacher.email||'-'}</p>
        <p><strong>التخصص:</strong> ${teacher.specialization||teacher.subject||'-'}</p>
        <p><strong>الحالة:</strong> ${teacher.status}</p>
        <p><strong>حالة هوية Auth (Phone + OTP):</strong> 
          ${teacher.authUid ? `<span class="badge" style="background:#064e3b; color:#34d399;">AUTH PROVISIONED (${teacher.authUid})</span>` : `<span class="badge warning">PROFILE DRAFT — ربط الهاتف + OTP عند تسجيل المعلم للدخول</span>`}
        </p>
        <hr style="border-color:#334155; margin:1rem 0;">
        <h4 style="margin:0 0 0.5rem 0; color:#38bdf8;">المواد التي يدرسها المعلم (${subjectAssignments.length})</h4>
        ${subjectAssignments.length>0 ? `<ul style="list-style:none; padding:0;">${subjectAssignments.map(a=>`<li style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.45rem 0.6rem; border-radius:6px; margin-bottom:0.3rem;"><span>${subjectMap[a.subjectId]||a.subjectId} <span class="code-box" style="font-size:0.7rem;">${a.subjectId}</span></span><button class="btn btn-danger" style="padding:0.2rem 0.4rem; font-size:0.7rem;" onclick="removeTeacherSubjectAction('${teacherId}','${a.id}')">إزالة</button></li>`).join('')}</ul>` : '<p style="color:#94a3b8; font-size:0.85rem;">لم يتم تخصيص مواد بعد</p>'}
        ${availableSubjects.length>0 ? `<div style="display:flex; gap:0.5rem; margin-top:0.5rem;"><select id="addSubjectSelect" style="flex:1; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">${availableSubjects.map(s=>`<option value="${s.id}">${s.name} (${s.code||s.id})</option>`).join('')}</select><button class="btn btn-success" style="padding:0.3rem 0.6rem;" onclick="addTeacherSubjectAction('${teacherId}')">+ إضافة مادة</button></div>` : ''}
        <h4 style="margin:1rem 0 0.5rem 0; color:#38bdf8;">المراحل التي يدرسها المعلم (${stageAssignments.length})</h4>
        ${stageAssignments.length>0 ? `<ul style="list-style:none; padding:0;">${stageAssignments.map(a=>`<li style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.45rem 0.6rem; border-radius:6px; margin-bottom:0.3rem;"><span>${stageMap[a.stageId]||a.stageId} <span class="code-box" style="font-size:0.7rem;">${a.stageId}</span></span><button class="btn btn-danger" style="padding:0.2rem 0.4rem; font-size:0.7rem;" onclick="removeTeacherStageAction('${teacherId}','${a.id}')">إزالة</button></li>`).join('')}</ul>` : '<p style="color:#94a3b8; font-size:0.85rem;">لم يتم تخصيص مراحل بعد</p>'}
        ${availableStages.length>0 ? `<div style="display:flex; gap:0.5rem; margin-top:0.5rem;"><select id="addStageSelect" style="flex:1; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">${availableStages.map(s=>`<option value="${s.id}">${s.name} (${s.code||s.id})</option>`).join('')}</select><button class="btn btn-success" style="padding:0.3rem 0.6rem;" onclick="addTeacherStageAction('${teacherId}')">+ إضافة مرحلة</button></div>` : ''}
        <h4 style="margin:1rem 0 0.5rem 0; color:#a78bfa;">المجموعات التي يدرسها المعلم (${teacherGroups.length}) — من group.teacherId</h4>
        ${teacherGroups.length>0 ? `<ul style="list-style:none; padding:0;">${teacherGroups.map(g=>`<li style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.45rem 0.6rem; border-radius:6px; margin-bottom:0.3rem;"><span><strong>${escapeHtmlAttr(g.name)}</strong> <span class="code-box" style="font-size:0.7rem;">${g.code || g.id}</span> <span style="font-size:0.75rem; color:#94a3b8;">${g.enrolledCount || 0}/${g.maxCapacity || 30}</span></span><button class="btn" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#8b5cf6;" onclick="openGroupDetailsModal('${g.id}')">التفاصيل</button></li>`).join('')}</ul>` : '<p style="color:#94a3b8; font-size:0.85rem;">لا توجد مجموعات مسندة لهذا المعلم بعد</p>'}
        <div style="display:flex; justify-content:flex-end; margin-top:1.5rem;">
          <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}
async function addTeacherSubjectAction(teacherId){
  const sel=document.getElementById('addSubjectSelect');
  if(!sel||!sel.value) return;
  try{ await callBackend('assignTeacherSubject', currentCallerToken, { institutionId: currentCallerToken.institutionId, teacherId, subjectId: sel.value }); showToast('تم تخصيص المادة للمعلم'); viewTeacherDetailsModal(teacherId); } catch(err){ showToast(err.message,true); }
}
async function removeTeacherSubjectAction(teacherId, assignmentId){
  try{ await callBackend('removeTeacherSubject', currentCallerToken, assignmentId, currentCallerToken.institutionId); showToast('تمت إزالة التخصيص'); viewTeacherDetailsModal(teacherId); } catch(err){ showToast(err.message,true); }
}
async function addTeacherStageAction(teacherId){
  const sel=document.getElementById('addStageSelect');
  if(!sel||!sel.value) return;
  try{ await callBackend('assignTeacherStage', currentCallerToken, { institutionId: currentCallerToken.institutionId, teacherId, stageId: sel.value }); showToast('تم تخصيص المرحلة للمعلم'); viewTeacherDetailsModal(teacherId); } catch(err){ showToast(err.message,true); }
}
async function removeTeacherStageAction(teacherId, assignmentId){
  try{ await callBackend('removeTeacherStage', currentCallerToken, assignmentId, currentCallerToken.institutionId); showToast('تمت إزالة المرحلة'); viewTeacherDetailsModal(teacherId); } catch(err){ showToast(err.message,true); }
}


async function openStudentGroupsModal(studentId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل مجموعات الطالب...</p></div></div>';
  try {
    const student = await callBackend('getStudentById', currentCallerToken, studentId, currentCallerToken.institutionId);
    const allGroups = await callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const teacherMap = new Map(teachers.map(t => [t.id, t.fullName || t.name]));
    const enrolledIds = canonicalIdsOf(student);
    const enrolledGroups = allGroups.filter(g => enrolledIds.includes(g.id));
    const availableGroups = allGroups.filter(g => !enrolledIds.includes(g.id) && g.status !== 'ARCHIVED');
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:600px; max-height:86vh; overflow-y:auto;">
        <div class="modal-header">إدارة مجموعات الطالب (${escapeHtmlAttr(student.name)})</div>
        <div style="margin-bottom:1rem;">
          <h4 style="margin:0 0 0.5rem 0; color:#38bdf8;">المجموعات المسجل بها حالياً (${enrolledGroups.length}):</h4>
          ${enrolledGroups.length > 0 ? `<ul style="list-style:none; padding:0; margin:0;">${enrolledGroups.map(g => `
            <li style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.5rem 0.75rem; border-radius:6px; margin-bottom:0.4rem;">
              <span><strong>${escapeHtmlAttr(g.name)}</strong><br><span style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(subjectMap.get(g.subjectId) || g.subjectName || '')} — ${escapeHtmlAttr(teacherMap.get(g.teacherId) || g.teacherName || '')} | ${g.enrolledCount || 0}/${g.maxCapacity || 30}</span></span>
              <span style="display:flex; gap:0.3rem;"><button class="btn" style="padding:0.2rem 0.5rem; font-size:0.72rem; background:#8b5cf6;" onclick="openGroupDetailsModal('${g.id}')">عرض المجموعة</button><button class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.72rem;" onclick="removeStudentFromGroupAction('${student.id}', '${g.id}')">إزالة</button></span>
            </li>`).join('')}</ul>` : `<p style="color:#94a3b8; font-size:0.85rem;">الطالب غير مسجل في أي مجموعة حالياً.</p>`}
        </div>
        <div class="form-group"><label>بحث في المجموعات المتاحة</label><input type="text" id="mAvailGroupSearch" placeholder="🔍 ابحث..." oninput="filterAvailGroups('${student.id}')" style="width:100%; padding:0.55rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;"></div>
        <div id="availGroupsBox">
          ${availableGroups.map(g => {
            const enrolled = Number(g.enrolledCount || 0); const cap = Number(g.maxCapacity || 30);
            const full = enrolled >= cap; const inactive = g.status !== 'ACTIVE';
            const stageMismatch = student.stageId && g.stageId && g.stageId !== student.stageId;
            const disabled = full || inactive || stageMismatch;
            const reason = inactive ? 'المجموعة غير نشطة' : full ? 'المجموعة ممتلئة' : stageMismatch ? 'الطالب مسجل في مرحلة مختلفة' : '';
            return `<div class="avail-group-row" data-name="${escapeHtmlAttr((g.name + ' ' + (subjectMap.get(g.subjectId) || '') + ' ' + (teacherMap.get(g.teacherId) || '')).toLowerCase())}" style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #334155; padding:0.5rem 0.7rem; border-radius:6px; margin-bottom:0.35rem; opacity:${disabled ? 0.6 : 1};">
              <span><strong>${escapeHtmlAttr(g.name)}</strong><br><span style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(subjectMap.get(g.subjectId) || '')} — ${escapeHtmlAttr(teacherMap.get(g.teacherId) || '')} | ${enrolled}/${cap}${reason ? ' — ' + reason : ''}</span></span>
              <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" ${disabled ? 'disabled title="' + reason + '"' : `onclick="addStudentToGroupDirect('${student.id}','${g.id}')"`}>إضافة</button>
            </div>`;
          }).join('') || '<p style="color:#94a3b8;">لا توجد مجموعات متاحة.</p>'}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:1rem;"><button class="btn btn-primary" onclick="closeModal()">تم والإغلاق</button></div>
      </div>
    </div>`;
    window._availGroups = availableGroups;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

function filterAvailGroups() {
  const q = (document.getElementById('mAvailGroupSearch')?.value || '').toLowerCase().trim();
  document.querySelectorAll('.avail-group-row').forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

async function addStudentToGroupDirect(studentId, groupId) {
  try {
    const res = await callBackend('addStudentToGroup', currentCallerToken, studentId, groupId, currentCallerToken.institutionId);
    showToast(`تمت إضافة الطالب للمجموعة بنجاح! (${res.enrolledCount})`);
    await openStudentGroupsModal(studentId);
    if (activeView === 'students' || activeView === 'groups') await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function addStudentToGroupAction(studentId) {
  const select = document.getElementById('mAddGroupIdSelect');
  if (!select || !select.value) return;
  await addStudentToGroupDirect(studentId, select.value);
}

async function removeStudentFromGroupAction(studentId, groupId) {
  if (!confirm('هل أنت متأكد من إزالة الطالب من هذه المجموعة؟ سيتم تحديث عدد المسجلين.')) return;
  try {
    const res = await callBackend('removeStudentFromGroup', currentCallerToken, studentId, groupId, currentCallerToken.institutionId);
    showToast(`تمت إزالة الطالب من المجموعة (${res.enrolledCount})`);
    await openStudentGroupsModal(studentId);
    if (activeView === 'students' || activeView === 'groups') await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function openGroupDetailsModal(groupId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل تفاصيل المجموعة...</p></div></div>';
  try {
    const group = await callBackend('getGroupById', currentCallerToken, groupId, currentCallerToken.institutionId);
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const students = await callBackend('getGroupStudents', currentCallerToken, groupId, currentCallerToken.institutionId).catch(() => []) || [];
    const find = (arr, id) => (arr || []).find(x => x.id === id);
    const year = find(years, group.academicYearId); const stage = find(stages, group.stageId);
    const subject = find(subjects, group.subjectId); const teacher = find(teachers, group.teacherId); const room = find(rooms, group.roomId);
    const enrolled = Number(group.enrolledCount || students.length || 0); const cap = Number(group.maxCapacity || group.capacity || 30);
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:700px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">📚 تفاصيل المجموعة — ${escapeHtmlAttr(group.name)} <span class="code-box">${group.code || group.id}</span></div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.6rem; margin-bottom:0.75rem;">
          <div class="stat-card" style="padding:0.8rem;"><div class="label">السنة</div><div style="font-weight:bold;">${escapeHtmlAttr(year ? year.name : (group.academicYearId || '-'))}</div></div>
          <div class="stat-card" style="padding:0.8rem;"><div class="label">المرحلة</div><div style="font-weight:bold;">${escapeHtmlAttr(stage ? stage.name : (group.stageId || '-'))}</div></div>
          <div class="stat-card" style="padding:0.8rem;"><div class="label">المادة</div><div style="font-weight:bold;">${escapeHtmlAttr(subject ? subject.name : (group.subjectName || '-'))}</div></div>
          <div class="stat-card" style="padding:0.8rem;"><div class="label">المعلم</div><div style="font-weight:bold;">${escapeHtmlAttr(teacher ? (teacher.fullName || teacher.name) : (group.teacherName || '-'))}</div></div>
          <div class="stat-card" style="padding:0.8rem;"><div class="label">القاعة</div><div style="font-weight:bold;">${escapeHtmlAttr(room ? room.name : (group.room || '-'))}</div></div>
          <div class="stat-card" style="padding:0.8rem;"><div class="label">السعة</div><div style="font-weight:bold; color:#38bdf8;">${enrolled} / ${cap} — المتبقي ${Math.max(0, cap - enrolled)}</div></div>
        </div>
        <p style="color:#94a3b8; font-size:0.85rem;">الحالة: <span class="badge">${group.status}</span> | الرسوم: ${group.monthlyFee || 0} ج.م | المواعيد: ${escapeHtmlAttr(group.schedule || '-')}</p>
        <div class="card" style="padding:0.9rem;"><div class="card-title">الطلاب المسجلون (${students.length})</div>
          ${students.length ? `<table class="data-table"><thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr></thead><tbody>${students.map(s => `<tr><td><span class="code-box">${s.studentCode || s.id}</span></td><td><strong>${escapeHtmlAttr(s.name)}</strong></td><td>${s.phone || '-'}</td><td>${s.status}</td><td>${s.createdAt ? String(s.createdAt).split('T')[0] : '-'}</td><td style="display:flex; gap:0.25rem;"><button class="btn" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#8b5cf6;" onclick="viewStudentDetailsModal('${s.id}')">البروفايل</button><button class="btn btn-danger" style="padding:0.2rem 0.45rem; font-size:0.7rem;" onclick="removeStudentFromGroupInModal('${s.id}','${group.id}')">إزالة</button></td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;">لا يوجد طلاب مسجلون في هذه المجموعة بعد.</p>'}
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn" style="background:#0284c7;" onclick="openManageGroupStudentsModal('${group.id}')">إدارة الطلاب</button>
          <button class="btn" style="background:#475569;" onclick="openEditGroupModal('${group.id}')">تعديل المجموعة</button>
          <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function openEditGroupModal(groupId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل بيانات المجموعة...</p></div></div>';
  try {
    const group = await callBackend('getGroupById', currentCallerToken, groupId, currentCallerToken.institutionId);
    const years = await callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const subjects = await callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const rooms = await callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:600px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">تعديل المجموعة — ${escapeHtmlAttr(group.name)}</div>
        <div class="form-group"><label>اسم المجموعة *</label><input type="text" id="eGrpName" value="${escapeHtmlAttr(group.name || '')}"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group"><label>السنة</label><select id="eGrpYear">${years.map(y => `<option value="${y.id}" ${y.id === group.academicYearId ? 'selected' : ''}>${escapeHtmlAttr(y.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المرحلة</label><select id="eGrpStage">${stages.map(s => `<option value="${s.id}" ${s.id === group.stageId ? 'selected' : ''}>${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المادة</label><select id="eGrpSubject">${subjects.map(s => `<option value="${s.id}" ${s.id === group.subjectId ? 'selected' : ''}>${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المعلم</label><select id="eGrpTeacher">${teachers.filter(t => t.status === 'ACTIVE').map(t => `<option value="${t.id}" ${t.id === group.teacherId ? 'selected' : ''}>${escapeHtmlAttr(t.fullName || t.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>القاعة</label><select id="eGrpRoom">${rooms.filter(r => r.status !== 'ARCHIVED').map(r => `<option value="${r.id}" ${r.id === group.roomId ? 'selected' : ''}>${escapeHtmlAttr(r.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>السعة * (المسجلون حالياً: ${group.enrolledCount || 0})</label><input type="number" id="eGrpCapacity" min="1" value="${group.maxCapacity || group.capacity || 30}"></div>
        </div>
        <div class="form-group"><label>المواعيد</label><input type="text" id="eGrpSchedule" value="${escapeHtmlAttr(group.schedule || '')}"></div>
        <div class="form-group"><label>الرسوم الشهرية</label><input type="number" id="eGrpFee" min="0" value="${group.monthlyFee || 0}"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnUpdateGroup" onclick="submitEditGroup('${group.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function submitEditGroup(groupId) {
  const btn = document.getElementById('btnUpdateGroup');
  const payload = {
    institutionId: currentCallerToken.institutionId,
    name: document.getElementById('eGrpName')?.value || '',
    academicYearId: document.getElementById('eGrpYear')?.value || '',
    stageId: document.getElementById('eGrpStage')?.value || '',
    subjectId: document.getElementById('eGrpSubject')?.value || '',
    teacherId: document.getElementById('eGrpTeacher')?.value || '',
    roomId: document.getElementById('eGrpRoom')?.value || '',
    maxCapacity: Number(document.getElementById('eGrpCapacity')?.value || 0),
    schedule: document.getElementById('eGrpSchedule')?.value || '',
    monthlyFee: Number(document.getElementById('eGrpFee')?.value || 0)
  };
  if (btn) { btn.disabled = true; btn.innerText = 'جاري الحفظ... ⏳'; }
  try {
    await callBackend('updateGroup', currentCallerToken, groupId, payload);
    closeModal();
    showToast('تم تحديث المجموعة بنجاح');
    await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); if (btn) { btn.disabled = false; btn.innerText = 'حفظ التعديلات'; } }
}

async function openManageGroupStudentsModal(groupId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل طلاب المجموعة...</p></div></div>';
  try {
    const group = await callBackend('getGroupById', currentCallerToken, groupId, currentCallerToken.institutionId);
    const enrolledStudents = await callBackend('getGroupStudents', currentCallerToken, groupId, currentCallerToken.institutionId).catch(() => []) || [];
    const allStudents = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stages = await callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const stageMap = new Map(stages.map(s => [s.id, s.name]));
    const enrolledIds = new Set(enrolledStudents.map(s => s.id));
    const candidates = allStudents.filter(s => !enrolledIds.has(s.id) && s.status !== 'ARCHIVED');
    const enrolled = Number(group.enrolledCount || enrolledStudents.length || 0); const cap = Number(group.maxCapacity || 30);
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:680px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">إدارة طلاب مجموعة (${escapeHtmlAttr(group.name)})</div>
        <p style="color:#94a3b8; font-size:0.85rem;">السعة: <strong style="color:#38bdf8;">${enrolled} / ${cap}</strong> — المتبقي ${Math.max(0, cap - enrolled)}</p>
        <div class="form-group"><label>بحث في الطلاب</label><input type="text" id="mGroupStudentSearch" placeholder="🔍 بالكود، الاسم أو الهاتف..." oninput="filterGroupCandidates()" style="width:100%; padding:0.55rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;"></div>
        <div style="max-height:200px; overflow-y:auto; margin-bottom:1rem;">
          <h4 style="color:#22c55e;">المسجلون حالياً (${enrolledStudents.length}):</h4>
          ${enrolledStudents.length ? `<table class="data-table"><thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${enrolledStudents.map(s => `<tr><td><span class="code-box">${s.studentCode || s.id}</span></td><td><strong>${escapeHtmlAttr(s.name)}</strong></td><td>${s.phone || '-'}</td><td>${s.status}</td><td style="display:flex; gap:0.25rem;"><button class="btn" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#8b5cf6;" onclick="viewStudentDetailsModal('${s.id}')">البروفايل</button><button class="btn btn-danger" style="padding:0.2rem 0.45rem; font-size:0.7rem;" onclick="removeStudentFromGroupInModal('${s.id}', '${group.id}')">إزالة</button></td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;">لا يوجد طلاب مسجلون بعد.</p>'}
        </div>
        <h4 style="color:#38bdf8;">إضافة طلاب (${candidates.length} مرشح):</h4>
        <div id="groupCandidatesBox" style="max-height:200px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:0.5rem; background:#0f172a;">
          ${candidates.map(s => {
            const gIds = canonicalIdsOf(s);
            const stageMismatch = group.stageId && s.stageId && s.stageId !== group.stageId;
            const alreadyFull = enrolled >= cap;
            const disabled = stageMismatch || alreadyFull || s.status === 'ARCHIVED';
            const reason = stageMismatch ? 'الطالب مسجل في مرحلة مختلفة' : alreadyFull ? 'المجموعة ممتلئة' : (s.status === 'ARCHIVED' ? 'الطالب مؤرشف' : '');
            return `<div class="group-cand-row" data-name="${escapeHtmlAttr(((s.name || '') + ' ' + (s.studentCode || '') + ' ' + (s.phone || '')).toLowerCase())}" style="display:flex; justify-content:space-between; align-items:center; padding:0.45rem; border-bottom:1px solid #1e293b; opacity:${disabled ? 0.6 : 1};">
              <span><strong>${escapeHtmlAttr(s.name)}</strong> <span class="code-box" style="font-size:0.65rem;">${s.studentCode || s.id}</span><br><span style="font-size:0.75rem; color:#94a3b8;">${s.phone || '-'} | ${escapeHtmlAttr(stageMap.get(s.stageId) || s.stage || '-')} | مجموعاته: ${gIds.length}${reason ? ' — ' + reason : ''}</span></span>
              <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" ${disabled ? 'disabled title="' + reason + '"' : `onclick="addStudentToGroupInModal2('${s.id}','${group.id}')"`}>+ إلحاق</button>
            </div>`;
          }).join('') || '<p style="color:#94a3b8;">لا يوجد مرشحون.</p>'}
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
          <button class="btn" style="background:#0284c7;" onclick="openGroupDetailsModal('${group.id}')">تفاصيل المجموعة</button>
          <button class="btn btn-primary" onclick="closeModal()">تم والإغلاق</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

function filterGroupCandidates() {
  const q = (document.getElementById('mGroupStudentSearch')?.value || '').toLowerCase().trim();
  document.querySelectorAll('.group-cand-row').forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

async function addStudentToGroupInModal(groupId) {
  const select = document.getElementById('mGroupStudentSelect');
  if (!select || !select.value) return;
  await addStudentToGroupInModal2(select.value, groupId);
}

async function addStudentToGroupInModal2(studentId, groupId) {
  try {
    const res = await callBackend('addStudentToGroup', currentCallerToken, studentId, groupId, currentCallerToken.institutionId);
    showToast(`تمت إضافة الطالب للمجموعة بنجاح! (${res.enrolledCount})`);
    await openManageGroupStudentsModal(groupId);
    if (activeView === 'students' || activeView === 'groups') await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function removeStudentFromGroupInModal(studentId, groupId) {
  if (!confirm('هل أنت متأكد من إزالة الطالب من هذه المجموعة؟')) return;
  try {
    const res = await callBackend('removeStudentFromGroup', currentCallerToken, studentId, groupId, currentCallerToken.institutionId);
    showToast(`تمت إزالة الطالب من المجموعة (${res.enrolledCount})`);
    const modalOpen = document.getElementById('modalContainer')?.innerHTML || '';
    if (modalOpen.includes('إدارة طلاب مجموعة')) await openManageGroupStudentsModal(groupId);
    else await openGroupDetailsModal(groupId);
    if (activeView === 'students' || activeView === 'groups') await renderActiveView(activeView);
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

