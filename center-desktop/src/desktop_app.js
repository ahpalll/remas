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
  const employeeOverlay = document.getElementById('employeeSelectionOverlay');
  const employeeLock = document.getElementById('employeeLockScreen');
  if (loginOverlay) loginOverlay.style.display = 'none';
  if (mandatoryOverlay) mandatoryOverlay.style.display = 'none';
  if (lockScreen) lockScreen.style.display = 'none';
  if (employeeOverlay) employeeOverlay.style.display = 'none';
  if (employeeLock) employeeLock.style.display = 'none';
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

function applyBrandingToUI(b) {
  if (!b) return;
  const centerName = b.centerName || 'REMAS EDU | رماس للتقنية التعليمية';
  const logoUrl = b.logoUrl || null;
  const subtitle = b.welcomeMessage || b.loginSubtitle || 'إدارة أذكى.. تعليم أفضل (v1.0.0-release.52.3.0)';

  // 1. Top Header
  const headerTitle = document.getElementById('mainHeaderTitle');
  if (headerTitle) {
    headerTitle.textContent = centerName;
  }
  const headerSub = document.getElementById('mainHeaderSubtitle');
  if (headerSub) {
    headerSub.textContent = subtitle;
  }
  const logoBox = document.getElementById('mainHeaderLogoBox');
  const logoImg = document.getElementById('mainHeaderLogo');
  if (logoBox && logoImg) {
    if (logoUrl) {
      logoImg.src = logoUrl;
      logoBox.style.display = 'flex';
    } else {
      logoBox.style.display = 'none';
    }
  }

  // 2. Login Screen
  const loginCenterName = document.getElementById('loginDisplayCenterName');
  if (loginCenterName) {
    loginCenterName.textContent = centerName;
  }
  const loginSub = document.getElementById('loginDisplaySubtitle');
  if (loginSub) {
    loginSub.textContent = b.loginSubtitle || 'أدخل بيانات حسابك الموثق على المنظمة للوصول إلى لوحة الإدارة';
  }
  const loginLogoImg = document.getElementById('loginDisplayLogo');
  const loginLogoPlaceholder = document.getElementById('loginLogoPlaceholder');
  if (loginLogoImg && loginLogoPlaceholder) {
    if (logoUrl) {
      loginLogoImg.src = logoUrl;
      loginLogoImg.style.display = 'block';
      loginLogoPlaceholder.style.display = 'none';
    } else {
      loginLogoImg.style.display = 'none';
      loginLogoPlaceholder.style.display = 'flex';
    }
  }

  // 3. Document Title
  document.title = `${centerName} — Windows Desktop App`;
}

function toggleLoginPasswordVisibility() {
  const pwd = document.getElementById('loginPassword');
  if (!pwd) return;
  pwd.type = pwd.type === 'password' ? 'text' : 'password';
}

function triggerLoginLogoUpload() {
  const input = document.getElementById('loginLogoFileInput');
  if (input) input.click();
}

async function handleLoginLogoSelected(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 2 * 1024 * 1024) {
    showToast('حجم الشعار كبير — يرجى اختيار صورة أقل من 2 ميجابايت', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const logoUrl = e.target.result;
    let active = {};
    try {
      const saved = localStorage.getItem('remas_active_branding');
      if (saved) active = JSON.parse(saved);
    } catch (_) {}
    active.logoUrl = logoUrl;
    try {
      localStorage.setItem('remas_active_branding', JSON.stringify(active));
      if (currentCallerToken && currentCallerToken.institutionId) {
        localStorage.setItem('remas_branding_' + currentCallerToken.institutionId, JSON.stringify(active));
        callBackend('updateBranding', currentCallerToken, {
          institutionId: currentCallerToken.institutionId,
          ...active,
          logoUrl
        }).catch(() => {});
      }
    } catch (_) {}
    applyBrandingToUI(active);
    showToast('تم تحديث شعار السنتر بنجاح!');
  };
  reader.readAsDataURL(file);
}

function showLoginScreen() {
  hideAllBlockingOverlays();
  const loginOverlay = document.getElementById('loginScreenOverlay');
  if (loginOverlay) {
    loginOverlay.style.display = 'flex';
    loginOverlay.style.zIndex = '998';
  }

  // Restore remembered credentials if saved
  try {
    const saved = localStorage.getItem('remas_saved_credentials');
    if (saved) {
      const data = JSON.parse(saved);
      const emailEl = document.getElementById('loginEmail');
      const pwdEl = document.getElementById('loginPassword');
      const remEl = document.getElementById('loginRememberMe');
      if (emailEl && data.email) emailEl.value = data.email;
      if (pwdEl && data.password) pwdEl.value = data.password;
      if (remEl) remEl.checked = true;
    }
  } catch (_) {}

  // Apply active branding to login screen
  try {
    const active = localStorage.getItem('remas_active_branding');
    if (active) applyBrandingToUI(JSON.parse(active));
  } catch (_) {}

  setTimeout(() => {
    const email = document.getElementById('loginEmail');
    const pwd = document.getElementById('loginPassword');
    if (email && !email.value) email.focus();
    else if (pwd) pwd.focus();
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

// ----------------------------------------------------------------------------
// LAYER 2: EMPLOYEE OPERATIONAL SESSION & PIN SYSTEM (Milestone C.1 Enforced)
// ----------------------------------------------------------------------------
let employeeSession = null;
let currentEmployeeName = '';
let employeeAutoLockTimer = null;

function closeEmployeeSelectionModal() {
  const overlay = document.getElementById('employeeSelectionOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function showEmployeeSelection() {
  hideAllBlockingOverlays();
  const overlay = document.getElementById('employeeSelectionOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.style.zIndex = '996';

  const container = document.getElementById('employeeSelectionContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:2rem; color:#94a3b8;"><div style="font-size:2rem; animation: pulse-green 1.5s infinite;">⏳</div><p style="margin-top:0.5rem;">جاري جلب موظفي السنتر المعتمدين...</p></div>';

  try {
    const employees = await callBackend('getEmployees', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    window._allEmployeesCache = employees;
    const activeEmployees = employees.filter(e => e.status === 'ACTIVE');

    let activeBranding = {};
    try {
      const saved = localStorage.getItem('remas_active_branding');
      if (saved) activeBranding = JSON.parse(saved);
    } catch (_) {}

    const centerName = activeBranding.centerName || 'السنتر التعليمي';
    const logoUrl = activeBranding.logoUrl;

    if (activeEmployees.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:1.5rem 1rem;">
          <div style="font-size:3rem; margin-bottom:0.5rem;">👨‍💼</div>
          <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا يوجد موظفون نشطون مسجلون بعد في ${escapeHtmlAttr(centerName)}</h3>
          <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:1.5rem; line-height:1.5;">
            لبدء العمل التشغيلي، يجب إنشاء حساب المدير العام الأول (Manager) وتعيين رقم سري (PIN) خاص به.
          </p>
          <div style="display:flex; justify-content:center; gap:0.75rem;">
            <button class="btn btn-success" style="padding:0.75rem 1.25rem; font-weight:bold;" onclick="closeEmployeeSelectionModal(); openAddEmployeeModal();">+ إضافة أول مدير عام الآن</button>
            <button class="btn btn-primary" style="padding:0.75rem 1.25rem; font-weight:bold;" onclick="bypassOwnerOperationalSession()">الدخول المباشر كمالك السنتر (Owner)</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:55px; max-width:120px; object-fit:contain; border-radius:8px; background:#fff; padding:4px; margin-bottom:0.5rem;">` : '<div style="font-size:2.5rem; margin-bottom:0.3rem;">👨‍💼</div>'}
        <div style="font-size:0.75rem; color:#38bdf8; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">OPERATIONAL SESSION GATE</div>
        <h2 style="color:#f8fafc; margin:0.2rem 0 0.4rem 0; font-size:1.4rem;">اختر حساب الموظف المشغل للمنصة</h2>
        <p style="color:#94a3b8; font-size:0.85rem; margin:0;">لضمان دقة العمليات وسجلات التدقيق المالي والإداري، اختر اسمك وأدخل الـ PIN الخاص بك</p>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:1rem; max-height:420px; overflow-y:auto; padding:0.25rem;">
        ${activeEmployees.map(emp => `
          <div class="employee-card-select" onclick="openEmployeePinPad('${emp.id}')" style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:1.1rem; text-align:center; cursor:pointer; transition:all 0.2s ease;">
            <div style="width:48px; height:48px; border-radius:50%; background:#1e293b; color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.4rem; margin:0 auto 0.6rem auto; border:1px solid #38bdf8;">
              ${emp.role === 'MANAGER' ? '👑' : (['ACCOUNTANT','CASHIER'].includes(emp.role) ? '💰' : '👤')}
            </div>
            <div style="color:#f8fafc; font-weight:bold; font-size:0.95rem; margin-bottom:0.3rem;">${escapeHtmlAttr(emp.name)}</div>
            <div style="margin-bottom:0.6rem;">${getEmployeeRoleBadge(emp.role)}</div>
            <div style="font-size:0.75rem; color:#64748b;">${escapeHtmlAttr(emp.jobTitle || 'موظف السنتر')}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
        <button class="btn btn-warning" onclick="logoutAction()" style="font-size:0.8rem; padding:0.4rem 0.8rem;">🚪 تسجيل خروج السنتر</button>
        <span style="font-size:0.75rem; color:#64748b;">🔒 الجلسة محمية بتشفير PBKDF2 والتحقق المعتمد</span>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:1.5rem; text-align:center;">تعذر جلب قائمة الموظفين: ${err.message}</div>`;
  }
}

async function openEmployeePinPad(employeeId) {
  let emp = null;
  try {
    const list = window._allEmployeesCache || await callBackend('getEmployees', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    emp = list.find(e => e.id === employeeId) || await callBackend('getEmployeeById', currentCallerToken, employeeId, currentCallerToken.institutionId);
  } catch (_) {}

  if (!emp) {
    showToast('تعذر جلب بيانات الموظف', true);
    return;
  }

  const container = document.getElementById('employeeSelectionContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; max-width:380px; margin:0 auto;">
      <div style="width:56px; height:56px; border-radius:50%; background:#1e293b; color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.6rem; margin:0 auto 0.6rem auto; border:2px solid #38bdf8;">
        ${emp.role === 'MANAGER' ? '👑' : '👤'}
      </div>
      <h3 style="color:#f8fafc; margin:0 0 0.2rem 0; font-size:1.25rem;">${escapeHtmlAttr(emp.name)}</h3>
      <div style="margin-bottom:0.75rem;">${getEmployeeRoleBadge(emp.role)}</div>
      <p style="color:#94a3b8; font-size:0.82rem; margin:0 0 1.25rem 0;">أدخل الرقم السري الخاص بك (PIN) لبدء الجلسة</p>

      <div id="pinPadAlert" style="display:none; background:#7f1d1d; color:#fecaca; border:1px solid #ef4444; border-radius:6px; padding:0.6rem; font-size:0.82rem; margin-bottom:1rem;"></div>

      <form onsubmit="event.preventDefault(); submitEmployeePin('${emp.id}');">
        <div style="margin-bottom:1.25rem;">
          <input type="password" id="employeePinInput" maxlength="8" placeholder="••••" required autofocus dir="ltr"
            style="width:200px; text-align:center; font-size:2rem; letter-spacing:8px; padding:0.6rem; background:#0f172a; border:2px solid #38bdf8; border-radius:10px; color:#38bdf8; font-family:monospace; outline:none;">
        </div>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.5rem; max-width:240px; margin:0 auto 1.25rem auto;">
          ${[1,2,3,4,5,6,7,8,9].map(n => `
            <button type="button" class="btn" style="background:#1e293b; color:#fff; font-size:1.2rem; font-weight:bold; padding:0.6rem; border-radius:8px;" onclick="pressPinDigit('${n}')">${n}</button>
          `).join('')}
          <button type="button" class="btn" style="background:#334155; color:#fca5a5; font-size:1.1rem; padding:0.6rem; border-radius:8px;" onclick="clearPinDigit()">⌫</button>
          <button type="button" class="btn" style="background:#1e293b; color:#fff; font-size:1.2rem; font-weight:bold; padding:0.6rem; border-radius:8px;" onclick="pressPinDigit('0')">0</button>
          <button type="button" class="btn btn-warning" style="font-size:0.85rem; padding:0.6rem; border-radius:8px;" onclick="resetPinInput()">مسح</button>
        </div>

        <div style="display:flex; justify-content:center; gap:0.75rem;">
          <button type="button" class="btn" style="background:#334155; padding:0.75rem 1.2rem;" onclick="showEmployeeSelection()">← اختيار موظف آخر</button>
          <button type="submit" id="btnVerifyPin" class="btn btn-primary" style="padding:0.75rem 1.5rem; font-weight:bold;">دخول الجلسة 🔓</button>
        </div>
      </form>
    </div>
  `;

  setTimeout(() => {
    const inp = document.getElementById('employeePinInput');
    if (inp) inp.focus();
  }, 100);
}

function pressPinDigit(d) {
  const inp = document.getElementById('employeePinInput');
  if (inp && inp.value.length < 8) {
    inp.value += d;
  }
}

function clearPinDigit() {
  const inp = document.getElementById('employeePinInput');
  if (inp && inp.value.length > 0) {
    inp.value = inp.value.slice(0, -1);
  }
}

function resetPinInput() {
  const inp = document.getElementById('employeePinInput');
  if (inp) inp.value = '';
}

async function submitEmployeePin(employeeId, explicitPin = null) {
  const pinInput = document.getElementById('employeePinInput');
  const pin = explicitPin || (pinInput ? pinInput.value.trim() : '');
  const alertEl = document.getElementById('pinPadAlert');
  const btn = document.getElementById('btnVerifyPin');

  if (!pin) {
    if (alertEl) { alertEl.textContent = 'يرجى إدخال الرقم السري (PIN)'; alertEl.style.display = 'block'; }
    return;
  }

  if (alertEl) alertEl.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    let result = null;
    if (window.electronAPI && typeof window.electronAPI.verifyEmployeePin === 'function') {
      const res = await window.electronAPI.verifyEmployeePin({
        institutionId: currentCallerToken.institutionId,
        employeeId,
        pin,
        callerToken: currentCallerToken
      });
      if (!res.success) {
        throw new Error(res.error || 'بيانات الدخول غير صالحة');
      }
      result = res.data;
    } else {
      result = await callBackend('verifyEmployeePin', currentCallerToken, {
        institutionId: currentCallerToken.institutionId,
        employeeId,
        pin
      });
    }

    // Operational Session established!
    employeeSession = result;
    currentEmployeeName = result.name || '';
    currentCallerToken.employeeId = result.id;
    currentCallerToken.employeeName = result.name;
    currentCallerToken.employeeRole = result.role;
    currentCallerToken.employeePermissions = result.permissions || [];

    // Hide overlays
    const selOverlay = document.getElementById('employeeSelectionOverlay');
    if (selOverlay) selOverlay.style.display = 'none';
    const lockOverlay = document.getElementById('employeeLockScreen');
    if (lockOverlay) lockOverlay.style.display = 'none';

    // Update Header with employee status
    updateEmployeeHeaderBadge();

    // Start auto lock timer (inactivity)
    startEmployeeAutoLock();

    // Render navigation and active view
    renderSidebarNav();
    await renderActiveView(activeView || 'dashboard');

    try { startScheduledWhatsAppWorker(); } catch (_) {}

    showToast(`مرحباً بك أ/ ${result.name} — تم فتح الجلسة التشغيلية بنجاح!`);
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = err.message || 'بيانات الدخول غير صالحة';
      alertEl.style.display = 'block';
    } else {
      showToast(err.message || 'بيانات الدخول غير صالحة', true);
    }
    resetPinInput();
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bypassOwnerOperationalSession() {
  employeeSession = {
    id: 'owner_' + (currentCallerToken.uid || 'admin'),
    name: 'مالك السنتر (Owner)',
    role: 'MANAGER',
    permissions: allMatrixPermissions(),
    sessionStartedAt: new Date().toISOString()
  };
  currentEmployeeName = employeeSession.name;
  currentCallerToken.employeeId = employeeSession.id;
  currentCallerToken.employeeName = employeeSession.name;
  currentCallerToken.employeeRole = 'MANAGER';
  currentCallerToken.employeePermissions = allMatrixPermissions();

  const selOverlay = document.getElementById('employeeSelectionOverlay');
  if (selOverlay) selOverlay.style.display = 'none';
  updateEmployeeHeaderBadge();
  startEmployeeAutoLock();
  renderSidebarNav();
  renderActiveView(activeView || 'dashboard');
  try { startScheduledWhatsAppWorker(); } catch (_) {}
  showToast('تم الدخول بصفة مالك السنتر (صلاحيات كاملة)');
}

function updateEmployeeHeaderBadge() {
  let badge = document.getElementById('employeeSessionBadge');
  const container = document.querySelector('.header-badges');
  if (!badge && container) {
    badge = document.createElement('span');
    badge.id = 'employeeSessionBadge';
    badge.className = 'badge';
    badge.style.background = '#1e3a8a';
    badge.style.color = '#93c5fd';
    badge.style.border = '1px solid #3b82f6';
    badge.style.cursor = 'pointer';
    badge.title = 'انقر لتبديل أو قفل جلسة الموظف';
    badge.onclick = () => lockEmployeeSession();
    container.insertBefore(badge, container.firstChild);
  }
  if (badge) {
    if (employeeSession) {
      badge.innerHTML = `👤 الموظف: <strong>${escapeHtmlAttr(employeeSession.name)}</strong> (${employeeSession.role}) 🔒`;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

function lockEmployeeSession() {
  if (employeeAutoLockTimer) clearTimeout(employeeAutoLockTimer);
  employeeSession = null;
  currentEmployeeName = '';
  if (currentCallerToken) {
    currentCallerToken.employeeId = null;
    currentCallerToken.employeeName = null;
    currentCallerToken.employeePermissions = [];
  }
  updateEmployeeHeaderBadge();
  showEmployeeSelection();
}

function unlockEmployeeSession() {
  showEmployeeSelection();
}

async function submitUnlockEmployeePin() {
  const pinInput = document.getElementById('unlockPinInput');
  const pin = pinInput ? pinInput.value.trim() : '';
  if (!pin) return showToast('يرجى إدخال الـ PIN', true);
  if (employeeSession && employeeSession.id) {
    await submitEmployeePin(employeeSession.id, pin);
  } else {
    showEmployeeSelection();
  }
}

function startEmployeeAutoLock(timeoutMinutes = 15) {
  if (employeeAutoLockTimer) clearTimeout(employeeAutoLockTimer);
  const resetTimer = () => {
    if (employeeAutoLockTimer) clearTimeout(employeeAutoLockTimer);
    if (employeeSession && currentCallerToken) {
      employeeAutoLockTimer = setTimeout(() => {
        showToast('تم قفل الجلسة لعدم النشاط', true);
        lockEmployeeSession();
      }, timeoutMinutes * 60 * 1000);
    }
  };
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(ev => {
    window.addEventListener(ev, resetTimer, { passive: true });
  });
  resetTimer();
}

async function verifyEmployeePin(payload) {
  if (window.electronAPI && typeof window.electronAPI.verifyEmployeePin === 'function') {
    return await window.electronAPI.verifyEmployeePin(payload);
  }
  return await callBackend('verifyEmployeePin', currentCallerToken, payload);
}

const employeePermissionsEditor = {
  open: openEmployeePermissionsModal,
  submit: submitAssignPermissions
};

function renderPayChargePanel(charge = {}, student = {}) {
  return `
    <div id="mPayChargePanel" class="card" style="margin-top:1rem; border:1px solid #38bdf8;">
      <div class="card-title">💵 تسجيل تحصيل مستحق</div>
      <p style="color:#94a3b8; font-size:0.85rem;">المحصل المشغل: ${escapeHtmlAttr(currentEmployeeName || 'المشرف')}</p>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  initDesktopApp();
});

async function initDesktopApp() {
  setupNetworkMonitoring();

  // Background Auto-Update Check (Check for new GitHub releases silently)
  setTimeout(() => {
    checkForAppUpdatesSilently();
  }, 5000);

  // Load and apply cached branding immediately on startup
  try {
    const cachedBranding = localStorage.getItem('remas_active_branding');
    if (cachedBranding) {
      applyBrandingToUI(JSON.parse(cachedBranding));
    }
  } catch (_) {}

  const savedCreds = localStorage.getItem('remas_saved_credentials');
  const explicitLogout = sessionStorage.getItem('remas_explicit_logout') === 'true';

  if (!currentCallerToken) {
    if (savedCreds && !explicitLogout) {
      try {
        const creds = JSON.parse(savedCreds);
        if (creds.email && creds.password) {
          showLoginScreen();
          const emailInput = document.getElementById('loginEmail');
          const passwordInput = document.getElementById('loginPassword');
          if (emailInput) emailInput.value = creds.email;
          if (passwordInput) passwordInput.value = creds.password;

          // If device is offline upon launching, inform user clearly instead of attempting failed login
          if (!navigator.onLine) {
            const loginAlert = document.getElementById('loginAlert');
            const spinner = document.getElementById('loginLoadingSpinner');
            const loginForm = document.getElementById('loginForm');
            if (spinner) spinner.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
            if (loginAlert) {
              loginAlert.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:0.6rem; text-align:right;">
                  <span style="font-size:1.4rem; line-height:1;">📡</span>
                  <div>
                    <strong style="display:block; margin-bottom:0.25rem;">لا يوجد اتصال بالإنترنت عند بدء التشغيل!</strong>
                    <span>تعذر تسجيل الدخول التلقائي لأن جهاز الكمبيوتر غير متصل بالإنترنت حالياً. يرجى توصيل الإنترنت ثم الضغط على زر "دخول لوحة التحكم".</span>
                  </div>
                </div>
              `;
              loginAlert.style.display = 'block';
            }
            return;
          }

          const spinner = document.getElementById('loginLoadingSpinner');
          const loginForm = document.getElementById('loginForm');
          const spinnerText = document.getElementById('loginSpinnerText');
          if (loginForm) loginForm.style.display = 'none';
          if (spinnerText) spinnerText.textContent = '⚡ جاري توثيق جهاز السنتر تلقائياً...';
          if (spinner) spinner.style.display = 'block';

          // Authenticate center, then enforce showEmployeeSelection()!
          handleLoginSubmit().catch(() => {
            if (spinner) spinner.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
          });
          return;
        }
      } catch (_) {}
    }

    showLoginScreen();
    const mainView = document.getElementById('mainView');
    if (mainView) mainView.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">الرجاء تسجيل الدخول أولاً للوصول للنظام.</div>';
    return;
  }

  // If center is already authenticated but no employee session is active, require employee selection!
  if (!employeeSession && currentCallerToken.role !== 'superAdmin') {
    showEmployeeSelection();
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
  const rememberCheckbox = document.getElementById('loginRememberMe');
  const loginAlert = document.getElementById('loginAlert');
  const loginForm = document.getElementById('loginForm');
  const spinner = document.getElementById('loginLoadingSpinner');

  if (!emailInput || !passwordInput) return;

  // Immediate offline pre-check to prevent hanging or false "wrong credentials" messages
  if (!navigator.onLine) {
    if (spinner) spinner.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    if (loginAlert) {
      loginAlert.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:0.6rem; text-align:right;">
          <span style="font-size:1.4rem; line-height:1;">📡</span>
          <div>
            <strong style="display:block; margin-bottom:0.25rem;">لا يوجد اتصال بالإنترنت!</strong>
            <span>جهاز الكمبيوتر غير متصل بالإنترنت حالياً. يرجى التأكد من كابل الشبكة أو الواي فاي ثم إعادة المحاولة.</span>
          </div>
        </div>
      `;
      loginAlert.style.display = 'block';
    }
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const isRemember = rememberCheckbox ? rememberCheckbox.checked : false;

  loginAlert.style.display = 'none';
  loginForm.style.display = 'none';
  spinner.style.display = 'block';

  try {
    const session = await callBackend('authenticateUser', { email, password });

    // STRICT DEVICE LOCK ENFORCEMENT GATE:
    // Bi-directional hardware binding check before granting any dashboard/employee access.
    if (session.role !== 'superAdmin' && window.electronAPI && typeof window.electronAPI.activateDevice === 'function') {
      try {
        const deviceResult = await window.electronAPI.activateDevice({
          institutionId: session.institutionId,
          callerToken: session
        });
        console.log('[handleLoginSubmit] Device Activation Result:', deviceResult);
        if (deviceResult && deviceResult.status === 'DEVICE_BOUND_TO_ANOTHER_INSTITUTION') {
          throw new Error('DEVICE_BOUND_TO_ANOTHER_INSTITUTION: هذا الجهاز مخصص ومرتبط بالفعل بأكاديمية/سنتر آخر. يُمنع نهائياً تشغيل حساب سنتر مختلف على نفس جهاز الكمبيوتر. لفك ارتباط هذا الجهاز بالسنتر السابق تواصل مع SuperAdmin.');
        }
        if (deviceResult && deviceResult.status === 'DEVICE_MISMATCH') {
          throw new Error('DEVICE_MISMATCH: هذا المركز مرتبط بجهاز كمبيوتر آخر بالفعل. الترخيص مخصص لجهاز واحد فقط لكل سنتر. تواصل مع SuperAdmin لفك الارتباط.');
        }
        if (deviceResult && (deviceResult.valid === false && deviceResult.status !== 'ACTIVE_OFFLINE_GRACE')) {
          const reason = deviceResult.reason || deviceResult.message || 'الجهاز غير مصرح له بالدخول.';
          throw new Error(`DEVICE_VALIDATION_FAILED: ${reason}`);
        }
      } catch (devErr) {
        // Abort login immediately and logout session!
        try { await callBackend('logoutUser', session); } catch (_) {}
        currentCallerToken = null;
        activeRole = null;
        try { localStorage.removeItem('remas_saved_credentials'); } catch (_) {}
        throw devErr;
      }
    }

    currentCallerToken = session;
    activeRole = session.role;

    // Clear explicit logout flag upon successful login
    try { sessionStorage.removeItem('remas_explicit_logout'); } catch (_) {}

    // Persist or clear remembered credentials
    try {
      if (isRemember) {
        localStorage.setItem('remas_saved_credentials', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('remas_saved_credentials');
      }
    } catch (_) {}

    // Fetch and apply center branding
    try {
      const instBranding = await callBackend('getBranding', currentCallerToken, session.institutionId);
      if (instBranding) {
        localStorage.setItem('remas_active_branding', JSON.stringify(instBranding));
        localStorage.setItem('remas_branding_' + session.institutionId, JSON.stringify(instBranding));
        applyBrandingToUI(instBranding);
      }
    } catch (_) {}

    // Update Header Badges
    const emailBadge = document.getElementById('userEmailBadge');
    if (emailBadge) {
      emailBadge.innerText = session.displayName || session.username || (session.email ? session.email.split('@')[0] : session.email);
      emailBadge.title = session.email || '';
    }
    
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
      renderSidebarNav();
      await renderActiveView(activeView);
      showToast(`تم تسجيل الدخول بنجاح بحساب ${session.email}`);
    } else {
      // MANDATORY STAGE 2: Employee Operational Session Gate
      // The user cannot access the dashboard or operations directly using the raw center account.
      // They MUST select their active employee profile and enter their operational PIN.
      activeView = 'dashboard';
      renderSidebarNav();
      showToast(`تم توثيق ترخيص السنتر بنجاح (${session.email}) — يرجى تسجيل الدخول بحساب الموظف`);
      showEmployeeSelection();
    }
  } catch (err) {
    spinner.style.display = 'none';
    loginForm.style.display = 'block';
    const rawErr = (err && (err.code || err.message)) || 'UNKNOWN';
    const rawMsg = (err && err.message) || '';
    const errorCode = rawErr.includes(':') ? rawErr.split(':')[0].trim() : rawErr;
    console.error('[Login Error] code:', errorCode, 'message:', err.message);

    const isNetwork = (
      !navigator.onLine ||
      errorCode === 'NETWORK_DISCONNECTED' ||
      errorCode === 'NETWORK_TIMEOUT' ||
      rawErr.includes('NETWORK_DISCONNECTED') ||
      rawErr.includes('NETWORK_TIMEOUT') ||
      rawErr.includes('auth/network-request-failed') ||
      rawErr.includes('auth/timeout') ||
      rawMsg.toLowerCase().includes('network') ||
      rawMsg.toLowerCase().includes('offline') ||
      rawMsg.toLowerCase().includes('timeout') ||
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('getaddrinfo') ||
      rawMsg.toLowerCase().includes('enotfound') ||
      rawMsg.toLowerCase().includes('etimedout')
    );

    if (isNetwork) {
      loginAlert.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:0.6rem; text-align:right;">
          <span style="font-size:1.4rem; line-height:1;">🌐</span>
          <div>
            <strong style="display:block; margin-bottom:0.25rem;">تعذر الاتصال بالخادم — انقطاع الإنترنت!</strong>
            <span>فشل الوصول لخوادم النظام بسبب انقطاع الإنترنت عن جهاز الكمبيوتر أو ضعف الشبكة (وليس بسبب خطأ في بيانات الحساب). يرجى التحقق من اتصال الشبكة ثم إعادة المحاولة.</span>
          </div>
        </div>
      `;
    } else if (errorCode === 'INVALID_CREDENTIALS' || rawErr.includes('auth/invalid-credential') || rawErr.includes('auth/wrong-password') || rawErr.includes('auth/user-not-found')) {
      loginAlert.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:0.6rem; text-align:right;">
          <span style="font-size:1.4rem; line-height:1;">🔑</span>
          <div>
            <strong style="display:block; margin-bottom:0.25rem;">خطأ في بيانات الدخول!</strong>
            <span>البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من كتابة البريد وكلمة المرور بشكل سليم.</span>
          </div>
        </div>
      `;
    } else if (errorCode === 'ELECTRON_BRIDGE_UNAVAILABLE') {
      loginAlert.innerText = 'تعذر الاتصال بالخادم — اتصال الجسر الإلكتروني غير متاح';
    } else if (errorCode === 'TENANT_RESOLUTION_FAILED') {
      loginAlert.innerText = 'تعذر تحديد المؤسسة — ملف الحساب غير مرتبط بمركز تعليمي مفعّل.';
    } else if (errorCode === 'UNAUTHORIZED_ROLE') {
      loginAlert.innerText = 'هذا الحساب غير مصرح له بالدخول لتطبيق سطح المكتب.';
    } else if (errorCode === 'DEVICE_BOUND_TO_ANOTHER_INSTITUTION' || rawMsg.includes('DEVICE_BOUND_TO_ANOTHER_INSTITUTION')) {
      loginAlert.innerText = 'هذا الجهاز مخصص ومرتبط بالفعل بأكاديمية/سنتر آخر. يُمنع نهائياً تشغيل حساب سنتر مختلف على نفس جهاز الكمبيوتر. لفك ارتباط هذا الجهاز يرجى التواصل مع SuperAdmin.';
    } else if (errorCode === 'DEVICE_MISMATCH' || errorCode === 'DEVICE_LIMIT_EXCEEDED' || rawMsg.includes('DEVICE_MISMATCH') || rawMsg.includes('DEVICE_LIMIT_EXCEEDED')) {
      loginAlert.innerText = 'هذا المركز مرتبط بجهاز كمبيوتر آخر بالفعل (ترخيص جهاز واحد فقط لكل سنتر). لفك الارتباط يرجى التواصل مع SuperAdmin.';
    } else {
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
    sessionStorage.setItem('remas_explicit_logout', 'true');
    await callBackend('logoutUser', currentCallerToken);
  } catch (err) {}

  currentCallerToken = null;
  activeRole = null;
  employeeSession = null;
  currentEmployeeName = '';
  if (employeeAutoLockTimer) {
    clearTimeout(employeeAutoLockTimer);
    employeeAutoLockTimer = null;
  }
  const empBadge = document.getElementById('employeeSessionBadge');
  if (empBadge) empBadge.remove();

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

  hideAllBlockingOverlays();
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
    if (title) title.innerHTML = '<span>🌐 لوحة المنصة الشاملة</span>';
    if (nav) nav.innerHTML = `
      <div class="sidebar-category">
        <div class="sidebar-category-title">الرئيسية والمتابعة</div>
        <li class="nav-item ${activeView === 'superadmin_dashboard' ? 'active' : ''}" onclick="navigate('superadmin_dashboard')">
          <span class="nav-icon">📊</span>
          <span>لوحة المنصة الشاملة</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">المؤسسات والتراخيص</div>
        <li class="nav-item ${activeView === 'superadmin_institutions' ? 'active' : ''}" onclick="navigate('superadmin_institutions')">
          <span class="nav-icon">🏢</span>
          <span>إدارة المراكز والمؤسسات</span>
        </li>
        <li class="nav-item ${activeView === 'superadmin_devices' ? 'active' : ''}" onclick="navigate('superadmin_devices')">
          <span class="nav-icon">💻</span>
          <span>الأجهزة والتراخيص</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">الذكاء الاصطناعي والهوية</div>
        <li class="nav-item ${activeView === 'superadmin_ai' ? 'active' : ''}" onclick="navigate('superadmin_ai')">
          <span class="nav-icon">🤖</span>
          <span>مزودات الذكاء الاصطناعي</span>
        </li>
        <li class="nav-item ${activeView === 'superadmin_branding' ? 'active' : ''}" onclick="navigate('superadmin_branding')">
          <span class="nav-icon">🎨</span>
          <span>إدارة الهوية والمؤسسات</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">الحوكمة والأمان</div>
        <li class="nav-item ${activeView === 'superadmin_audit' ? 'active' : ''}" onclick="navigate('superadmin_audit')">
          <span class="nav-icon">📜</span>
          <span>سجل أحداث المنصة Audit</span>
        </li>
      </div>
    `;
  } else {
    // Block full navigation when mandatory password change is pending
    if (isPasswordChangeRequired()) {
      if (title) title.innerText = 'إدارة السنتر — تغيير كلمة المرور مطلوب';
      if (nav) nav.innerHTML = `
        <li class="nav-item active" style="background:#7c2d12; color:#fdba74;">
          <span class="nav-icon">🔒</span>
          <span>تغيير كلمة المرور مطلوب</span>
        </li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;"><span class="nav-icon">📈</span><span>لوحة التحكم (مغلق)</span></li>
        <li class="nav-item" style="opacity:0.45; pointer-events:none;"><span class="nav-icon">🏫</span><span>الإعداد الأكاديمي (مغلق)</span></li>
      `;
      return;
    }
    if (title) title.innerHTML = '<span>🏫 إدارة السنتر التعليمي</span>';
    if (nav) nav.innerHTML = `
      <div class="sidebar-category">
        <div class="sidebar-category-title">📊 الرئيسية والمتابعة</div>
        <li class="nav-item ${activeView === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">
          <span class="nav-icon">📈</span>
          <span>لوحة التحكم الشاملة</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">🏫 الهيكل الأكاديمي</div>
        <li class="nav-item ${activeView === 'academic' ? 'active' : ''}" onclick="navigate('academic')">
          <span class="nav-icon">🏫</span>
          <span>الإعداد الأكاديمي</span>
        </li>
        <li class="nav-item ${activeView === 'groups' ? 'active' : ''}" onclick="navigate('groups')">
          <span class="nav-icon">📚</span>
          <span>المجموعات والمواد</span>
        </li>
        <li class="nav-item ${activeView === 'schedule' ? 'active' : ''}" onclick="navigate('schedule')">
          <span class="nav-icon">🗓️</span>
          <span>جدول الحصص</span>
        </li>
        <li class="nav-item ${activeView === 'content' ? 'active' : ''}" onclick="navigate('content')">
          <span class="nav-icon">📖</span>
          <span>المحتوى والدروس</span>
        </li>
        <li class="nav-item ${activeView === 'exams' ? 'active' : ''}" onclick="navigate('exams')">
          <span class="nav-icon">📝</span>
          <span>الاختبارات والتقييمات</span>
        </li>
        <li class="nav-item ${activeView === 'homework' ? 'active' : ''}" onclick="navigate('homework')">
          <span class="nav-icon">📑</span>
          <span>الواجبات والتكليفات</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">👥 شؤون الطلاب والكادر والإدارة</div>
        <li class="nav-item ${activeView === 'students' ? 'active' : ''}" onclick="navigate('students')">
          <span class="nav-icon">🎓</span>
          <span>إدارة الطلاب</span>
        </li>
        <li class="nav-item ${activeView === 'cards' ? 'active' : ''}" onclick="navigate('cards')">
          <span class="nav-icon">🪪</span>
          <span>كروت وبطاقات الطلاب</span>
        </li>
        <li class="nav-item ${activeView === 'teachers' ? 'active' : ''}" onclick="navigate('teachers')">
          <span class="nav-icon">👨‍🏫</span>
          <span>المعلمون وهيئة التدريس</span>
        </li>
        <li class="nav-item ${activeView === 'employees' ? 'active' : ''}" onclick="navigate('employees')">
          <span class="nav-icon">👨‍💼</span>
          <span>الموظفون والصلاحيات</span>
        </li>
        <li class="nav-item ${activeView === 'parents' ? 'active' : ''}" onclick="navigate('parents')">
          <span class="nav-icon">👨‍👩‍👧</span>
          <span>أولياء الأمور</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">⏱️ الحضور والانضباط</div>
        <li class="nav-item ${activeView === 'attendance' ? 'active' : ''}" onclick="navigate('attendance')">
          <span class="nav-icon">📋</span>
          <span>كشك الحضور والباركود</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">💰 المالية والخزينة</div>
        <li class="nav-item ${activeView === 'finance' ? 'active' : ''}" onclick="navigate('finance')">
          <span class="nav-icon">💵</span>
          <span>الخزينة والحسابات</span>
        </li>
        <li class="nav-item ${activeView === 'subscriptions' ? 'active' : ''}" onclick="navigate('subscriptions')">
          <span class="nav-icon">🎟️</span>
          <span>الاشتراكات والباقات</span>
        </li>
      </div>

      <div class="sidebar-category">
        <div class="sidebar-category-title">⚙️ الإعدادات والترخيص والرقابة</div>
        <li class="nav-item ${activeView === 'branding' ? 'active' : ''}" onclick="navigate('branding')">
          <span class="nav-icon">🎨</span>
          <span>الهوية والعلامة التجارية</span>
        </li>
        <li class="nav-item ${activeView === 'center_info' ? 'active' : ''}" onclick="navigate('center_info')">
          <span class="nav-icon">⚙️</span>
          <span>معلومات السنتر الرسمية</span>
        </li>
        <li class="nav-item ${activeView === 'invoice_settings' ? 'active' : ''}" onclick="navigate('invoice_settings')">
          <span class="nav-icon">🧾</span>
          <span>إعدادات وترويسة الفواتير</span>
        </li>
        <li class="nav-item ${activeView === 'whatsapp' ? 'active' : ''}" onclick="navigate('whatsapp')">
          <span class="nav-icon">💬</span>
          <span>إعدادات وربط الواتس والجدولة</span>
        </li>
        <li class="nav-item ${activeView === 'license' ? 'active' : ''}" onclick="navigate('license')">
          <span class="nav-icon">🔒</span>
          <span>الترخيص وتوثيق الجهاز</span>
        </li>
        <li class="nav-item ${activeView === 'audit' ? 'active' : ''}" onclick="navigate('audit')">
          <span class="nav-icon">📜</span>
          <span>سجل الرقابة والعمليات</span>
        </li>
        <li class="nav-item ${activeView === 'system_updates' ? 'active' : ''}" onclick="navigate('system_updates')" style="color:#38bdf8; border-top:1px dashed #334155; margin-top:0.4rem; padding-top:0.6rem; display:flex; align-items:center;">
          <span class="nav-icon">📦</span>
          <span>تحديثات النظام والإصدارات</span>
          <span id="sidebarUpdateBadge" style="display:none; background:#ef4444; color:#fff; font-size:0.65rem; padding:0.12rem 0.45rem; border-radius:10px; margin-right:auto; font-weight:800;">جديد 🚀</span>
        </li>
      </div>
    `;
  }
}

function navigate(viewName) {
  if (isPasswordChangeRequired()) {
    showMandatoryPasswordScreen();
    showToast('يجب تغيير كلمة المرور المؤقتة أولاً قبل الوصول لأي قسم', true);
    return;
  }
  if (!employeeSession && currentCallerToken && currentCallerToken.role !== 'superAdmin') {
    showEmployeeSelection();
    showToast('يجب اختيار حساب موظف وتأكيد الـ PIN قبل المتابعة', true);
    return;
  }
  activeView = viewName;
  renderSidebarNav();
  renderActiveView(activeView);
}

function setupNetworkMonitoring() {
  const badge = document.getElementById('networkBadge');

  // Ensure global offline/online floating alert bar exists
  let banner = document.getElementById('globalNetworkBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'globalNetworkBanner';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.zIndex = '999999';
    banner.style.textAlign = 'center';
    banner.style.padding = '0.65rem 1rem';
    banner.style.fontSize = '0.92rem';
    banner.style.fontWeight = 'bold';
    banner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
    banner.style.display = 'none';
    banner.style.transition = 'all 0.3s ease';
    banner.style.direction = 'rtl';
    document.body.prepend(banner);
  }

  const updateNet = (isEvent = false) => {
    if (navigator.onLine) {
      if (badge) {
        badge.innerText = 'ONLINE 🟢';
        badge.className = 'badge net-online';
      }
      if (isEvent) {
        banner.style.background = 'linear-gradient(90deg, #065f46 0%, #059669 100%)';
        banner.style.color = '#ecfdf5';
        banner.style.borderBottom = '2px solid #10b981';
        banner.innerHTML = '🟢 <strong>تم استعادة الاتصال بالإنترنت:</strong> تم إعادة الاتصال بالخادم بنجاح والخدمات متاحة الآن.';
        banner.style.display = 'block';
        showToast('🟢 عاد الاتصال بالإنترنت بنجاح.');
        setTimeout(() => {
          if (navigator.onLine && banner) {
            banner.style.display = 'none';
          }
        }, 4000);
      } else {
        banner.style.display = 'none';
      }
    } else {
      if (badge) {
        badge.innerText = 'OFFLINE 🔴';
        badge.className = 'badge net-offline';
      }
      banner.style.background = 'linear-gradient(90deg, #991b1b 0%, #b91c1c 100%)';
      banner.style.color = '#fef2f2';
      banner.style.borderBottom = '2px solid #ef4444';
      banner.innerHTML = '⚠️ <strong>انقطع الاتصال بالإنترنت:</strong> جهاز الكمبيوتر غير متصل بالإنترنت حالياً. يرجى مراجعة كابل الشبكة أو الواي فاي لتجنب توقف العمليات.';
      banner.style.display = 'block';
      if (isEvent) {
        showToast('⚠️ انقطع الاتصال بالإنترنت! تحقق من اتصال الشبكة.', true);
      }
    }
  };

  window.addEventListener('online', () => updateNet(true));
  window.addEventListener('offline', () => updateNet(true));
  updateNet(false);
}

async function callBackend(method, ...args) {
  if (window.electronAPI && typeof window.electronAPI.callBackendService === 'function') {
    // Immediate pre-check: if offline in renderer, throw immediately without hanging
    if (!navigator.onLine) {
      const netErr = new Error('NETWORK_DISCONNECTED: تعذر إتمام العملية — جهاز الكمبيوتر غير متصل بالإنترنت حالياً.');
      netErr.code = 'NETWORK_DISCONNECTED';
      throw netErr;
    }

    const isLongRunningMethod = method.startsWith('generate') && method.includes('WithAI');
    const timeoutMs = isLongRunningMethod ? 60000 : 12000;

    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        const tErr = new Error(`NETWORK_TIMEOUT: انتهت مهلة استجابة الخادم للعملية (${method}) بسبب بطء أو انقطاع الإنترنت.`);
        tErr.code = 'NETWORK_TIMEOUT';
        reject(tErr);
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([
        window.electronAPI.callBackendService(method, ...args),
        timeoutPromise
      ]);
      if (res && res.success) {
        return res.data;
      }
      const err = new Error(res ? res.error : 'فشل تنفيذ الخدمة على الخادم');
      if (res && res.code) err.code = res.code;
      throw err;
    } finally {
      if (timerId) clearTimeout(timerId);
    }
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

function fmtMoney(n) {
  return `${Number(n || 0).toLocaleString('en-US')} ج.م`;
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
      case 'cards':
        await renderCardsView(mainView);
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
      case 'homework':
        await renderHomeworkView(mainView);
        break;
      case 'subscriptions':
        await renderSubscriptionsView(mainView);
        break;
      case 'parents':
        await renderParentsView(mainView);
        break;
      case 'employees':
        await renderEmployeesView(mainView);
        break;
      case 'audit':
        await renderAuditView(mainView);
        break;
      case 'branding':
        await renderBrandingView(mainView);
        break;
      case 'center_info':
        await renderCenterInfoView(mainView);
        break;
      case 'invoice_settings':
        await renderInvoiceSettingsView(mainView);
        break;
      case 'whatsapp':
        await renderWhatsAppSettingsView(mainView);
        break;
      case 'license':
        await renderLicenseView(mainView);
        break;
      case 'system_updates':
        await renderSystemUpdatesView(mainView);
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
    const isNet = !navigator.onLine || (err && (err.code === 'NETWORK_DISCONNECTED' || err.code === 'NETWORK_TIMEOUT' || (err.message && (err.message.includes('NETWORK') || err.message.includes('الإنترنت')))));
    if (isNet) {
      mainView.innerHTML = `
        <div class="card" style="border:1px solid #ef4444; background:rgba(239, 68, 68, 0.08); text-align:center; padding:3rem 2rem; border-radius:12px; max-width:650px; margin:3rem auto;">
          <div style="font-size:3rem; margin-bottom:1rem;">📡</div>
          <h3 style="color:#ef4444; margin-bottom:0.75rem; font-size:1.4rem;">تعذر تحميل الصفحة بسبب انقطاع الإنترنت</h3>
          <p style="color:#cbd5e1; margin-bottom:1.5rem; line-height:1.7;">
            جهاز الكمبيوتر غير متصل بالإنترنت حالياً أو استجابة الخادم استغرقت وقتاً أطول من المعتاد.<br>
            يرجى التأكد من اتصال الإنترنت ثم الضغط على زر إعادة المحاولة.
          </p>
          <button class="btn btn-primary" onclick="renderActiveView('${view}')" style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:bold; padding:0.75rem 1.75rem;">
            <span>🔄</span> <span>إعادة المحاولة الآن</span>
          </button>
        </div>
      `;
    } else {
      mainView.innerHTML = `
        <div class="card" style="border:1px solid #ef4444; padding:2rem; border-radius:10px;">
          <h3 style="color:#ef4444; margin-bottom:0.5rem;">⚠️ خطأ في تحميل البيانات</h3>
          <p style="color:#cbd5e1;">${err.message || 'حدث خطأ غير متوقع أثناء معالجة الصفحة.'}</p>
          <button class="btn btn-secondary" onclick="renderActiveView('${view}')" style="margin-top:1rem;">🔄 إعادة المحاولة</button>
        </div>
      `;
    }
  }
}

// 1. Center Dashboard — Executive Modern Redesign
async function renderDashboardView(container) {
  const summary = await callBackend('getDashboardSummary', currentCallerToken, currentCallerToken.institutionId).catch(() => null);
  const now = new Date();
  const arabicDate = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const totalIncome = summary?.totalIncome || 0;
  const totalExpenses = summary?.totalExpenses || 0;
  const netBalance = summary?.netBalance || (totalIncome - totalExpenses);
  const todayIncome = summary?.todayIncome || 0;
  const studentsCount = summary?.studentsCount || 0;
  const teachersCount = summary?.teachersCount || 0;
  const groupsCount = summary?.groupsCount || 0;
  const attendanceRate = summary?.attendanceRate || 0;
  const todayAttendanceCount = summary?.todayAttendanceCount || 0;

  container.innerHTML = `
    <!-- Top Welcome & Status Banner -->
    <div class="dashboard-hero">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <div class="dash-hero-title">
            <span>✨ مرحباً بك في لوحة تحكم السنتر التعليمي</span>
          </div>
          <p class="dash-hero-desc">
            متابعة شاملة للحركات الأكاديمية والمالية، سجلات الحضور، واحتساب رسوم المجموعات والتحصيل بدقة لحظية.
          </p>
          <div class="dash-hero-badges">
            <span class="hero-badge-pill"><span class="pulse-dot-green"></span> متصل بالسحابة اللحظية (Firestore Realtime)</span>
            <span class="hero-badge-pill">📅 ${arabicDate} | ⏱️ ${timeStr}</span>
            <span class="hero-badge-pill">🔒 الجهاز مرخص وموثق بالسنتر</span>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openRecordPaymentModal()">
            <span>💳</span> تسجيل تحصيل سريع
          </button>
          <button class="btn" style="background:#0284c7; box-shadow:0 4px 12px rgba(2,132,199,0.3);" onclick="renderActiveView('dashboard')">
            <span>🔄</span> تحديث البيانات
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Actions Bar -->
    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-weight:700; color:#38bdf8; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem;">
        ⚡ إجراءات الوصول السريع للسنتر
      </span>
      <span style="font-size:0.8rem; color:#64748b;">بنقرة واحدة للوصول الفوري</span>
    </div>
    <div class="quick-actions-bar">
      <div class="quick-action-btn" onclick="openRecordPaymentModal()">
        <div class="quick-action-icon" style="color:#22c55e;">💵</div>
        <div>
          <div>تسجيل تحصيل</div>
          <div style="font-size:0.72rem; color:#64748b; font-weight:normal;">إيصال + حساب مواد</div>
        </div>
      </div>
      <div class="quick-action-btn" onclick="openAddStudentModal()">
        <div class="quick-action-icon" style="color:#38bdf8;">👨‍🎓</div>
        <div>
          <div>تسجيل طالب جديد</div>
          <div style="font-size:0.72rem; color:#64748b; font-weight:normal;">بيانات واشتراك مجموعات</div>
        </div>
      </div>
      <div class="quick-action-btn" onclick="openAddGroupModal()">
        <div class="quick-action-icon" style="color:#a855f7;">📚</div>
        <div>
          <div>إنشاء مجموعة</div>
          <div style="font-size:0.72rem; color:#64748b; font-weight:normal;">تسعير آلي من المادة</div>
        </div>
      </div>
      <div class="quick-action-btn" onclick="navigate('attendance')">
        <div class="quick-action-icon" style="color:#f59e0b;">⏱️</div>
        <div>
          <div>تسجيل الحضور</div>
          <div style="font-size:0.72rem; color:#64748b; font-weight:normal;">مسح باركود ذكي</div>
        </div>
      </div>
      <div class="quick-action-btn" onclick="navigate('cards')">
        <div class="quick-action-icon" style="color:#06b6d4;">🪪</div>
        <div>
          <div>طباعة الكروت</div>
          <div style="font-size:0.72rem; color:#64748b; font-weight:normal;">باركود وهوية الطلاب</div>
        </div>
      </div>
      <div class="quick-action-btn" onclick="navigate('finance')">
        <div class="quick-action-icon" style="color:#ec4899;">📊</div>
        <div>
          <div>التقرير المالي</div>
          <div style="font-size:0.72rem; color:#64748b; font-weight:normal;">إيرادات ومصروفات</div>
        </div>
      </div>
    </div>

    <!-- 6 KPI Modern Gradient Cards -->
    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-weight:700; color:#e2e8f0; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem;">
        📈 المؤشرات والإحصائيات الرئيسية
      </span>
      <span style="font-size:0.8rem; color:#64748b;">تحديث فوري من قاعدة البيانات</span>
    </div>
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <!-- Card 1: Students -->
      <div class="stat-card-modern" style="border-right: 4px solid #3b82f6;" onclick="navigate('students')">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">الطلاب النشطون</div>
            <div class="stat-value" style="color:#60a5fa;">${studentsCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3);">👨‍🎓</div>
        </div>
        <div class="stat-sub"><span>📚 مسجلون بالمجموعات الدراسية</span><span style="margin-right:auto; color:#60a5fa;">عرض ⬅️</span></div>
      </div>

      <!-- Card 2: Groups -->
      <div class="stat-card-modern" style="border-right: 4px solid #8b5cf6;" onclick="navigate('groups')">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">المجموعات الدراسية</div>
            <div class="stat-value" style="color:#a78bfa;">${groupsCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.3);">📚</div>
        </div>
        <div class="stat-sub"><span>🏛️ تسعير آلي حسب الطلاب والمادة</span><span style="margin-right:auto; color:#a78bfa;">عرض ⬅️</span></div>
      </div>

      <!-- Card 3: Teachers -->
      <div class="stat-card-modern" style="border-right: 4px solid #14b8a6;" onclick="navigate('teachers')">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">أعضاء هيئة التدريس</div>
            <div class="stat-value" style="color:#2dd4bf;">${teachersCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(20,184,166,0.15); color:#2dd4bf; border:1px solid rgba(20,184,166,0.3);">👨‍🏫</div>
        </div>
        <div class="stat-sub"><span>📖 الكادر التعليمي المتخصص</span><span style="margin-right:auto; color:#2dd4bf;">عرض ⬅️</span></div>
      </div>

      <!-- Card 4: Today Income -->
      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;" onclick="navigate('finance')">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">تحصيل نقدية اليوم</div>
            <div class="stat-value" style="color:#4ade80;">${fmtMoney(todayIncome)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">💵</div>
        </div>
        <div class="stat-sub"><span>✅ إيصالات محصلة اليوم</span><span style="margin-right:auto; color:#4ade80;">تفاصيل ⬅️</span></div>
      </div>

      <!-- Card 5: Attendance Rate -->
      <div class="stat-card-modern" style="border-right: 4px solid #f59e0b;" onclick="navigate('attendance')">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">نسبة حضور اليوم</div>
            <div class="stat-value" style="color:#fbbf24;">${attendanceRate}%</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);">⏱️</div>
        </div>
        <div class="stat-sub"><span>🟢 ${todayAttendanceCount} حضور مسجل اليوم</span><span style="margin-right:auto; color:#fbbf24;">كشف ⬅️</span></div>
      </div>

      <!-- Card 6: Net Treasury Balance -->
      <div class="stat-card-modern" style="border-right: 4px solid #0284c7;" onclick="navigate('finance')">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">صافي الصندوق العام</div>
            <div class="stat-value" style="color:#38bdf8;">${fmtMoney(netBalance)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(2,132,199,0.15); color:#38bdf8; border:1px solid rgba(2,132,199,0.3);">💎</div>
        </div>
        <div class="stat-sub"><span>💰 الإيرادات: ${fmtMoney(totalIncome)}</span><span style="margin-right:auto; color:#38bdf8;">المالية ⬅️</span></div>
      </div>
    </div>

    <!-- Dual Grid: Real-time Payments & Attendance -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
      <div class="card" style="margin-bottom:0; box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:0.75rem; margin-bottom:1rem;">
          <div style="font-weight:700; color:#4ade80; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem;">
            <span>💳</span> آخر حركات التحصيل المالي المباشرة
          </div>
          <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#334155;" onclick="navigate('finance')">عرض الكل ⬅️</button>
        </div>
        ${renderPaymentsTable(summary ? summary.recentPayments : [])}
      </div>

      <div class="card" style="margin-bottom:0; box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:0.75rem; margin-bottom:1rem;">
          <div style="font-weight:700; color:#38bdf8; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem;">
            <span>⏱️</span> سجلات الحضور والانضباط اليومية
          </div>
          <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#334155;" onclick="navigate('attendance')">شاشة الحضور ⬅️</button>
        </div>
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
              <th>سعر المادة</th>
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
                <td><strong style="color:#38bdf8;">${fmtMoney(sb.price || 0)}</strong></td>
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
                  <button class="btn" style="padding:0.25rem 0.5rem; font-size:0.72rem; background:#0284c7;" onclick="showStudentPinModal('${s.id}')">🔑 الـ PIN</button>
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

// 2.5 Student Cards & Barcodes View
let cardSearchQuery = '';
async function renderCardsView(container) {
  container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:3rem;">جاري تحميل بطاقات الطلاب من السحابة...</div>';
  try {
    const cards = await callBackend('getStudentCards', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const students = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const studentMap = new Map((students || []).map(s => [s.id, s]));

    const assignedCount = cards.filter(c => c.status === 'ASSIGNED').length;
    const availableCount = cards.filter(c => c.status === 'AVAILABLE').length;
    const revokedCount = cards.filter(c => c.status === 'REVOKED' || c.status === 'LOST').length;

    const q = (cardSearchQuery || '').toLowerCase().trim();
    const filteredCards = cards.filter(c => {
      if (!q) return true;
      const stu = studentMap.get(c.studentId);
      const sName = (stu?.name || '').toLowerCase();
      const cCode = (c.cardCode || c.id || '').toLowerCase();
      return sName.includes(q) || cCode.includes(q);
    });

    container.innerHTML = `
      <div class="view-title">
        <span>🪪 كارنيهات الطلاب وبطاقات الباركود الذكي (${cards.length})</span>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openGenerateCardsModal()">+ توليد بطاقات جديدة</button>
          <button class="btn" style="background:#0284c7; box-shadow:0 4px 12px rgba(2,132,199,0.3);" onclick="window.print()">🖨️ طباعة الكروت</button>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
          <div class="stat-card-header">
            <div>
              <div class="stat-label">إجمالي الكروت المنشأة</div>
              <div class="stat-value" style="color:#38bdf8;">${cards.length}</div>
            </div>
            <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">🪪</div>
          </div>
          <div class="stat-sub"><span>بطاقات مشفرة بالباركود</span></div>
        </div>
        <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
          <div class="stat-card-header">
            <div>
              <div class="stat-label">كروت مسندة لطلاب</div>
              <div class="stat-value" style="color:#4ade80;">${assignedCount}</div>
            </div>
            <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">👨‍🎓</div>
          </div>
          <div class="stat-sub"><span>فعالة ومربوطة بالطلاب</span></div>
        </div>
        <div class="stat-card-modern" style="border-right: 4px solid #f59e0b;">
          <div class="stat-card-header">
            <div>
              <div class="stat-label">كروت شاغرة للتوزيع</div>
              <div class="stat-value" style="color:#fbbf24;">${availableCount}</div>
            </div>
            <div class="stat-icon-bubble" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);">📦</div>
          </div>
          <div class="stat-sub"><span>جاهزة للتسليم للطلاب الجدد</span></div>
        </div>
        <div class="stat-card-modern" style="border-right: 4px solid #ef4444;">
          <div class="stat-card-header">
            <div>
              <div class="stat-label">كروت ملغاة أو مفقودة</div>
              <div class="stat-value" style="color:#f87171;">${revokedCount}</div>
            </div>
            <div class="stat-icon-bubble" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);">🛑</div>
          </div>
          <div class="stat-sub"><span>بطاقات تم إيقافها</span></div>
        </div>
      </div>

      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <span>📋 سجل كروت وبطاقات الحضور المطبوعة</span>
          <div style="min-width:260px;">
            <input type="text" value="${escapeHtmlAttr(cardSearchQuery)}" placeholder="🔍 بحث باسم الطالب أو كود الباركود..." style="width:100%; padding:0.55rem 0.85rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="onCardSearchInput(this.value)">
          </div>
        </div>

        ${filteredCards.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>كود الباركود</th>
                  <th>اسم الطالب المسجل</th>
                  <th>الصف / المرحلة</th>
                  <th>الحالة</th>
                  <th>تاريخ الإصدار</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${filteredCards.map(c => {
                  const stu = studentMap.get(c.studentId);
                  const isAssigned = c.status === 'ASSIGNED';
                  const isAvailable = c.status === 'AVAILABLE';
                  const badgeStyle = isAssigned ? 'background:#064e3b; color:#86efac; border:1px solid #10b981;' : (isAvailable ? 'background:#1e3a8a; color:#93c5fd; border:1px solid #3b82f6;' : 'background:#7f1d1d; color:#fca5a5; border:1px solid #ef4444;');
                  const statusText = isAssigned ? 'مسند لطالب 🟢' : (isAvailable ? 'شاغر متاح 🔵' : 'ملغى 🛑');
                  return `
                    <tr>
                      <td><span class="code-box" style="font-weight:700; color:#38bdf8; font-size:0.85rem;">${escapeHtmlAttr(c.cardCode || c.id)}</span></td>
                      <td><strong style="color:#f1f5f9;">${stu ? escapeHtmlAttr(stu.name) : '<span style="color:#64748b;">— غير مسند —</span>'}</strong></td>
                      <td style="color:#cbd5e1;">${stu ? escapeHtmlAttr(stu.grade || '—') : '—'}</td>
                      <td><span class="badge" style="${badgeStyle}">${statusText}</span></td>
                      <td style="color:#94a3b8; font-size:0.8rem;">${c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('ar-EG') : '—'}</td>
                      <td>
                        <div style="display:flex; gap:0.35rem;">
                          <button class="btn" style="padding:0.25rem 0.55rem; font-size:0.75rem; background:#0284c7;" onclick="openCardPrintModal('${c.id}', '${escapeHtmlAttr(c.cardCode || c.id)}', '${stu ? escapeHtmlAttr(stu.name) : ''}')">🪪 عرض وطباعة</button>
                          ${isAssigned ? `<button class="btn btn-warning" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="revokeCardAction('${c.id}')">إلغاء</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
            <div style="font-size:3rem; margin-bottom:0.5rem; opacity:0.8;">🪪</div>
            <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">${cards.length === 0 ? 'لا توجد بطاقات منشأة حالياً' : 'لا توجد نتائج مطابقة للبحث'}</h3>
            <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.5rem;">قم بتوليد دفعة جديدة من كروت الطلاب الذكية برقم تسلسلي وباركود مشفر.</p>
            ${cards.length === 0 ? '<button class="btn btn-success" onclick="openGenerateCardsModal()">+ توليد بطاقات جديدة الآن</button>' : ''}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="border-color:#ef4444;"><h3 style="color:#ef4444;">خطأ في تحميل الكروت</h3><p>${err.message}</p></div>`;
  }
}

function onCardSearchInput(val) {
  cardSearchQuery = val;
  const mv = document.getElementById('mainView');
  if (mv && activeView === 'cards') renderCardsView(mv);
}

function openGenerateCardsModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:450px;">
        <div class="modal-header">🪪 توليد دفعة كروت طلاب جديدة</div>
        <div class="form-group">
          <label>عدد البطاقات المطلوب توليدها *</label>
          <input type="number" id="genCardCount" min="1" max="100" value="10" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          <small style="color:#94a3b8; display:block; margin-top:0.35rem;">سيتم توليد أكواد باركود مشفرة فريدة لكل بطاقة بصيغة REMAS-XXXX</small>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnSubmitGenCards" onclick="submitGenerateCards()">توليد البطاقات الآن 🚀</button>
        </div>
      </div>
    </div>
  `;
}

async function submitGenerateCards() {
  const btn = document.getElementById('btnSubmitGenCards');
  const count = Math.max(1, Math.min(100, Number(document.getElementById('genCardCount')?.value || 10)));
  if (btn) btn.disabled = true;
  try {
    await callBackend('generateStudentCards', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      count
    });
    closeModal();
    showToast(`تم توليد ${count} بطاقة طالب بنجاح!`);
    await renderActiveView('cards');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
    if (btn) btn.disabled = false;
  }
}

async function openCardPrintModal(cardId, cardCode, studentName) {
  const container = document.getElementById('modalContainer');
  let barcodeImgHtml = '';
  try {
    let bData = null;
    if (window.electronAPI && typeof window.electronAPI.generateBarcode === 'function') {
      const res = await window.electronAPI.generateBarcode({ text: cardCode, bcid: 'code128', scale: 3, height: 14 });
      if (res && res.success) bData = res.dataUrl;
    }
    if (!bData) {
      const res = await callBackend('generateBarcode', currentCallerToken, { text: cardCode, bcid: 'code128' }).catch(() => null);
      if (res && res.dataUrl) bData = res.dataUrl;
    }
    if (bData) {
      barcodeImgHtml = `<img src="${bData}" alt="${escapeHtmlAttr(cardCode)}" style="max-width:320px; width:92%; height:75px; object-fit:contain; background:#fff; padding:6px 12px; border-radius:6px; margin:0 auto; display:block; filter:contrast(140%);">`;
    } else {
      barcodeImgHtml = `<div style="font-family:monospace; font-size:1.4rem; font-weight:bold; color:#000; letter-spacing:4px; background:#fff; padding:8px 16px; border-radius:6px; display:inline-block;">*${escapeHtmlAttr(cardCode)}*</div>`;
    }
  } catch (_) {
    barcodeImgHtml = `<div style="font-family:monospace; font-size:1.4rem; font-weight:bold; color:#000; letter-spacing:4px; background:#fff; padding:8px 16px; border-radius:6px; display:inline-block;">*${escapeHtmlAttr(cardCode)}*</div>`;
  }

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-card" style="max-width:480px; text-align:center;">
        <div class="modal-header" style="text-align:right;">
          <div class="modal-title">🖨️ معاينة وطباعة بطاقة الطالب المعتمدة</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div id="studentIdCardPrint" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border:2px solid #0284c7; border-radius:14px; padding:1.75rem 1.25rem; margin:1rem 0; color:#fff; box-shadow:0 12px 28px rgba(0,0,0,0.5);">
          <div style="font-size:0.75rem; color:#38bdf8; font-weight:bold; letter-spacing:1px; margin-bottom:0.25rem; text-transform:uppercase;">REMAS EDUCATIONAL CENTER SAAS</div>
          <div style="font-size:1.15rem; font-weight:800; color:#f8fafc; margin-bottom:0.75rem;">بطاقة هوية الطالب المعتمدة (Barcode Card)</div>
          <div style="width:64px; height:64px; border-radius:50%; background:#334155; margin:0 auto 0.75rem auto; display:flex; align-items:center; justify-content:center; font-size:2rem; border:2px solid #38bdf8;">👨‍🎓</div>
          <div style="font-size:1.3rem; font-weight:bold; color:#4ade80; margin-bottom:0.35rem;">${escapeHtmlAttr(studentName || 'طالب مسجل')}</div>
          <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:1rem;">كود الطالب الموحد: <span class="code-box" style="font-size:0.9rem; font-weight:bold; color:#38bdf8;">${escapeHtmlAttr(cardCode)}</span></div>
          <div style="margin:0.75rem 0;">
            ${barcodeImgHtml}
          </div>
          <div style="font-size:0.75rem; color:#64748b; margin-top:0.6rem;">📷 باركود قياسي Code 128 معتمد للقراءة الفورية بجميع قوارئ الباركود في كشك الحضور</div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إغلاق</button>
          <button class="btn btn-success" onclick="window.print()">🖨️ طباعة الكارت الآن</button>
        </div>
      </div>
    </div>
  `;
}

async function revokeCardAction(cardId) {
  if (!confirm('هل أنت متأكد من إلغاء هذه البطاقة؟ لن يتمكن الطالب من استخدامها في تسجيل الحضور.')) return;
  try {
    await callBackend('setStudentCardStatus', currentCallerToken, cardId, 'REVOKED', currentCallerToken.institutionId);
    showToast('تم إلغاء البطاقة بنجاح');
    await renderActiveView('cards');
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

// ----------------------------------------------------------------------------
// PRODUCTION BARCODE & CARD PRINT SYSTEM (Milestone 50.5 Parity)
// ----------------------------------------------------------------------------
const PROD_BARCODE_OPTS = {
  bcid: 'code128',
  scale: 4,
  height: 18,
  includetext: false,
  backgroundcolor: 'FFFFFF',
  paddingwidth: 24,
  paddingheight: 24
};

async function renderCardBarcodeDataURL(code) {
  const opts = { ...PROD_BARCODE_OPTS };
  try {
    if (window.electronAPI && typeof window.electronAPI.generateBarcode === 'function') {
      const res = await window.electronAPI.generateBarcode({ text: code, ...opts });
      if (res && res.success) return res.dataUrl;
    }
    const res = await callBackend('generateBarcode', currentCallerToken, { text: code, ...opts }).catch(() => null);
    if (res && res.dataUrl) return res.dataUrl;
  } catch (_) {}
  return null;
}

const BARCODE_PRINT_CSS = `
<style>
@page { size:A4; margin:10mm; }
.barcode{ width:100mm; max-width:none; image-rendering:pixelated; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
.card-code-text{ letter-spacing:2px; font-family:monospace; font-weight:bold; }
</style>
`;

function blankCardTile(code) {
  return `
    <div class="blank-card-tile" style="display:inline-block; border:1px solid #000; padding:10px; margin:5px; text-align:center;">
      <div class="card-brand" style="font-size:10pt; font-weight:bold;">REMAS CARD</div>
      <div class="barcode-box">
        <img class="barcode" src="${code}" alt="Barcode">
      </div>
      <div class="card-code-text" style="font-size:11pt; margin-top:4px;">${code}</div>
    </div>
  `;
}

async function printBlankCardBatch(cardsList = []) {
  const assigned = (cardsList || []).filter(c => c.status === 'ASSIGNED');
  if (assigned.length > 0) {
    throw new Error('BLANK_PRINT_REFUSED: لا يمكن طباعة كروت فارغة لكروت مسندة لطلاب بالفعل');
  }
  const w = window.open('');
  if (!w) return;
  const cardsHtml = (await Promise.all(cardsList.map(async c => {
    const dUrl = await renderCardBarcodeDataURL(c.cardCode || c.id);
    return blankCardTile(dUrl || c.cardCode);
  }))).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>كروت غير مسندة</title>${BARCODE_PRINT_CSS}</head><body>${cardsHtml}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

async function printAssignedCard(cardId) {
  const cards = await callBackend('getStudentCards', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const card = cards.find(c => c.id === cardId);
  if (!card) return showToast('البطاقة غير موجودة', true);
  await openCardPrintModal(card.id, card.cardCode || card.id, card.studentName || '');
}

async function printBarcodeDiagnostic() {
  const testVal = 'CARD-7K4P9X28';
  const dataUrl = await renderCardBarcodeDataURL(testVal);
  const w = window.open('');
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>TEST DIAGNOSTIC BARCODE SHEET</title>
      ${BARCODE_PRINT_CSS}
    </head>
    <body style="font-family:sans-serif; text-align:center; padding:20mm;">
      <h2>TEST DIAGNOSTIC BARCODE SHEET</h2>
      <p>ورقة اختبار فحص جودة طباعة وقراءة الباركود (TEST DIAGNOSTIC)</p>
      <div style="margin:20mm auto; display:inline-block; border:2px solid #000; padding:15mm;">
        <div>${blankCardTile(dataUrl || testVal)}</div>
        <div class="card-code-text" style="font-size:16pt; margin-top:5mm;">${testVal}</div>
      </div>
    </body>
    </html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

async function submitBarcodeScan() {
  return await processBarcodeScanSubmit();
}

async function getStudentCardHistory(cardId) {
  return await callBackend('getStudentCardHistory', currentCallerToken, cardId, currentCallerToken.institutionId).catch(() => []);
}

async function openReplaceCardModal(oldCardId, studentId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-card" style="max-width:440px;">
        <div class="modal-header">
          <div class="modal-title">🔄 استبدال كارت الطالب بكارت جديد</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <p style="color:#94a3b8; font-size:0.85rem;">سيتم إيقاف الكارت القديم وربط كارنيه جديد متاح للطالب.</p>
        <div class="form-group">
          <label>سبب الاستبدال</label>
          <select id="mReplaceReason">
            <option value="LOST">فقدان الكارت (LOST)</option>
            <option value="DAMAGED">تلف الكارت (DAMAGED)</option>
            <option value="UPGRADE">تحديث الكارت (UPGRADE)</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button class="btn" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-warning" onclick="submitReplaceCard('${oldCardId}', '${studentId}')">تأكيد الاستبدال</button>
        </div>
      </div>
    </div>
  `;
}

async function submitReplaceCard(oldCardId, studentId) {
  const reason = document.getElementById('mReplaceReason')?.value || 'LOST';
  try {
    await callBackend('replaceStudentCard', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      oldCardId,
      studentId,
      reason
    });
    showToast('تم استبدال البطاقة بنجاح!');
    closeModal();
    if (activeView === 'cards') await renderActiveView('cards');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function renderLoginCenterBrand() {
  if (window.electronAPI && typeof window.electronAPI.getBoundBranding === 'function') {
    const bound = await window.electronAPI.getBoundBranding();
    if (bound) applyBrandingToUI(bound);
  }
}

async function generateTodaySessionsAction() {
  try {
    const res = await callBackend('generateTodaySessions', currentCallerToken, { institutionId: currentCallerToken.institutionId });
    showToast(`تم توليد حصص اليوم بنجاح (${(res?.sessions || []).length} حصة)`);
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

function openAddScheduleModal() {
  openAddSessionModal();
}

async function openSessionAttendanceModal(sessionId) {
  openRecordAttendanceForSession(sessionId);
}

async function submitCorrectAttendance(attendanceId, newStatus, reason) {
  try {
    await callBackend('correctAttendance', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      attendanceId,
      newStatus,
      reason
    });
    showToast('تم تصحيح الحضور بنجاح');
    if (activeView === 'attendance') await renderActiveView('attendance');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function refreshAttendanceSummary(sessionId) {
  return await callBackend('getSessionAttendanceSummary', currentCallerToken, sessionId, currentCallerToken.institutionId);
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
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn" style="background:#0284c7;" onclick="batchSyncAllTeachersPin()">🔄 توليد / مزامنة PIN لجميع المعلمين</button>
        <button class="btn btn-success" onclick="openAddTeacherModal()">+ إضافة معلم جديد</button>
      </div>
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
                  <button class="btn" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#0284c7;" onclick="showTeacherPinModal('${t.id}')">🔑 الـ PIN</button>
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
  const subjectPriceMap = new Map((subjects || []).map(s => [s.id, Math.max(0, Number(s.price || 0))]));
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
              <th>سعر المجموعة</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(g => {
              const enrolled = Number(g.enrolledCount || 0);
              const cap = Number(g.maxCapacity || g.capacity || 30);
              const remaining = Math.max(0, cap - enrolled);
              const subjPrice = g.subjectPrice !== undefined ? Math.max(0, Number(g.subjectPrice)) : (subjectPriceMap.get(g.subjectId) || 0);
              const totalGroupFee = enrolled * subjPrice;
              return `
              <tr>
                <td><span class="code-box">${g.code || g.id}</span></td>
                <td><strong>${escapeHtmlAttr(g.name)}</strong><div style="font-size:0.7rem; color:#64748b;">${yearMap.get(g.academicYearId) || ''}</div></td>
                <td><div>${escapeHtmlAttr(stageMap.get(g.stageId) || g.stageId || '-')}</div><div style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(subjectMap.get(g.subjectId) || g.subjectName || '-')}</div></td>
                <td><div>${escapeHtmlAttr(teacherMap.get(g.teacherId) || g.teacherName || '-')}</div><div style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(roomMap.get(g.roomId) || g.room || '-')}</div></td>
                <td><span class="badge" style="background:${enrolled >= cap ? '#7f1d1d' : '#1e293b'}; color:${enrolled >= cap ? '#fca5a5' : '#38bdf8'};">${enrolled} / ${cap}</span></td>
                <td><span class="badge" style="background:${remaining === 0 ? '#7f1d1d' : '#14532d'}; color:${remaining === 0 ? '#fca5a5' : '#86efac'};">${remaining === 0 ? 'ممتلئة' : remaining + ' متاح'}</span></td>
                <td><strong style="color:#38bdf8;">${fmtMoney(totalGroupFee)}</strong><div style="font-size:0.72rem; color:#94a3b8;">(${enrolled} طالب × ${fmtMoney(subjPrice)})</div></td>
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

// 5. Attendance View & Barcode Scanner Kiosk
let lastScannedStudentData = null;
let currentAttendanceSessionId = null;

function playAudioNotification(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    if (type === 'payment') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.25, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } else if (type === 'attendance') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'warning' || type === 'due') {
      [440, 370].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.3, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.2);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.22);
      });
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch (_) {}
}

function playAudioBeep(isSuccess = true) {
  playAudioNotification(isSuccess ? 'attendance' : 'error');
}

const liveNotificationQueue = [];

function addNotificationAlert(title, message, type = 'info') {
  const notif = {
    id: 'NOTIF_' + Date.now(),
    title,
    message,
    type,
    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };
  liveNotificationQueue.unshift(notif);
  if (liveNotificationQueue.length > 50) liveNotificationQueue.pop();

  playAudioNotification(type === 'payment' ? 'payment' : (type === 'warning' ? 'warning' : 'attendance'));

  const countBadge = document.getElementById('unreadNotifCount');
  if (countBadge) {
    countBadge.innerText = liveNotificationQueue.length;
    countBadge.style.display = 'inline-block';
  }
  renderNotificationList();
}

function toggleNotificationDrawer() {
  const drawer = document.getElementById('notificationDrawer');
  if (!drawer) return;
  drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
  if (drawer.style.display === 'block') {
    renderNotificationList();
  }
}

function clearAllNotifications() {
  liveNotificationQueue.length = 0;
  const countBadge = document.getElementById('unreadNotifCount');
  if (countBadge) countBadge.style.display = 'none';
  renderNotificationList();
}

function renderNotificationList() {
  const list = document.getElementById('notificationList');
  if (!list) return;
  if (liveNotificationQueue.length === 0) {
    list.innerHTML = '<div style="color:#64748b; text-align:center; padding:1.5rem; font-size:0.85rem;">لا توجد تنبيهات جديدة حالياً</div>';
    return;
  }
  list.innerHTML = liveNotificationQueue.map(n => `
    <div style="background:#1e293b; padding:0.6rem 0.8rem; border-radius:6px; margin-bottom:0.4rem; border-right:3px solid ${n.type === 'payment' ? '#22c55e' : (n.type === 'warning' ? '#f59e0b' : '#38bdf8')};">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:#f8fafc; font-size:0.82rem;">${escapeHtmlAttr(n.title)}</strong>
        <span style="color:#64748b; font-size:0.7rem;">${n.time}</span>
      </div>
      <div style="color:#cbd5e1; font-size:0.78rem; margin-top:0.25rem;">${escapeHtmlAttr(n.message)}</div>
    </div>
  `).join('');
}

function renderScanFeedbackHtml(data) {
  if (!data) return '';
  if (data.success) {
    return `
      <div style="background:rgba(6,95,70,0.5); border:1px solid #10b981; border-radius:10px; padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between; animation:fadeIn 0.2s ease;">
        <div style="display:flex; align-items:center; gap:1rem;">
          <div style="width:48px; height:48px; border-radius:50%; background:#10b981; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.6rem;">
            ✓
          </div>
          <div>
            <div style="font-size:0.75rem; color:#a7f3d0; font-weight:bold;">تم تسجيل الحضور بنجاح</div>
            <div style="font-size:1.25rem; font-weight:800; color:#f8fafc;">${escapeHtmlAttr(data.studentName)}</div>
            <div style="font-size:0.8rem; color:#94a3b8;">المجموعة: ${escapeHtmlAttr(data.groupName || '—')} • الكود: <span style="font-family:monospace; color:#38bdf8;">${escapeHtmlAttr(data.cardCode)}</span></div>
          </div>
        </div>
        <div style="text-align:left;">
          <span class="badge" style="background:#065f46; color:#a7f3d0; border:1px solid #10b981; font-size:0.85rem; padding:0.35rem 0.75rem;">حاضر ✅</span>
          <div style="font-size:0.75rem; color:#cbd5e1; margin-top:0.3rem;">🕒 ${escapeHtmlAttr(data.time)}</div>
        </div>
      </div>
    `;
  } else {
    return `
      <div style="background:rgba(127,29,29,0.5); border:1px solid #ef4444; border-radius:10px; padding:1rem 1.25rem; display:flex; align-items:center; gap:1rem; animation:fadeIn 0.2s ease;">
        <div style="width:48px; height:48px; border-radius:50%; background:#ef4444; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
          ⚠️
        </div>
        <div>
          <div style="font-size:0.75rem; color:#fca5a5; font-weight:bold;">تنبيه في قراءة الباركود</div>
          <div style="font-size:1.05rem; font-weight:bold; color:#fff;">${escapeHtmlAttr(data.message || 'تعذر تسجيل الحضور')}</div>
          ${data.cardCode ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">الكود الممسوح: <span style="font-family:monospace; color:#fca5a5;">${escapeHtmlAttr(data.cardCode)}</span></div>` : ''}
        </div>
      </div>
    `;
  }
}

function updateScanFeedback(data) {
  const c = document.getElementById('scanFeedbackContainer');
  if (c) c.innerHTML = renderScanFeedbackHtml(data);
}

function onAttendanceSessionChange(sessionId) {
  currentAttendanceSessionId = sessionId;
  renderAttendanceView(document.getElementById('mainView'));
}

async function handleBarcodeScannerKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    await processBarcodeScanSubmit();
  }
}

async function processBarcodeScanSubmit() {
  const inp = document.getElementById('barcodeScanInput');
  if (!inp) return;
  const rawCode = inp.value.trim();
  if (!rawCode) return;

  const select = document.getElementById('attActiveSessionSelect');
  const sessionId = select ? select.value : currentAttendanceSessionId;

  if (!sessionId) {
    playAudioBeep(false);
    updateScanFeedback({
      success: false,
      message: 'لا توجد حصة مفتوحة حالياً لاستقبال الحضور. افتح حصة أولاً من الجدول.'
    });
    showToast('اختر حصة مفتوحة أولاً لبدء تسجيل الحضور', true);
    inp.value = '';
    inp.focus();
    return;
  }

  try {
    const res = await callBackend('recordCardScan', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      cardCode: rawCode,
      sessionId
    });

    playAudioBeep(true);
    const stu = res.student || {};
    const feedback = {
      success: true,
      studentName: stu.name || rawCode,
      cardCode: rawCode,
      groupName: res.group?.name || 'المجموعة',
      time: new Date().toLocaleTimeString('ar-EG'),
      status: res.record?.status || 'PRESENT'
    };
    lastScannedStudentData = feedback;
    updateScanFeedback(feedback);
    showToast(`✅ تم تسجيل حضور: ${stu.name || rawCode}`);
    autoDispatchAttendanceWhatsApp({ student: stu, subjectName: res.group?.subjectName || res.group?.name, groupName: res.group?.name });

    // Update records table
    const records = await callBackend('getAttendanceRecords', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const activeSessionRecords = records.filter(r => r.sessionId === sessionId);
    const tableWrapper = document.getElementById('attendanceTableContainer');
    if (tableWrapper) {
      tableWrapper.innerHTML = renderAttendanceTable(activeSessionRecords);
    }
  } catch (err) {
    playAudioBeep(false);
    const feedback = {
      success: false,
      message: friendlyBatchAError(err),
      cardCode: rawCode
    };
    lastScannedStudentData = feedback;
    updateScanFeedback(feedback);
    showToast(friendlyBatchAError(err), true);
  } finally {
    inp.value = '';
    setTimeout(() => { if (inp) inp.focus(); }, 50);
  }
}

async function renderAttendanceView(container) {
  checkAndAutoStartDueSessions();
  let sessions = [];
  let records = [];
  try {
    [sessions, records] = await Promise.all([
      callBackend('getSessions', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getAttendanceRecords', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || []
    ]);
  } catch (err) {
    sessions = [];
    records = [];
  }

  const openSessions = sessions.filter(s => s.status === 'OPEN');
  
  if (window._selectedAttendanceSessionId) {
    currentAttendanceSessionId = window._selectedAttendanceSessionId;
    window._selectedAttendanceSessionId = null;
  } else if (!currentAttendanceSessionId || !openSessions.find(s => s.id === currentAttendanceSessionId)) {
    currentAttendanceSessionId = openSessions[0] ? openSessions[0].id : null;
  }

  const activeSession = openSessions.find(s => s.id === currentAttendanceSessionId) || openSessions[0] || null;
  const sessionRecords = activeSession ? records.filter(r => r.sessionId === activeSession.id) : records;
  const presentCount = sessionRecords.filter(r => (r.status || '').toUpperCase() === 'PRESENT').length;
  const lateCount = sessionRecords.filter(r => (r.status || '').toUpperCase() === 'LATE').length;

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>📋 كشك الحضور الذكي والمسح السريع بالباركود</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          تسجيل فوري متواصل بالباركود عبر قارئ الليزر أو الكاميرا لكارنيهات الطلاب
        </div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="openRecordAttendanceModal('${activeSession?.id || ''}')">+ تسجيل حضور يدوي</button>
        <button class="btn" style="background:#334155; color:#f8fafc;" onclick="renderActiveView('attendance')">🔄 تحديث الكشك</button>
      </div>
    </div>

    <!-- Active Session Selector & Stats -->
    <div class="card" style="margin-bottom:1.25rem; padding:1.25rem; box-shadow:0 8px 24px -4px rgba(0,0,0,0.35);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div style="flex:1; min-width:280px;">
          <label style="color:#38bdf8; font-size:0.85rem; font-weight:bold; display:block; margin-bottom:0.4rem;">
            📌 الحصة النشطة الجارية لاستقبال الحضور:
          </label>
          ${openSessions.length > 0 ? `
            <select id="attActiveSessionSelect" onchange="onAttendanceSessionChange(this.value)" style="width:100%; padding:0.65rem 0.9rem; background:#0f172a; border:2px solid #22c55e; border-radius:8px; color:#f8fafc; font-size:0.95rem; font-weight:bold;">
              ${openSessions.map(s => `
                <option value="${s.id}" ${s.id === (activeSession?.id) ? 'selected' : ''}>
                  🟢 ${escapeHtmlAttr(s.title || 'حصة')} — ${escapeHtmlAttr(s.startTime || '')} إلى ${escapeHtmlAttr(s.endTime || '')} (${escapeHtmlAttr(s.room || 'القاعة')})
                </option>
              `).join('')}
            </select>
          ` : `
            <div style="background:#7f1d1d; color:#fecaca; border:1px solid #ef4444; border-radius:8px; padding:0.75rem 1rem; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
              <span>⚠️ لا توجد حصة مفتوحة حالياً لاستقبال الحضور</span>
              <button class="btn btn-success" style="font-size:0.8rem; padding:0.35rem 0.75rem;" onclick="navigate('schedule')">فتح حصة من الجدول 🗓️</button>
            </div>
          `}
        </div>

        <div style="display:flex; gap:1rem; align-items:center;">
          <div style="text-align:center; background:#1e293b; padding:0.5rem 1rem; border-radius:8px; border:1px solid #334155;">
            <div style="font-size:0.75rem; color:#94a3b8;">حاضر الآن</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#4ade80;">${presentCount}</div>
          </div>
          <div style="text-align:center; background:#1e293b; padding:0.5rem 1rem; border-radius:8px; border:1px solid #334155;">
            <div style="font-size:0.75rem; color:#94a3b8;">متأخر</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#fbbf24;">${lateCount}</div>
          </div>
          <div style="text-align:center; background:#1e293b; padding:0.5rem 1rem; border-radius:8px; border:1px solid #334155;">
            <div style="font-size:0.75rem; color:#94a3b8;">إجمالي السجلات</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#38bdf8;">${sessionRecords.length}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Barcode Scanner Station Box -->
    <div class="card" style="margin-bottom:1.5rem; padding:1.5rem; background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border:2px solid #38bdf8; border-radius:14px; box-shadow:0 12px 32px -4px rgba(56,189,248,0.2);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div style="font-size:1.8rem;">📷</div>
          <div>
            <h3 style="color:#f8fafc; margin:0; font-size:1.15rem;">محطة المسح السريع بالباركود</h3>
            <div style="font-size:0.8rem; color:#38bdf8;">جاهز للقراءة الفورية من قارئ الباركود اليدوي USB أو البلوتوث</div>
          </div>
        </div>
        <div style="font-size:0.75rem; color:#94a3b8; background:rgba(30,41,59,0.8); padding:0.35rem 0.75rem; border-radius:20px; border:1px solid #475569;">
          ⚡ المسح متواصل وتلقائي بدون استخدام الفأرة
        </div>
      </div>

      <div style="position:relative; margin-bottom:1rem;">
        <input type="text" id="barcodeScanInput" autofocus autocomplete="off"
          placeholder="📷 وجّه قارئ الباركود نحو الكارنيه (أو اكتب الكود واضغط Enter)..."
          onkeydown="handleBarcodeScannerKey(event)"
          style="width:100%; padding:0.9rem 1.25rem; font-size:1.2rem; font-weight:bold; background:#0b1329; border:2px solid #22c55e; border-radius:10px; color:#4ade80; outline:none; box-shadow:0 0 15px rgba(34,197,94,0.3); font-family:monospace;">
        <button class="btn btn-success" onclick="processBarcodeScanSubmit()" style="position:absolute; left:8px; top:8px; bottom:8px; padding:0 1.5rem; font-weight:bold; font-size:0.95rem; border-radius:8px;">
          تسجيل الحضور ⚡
        </button>
      </div>

      <!-- Live Feedback Box for Scanned Student -->
      <div id="scanFeedbackContainer">
        ${lastScannedStudentData ? renderScanFeedbackHtml(lastScannedStudentData) : `
          <div style="text-align:center; padding:1.25rem; background:rgba(15,23,42,0.6); border-radius:8px; border:1px dashed #334155; color:#94a3b8; font-size:0.85rem;">
            في انتظار مسح أول كارت طالب... وجّه قارئ الباركود نحو كارنيه الطالب وسيتم تسجيله فوراً مع تنبيه صوتي مرئي.
          </div>
        `}
      </div>
    </div>

    <!-- Attendance Records Table -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>سجلات الحضور المسجلة لليوم (${sessionRecords.length})</span>
        <span style="font-size:0.8rem; color:#94a3b8; font-weight:normal;">تحديث فوري</span>
      </div>
      <div id="attendanceTableContainer">
        ${renderAttendanceTable(sessionRecords)}
      </div>
    </div>
  `;

  setTimeout(() => {
    const inp = document.getElementById('barcodeScanInput');
    if (inp) inp.focus();
  }, 100);
}

// 6. Finance View
async function renderFinanceView(container) {
  const [payments, expenses, dues, vouchers] = await Promise.all([
    callBackend('getPayments', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
    callBackend('getExpenses', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
    callBackend('calcAccruedStudentDues', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => null),
    callBackend('getAiVouchers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
  ]);

  const totalInc = (payments || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalExp = (expenses || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const net = totalInc - totalExp;
  const netDues = dues ? dues.netDuesOwedToCenter : 0;
  const studentsWithDues = dues ? dues.studentsWithDuesCount : 0;

  // Financial accounting of sold AI VIP vouchers & packages
  const allVouchers = Array.isArray(vouchers) ? vouchers : [];
  const soldVouchers = allVouchers.filter(v => v.status === 'REDEEMED');
  const activeVouchers = allVouchers.filter(v => v.status === 'ACTIVE');
  const totalSoldVouchersRevenue = soldVouchers.reduce((acc, v) => acc + (Number(v.price) || 0), 0);
  const totalActiveVouchersValue = activeVouchers.reduce((acc, v) => acc + (Number(v.price) || 0), 0);

  // Store in global state for quick access in details modal
  window._financeVouchersState = { allVouchers, soldVouchers, activeVouchers, totalSoldVouchersRevenue, totalActiveVouchersValue };

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>💰 الخزينة والمالية وحسابات السنتر</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          متابعة دقيقة للسيولة النقدية، المصروفات، وإصدار إيصالات السداد، مستحقات الحضور، ومبيعات الأكواد
        </div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openRecordPaymentModal()">💳 + تسجيل تحصيل نقدية</button>
        <button class="btn btn-warning" style="box-shadow:0 4px 12px rgba(245,158,11,0.3);" onclick="openRecordExpenseModal()">💸 + تسجيل مصروفات</button>
        <button class="btn btn-primary" style="box-shadow:0 4px 12px rgba(2,132,199,0.3);" onclick="openReceiptHistoryModal()">🧾 أرشيف الإيصالات المطبوعة</button>
      </div>
    </div>
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي المقبوضات والتحصيل</div>
            <div class="stat-value" style="color:#4ade80;">${fmtMoney(totalInc)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">💵</div>
        </div>
        <div class="stat-sub"><span>عدد الإيصالات: ${(payments || []).length}</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid #ef4444;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي المصروفات</div>
            <div class="stat-value" style="color:#f87171;">${fmtMoney(totalExp)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);">💸</div>
        </div>
        <div class="stat-sub"><span>عدد بنود الصرف: ${(expenses || []).length}</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid ${net >= 0 ? '#0284c7' : '#ef4444'};">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">صافي رصيد الخزينة</div>
            <div class="stat-value" style="color:${net >= 0 ? '#38bdf8' : '#f87171'};">${fmtMoney(net)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(2,132,199,0.15); color:#38bdf8; border:1px solid rgba(2,132,199,0.3);">💎</div>
        </div>
        <div class="stat-sub"><span>${net >= 0 ? '🟢 فائض نقدي متاح' : '🔴 عجز في الرصيد'}</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid #f59e0b; cursor:pointer;" onclick="openAccruedDuesModal()" title="اضغط لمعاينة تفاصيل المستحقات وإرسال مطالبات واتس">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">مستحقات السنتر حسب الحضور ⚖️</div>
            <div class="stat-value" style="color:#fbbf24;">${fmtMoney(netDues)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);">⚖️</div>
        </div>
        <div class="stat-sub"><span style="color:#fde047;">${studentsWithDues} طالب مدين — عرض التفاصيل ومطالبة 👆</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid #a855f7; cursor:pointer; background:linear-gradient(145deg, rgba(30,41,59,0.9), rgba(88,28,135,0.15));" onclick="openVouchersFinancialDetailsModal()" title="اضغط لمعاينة الحساب المالي للأكواد والباقات المباعة للطلبة">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">مبيعات الأكواد والباقات 🎟️</div>
            <div class="stat-value" style="color:#c084fc;">${fmtMoney(totalSoldVouchersRevenue)}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);">🎟️</div>
        </div>
        <div class="stat-sub"><span style="color:#d8b4fe;">${soldVouchers.length} كود مباع ومفعل (${activeVouchers.length} متاح) 👆</span></div>
      </div>
    </div>
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>💳 سجل المقبوضات المالية والإيصالات</span>
        <span style="font-size:0.8rem; color:#94a3b8; font-weight:normal;">تحديث فوري من السحابة</span>
      </div>
      ${renderPaymentsTable(payments || [])}
    </div>
  `;
}

function openVouchersFinancialDetailsModal() {
  const st = window._financeVouchersState || { soldVouchers: [], activeVouchers: [], totalSoldVouchersRevenue: 0, totalActiveVouchersValue: 0 };
  const sold = st.soldVouchers || [];
  const active = st.activeVouchers || [];
  const totalRev = st.totalSoldVouchersRevenue || 0;
  const potentialVal = st.totalActiveVouchersValue || 0;

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:780px; max-height:90vh; overflow-y:auto; padding:1.75rem; background:#0f172a; border:1px solid #a855f7; box-shadow:0 20px 45px rgba(0,0,0,0.6);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #334155; padding-bottom:0.75rem;">
          <div>
            <h3 style="margin:0; font-size:1.25rem; color:#f8fafc; display:flex; align-items:center; gap:0.5rem;">
              <span>🎟️</span> الحساب المالي لمبيعات الأكواد والباقات VIP
            </h3>
            <div style="font-size:0.85rem; color:#94a3b8; margin-top:0.25rem;">
              تفاصيل الإيرادات المحصلة من بيع وتفعيل أكواد المساعد الذكي VIP المربوطة بالطلاب
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="closeModal()">إغلاق ✕</button>
        </div>

        <!-- 3 KPI Mini Cards -->
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
          <div style="background:#1e293b; border:1px solid rgba(168,85,247,0.3); border-radius:10px; padding:1rem; text-align:center;">
            <div style="font-size:0.8rem; color:#c084fc;">إجمالي الإيراد المحصل</div>
            <div style="font-size:1.5rem; font-weight:bold; color:#f8fafc; margin-top:0.35rem;">${fmtMoney(totalRev)}</div>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">صافي إيرادات الأكواد المباعة</div>
          </div>
          <div style="background:#1e293b; border:1px solid rgba(34,197,94,0.3); border-radius:10px; padding:1rem; text-align:center;">
            <div style="font-size:0.8rem; color:#4ade80;">الأكواد المفعلة للطلاب</div>
            <div style="font-size:1.5rem; font-weight:bold; color:#4ade80; margin-top:0.35rem;">${sold.length} كود</div>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">تم تفعيلها للطلاب</div>
          </div>
          <div style="background:#1e293b; border:1px solid rgba(56,189,248,0.3); border-radius:10px; padding:1rem; text-align:center;">
            <div style="font-size:0.8rem; color:#38bdf8;">الأكواد المتاحة للبيع</div>
            <div style="font-size:1.5rem; font-weight:bold; color:#38bdf8; margin-top:0.35rem;">${active.length} كود</div>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">بقيمة متوقعة: ${fmtMoney(potentialVal)}</div>
          </div>
        </div>

        <!-- Table of Sold Codes -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <h4 style="margin:0; font-size:1rem; color:#cbd5e1;">📋 بيان تفصيلي بالأكواد المباعة للطلاب:</h4>
          <span style="font-size:0.8rem; color:#94a3b8;">${sold.length} عملية بيع مسجلة</span>
        </div>

        ${sold.length === 0 ? `
          <div style="text-align:center; padding:2.5rem; background:#1e293b; border-radius:8px; border:1px dashed #475569;">
            <div style="font-size:2rem; margin-bottom:0.5rem;">🎟️</div>
            <div style="color:#f8fafc; font-weight:bold; margin-bottom:0.25rem;">لا توجد أكواد مباعة حتى الآن</div>
            <div style="color:#94a3b8; font-size:0.85rem; margin-bottom:1rem;">يمكنك توليد وتوزيع أكواد VIP من قسم الباقات وربطها بالطلاب لاحتساب إيراداتها هنا تلقائياً</div>
            <button class="btn btn-primary btn-sm" onclick="closeModal(); navigateToView('subscriptions');">الانتقال لقسم الباقات والأكواد 🚀</button>
          </div>
        ` : `
          <div style="max-height:340px; overflow-y:auto; border:1px solid #334155; border-radius:8px;">
            <table class="table" style="margin:0; font-size:0.88rem; width:100%;">
              <thead>
                <tr style="background:#1e293b; position:sticky; top:0;">
                  <th>كود الاشتراك</th>
                  <th>اسم الباقة</th>
                  <th>الطالب المستفيد</th>
                  <th>تاريخ البيع والتفعيل</th>
                  <th>السعر المحصل</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${sold.map(v => `
                  <tr>
                    <td><strong style="color:#c084fc; font-family:monospace; font-size:0.95rem;">${escapeHtml(v.code)}</strong></td>
                    <td style="color:#e2e8f0;">${escapeHtml(v.name || 'باقة VIP')}</td>
                    <td style="font-weight:600; color:#38bdf8;">${escapeHtml(v.redeemedByStudentName || 'طالب')}</td>
                    <td style="color:#94a3b8; font-size:0.8rem;">${v.redeemedAt ? new Date(v.redeemedAt).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'}</td>
                    <td style="font-weight:bold; color:#4ade80;">${fmtMoney(v.price || 0)}</td>
                    <td><span class="badge" style="background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);">مباع ومفعل</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; padding-top:1rem; border-top:1px solid #334155;">
          <button class="btn btn-primary" onclick="closeModal(); navigateToView('subscriptions');">
            🚀 فتح مركز توزيع الباقات والأكواد
          </button>
          <button class="btn btn-secondary" onclick="closeModal()">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  `;
}

async function openAccruedDuesModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:420px; text-align:center; padding:2rem; background:#0f172a; border:1px solid #334155;">
        <div class="spinner" style="margin: 0 auto 1.25rem auto; width:38px; height:38px; border:3px solid rgba(245,158,11,0.2); border-top-color:#f59e0b; border-radius:50%; animation: spin 0.8s linear infinite;"></div>
        <div style="color:#fbbf24; font-weight:bold; font-size:1.05rem; margin-bottom:0.35rem;">جاري احتساب مستحقات السنتر...</div>
        <p style="color:#94a3b8; font-size:0.85rem; margin:0 0 1.25rem 0; line-height:1.5;">
          تتبع حضور الطلاب وحساب الحصص المحضورة مقارنة بإجمالي المدفوعات
        </p>
        <button class="btn" style="background:#334155; font-size:0.8rem; padding:0.35rem 1rem;" onclick="closeModal()">إلغاء</button>
      </div>
    </div>
  `;

  try {
    const dues = await callBackend('calcAccruedStudentDues', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || { studentsBreakdown: [], netDuesOwedToCenter: 0 };
    const studentsWithDues = (dues.studentsBreakdown || []).filter(s => s.netDue > 0);

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:780px; max-height:88vh; overflow-y:auto; background:#0f172a; border:1px solid #f59e0b;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:0.5rem; color:#fbbf24;">
              <span>⚖️ كشف تفصيلي لمستحقات السنتر حسب حضور الطلاب</span>
            </div>
            <button class="btn" style="background:#475569; padding:0.25rem 0.65rem;" onclick="closeModal()">✖️</button>
          </div>

          <div style="background:rgba(245,158,11,0.1); border:1px solid #f59e0b; border-radius:8px; padding:0.9rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:bold; color:#fbbf24; font-size:1.05rem;">إجمالي المبالغ المستحقة للسنتر: ${fmtMoney(dues.netDuesOwedToCenter)}</div>
              <div style="font-size:0.8rem; color:#cbd5e1; margin-top:0.25rem;">
                معادلة الحساب: احتساب الحصص المحضورة من إجمالي المادة على كل 4 حصص - إجمالي مدفوعات الطالب
              </div>
            </div>
            <div style="text-align:left;">
              <span class="badge warning" style="font-size:0.85rem;">${studentsWithDues.length} طالب مدين</span>
            </div>
          </div>

          ${studentsWithDues.length > 0 ? `
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>اسم الطالب</th>
                    <th>الحصص المحضورة</th>
                    <th>المستحق الإجمالي</th>
                    <th>المدفوع</th>
                    <th>صافي المطلوب</th>
                    <th>إجراءات المطالبة</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentsWithDues.map(s => `
                    <tr>
                      <td>
                        <strong style="color:#f8fafc; display:block;">${escapeHtmlAttr(s.studentName)}</strong>
                        <small style="color:#94a3b8;">${escapeHtmlAttr(s.guardianPhone || s.studentPhone || 'بدون هاتف')}</small>
                      </td>
                      <td><span class="badge" style="background:#1e3a8a; color:#93c5fd;">${s.attendedSessionsCount} حصة</span></td>
                      <td>${fmtMoney(s.totalAccrued)}</td>
                      <td style="color:#22c55e;">${fmtMoney(s.totalPaid)}</td>
                      <td><strong style="color:#f87171; font-size:0.95rem;">${fmtMoney(s.netDue)}</strong></td>
                      <td>
                        <div style="display:flex; gap:0.35rem;">
                          <button class="btn btn-success" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="sendStudentDueWhatsApp('${escapeHtmlAttr(s.studentId)}', '${escapeHtmlAttr(s.studentName)}', ${s.netDue}, '${escapeHtmlAttr(s.guardianPhone || s.studentPhone)}')">
                            💬 واتس
                          </button>
                          <button class="btn btn-primary" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="closeModal(); openRecordPaymentModal(); setTimeout(() => { const ni = document.getElementById('mPayStudentName'); if (ni) ni.value = '${escapeHtmlAttr(s.studentName)}'; const ai = document.getElementById('mPayAmount'); if (ai) ai.value = ${s.netDue}; }, 200);">
                            💳 تحصيل
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
              <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎉</div>
              <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد أي مستحقات متأخرة على الطلاب!</h3>
              <p style="color:#94a3b8; font-size:0.85rem;">جميع الطلاب قاموا بسداد مستحقات الحصص التي حضروها بالكامل.</p>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:450px; background:#0f172a; border:1px solid #ef4444; padding:1.5rem; text-align:center;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
          <h3 style="color:#f87171; margin:0 0 0.5rem 0;">تعذر جلب المستحقات المالية</h3>
          <p style="color:#cbd5e1; font-size:0.85rem; line-height:1.5;">${escapeHtmlAttr(friendlyBatchAError(err))}</p>
          <div style="display:flex; justify-content:center; gap:0.5rem; margin-top:1.5rem;">
            <button class="btn" style="background:#475569;" onclick="closeModal()">إغلاق</button>
            <button class="btn btn-warning" onclick="openAccruedDuesModal()">إعادة المحاولة 🔄</button>
          </div>
        </div>
      </div>
    `;
    showToast(friendlyBatchAError(err), true);
  }
}

async function sendStudentDueWhatsApp(studentId, studentName, dueAmount, phone) {
  let targetPhone = phone;
  if (!targetPhone) {
    targetPhone = prompt('أدخل رقم هاتف ولي الأمر (واتساب):', '01');
    if (!targetPhone) return;
  }
  const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})) || {};
  let template = config.dueReminderTemplate || 'تذكير بموعد السداد: نود تذكير سيادتكم بقرب موعد تسديد مصروفات الطالب {studentName}. المبلغ المستحق: {dueAmount} ج.م.';
  
  const text = template
    .replace(/{studentName}/g, studentName)
    .replace(/{dueAmount}/g, dueAmount)
    .replace(/{centerName}/g, 'السنتر');

  try {
    const res = await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: targetPhone,
      message: text
    });
    if (res.mode === 'api') {
      showToast('✅ تم إرسال تذكير المصروفات عبر بوابة الواتس بنجاح!');
    } else {
      openWhatsAppExternalUrl(res.directUrl || res.waMeUrl);
      showToast('تم فتح واتساب لإرسال مطالبة المصروفات');
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

async function openReceiptHistoryModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري جلب أرشيف الإيصالات المطبوعة...</p></div></div>';

  try {
    const receipts = await callBackend('getReceipts', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    receipts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:780px; max-height:88vh; overflow-y:auto; background:#0f172a; border:1px solid #0284c7;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="color:#38bdf8; font-weight:bold; font-size:1.1rem;">🧾 أرشيف الإيصالات المالية المعتمدة (${receipts.length})</div>
            <button class="btn" style="background:#475569; padding:0.25rem 0.65rem;" onclick="closeModal()">✖️</button>
          </div>

          <div style="margin-bottom:1rem;">
            <input type="text" id="receiptSearchInput" oninput="filterReceiptHistoryTable()" placeholder="ابحث برقم الإيصال أو اسم الطالب..." style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>

          ${receipts.length > 0 ? `
            <div style="overflow-x:auto;">
              <table class="data-table" id="receiptHistoryTable">
                <thead>
                  <tr>
                    <th>رقم الإيصال</th>
                    <th>اسم الطالب</th>
                    <th>المبلغ المحصل</th>
                    <th>التاريخ</th>
                    <th>المستلم</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${receipts.map(r => `
                    <tr>
                      <td><span class="code-box" style="color:#38bdf8; font-weight:bold;">${escapeHtmlAttr(r.humanNumber || r.receiptNumber || r.id)}</span></td>
                      <td><strong style="color:#f8fafc;">${escapeHtmlAttr(r.studentName || '—')}</strong></td>
                      <td style="color:#4ade80; font-weight:bold;">
                        ${fmtMoney(r.amount)}
                        ${r.discount && Number(r.discount) > 0 ? `<span class="badge" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); font-size:0.7rem; margin-right:0.3rem;" title="خصم ممنوح: ${fmtMoney(r.discount)} ${r.discountReason ? `(${escapeHtmlAttr(r.discountReason)})` : ''}">خصم -${fmtMoney(r.discount)}</span>` : ''}
                      </td>
                      <td>${r.paymentDate || '—'}</td>
                      <td><small style="color:#94a3b8;">${escapeHtmlAttr(r.collectorName || 'الخزينة')}</small></td>
                      <td>
                        <button class="btn btn-primary" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openReceiptPreviewModal(${escapeHtmlAttr(JSON.stringify(r))})">
                          👁️ معاينة وطباعة
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align:center; padding:3rem; color:#64748b;">
              <div style="font-size:2.5rem; margin-bottom:0.5rem;">🧾</div>
              <p>لا توجد إيصالات سابقة مسجلة بالسنتر حتى الآن.</p>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

function filterReceiptHistoryTable() {
  const q = document.getElementById('receiptSearchInput')?.value?.toLowerCase() || '';
  const rows = document.querySelectorAll('#receiptHistoryTable tbody tr');
  rows.forEach(r => {
    const text = r.innerText.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

// 7. Schedule View
const SESSION_STATUS_AR = {
  SCHEDULED: 'مجدولة ⏳',
  OPEN: 'مفتوحة للحضور 🟢',
  CLOSED: 'مكتملة ومغلقة ✅',
  CANCELLED: 'ملغاة ❌'
};

function filterTodaySessions() {
  const todayStr = new Date().toISOString().split('T')[0];
  const searchInput = document.getElementById('sessionSearchInput');
  if (searchInput) searchInput.value = todayStr;
  filterSessionsTable();
}

function openRecordAttendanceForSession(sessionId) {
  window._selectedAttendanceSessionId = sessionId;
  activeView = 'attendance';
  renderSidebarNav();
  renderActiveView('attendance');
}

async function checkAndAutoStartDueSessions() {
  if (!currentCallerToken || !currentCallerToken.institutionId) return;
  try {
    const sessions = await callBackend('getSessions', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowHours = String(now.getHours()).padStart(2, '0');
    const nowMins = String(now.getMinutes()).padStart(2, '0');
    const nowTimeStr = `${nowHours}:${nowMins}`;

    let shouldRefresh = false;

    for (const s of sessions) {
      const sDate = s.date || s.sessionDate || todayStr;

      // 1. Auto-Start: Open scheduled session when scheduled start time arrives
      if (s.status === 'SCHEDULED' && sDate && s.startTime) {
        const isDue = sDate < todayStr || (sDate === todayStr && nowTimeStr >= s.startTime);
        const notEnded = !s.endTime || sDate < todayStr || nowTimeStr < s.endTime;
        if (isDue && notEnded) {
          console.log(`[AutoStart] Session ${s.id} (${s.title}) reached scheduled time (${s.startTime}). Auto-starting...`);
          await callBackend('startSession', currentCallerToken, s.id, currentCallerToken.institutionId);
          showToast(`🔔 حان موعد حصة: "${s.title}" — تم فتح الحصة تلقائياً وبدء استقبال الحضور بالباركود! 🟢`);
          playAudioNotification('attendance');
          addNotificationAlert('بدء حصة تلقائياً', `تم فتح الحصة "${s.title}" تلقائياً لحلول وقت البدء المحدد (${s.startTime}).`, 'attendance');
          shouldRefresh = true;
        } else if (isDue && !notEnded) {
          // Both start time and end time passed before opening: close directly
          console.log(`[AutoClose] Scheduled session ${s.id} (${s.title}) was never opened and passed end time (${s.endTime}). Closing...`);
          await callBackend('closeSession', currentCallerToken, s.id, currentCallerToken.institutionId);
          showToast(`⏹️ انتهى الموعد المحدد لحصة: "${s.title}" — تم إغلاق الحصة تلقائياً.`);
          shouldRefresh = true;
        }
      }

      // 2. Auto-Close: Close open session when scheduled end time arrives
      if (s.status === 'OPEN' && s.endTime) {
        const isPastEnd = sDate < todayStr || (sDate === todayStr && nowTimeStr >= s.endTime);
        if (isPastEnd) {
          console.log(`[AutoClose] Open session ${s.id} (${s.title}) reached scheduled end time (${s.endTime}). Auto-closing...`);
          await callBackend('closeSession', currentCallerToken, s.id, currentCallerToken.institutionId);
          showToast(`⏹️ انتهى الموعد المحدد لحصة: "${s.title}" (${s.endTime}) — تم إغلاق الحصة تلقائياً وإنهاء استقبال الحضور.`);
          playAudioNotification('soft');
          addNotificationAlert('إغلاق حصة تلقائياً', `تم إغلاق الحصة "${s.title}" تلقائياً لانتهاء وقتها المحدد (${s.endTime}).`, 'alert');
          shouldRefresh = true;
        }
      }
    }

    if (shouldRefresh) {
      if (activeView === 'schedule') {
        await renderActiveView('schedule');
      } else if (activeView === 'attendance') {
        await renderActiveView('attendance');
      }
    }
  } catch (err) {
    console.warn('[AutoSyncSessions] Notice:', err.message);
  }
}

if (typeof window !== 'undefined') {
  if (window._sessionAutoStartInterval) clearInterval(window._sessionAutoStartInterval);
  window._sessionAutoStartInterval = setInterval(checkAndAutoStartDueSessions, 30000);
}

async function renderScheduleView(container) {
  checkAndAutoStartDueSessions();
  let sessions = [];
  try {
    sessions = await callBackend('getSessions', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  } catch (err) {
    console.error('Failed to get sessions:', err);
    sessions = [];
  }

  const total = sessions.length;
  const openCount = sessions.filter(s => s.status === 'OPEN').length;
  const scheduledCount = sessions.filter(s => s.status === 'SCHEDULED').length;
  const closedCount = sessions.filter(s => s.status === 'CLOSED').length;

  window._allSessionsCache = sessions;

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>🗓️ جدول الحصص والمواعيد الدراسية (${total})</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">جدولة الحصص الأسبوعية واليومية، الفتح التلقائي للحصص، وإدارة ملفات ومذكرات الحصة</div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openAddSessionModal()">+ إضافة حصة في الجدول</button>
        <button class="btn" style="background:#334155; color:#f8fafc;" onclick="renderActiveView('schedule')">🔄 تحديث</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي الحصص</div>
            <div class="stat-value" style="color:#38bdf8;">${total}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">🗓️</div>
        </div>
        <div class="stat-sub"><span>كل الحصص المسجلة</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">حصص جارية ومفتوحة الآن</div>
            <div class="stat-value" style="color:#4ade80;">${openCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">🟢</div>
        </div>
        <div class="stat-sub"><span>تستقبل تسجيل الحضور بالباركود</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #f59e0b;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">حصص قادمة مجدولة</div>
            <div class="stat-value" style="color:#fbbf24;">${scheduledCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);">⏳</div>
        </div>
        <div class="stat-sub"><span>تفتح تلقائياً عند حلول موعدها</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #64748b;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">حصص مكتملة ومغلقة</div>
            <div class="stat-value" style="color:#94a3b8;">${closedCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(100,116,139,0.15); color:#cbd5e1; border:1px solid rgba(100,116,139,0.3);">✅</div>
        </div>
        <div class="stat-sub"><span>تم إنهاء تسجيل الحضور</span></div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:1.25rem; padding:1rem 1.25rem; display:flex; gap:1rem; align-items:center; flex-wrap:wrap; box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div style="flex:1; min-width:220px;">
        <input type="text" id="sessionSearchInput" placeholder="🔍 بحث بعنوان الحصة، القاعة، أو التاريخ..." oninput="filterSessionsTable()" style="width:100%; padding:0.6rem 0.9rem; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.9rem;">
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button class="btn" style="background:#0284c7; color:#fff; font-size:0.85rem; padding:0.55rem 0.95rem; font-weight:bold;" onclick="filterTodaySessions()">📅 حصص اليوم</button>
        <label style="color:#94a3b8; font-size:0.85rem; margin-right:0.5rem;">الحالة:</label>
        <select id="sessionStatusFilter" onchange="filterSessionsTable()" style="padding:0.6rem 0.9rem; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.9rem;">
          <option value="ALL">كل الحالات</option>
          <option value="OPEN">مفتوحة للحضور الآن 🟢</option>
          <option value="SCHEDULED">قادمة مجدولة ⏳</option>
          <option value="CLOSED">مكتملة ومغلقة ✅</option>
          <option value="CANCELLED">ملغاة ❌</option>
        </select>
      </div>
    </div>

    <!-- Sessions Table Card -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div id="sessionsTableWrapper">
        ${renderSessionsTableHtml(sessions)}
      </div>
    </div>
  `;
}

function renderSessionsTableHtml(list) {
  if (!list || list.length === 0) {
    return `
      <div style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
        <div style="font-size:3.5rem; margin-bottom:0.75rem; opacity:0.8;">🗓️</div>
        <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد حصص دراسية مطابقة للشروط</h3>
        <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.25rem;">يمكنك جدولة حصص جديدة لربطها بالمجموعات والقاعات ومتابعة الحضور بسهولة.</p>
        <button class="btn btn-success" onclick="openAddSessionModal()">+ إضافة أول حصة في الجدول</button>
      </div>
    `;
  }

  return `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>عنوان الحصة والملفات</th>
            <th>التاريخ والوقت</th>
            <th>القاعة</th>
            <th>حالة الحصة</th>
            <th style="text-align:center;">إجراءات الإدارة</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => {
            const isScheduled = s.status === 'SCHEDULED';
            const isOpen = s.status === 'OPEN';
            const isClosed = s.status === 'CLOSED';
            const isCancelled = s.status === 'CANCELLED';
            const attCount = Array.isArray(s.attachments) ? s.attachments.length : 0;

            return `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <strong style="color:#f8fafc; font-size:0.95rem;">${escapeHtmlAttr(s.title || 'حصة دراسية')}</strong>
                    <button class="btn" style="padding:0.2rem 0.5rem; font-size:0.72rem; background:${attCount > 0 ? '#1e3a8a' : '#334155'}; color:${attCount > 0 ? '#93c5fd' : '#cbd5e1'}; border:1px solid #3b82f6;" onclick="openSessionFilesModal('${s.id}')" title="رفع وعرض ملفات ومذكرات الحصة">
                      📁 الملفات (${attCount})
                    </button>
                  </div>
                  ${s.date ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">📅 ${escapeHtmlAttr(s.date)}</div>` : ''}
                </td>
                <td>
                  <span style="color:#38bdf8; font-family:monospace; font-weight:bold;">${escapeHtmlAttr(s.startTime || '16:00')} - ${escapeHtmlAttr(s.endTime || '18:00')}</span>
                </td>
                <td>
                  <span class="badge" style="background:#1e293b; color:#cbd5e1; border:1px solid #334155;">📍 ${escapeHtmlAttr(s.room || 'القاعة العامة')}</span>
                </td>
                <td>
                  ${isOpen ? '<span class="badge" style="background:#065f46; color:#a7f3d0; border:1px solid #10b981; font-weight:bold;">مفتوحة للحضور 🟢</span>' :
                    (isScheduled ? '<span class="badge" style="background:#0369a1; color:#e0f2fe; border:1px solid #0284c7;">مجدولة ⏳</span>' :
                    (isClosed ? '<span class="badge" style="background:#334155; color:#94a3b8;">مكتملة ومغلقة ✅</span>' :
                    '<span class="badge" style="background:#7f1d1d; color:#fca5a5;">ملغاة ❌</span>'))}
                  <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.3rem;">
                    ⏱️ تأخير: <span style="color:#fbbf24; font-weight:600;">${s.lateThresholdMinutes !== undefined ? s.lateThresholdMinutes : 15}د</span>
                    | 🔒 غلق: <span style="color:#f87171; font-weight:600;">${s.closeAttendanceMinutes !== undefined ? s.closeAttendanceMinutes : 45}د</span>
                  </div>
                </td>
                <td>
                  <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
                    ${isScheduled ? `
                      <button class="btn btn-success" style="padding:0.3rem 0.65rem; font-size:0.75rem; box-shadow:0 2px 8px rgba(34,197,94,0.3);" onclick="startSessionAction('${s.id}')" title="بدء الحصة الآن يدوياً">▶️ بدء الحصة</button>
                    ` : ''}
                    ${isOpen ? `
                      <button class="btn btn-warning" style="padding:0.3rem 0.65rem; font-size:0.75rem; box-shadow:0 2px 8px rgba(245,158,11,0.3);" onclick="closeSessionAction('${s.id}')" title="إغلاق الحصة وإنهاء الحضور">⏹️ إغلاق الحصة</button>
                      <button class="btn btn-success" style="padding:0.3rem 0.65rem; font-size:0.75rem; box-shadow:0 2px 8px rgba(34,197,94,0.3);" onclick="openRecordAttendanceForSession('${s.id}')" title="الانتقال لكشك الحضور بالباركود">📋 كشك الحضور</button>
                      <button class="btn" style="padding:0.3rem 0.65rem; font-size:0.75rem; background:#dc2626; color:#fff;" onclick="confirmMarkSessionAbsent('${s.id}')" title="غلق الحضور واحتساب الغياب لجميع الطلاب المقيدين الذين لم يحضروا">🚫 رصد الغياب للغائبين</button>
                    ` : ''}
                    ${!isClosed && !isCancelled ? `
                      <button class="btn" style="padding:0.3rem 0.65rem; font-size:0.75rem; background:#0284c7;" onclick="openEditSessionModal('${s.id}')" title="تعديل الموعد أو القاعة أو مدد الحضور">✏️ تعديل</button>
                      <button class="btn btn-danger" style="padding:0.3rem 0.65rem; font-size:0.75rem;" onclick="cancelSessionAction('${s.id}')" title="إلغاء الحصة">❌ إلغاء</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 8. Content View
async function renderContentView(container) {
  let lessons = [];
  let contents = [];
  try {
    const [lRes, cRes] = await Promise.all([
      callBackend('getLessons', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getContent', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    lessons = lRes || [];
    contents = cRes || [];
  } catch (err) {
    lessons = [];
    contents = [];
  }

  const publishedLessons = lessons.filter(l => l.status === 'PUBLISHED').length;
  window._allLessonsCache = lessons;
  window._allContentsCache = contents;

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>📖 المحتوى التعليمي والدروس والمذكرات الرقمية (${lessons.length + contents.length})</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">إدارة المناهج والدروس الرقمية، مشاركة المذكرات والملخصات مع الطلاب والمعلمين</div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openAddLessonModal()">+ إضافة درس جديد</button>
        <button class="btn" style="background:#0284c7; color:#fff;" onclick="openAddContentModal()">📁 + رفع مذكرة / ملف PDF</button>
        <button class="btn" style="background:#334155; color:#f8fafc;" onclick="renderActiveView('content')">🔄 تحديث</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي الدروس المسجلة</div>
            <div class="stat-value" style="color:#38bdf8;">${lessons.length}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">📖</div>
        </div>
        <div class="stat-sub"><span>شروحات ووحدات تعليمية</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">دروس منشورة للطلاب</div>
            <div class="stat-value" style="color:#4ade80;">${publishedLessons}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">🟢</div>
        </div>
        <div class="stat-sub"><span>متاحة في تطبيق الطالب</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #a855f7;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">الملفات والمذكرات الرقمية</div>
            <div class="stat-value" style="color:#c084fc;">${contents.length}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);">📄</div>
        </div>
        <div class="stat-sub"><span>مكتبة المذكرات والملازم</span></div>
      </div>
    </div>

    <!-- Lessons Table -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3); margin-bottom:1.5rem;">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>📚 الدروس والوحدات التعليمية (${lessons.length})</span>
      </div>
      ${lessons && lessons.length > 0 ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>عنوان الدرس</th>
                <th>ترتيب الدرس</th>
                <th>الحالة للطلاب</th>
                <th>تاريخ الإنشاء</th>
                <th style="text-align:center;">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${lessons.map(l => `
                <tr>
                  <td>
                    <strong style="color:#f8fafc; font-size:0.95rem;">${escapeHtmlAttr(l.title)}</strong>
                    ${l.description ? `<div style="font-size:0.75rem; color:#94a3b8; max-width:320px;">${escapeHtmlAttr(l.description)}</div>` : ''}
                  </td>
                  <td><span class="badge" style="background:#1e293b; color:#38bdf8; border:1px solid #0284c7;">درس #${l.lessonOrder || l.lessonNumber || 1}</span></td>
                  <td>
                    ${l.status === 'PUBLISHED' ? '<span class="badge" style="background:#064e3b; color:#86efac;">منشور للطلاب 🟢</span>' :
                      (l.status === 'ARCHIVED' ? '<span class="badge" style="background:#334155; color:#94a3b8;">مؤرشف 🗄️</span>' :
                      '<span class="badge" style="background:#78350f; color:#fde047;">مسودة DRAFT 📝</span>')}
                  </td>
                  <td style="color:#94a3b8; font-size:0.8rem;">${l.createdAt ? new Date(l.createdAt).toLocaleDateString('ar-EG') : '—'}</td>
                  <td>
                    <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
                      ${l.status !== 'PUBLISHED' && l.status !== 'ARCHIVED' ? `
                        <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="publishLessonAction('${l.id}')">📢 نشر</button>
                      ` : ''}
                      ${l.status !== 'ARCHIVED' ? `
                        <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="archiveLessonAction('${l.id}')">🗄️ أرشفة</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
          <div style="font-size:3rem; margin-bottom:0.5rem; opacity:0.8;">📚</div>
          <h4 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد دروس مضافة حالياً</h4>
          <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:1rem;">قم بإضافة دروس جديدة وتنظيمها في وحدات دراسية لمشاركتها مع الطلاب.</p>
          <button class="btn btn-success" onclick="openAddLessonModal()">+ إضافة أول درس</button>
        </div>
      `}
    </div>

    <!-- Memos / Content Table -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>📄 المكتبة والمذكرات الرقمية المرفوعة (${contents.length})</span>
      </div>
      ${contents && contents.length > 0 ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>عنوان المذكرة / الملف</th>
                <th>التصنيف</th>
                <th>حجم الملف</th>
                <th>تاريخ الرفع</th>
                <th>الحالة</th>
                <th style="text-align:center;">إجراءات الملف</th>
              </tr>
            </thead>
            <tbody>
              ${contents.map(c => {
                const isPdf = (c.fileName || c.title || '').toLowerCase().endsWith('.pdf') || (c.type === 'PDF');
                const isDoc = (c.fileName || '').toLowerCase().match(/\.(doc|docx)$/);
                const isImg = (c.fileName || '').toLowerCase().match(/\.(jpg|jpeg|png|webp)$/) || (c.type === 'IMAGE');
                const icon = isPdf ? '📕' : (isDoc ? '📝' : (isImg ? '🖼️' : '📄'));
                const fileTarget = c.dataUrl || c.url;
                const sizeText = c.sizeBytes ? ((c.sizeBytes > 1024 * 1024) ? (c.sizeBytes / (1024 * 1024)).toFixed(2) + ' MB' : (c.sizeBytes / 1024).toFixed(1) + ' KB') : '—';
                return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <span style="font-size:1.3rem;">${icon}</span>
                      <div>
                        <strong style="color:#f1f5f9; display:block;">${escapeHtmlAttr(c.title)}</strong>
                        ${c.fileName && c.fileName !== c.title ? `<div style="font-size:0.72rem; color:#94a3b8;">${escapeHtmlAttr(c.fileName)}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td><span class="badge" style="background:#1e3a8a; color:#93c5fd;">${escapeHtmlAttr(c.type || 'PDF')}</span></td>
                  <td style="color:#cbd5e1; font-size:0.82rem;">${sizeText}</td>
                  <td style="color:#94a3b8; font-size:0.82rem;">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '—'}</td>
                  <td><span class="badge" style="background:#064e3b; color:#86efac;">متاح للطلاب 🟢</span></td>
                  <td style="text-align:center;">
                    <div style="display:inline-flex; gap:0.35rem;">
                      ${fileTarget ? `<button type="button" class="btn" style="background:#0284c7; color:#fff; padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openOrDownloadFile('${escapeHtmlAttr(fileTarget)}', '${escapeHtmlAttr(c.title)}')">👁️ فتح / تنزيل</button>` : ''}
                      <button type="button" class="btn btn-danger" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="deleteContentItemAction('${c.id}')">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
          <div style="font-size:3rem; margin-bottom:0.5rem; opacity:0.8;">📄</div>
          <h4 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد مذكرات أو ملفات مرفوعة حالياً</h4>
          <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:1rem;">يمكنك رفع مذكرات وملخصات وملازم PDF ليتمكن الطلاب من تحميلها.</p>
          <button class="btn" style="background:#0284c7; color:#fff;" onclick="openAddContentModal()">+ رفع أول مذكرة الآن</button>
        </div>
      `}
    </div>
  `;
}

// 9. Exams View
async function renderExamsView(container) {
  let exams = [];
  let groups = [];
  let stages = [];
  let subjects = [];
  try {
    const [eRes, gRes, stRes, sbRes] = await Promise.all([
      callBackend('getExams', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getStages', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getSubjects', currentCallerToken, currentCallerToken.institutionId).catch(() => [])
    ]);
    exams = eRes || [];
    groups = gRes || [];
    stages = stRes || [];
    subjects = sbRes || [];
  } catch (err) {
    exams = [];
  }

  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  const stageMap = new Map(stages.map(s => [s.id, s.name]));
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));

  const publishedCount = exams.filter(x => x.status === 'PUBLISHED').length;
  const closedCount = exams.filter(x => x.status === 'CLOSED').length;
  window._allExamsCache = exams;
  window._allGroupsCache = groups;

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>📝 إدارة الاختبارات والتقييمات الدورية (${exams.length})</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">إنشاء ومتابعة الاختبارات، نشر النتائج، رصد كشوف الدرجات والغياب، وطباعة تقارير التقييم</div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn" style="background: linear-gradient(135deg, #8b5cf6, #d946ef); color:#fff; font-weight:bold; box-shadow:0 4px 14px rgba(139,92,246,0.4);" onclick="openAiExamGeneratorModal()">🤖 توليد اختبار بالذكاء الاصطناعي</button>
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openAddExamModal()">+ إنشاء اختبار يدوي</button>
        <button class="btn" style="background:#334155; color:#f8fafc;" onclick="renderActiveView('exams')">🔄 تحديث</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي الاختبارات</div>
            <div class="stat-value" style="color:#38bdf8;">${exams.length}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">📝</div>
        </div>
        <div class="stat-sub"><span>اختبارات مسجلة بالسنتر</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">اختبارات منشورة للطلاب</div>
            <div class="stat-value" style="color:#4ade80;">${publishedCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">🟢</div>
        </div>
        <div class="stat-sub"><span>نشطة وجاهزة لرصد الدرجات</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #a855f7;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">اختبارات مكتملة ومغلقة</div>
            <div class="stat-value" style="color:#c084fc;">${closedCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);">✅</div>
        </div>
        <div class="stat-sub"><span>تم رصد نتائجها بالكامل</span></div>
      </div>
    </div>

    <!-- Exams Table -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      ${exams && exams.length > 0 ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>عنوان الاختبار</th>
                <th>المرحلة والمادة</th>
                <th>المجموعة المستهدفة</th>
                <th>الدرجة الكلية / النجاح</th>
                <th>المدة والموعد</th>
                <th>الحالة</th>
                <th style="text-align:center;">إجراءات الإدارة والكشوف</th>
              </tr>
            </thead>
            <tbody>
              ${exams.map(x => {
                const isDraft = x.status === 'DRAFT' || !x.status;
                const isPublished = x.status === 'PUBLISHED';
                const isClosed = x.status === 'CLOSED';
                const groupName = x.groupId ? (groupMap.get(x.groupId) || x.groupId) : 'جميع مجموعات المادة';
                const stageName = stageMap.get(x.stageId) || x.stageId || '—';
                const subjectName = subjectMap.get(x.subjectId) || x.subjectId || '—';

                return `
                  <tr>
                    <td>
                      <strong style="color:#f8fafc; font-size:0.95rem;">${escapeHtmlAttr(x.title)}</strong>
                      ${x.description ? `<div style="font-size:0.75rem; color:#94a3b8; max-width:280px;">${escapeHtmlAttr(x.description)}</div>` : ''}
                      ${x.paperUrl ? `<div style="margin-top:0.25rem;"><button type="button" class="btn" style="background:#0284c7; color:#fff; padding:0.15rem 0.55rem; font-size:0.72rem;" onclick="openOrDownloadFile('${escapeHtmlAttr(x.paperUrl)}', '${escapeHtmlAttr(x.title)} - ورقة الاختبار')">📎 عرض / تنزيل ورقة الاختبار</button></div>` : ''}
                    </td>
                    <td>
                      <div style="font-size:0.85rem; color:#e2e8f0; font-weight:bold;">${escapeHtmlAttr(subjectName)}</div>
                      <div style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(stageName)}</div>
                    </td>
                    <td>
                      <span class="badge" style="background:#1e293b; color:#38bdf8; border:1px solid #334155;">${escapeHtmlAttr(groupName)}</span>
                    </td>
                    <td>
                      <span style="color:#4ade80; font-weight:bold;">${x.maxScore || 100} د</span>
                      <span style="font-size:0.75rem; color:#94a3b8;">(نجاح: ${x.passingScore || Math.round((x.maxScore || 100) * 0.5)} د)</span>
                    </td>
                    <td>
                      <div style="font-size:0.85rem; color:#cbd5e1;">⏱️ ${x.durationMinutes ? x.durationMinutes + ' دقيقة' : 'غير محدد'}</div>
                      <div style="font-size:0.75rem; color:#94a3b8;">📅 ${x.examDate || '—'}</div>
                    </td>
                    <td>
                      ${isPublished ? '<span class="badge" style="background:#064e3b; color:#86efac;">منشور ونشط 🟢</span>' :
                        (isClosed ? '<span class="badge" style="background:#334155; color:#cbd5e1;">مكتمل ومغلق ✅</span>' :
                        '<span class="badge" style="background:#78350f; color:#fde047;">مسودة DRAFT 📝</span>')}
                    </td>
                    <td>
                      <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
                        ${isDraft ? `
                          <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="publishExamAction('${x.id}')" title="نشر الاختبار">📢 نشر</button>
                        ` : ''}
                        <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#8b5cf6;" onclick="openRecordGradesModal('${x.id}')" title="كشف رصد درجات الطلاب والغياب">📊 كشف الدرجات</button>
                        <button class="btn" style="padding:0.25rem 0.55rem; font-size:0.75rem; background:#0284c7;" onclick="printExamGradesReport('${x.id}')" title="طباعة كشف الدرجات">🖨️ طباعة</button>
                        ${isPublished ? `
                          <button class="btn btn-warning" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="closeExamAction('${x.id}')" title="إنهاء وإغلاق الاختبار">⏹️ إنهاء</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
          <div style="font-size:3.5rem; margin-bottom:0.75rem; opacity:0.8;">📝</div>
          <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد اختبارات مسجلة حالياً</h3>
          <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.25rem;">يمكنك إعداد الاختبارات الدورية وتحديد المجموعات ورصد درجات الطلاب وطباعة الكشوف.</p>
          <button class="btn btn-success" onclick="openAddExamModal()">+ إنشاء أول اختبار الآن</button>
        </div>
      `}
    </div>
  `;
}

// 9.5 Homework View
async function renderHomeworkView(container) {
  let homework = [];
  let groups = [];
  let stages = [];
  let subjects = [];
  let lessons = [];
  try {
    const [hRes, gRes, stRes, sbRes, lRes] = await Promise.all([
      callBackend('getHomework', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getStages', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getSubjects', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getLessons', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    homework = hRes || [];
    groups = gRes || [];
    stages = stRes || [];
    subjects = sbRes || [];
    lessons = lRes || [];
  } catch (err) {
    homework = [];
  }

  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  const stageMap = new Map(stages.map(s => [s.id, s.name]));
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
  const lessonMap = new Map(lessons.map(l => [l.id, l.title]));

  const publishedCount = homework.filter(h => h.status === 'PUBLISHED').length;
  const closedCount = homework.filter(h => h.status === 'CLOSED').length;
  window._allHomeworkCache = homework;
  window._allGroupsCache = groups;

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>📑 إدارة الواجبات المنزلية والتكليفات (${homework.length})</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">تكليف الطلاب، تحديد المواعيد والمرفقات، متابعة التسليمات، وتصحيح ورصد درجات وملاحظات الطلاب</div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openAddHomeworkModal()">+ إضافة واجب جديد</button>
        <button class="btn" style="background:#334155; color:#f8fafc;" onclick="renderActiveView('homework')">🔄 تحديث</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي الواجبات</div>
            <div class="stat-value" style="color:#38bdf8;">${homework.length}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">📑</div>
        </div>
        <div class="stat-sub"><span>تكليفات مسجلة بالسنتر</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">واجبات نشطة للتسليم</div>
            <div class="stat-value" style="color:#4ade80;">${publishedCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">🟢</div>
        </div>
        <div class="stat-sub"><span>متاحة في تطبيق الطالب</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #64748b;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">واجبات مغلقة / منتهية</div>
            <div class="stat-value" style="color:#94a3b8;">${closedCount}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(100,116,139,0.15); color:#cbd5e1; border:1px solid rgba(100,116,139,0.3);">✅</div>
        </div>
        <div class="stat-sub"><span>تم استلام وتصحيح الحلول</span></div>
      </div>
    </div>

    <!-- Homework Table -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      ${homework && homework.length > 0 ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>عنوان الواجب</th>
                <th>المادة والدرس</th>
                <th>المجموعة المستهدفة</th>
                <th>نمط التسليم والدرجة</th>
                <th>آخر موعد للتسليم</th>
                <th>الحالة</th>
                <th style="text-align:center;">إجراءات التسليم والتصحيح</th>
              </tr>
            </thead>
            <tbody>
              ${homework.map(h => {
                const isDraft = h.status === 'DRAFT' || !h.status;
                const isPublished = h.status === 'PUBLISHED';
                const isClosed = h.status === 'CLOSED';
                const groupName = h.groupId ? (groupMap.get(h.groupId) || h.groupId) : 'جميع المجموعات';
                const subjectName = subjectMap.get(h.subjectId) || h.subjectId || '—';
                const lessonTitle = lessonMap.get(h.lessonId) || h.lessonId || '—';

                return `
                  <tr>
                    <td>
                      <strong style="color:#f8fafc; font-size:0.95rem;">${escapeHtmlAttr(h.title)}</strong>
                      ${h.description ? `<div style="font-size:0.75rem; color:#94a3b8; max-width:280px;">${escapeHtmlAttr(h.description)}</div>` : ''}
                      ${h.attachmentUrl ? `<div style="margin-top:0.25rem;"><button type="button" class="btn" style="background:#0284c7; color:#fff; padding:0.15rem 0.55rem; font-size:0.72rem;" onclick="openOrDownloadFile('${escapeHtmlAttr(h.attachmentUrl)}', '${escapeHtmlAttr(h.title)} - ورقة الواجب')">📎 عرض / تنزيل ورقة الواجب</button></div>` : ''}
                    </td>
                    <td>
                      <div style="font-size:0.85rem; color:#e2e8f0; font-weight:bold;">${escapeHtmlAttr(subjectName)}</div>
                      <div style="font-size:0.75rem; color:#94a3b8;">الدرس: ${escapeHtmlAttr(lessonTitle)}</div>
                    </td>
                    <td>
                      <span class="badge" style="background:#1e293b; color:#38bdf8; border:1px solid #334155;">${escapeHtmlAttr(groupName)}</span>
                    </td>
                    <td>
                      <span class="badge" style="background:#1e3a8a; color:#93c5fd;">${h.mode === 'PAPER' ? '📝 ورقي' : (h.mode === 'HYBRID' ? '📲 مختلط / إلكتروني' : 'إلكتروني')}</span>
                      <div style="color:#4ade80; font-weight:bold; font-size:0.85rem; margin-top:0.2rem;">${h.maxScore || 20} درجة</div>
                    </td>
                    <td style="color:#94a3b8; font-size:0.82rem;">
                      ${h.dueAt ? new Date(h.dueAt).toLocaleDateString('ar-EG') : '—'}
                    </td>
                    <td>
                      ${isPublished ? '<span class="badge" style="background:#064e3b; color:#86efac;">متاح للتسليم 🟢</span>' :
                        (isClosed ? '<span class="badge" style="background:#334155; color:#cbd5e1;">مغلق ومكتمل ✅</span>' :
                        '<span class="badge" style="background:#78350f; color:#fde047;">مسودة DRAFT 📝</span>')}
                    </td>
                    <td>
                      <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
                        ${isDraft ? `
                          <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="publishHomeworkAction('${h.id}')" title="نشر الواجب للطلاب">📢 نشر</button>
                        ` : ''}
                        <button class="btn" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#0284c7;" onclick="openHomeworkSubmissionsModal('${h.id}')" title="كشف تسليمات الطلاب وتصحيح الواجب">📥 كشف التسليمات والتصحيح</button>
                        ${isPublished ? `
                          <button class="btn btn-warning" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="closeHomeworkAction('${h.id}')" title="إغلاق فترة التسليم">⏹️ إغلاق</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
          <div style="font-size:3.5rem; margin-bottom:0.75rem; opacity:0.8;">📑</div>
          <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد واجبات مسجلة حالياً</h3>
          <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.25rem;">يمكنك إنشاء واجبات وتحديد مواعيد التسليم وتصحيح إجابات الطلاب وإرجاع الملاحظات.</p>
          <button class="btn btn-success" onclick="openAddHomeworkModal()">+ إضافة أول واجب الآن</button>
        </div>
      `}
    </div>
  `;
}


// 10. Subscriptions View
// 10. Subscriptions & AI VIP Voucher Hub View
function getSubscriptionFeatureBadge(feat) {
  switch (feat) {
    case 'ai_tutor':
      return '<span class="badge" style="background:#1e1b4b; color:#c084fc;">🤖 المساعد الذكي وحل المسائل</span>';
    case 'homework_solver':
      return '<span class="badge" style="background:#064e3b; color:#86efac;">📝 تصحيح الواجبات التلقائي</span>';
    case 'exam_practice':
      return '<span class="badge" style="background:#451a03; color:#fde047;">🎯 توليد اختبارات تدريبية</span>';
    case 'vip_materials':
      return '<span class="badge" style="background:#172554; color:#93c5fd;">📚 بنك الأسئلة المتقدم</span>';
    case 'priority_speed':
      return '<span class="badge" style="background:#3b0764; color:#f0abfc;">⚡ سرعة استجابة فائقة</span>';
    default:
      return `<span class="badge" style="background:#334155; color:#cbd5e1;">✨ ${escapeHtmlAttr(feat)}</span>`;
  }
}

async function renderSubscriptionsView(container) {
  const [plans, vouchers, subs, students] = await Promise.all([
    callBackend('getSubscriptionPlans', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
    callBackend('getAiVouchers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
    callBackend('getSubscriptions', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
    callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || []
  ]);

  window._voucherStudentsCache = students.filter(s => s.status !== 'ARCHIVED');
  window._allVouchersCache = vouchers;
  window._allPlansCache = plans;

  const activeTab = window._subActiveTab || 'plans';
  const activeVouchers = vouchers.filter(v => v.status === 'ACTIVE');
  const redeemedVouchers = vouchers.filter(v => v.status === 'REDEEMED');

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>🎟️ الاشتراكات والباقات وأكواد VIP للذكاء الاصطناعي</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          إنشاء وتحديد خطط وباقات الاشتراك وتخصيص المميزات والأسعار وتوليد كروت الشحن للطلاب
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn btn-primary" style="box-shadow:0 4px 12px rgba(2,132,199,0.3);" onclick="openPlanModal()">
          ➕ إنشاء باقة / خطة جديدة
        </button>
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(139,92,246,0.3); background:#8b5cf6;" onclick="openGenerateVouchersModal()">
          ✨ توليد حزمة أكواد VIP
        </button>
      </div>
    </div>

    <!-- Stats row -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #0284c7;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">خطط وباقات الاشتراك المعرفة</div>
            <div class="stat-value" style="color:#38bdf8;">${plans.length} خطط</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(2,132,199,0.15); color:#38bdf8;">📦</div>
        </div>
        <div class="stat-sub"><span>تحدد الأسعار وحصص الأسئلة والمميزات</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid #8b5cf6;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">أكواد VIP المتاحة للتوزيع</div>
            <div class="stat-value" style="color:#c084fc;">${activeVouchers.length} كود</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(139,92,246,0.15); color:#c084fc;">🎟️</div>
        </div>
        <div class="stat-sub"><span>جاهزة للطباعة والتسليم للطلاب</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">الأكواد المفعلة والمستخدمة</div>
            <div class="stat-value" style="color:#4ade80;">${redeemedVouchers.length} كود</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80;">⚡</div>
        </div>
        <div class="stat-sub"><span>مربوطة بطلاب نشطين بالذكاء الاصطناعي</span></div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div style="display:flex; gap:0.5rem; margin-bottom:1.2rem; border-bottom:1px solid #334155; padding-bottom:0.6rem;">
      <button class="btn" style="${activeTab === 'plans' ? 'background:#0284c7; color:#fff; font-weight:bold;' : 'background:#1e293b; color:#94a3b8;'}" onclick="switchSubscriptionTab('plans')">
        📦 1) خطط وباقات الاشتراك وتحديد الصلاحيات والمميزات (${plans.length})
      </button>
      <button class="btn" style="${activeTab === 'vouchers' ? 'background:#8b5cf6; color:#fff; font-weight:bold;' : 'background:#1e293b; color:#94a3b8;'}" onclick="switchSubscriptionTab('vouchers')">
        🎟️ 2) كروت وأكواد الشحن والتوزيع للطلاب (${vouchers.length})
      </button>
    </div>

    ${activeTab === 'plans' ? `
      <!-- TAB 1: PLANS & PACKAGES -->
      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span>📦 خطط وباقات الاشتراك وتحديد المميزات المفتوحة للطالب</span>
            <div style="font-size:0.8rem; color:#94a3b8; font-weight:normal; margin-top:0.2rem;">
              يمكنك إنشاء خطط باشتراكات شهرية أو فصلية وتحديد حصة الأسئلة والصلاحيات، ثم توليد أكواد بناءً على أي خطة بنقرة واحدة
            </div>
          </div>
          <button class="btn btn-primary" onclick="openPlanModal()" style="padding:0.4rem 0.85rem; font-size:0.85rem;">➕ إضافة باقة جديدة</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:1.2rem; margin-top:1rem;">
          ${plans.map(p => `
            <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:1.2rem; display:flex; flex-direction:column; justify-content:space-between; position:relative; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                  <h3 style="margin:0; font-size:1.1rem; color:#f8fafc; font-weight:bold;">${escapeHtmlAttr(p.name)}</h3>
                  <div style="font-size:1.2rem; font-weight:900; color:#4ade80;">${fmtMoney(p.price)}</div>
                </div>
                
                <p style="color:#94a3b8; font-size:0.82rem; margin:0 0 0.9rem 0; line-height:1.5;">${escapeHtmlAttr(p.description || 'باقة مخصصة لدعم الطلاب بالذكاء الاصطناعي')}</p>

                <!-- Quota and Duration Chips -->
                <div style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
                  <span class="badge" style="background:#1e1b4b; color:#a5b4fc; font-weight:bold; font-size:0.8rem;">⚡ ${p.quotaQuestions} سؤال ذكي</span>
                  <span class="badge" style="background:#0f291e; color:#86efac; font-weight:bold; font-size:0.8rem;">⏳ صلاحية ${p.durationDays} يوم</span>
                  <span class="badge" style="background:#1e293b; color:#cbd5e1; font-size:0.8rem;">${p.status === 'ACTIVE' ? 'نشطة 🟢' : 'مسودة 🟡'}</span>
                </div>

                <!-- Features Whitelist List -->
                <div style="border-top:1px solid #1e293b; padding-top:0.75rem; margin-bottom:1rem;">
                  <div style="font-size:0.75rem; color:#94a3b8; font-weight:bold; margin-bottom:0.4rem;">المميزات والصلاحيات المفتوحة:</div>
                  <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
                    ${(p.features || ['ai_tutor']).map(f => getSubscriptionFeatureBadge(f)).join('')}
                  </div>
                </div>
              </div>

              <!-- Card Actions -->
              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #1e293b; padding-top:0.8rem; margin-top:auto;">
                <button class="btn btn-primary" onclick="openGenerateVouchersModal('${p.id}')" style="background:#8b5cf6; padding:0.35rem 0.75rem; font-size:0.8rem;">
                  ⚡ توليد أكواد لهذه الباقة
                </button>
                <div style="display:flex; gap:0.35rem;">
                  <button class="btn" style="background:#334155; padding:0.35rem 0.6rem; font-size:0.8rem;" onclick="openPlanModal('${p.id}')" title="تعديل الباقة">✏️</button>
                  <button class="btn btn-danger" style="padding:0.35rem 0.6rem; font-size:0.8rem;" onclick="deletePlanAction('${p.id}')" title="حذف الباقة">🗑️</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <!-- TAB 2: VOUCHERS TABLE -->
      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>🤖 بطاقات وأكواد شحن المساعد الذكي VIP (${vouchers.length})</span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-primary" onclick="openGenerateVouchersModal()" style="padding:0.35rem 0.8rem; font-size:0.8rem; background:#8b5cf6;">➕ توليد أكواد</button>
            <button class="btn btn-success" onclick="printVouchersSheet()" style="padding:0.35rem 0.8rem; font-size:0.8rem;">🖨️ طباعة كروت الأكواد للتوزيع</button>
          </div>
        </div>

        ${vouchers.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>كود الشحن (VIP Code)</th>
                  <th>الباقة المرتبطة</th>
                  <th>رصيد الأسئلة</th>
                  <th>المميزات المفتوحة</th>
                  <th>السعر</th>
                  <th>الحالة</th>
                  <th>تاريخ الإنشاء</th>
                  <th>المستفيد</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.map(v => `
                  <tr>
                    <td>
                      <span class="code-box" style="font-size:0.95rem; font-weight:bold; color:#c084fc; letter-spacing:1px; cursor:pointer;" onclick="navigator.clipboard.writeText('${v.code}'); showToast('تم نسخ الكود: ${v.code}');" title="اضغط لنسخ الكود">
                        ${v.code} 📋
                      </span>
                    </td>
                    <td><strong>${escapeHtmlAttr(v.name)}</strong></td>
                    <td><span class="badge" style="background:#1e1b4b; color:#a5b4fc; font-weight:bold;">${v.quotaQuestions} سؤال</span></td>
                    <td>
                      <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                        ${(v.features || ['ai_tutor']).map(f => getSubscriptionFeatureBadge(f)).join('')}
                      </div>
                    </td>
                    <td style="color:#4ade80; font-weight:bold;">${fmtMoney(v.price)}</td>
                    <td>
                      ${v.status === 'ACTIVE' 
                        ? '<span class="badge" style="background:#064e3b; color:#86efac;">متاح للتسليم 🟢</span>' 
                        : '<span class="badge" style="background:#451a03; color:#fde047;">مستخدم ومفعل ⚡</span>'}
                    </td>
                    <td><small style="color:#94a3b8;">${(v.createdAt || '').split('T')[0]}</small></td>
                    <td>
                      ${v.redeemedByStudentName 
                        ? `<strong style="color:#f8fafc;">👨‍🎓 ${escapeHtmlAttr(v.redeemedByStudentName)}</strong>` 
                        : '<span style="color:#64748b;">—</span>'}
                    </td>
                    <td>
                      ${v.status === 'ACTIVE' ? `
                        <button class="btn btn-warning" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openRedeemVoucherModal('${v.code}')">
                          🔗 ربط بطالب
                        </button>
                      ` : `
                        <span style="color:#64748b; font-size:0.75rem;">مكتمل ✅</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
            <div style="font-size:3rem; margin-bottom:0.5rem; opacity:0.8;">🎟️</div>
            <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لم يتم توليد أي حزم أكواد VIP حتى الآن</h3>
            <p style="color:#94a3b8; font-size:0.9rem;">اختر باقة واضغط على "توليد حزمة أكواد VIP جديدة" لإنشاء كروت شحن بصلاحيات أسئلة محددة وبيعها للطلاب بالسنتر.</p>
          </div>
        `}
      </div>
    `}
  `;
}

function switchSubscriptionTab(tab) {
  window._subActiveTab = tab;
  renderActiveView('subscriptions');
}

// Modal for Creating / Editing Subscription Plans
function openPlanModal(planId = null) {
  const plans = window._allPlansCache || [];
  const plan = planId ? plans.find(p => p.id === planId) : null;
  const isEdit = !!plan;

  const features = plan?.features || ['ai_tutor', 'homework_solver'];

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:580px; max-height:92vh; overflow-y:auto; background:#0f172a; border:1px solid #0284c7;">
        <div class="modal-header" style="color:#38bdf8;">
          ${isEdit ? '✏️ تعديل باقة وخطة اشتراك' : '➕ إنشاء خطة / باقة اشتراك جديدة'}
        </div>

        <div class="form-group">
          <label>اسم الخطة / الباقة *</label>
          <input type="text" id="planName" value="${escapeHtmlAttr(plan?.name || '')}" placeholder="مثال: باقة التفوق VIP الشاملة" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>

        <div class="form-group">
          <label>وصف مختصر للباقة</label>
          <textarea id="planDesc" rows="2" placeholder="وصف ما تتضمنه الباقة والمميزات التي تمنحها للطالب" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(plan?.description || '')}</textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group">
            <label>سعر البيع للطالب (جنيه) *</label>
            <input type="number" id="planPrice" value="${plan ? plan.price : 50}" min="0" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
          <div class="form-group">
            <label>مدة الصلاحية (بالأيام) *</label>
            <input type="number" id="planDays" value="${plan ? plan.durationDays : 30}" min="1" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group">
            <label>حصة أسئلة الذكاء الاصطناعي (سؤال) *</label>
            <input type="number" id="planQuota" value="${plan ? plan.quotaQuestions : 50}" min="5" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
          <div class="form-group">
            <label>حالة الباقة</label>
            <select id="planStatus" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
              <option value="ACTIVE" ${plan?.status === 'ACTIVE' ? 'selected' : ''}>نشطة ومتاحة للتوزيع 🟢</option>
              <option value="DRAFT" ${plan?.status === 'DRAFT' ? 'selected' : ''}>مسودة غير معروضة 🟡</option>
            </select>
          </div>
        </div>

        <!-- Features Selection Section -->
        <div class="form-group" style="margin-top:0.75rem; background:#0b1329; border:1px solid #1e293b; border-radius:8px; padding:1rem;">
          <label style="color:#38bdf8; font-weight:bold; margin-bottom:0.5rem; display:block;">
            🎯 تحديد الصلاحيات والمميزات المفتوحة للطالب (Features & Entitlements):
          </label>
          <div style="display:flex; flex-direction:column; gap:0.6rem;">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; color:#f8fafc; font-size:0.9rem;">
              <input type="checkbox" id="feat_ai_tutor" ${features.includes('ai_tutor') ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
              <span>🤖 المساعد الذكي التفاعلي وحل المسائل وشرح الدروس خطوة بخطوة</span>
            </label>

            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; color:#f8fafc; font-size:0.9rem;">
              <input type="checkbox" id="feat_homework_solver" ${features.includes('homework_solver') ? 'checked' : ''} style="width:18px; height:18px; accent-color:#22c55e;">
              <span>📝 تصحيح الواجبات التلقائي ومراجعة الإجابات ونقاط القوة والضعف</span>
            </label>

            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; color:#f8fafc; font-size:0.9rem;">
              <input type="checkbox" id="feat_exam_practice" ${features.includes('exam_practice') ? 'checked' : ''} style="width:18px; height:18px; accent-color:#f59e0b;">
              <span>🎯 توليد اختبارات تدريبية مخصصة وتحديات امتحانية للطلاب</span>
            </label>

            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; color:#f8fafc; font-size:0.9rem;">
              <input type="checkbox" id="feat_vip_materials" ${features.includes('vip_materials') ? 'checked' : ''} style="width:18px; height:18px; accent-color:#38bdf8;">
              <span>📚 فتح بنك الأسئلة والمذكرات المتقدمة ونماذج الإجابة النموذجية</span>
            </label>

            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; color:#f8fafc; font-size:0.9rem;">
              <input type="checkbox" id="feat_priority_speed" ${features.includes('priority_speed') ? 'checked' : ''} style="width:18px; height:18px; accent-color:#c084fc;">
              <span>⚡ سرعة استجابة فائقة وأولوية الذكاء الاصطناعي (High Priority VIP)</span>
            </label>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.2rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-primary" onclick="submitSavePlan('${isEdit ? plan.id : ''}')">
            💾 ${isEdit ? 'تحديث وحفظ الباقة' : 'إنشاء وحفظ الخطة'}
          </button>
        </div>
      </div>
    </div>
  `;
}

async function submitSavePlan(planId = null) {
  const name = document.getElementById('planName')?.value?.trim();
  const description = document.getElementById('planDesc')?.value?.trim();
  const price = Number(document.getElementById('planPrice')?.value || 0);
  const durationDays = Number(document.getElementById('planDays')?.value || 30);
  const quotaQuestions = Number(document.getElementById('planQuota')?.value || 50);
  const status = document.getElementById('planStatus')?.value || 'ACTIVE';

  if (!name) return showToast('اسم الخطة / الباقة مطلوب', true);

  const features = [];
  if (document.getElementById('feat_ai_tutor')?.checked) features.push('ai_tutor');
  if (document.getElementById('feat_homework_solver')?.checked) features.push('homework_solver');
  if (document.getElementById('feat_exam_practice')?.checked) features.push('exam_practice');
  if (document.getElementById('feat_vip_materials')?.checked) features.push('vip_materials');
  if (document.getElementById('feat_priority_speed')?.checked) features.push('priority_speed');

  if (features.length === 0) features.push('ai_tutor');

  try {
    if (planId) {
      await callBackend('updateSubscriptionPlan', currentCallerToken, planId, {
        institutionId: currentCallerToken.institutionId,
        name,
        description,
        price,
        durationDays,
        quotaQuestions,
        features,
        status
      });
      showToast('✅ تم تحديث بيانات الباقة بنجاح!');
    } else {
      await callBackend('createSubscriptionPlan', currentCallerToken, {
        institutionId: currentCallerToken.institutionId,
        name,
        description,
        price,
        durationDays,
        quotaQuestions,
        features,
        status
      });
      showToast('✅ تم إنشاء وحفظ باقة الاشتراك بنجاح!');
    }
    closeModal();
    window._subActiveTab = 'plans';
    await renderActiveView('subscriptions');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function deletePlanAction(planId) {
  if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
  try {
    await callBackend('deleteSubscriptionPlan', currentCallerToken, planId, currentCallerToken.institutionId);
    showToast('تم حذف الباقة بنجاح');
    await renderActiveView('subscriptions');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// Modal for Generating Codes Based on Selected Plan
function openGenerateVouchersModal(prefilledPlanId = null) {
  const plans = window._allPlansCache || [];
  const selectedPlanId = prefilledPlanId || (plans[0]?.id || '');
  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:540px; background:#0f172a; border:1px solid #8b5cf6;">
        <div class="modal-header" style="color:#c084fc;">✨ توليد حزمة أكواد VIP بناءً على باقة محددة</div>
        
        <div class="form-group">
          <label>اختر باقة / خطة الاشتراك المراد توليد الأكواد لها *</label>
          <select id="vchPlanSelect" onchange="onVoucherPlanSelected()" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-weight:bold;">
            ${plans.map(p => `
              <option value="${p.id}" ${p.id === selectedPlanId ? 'selected' : ''}>
                ${escapeHtmlAttr(p.name)} — (${p.price} ج.م | ${p.quotaQuestions} سؤال | ${p.durationDays} يوم)
              </option>
            `).join('')}
          </select>
        </div>

        <div style="background:#0b1329; border:1px solid #1e293b; border-radius:8px; padding:0.9rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:#94a3b8; font-size:0.8rem;">سعر الكود للطالب:</span>
            <strong id="vchDisplayPrice" style="color:#4ade80; font-size:1.05rem;">${selectedPlan ? selectedPlan.price : 50} ج.م</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:#94a3b8; font-size:0.8rem;">رصيد الأسئلة الممنوح:</span>
            <strong id="vchDisplayQuota" style="color:#38bdf8;">${selectedPlan ? selectedPlan.quotaQuestions : 50} سؤال ذكي</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94a3b8; font-size:0.8rem;">المميزات المفتوحة بالكود:</span>
            <div id="vchDisplayFeatures" style="display:flex; gap:0.25rem; flex-wrap:wrap;">
              ${(selectedPlan?.features || ['ai_tutor']).map(f => getSubscriptionFeatureBadge(f)).join('')}
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group">
            <label>عدد الأكواد المطلوب توليدها *</label>
            <input type="number" id="vchCount" value="10" min="1" max="100" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
          <div class="form-group">
            <label>تأكيد اسم الباقة على الكروت</label>
            <input type="text" id="vchName" value="${escapeHtmlAttr(selectedPlan?.name || 'باقة أسئلة VIP للمساعد الذكي')}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitGenerateVouchers()" style="background:#8b5cf6;">⚡ توليد الأكواد وحفظها الآن</button>
        </div>
      </div>
    </div>
  `;
}

function onVoucherPlanSelected() {
  const planId = document.getElementById('vchPlanSelect')?.value;
  const plans = window._allPlansCache || [];
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;

  if (document.getElementById('vchDisplayPrice')) document.getElementById('vchDisplayPrice').innerText = `${plan.price} ج.م`;
  if (document.getElementById('vchDisplayQuota')) document.getElementById('vchDisplayQuota').innerText = `${plan.quotaQuestions} سؤال ذكي`;
  if (document.getElementById('vchName')) document.getElementById('vchName').value = plan.name;
  if (document.getElementById('vchDisplayFeatures')) {
    document.getElementById('vchDisplayFeatures').innerHTML = (plan.features || ['ai_tutor']).map(f => getSubscriptionFeatureBadge(f)).join('');
  }
}

async function submitGenerateVouchers() {
  const planId = document.getElementById('vchPlanSelect')?.value;
  const count = Number(document.getElementById('vchCount')?.value || 10);
  const name = document.getElementById('vchName')?.value;

  try {
    const res = await callBackend('generateAiVoucherBatch', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      planId,
      count,
      name
    });
    closeModal();
    playAudioNotification('payment');
    showToast(`✅ تم بنجاح توليد وتوثيق (${res.count}) كود VIP بناءً على الباقة المختارة!`);
    window._subActiveTab = 'vouchers';
    await renderActiveView('subscriptions');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

function openRedeemVoucherModal(prefilledCode = '') {
  const students = window._voucherStudentsCache || [];
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:520px; background:#0f172a; border:1px solid #38bdf8;">
        <div class="modal-header" style="color:#38bdf8;">🔗 ربط كود VIP بالطالب</div>
        
        <div class="form-group">
          <label>كود الـ VIP المراد ربطه *</label>
          <input type="text" id="mRedeemCode" value="${escapeHtmlAttr(prefilledCode)}" placeholder="VIP-1234-ABCD" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-family:monospace; font-size:1.15rem; letter-spacing:1px; font-weight:bold;">
        </div>

        <div class="form-group">
          <label>اختر الطالب المراد ربط الكود به *</label>
          <select id="mRedeemStudentId" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            <option value="">-- اختر الطالب --</option>
            ${students.map(s => `<option value="${s.id}">${escapeHtmlAttr(s.name)} (${s.phone || s.studentCode || s.id})</option>`).join('')}
          </select>
        </div>

        <div style="background:#0b1329; border:1px solid #1e293b; border-radius:8px; padding:0.85rem; margin-top:0.75rem;">
          <div style="color:#94a3b8; font-size:0.8rem; line-height:1.5;">
            💡 <strong>خيارات التفعيل:</strong><br>
            • <strong>ربط الكود بالطالب (الموصى به):</strong> يتم حجز وتخصيص الكود لهذا الطالب، ويدخل الطالب الكود في تطبيقه لفتح الميزات.<br>
            • <strong>تفعيل وشحن فوري:</strong> يتم فتح وشحن الرصيد للطالب فوراً من السنتر.
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-warning" onclick="submitAllocateVoucher()" style="background:#eab308; color:#0f172a; font-weight:bold;">
              🔗 ربط الكود بالطالب للتفعيل من التطبيق
            </button>
            <button class="btn btn-primary" onclick="submitRedeemVoucher()">
              ⚡ تفعيل وشحن فوري
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function submitAllocateVoucher() {
  const code = document.getElementById('mRedeemCode')?.value?.trim();
  const studentId = document.getElementById('mRedeemStudentId')?.value;
  if (!code || !studentId) return showToast('يرجى تحديد الكود واختيار الطالب', true);

  try {
    const res = await callBackend('allocateAiVoucherToStudent', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      code,
      studentId
    });
    closeModal();
    playAudioNotification('attendance');

    // Show success dialog with option to copy & send via WhatsApp
    const container = document.getElementById('modalContainer');
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:480px; background:#0f172a; border:1px solid #22c55e;">
          <div class="modal-header" style="color:#4ade80;">✅ تم ربط كود VIP بنجاح!</div>
          <div style="color:#cbd5e1; font-size:0.9rem; line-height:1.6; margin-bottom:1rem;">
            تم ربط وتخصيص الكود للطالب <strong>${escapeHtmlAttr(res.studentName)}</strong> بنجاح.<br>
            يمكن للطالب الآن إدخال الكود في تطبيق الطالب لفتح المساعد الذكي VIP.
          </div>
          <div style="background:#1e1b4b; border:2px dashed #8b5cf6; border-radius:8px; padding:1rem; text-align:center; margin-bottom:1.2rem;">
            <div style="font-size:0.8rem; color:#a5b4fc; font-weight:bold;">كود التفعيل (VIP Code)</div>
            <div style="font-size:1.4rem; font-weight:900; color:#fff; font-family:monospace; letter-spacing:2px; margin:0.4rem 0;">
              ${res.code}
            </div>
            <button class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="navigator.clipboard.writeText('${res.code}'); showToast('تم نسخ الكود!');">
              📋 نسخ الكود
            </button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn" style="background:#475569;" onclick="closeModal()">تم والإغلاق</button>
            ${res.studentPhone ? `
              <button class="btn btn-success" onclick="openWhatsAppExternalUrl('https://wa.me/${res.studentPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('أهلاً بك يا ' + res.studentName + '! كود تفعيل باقة المساعد الذكي VIP في تطبيق السنتر هو: ' + res.code + ' — أدخل الكود في قسم المساعد الذكي لفتح كافة الميزات.')}')">
                💬 إرسال الكود للواتساب
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    window._subActiveTab = 'vouchers';
    await renderActiveView('subscriptions');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function submitRedeemVoucher() {
  const code = document.getElementById('mRedeemCode')?.value;
  const studentId = document.getElementById('mRedeemStudentId')?.value;
  if (!code || !studentId) return showToast('يرجى تحديد الكود واختيار الطالب', true);

  try {
    const res = await callBackend('redeemAiVoucher', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      code,
      studentId
    });
    closeModal();
    playAudioNotification('attendance');
    showToast(`✅ تم بنجاح شحن (${res.quotaAdded} سؤال ذكي) وفتح مميزات VIP للطالب ${res.studentName}! رصيده الجديد: ${res.newBalance}`);
    window._subActiveTab = 'vouchers';
    await renderActiveView('subscriptions');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

function printVouchersSheet() {
  const vouchers = (window._allVouchersCache || []).filter(v => v.status === 'ACTIVE');
  if (!vouchers.length) return showToast('لا توجد أكواد نشطة جاهزة للطباعة', true);

  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:720px; max-height:90vh; overflow-y:auto; background:#0f172a; border:1px solid #38bdf8;">
        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #334155; padding-bottom:0.75rem;">
          <strong style="color:#38bdf8;">🖨️ كروت أكواد VIP الجاهزة للطباعة والتوزيع (${vouchers.length} كارت)</strong>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-success" onclick="window.print()">🖨️ طباعة الكروت</button>
            <button class="btn" style="background:#475569;" onclick="closeModal()">إغلاق</button>
          </div>
        </div>

        <div class="printable-receipt-area" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#fff; padding:15px; border-radius:8px;">
          ${vouchers.map(v => `
            <div style="border:2px solid #8b5cf6; border-radius:8px; padding:12px; background:#faf5ff; color:#1e1b4b; text-align:center;">
              <div style="font-size:0.75rem; color:#7c3aed; font-weight:bold;">REMAS EDU VIP ASSISTANT</div>
              <div style="font-size:1.15rem; font-weight:900; color:#4c1d95; margin:6px 0; font-family:monospace; letter-spacing:2px; background:#fff; padding:6px; border-radius:4px; border:1px dashed #a855f7;">
                ${v.code}
              </div>
              <div style="font-size:0.8rem; font-weight:bold; color:#1e1b4b;">${escapeHtmlAttr(v.name)}</div>
              <div style="display:flex; justify-content:space-around; font-size:0.75rem; margin-top:6px; color:#6b21a8;">
                <span>⚡ رصيد: ${v.quotaQuestions} سؤال ذكي</span>
                <span>💰 القيمة: ${v.price} ج.م</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// 11. Parents View
async function renderParentsView(container) {
  const parents = await callBackend('getParents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  
  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>👨‍👩‍👧 إدارة أولياء الأمور وحسابات الدخول (${parents.length})</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          إدارة حسابات أولياء الأمور وكلمات المرور التلقائية PIN ومشاركتها بنقرة واحدة عبر الواتس آب
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn btn-warning" style="box-shadow:0 4px 12px rgba(245,158,11,0.3);" onclick="syncAllGuardiansAction()">
          🔄 مزامنة أولياء الأمور من الطلاب
        </button>
      </div>
    </div>

    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div class="card-title">قائمة أولياء الأمور وبيانات تسجيل الدخول</div>
      ${parents && parents.length > 0 ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم ولي الأمر</th>
                <th>رقم هاتف الدخول</th>
                <th>كلمة المرور / PIN</th>
                <th>الطلاب المرتبطين</th>
                <th>الحالة</th>
                <th>إجراءات الواتس</th>
              </tr>
            </thead>
            <tbody>
              ${parents.map(p => {
                const pin = p.pin || p.tempPassword || '123456';
                return `
                  <tr>
                    <td><strong style="color:#f1f5f9;">${escapeHtmlAttr(p.name || 'ولي أمر')}</strong></td>
                    <td><span style="color:#38bdf8; font-family:monospace; font-size:0.95rem;">${escapeHtmlAttr(p.phone || '—')}</span></td>
                    <td>
                      <span class="code-box" style="font-size:1.1rem; color:#fbbf24; font-weight:bold; letter-spacing:2px;">
                        ${pin}
                      </span>
                    </td>
                    <td>
                      <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                        ${(p.linkedStudentNames || ['طالب مسجل']).map(sn => `<span class="badge" style="background:#1e3a8a; color:#93c5fd;">👨‍🎓 ${escapeHtmlAttr(sn)}</span>`).join('')}
                      </div>
                    </td>
                    <td><span class="badge" style="background:#064e3b; color:#86efac;">نشط ومربوط 🟢</span></td>
                    <td>
                      <button class="btn btn-success" style="padding:0.3rem 0.75rem; font-size:0.78rem; display:flex; align-items:center; gap:0.3rem;" onclick="sendParentCredentialsWhatsApp('${escapeHtmlAttr(p.name || 'ولي أمر')}', '${escapeHtmlAttr(p.phone || '')}', '${pin}')">
                        <span>💬 إرسال بيانات الدخول واتس</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
          <div style="font-size:3rem; margin-bottom:0.5rem; opacity:0.8;">👨‍👩‍👧</div>
          <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا يوجد أولياء أمور مسجلين</h3>
          <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1rem;">يتم إنشاء أولياء الأمور تلقائياً مع أرقام سرية فور تسجيل الطلاب، أو اضغط زر المزامنة.</p>
          <button class="btn btn-warning" onclick="syncAllGuardiansAction()">🔄 تشغيل مزامنة أولياء الأمور الآن</button>
        </div>
      `}
    </div>
  `;
}

async function sendParentCredentialsWhatsApp(parentName, phone, pin) {
  if (!phone) return showToast('لا يوجد رقم هاتف مسجل لولي الأمر', true);
  const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})) || {};
  let template = config.parentCredentialsTemplate || 'مرحباً {parentName}، بيانات دخولك لمنصة وتطبيق ولي الأمر لسنتر {centerName}:\nرقم الدخول: {phone}\nرمز PIN السري: {pin}\nرابط التطبيق: https://remas.app/parent';
  
  const text = template
    .replace(/{parentName}/g, parentName)
    .replace(/{phone}/g, phone)
    .replace(/{pin}/g, pin)
    .replace(/{centerName}/g, 'السنتر')
    .replace(/{appUrl}/g, 'https://remas.app/parent');

  try {
    const res = await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone,
      message: text
    });
    if (res.mode === 'api') {
      showToast('✅ تم إرسال بيانات الدخول لولي الأمر عبر الواتس بنجاح!');
    } else {
      openWhatsAppExternalUrl(res.directUrl || res.waMeUrl);
      showToast('تم فتح واتساب لمشاركة بيانات الدخول مع ولي الأمر');
    }
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function syncAllGuardiansAction() {
  try {
    showToast('جاري مزامنة أولياء الأمور من سجلات الطلاب...');
    const res = await callBackend('syncAllGuardiansFromStudents', currentCallerToken, currentCallerToken.institutionId);
    showToast(`تمت المزامنة بنجاح! تم فحص ${res?.scanned || 0} طالب وتحديث بيانات الأولياء`);
    if (activeView === 'parents') await renderActiveView('parents');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// 11.5 Employees View
async function renderEmployeesView(container) {
  let employees = [];
  try {
    employees = await callBackend('getEmployees', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  } catch (err) {
    console.error('Failed to get employees:', err);
    employees = [];
  }

  const totalEmp = employees.length;
  const activeEmp = employees.filter(e => e.status === 'ACTIVE').length;
  const managers = employees.filter(e => e.role === 'MANAGER').length;
  const financeStaff = employees.filter(e => ['ACCOUNTANT', 'CASHIER'].includes(e.role)).length;

  window._allEmployeesCache = employees;

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>👨‍💼 شؤون الموظفين وإدارة الصلاحيات (${totalEmp})</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">إدارة طاقم عمل السنتر، تعيين الأدوار والصلاحيات، وضبط الأرقام السرية (PIN)</div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="openAddEmployeeModal()">+ إضافة موظف جديد</button>
        <button class="btn" style="background:#334155; color:#f8fafc;" onclick="renderActiveView('employees')">🔄 تحديث</button>
      </div>
    </div>

    <!-- KPI Summary -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">إجمالي الكادر الوظيفي</div>
            <div class="stat-value" style="color:#38bdf8;">${totalEmp}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">👥</div>
        </div>
        <div class="stat-sub"><span>مسجلون في قاعدة بيانات السنتر</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">الموظفون النشطون</div>
            <div class="stat-value" style="color:#4ade80;">${activeEmp}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">🟢</div>
        </div>
        <div class="stat-sub"><span>يمتلكون حق الدخول للنظام</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #a855f7;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">المدراء والمشرفون</div>
            <div class="stat-value" style="color:#c084fc;">${managers}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);">👑</div>
        </div>
        <div class="stat-sub"><span>صلاحيات إدارية كاملة</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #f59e0b;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">المالية والخزينة</div>
            <div class="stat-value" style="color:#fbbf24;">${financeStaff}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);">💼</div>
        </div>
        <div class="stat-sub"><span>محاسبين وكاشير</span></div>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="card" style="margin-bottom:1.25rem; padding:1rem 1.25rem; display:flex; gap:1rem; align-items:center; flex-wrap:wrap; box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div style="flex:1; min-width:220px;">
        <input type="text" id="employeeSearchInput" placeholder="🔍 بحث بالاسم، رقم الهاتف، أو المسمى الوظيفي..." oninput="filterEmployeesTable()" style="width:100%; padding:0.6rem 0.9rem; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.9rem;">
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <label style="color:#94a3b8; font-size:0.85rem;">الدور:</label>
        <select id="employeeRoleFilter" onchange="filterEmployeesTable()" style="padding:0.6rem 0.9rem; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.9rem;">
          <option value="ALL">كل الأدوار</option>
          <option value="MANAGER">مدير (MANAGER)</option>
          <option value="ACCOUNTANT">محاسب (ACCOUNTANT)</option>
          <option value="CASHIER">كاشير (CASHIER)</option>
          <option value="RECEPTIONIST">استقبال (RECEPTIONIST)</option>
          <option value="TEACHER_LINKED">معلم مرتبط (TEACHER_LINKED)</option>
          <option value="STAFF">موظف عام (STAFF)</option>
        </select>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <label style="color:#94a3b8; font-size:0.85rem;">الحالة:</label>
        <select id="employeeStatusFilter" onchange="filterEmployeesTable()" style="padding:0.6rem 0.9rem; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.9rem;">
          <option value="ALL">الكل</option>
          <option value="ACTIVE" selected>النشطون فقط 🟢</option>
          <option value="SUSPENDED">الموقوفون 🔴</option>
          <option value="ARCHIVED">المؤرشفون 🗄️</option>
        </select>
      </div>
    </div>

    <!-- Employees List -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div id="employeesTableWrapper">
        ${renderEmployeesTableHtml(employees)}
      </div>
    </div>
  `;
}

function getEmployeeRoleBadge(role) {
  switch (role) {
    case 'MANAGER':
      return `<span class="badge" style="background:#1e3a8a; color:#93c5fd; border:1px solid #3b82f6;">👑 مدير عام</span>`;
    case 'ACCOUNTANT':
      return `<span class="badge" style="background:#064e3b; color:#86efac; border:1px solid #10b981;">💼 محاسب</span>`;
    case 'CASHIER':
      return `<span class="badge" style="background:#78350f; color:#fde047; border:1px solid #f59e0b;">💵 كاشير</span>`;
    case 'RECEPTIONIST':
      return `<span class="badge" style="background:#581c87; color:#d8b4fe; border:1px solid #a855f7;">🎧 موظف استقبال</span>`;
    case 'TEACHER_LINKED':
      return `<span class="badge" style="background:#0c4a6e; color:#7dd3fc; border:1px solid #0284c7;">👨‍🏫 معلم مرتبط</span>`;
    case 'STAFF':
    default:
      return `<span class="badge" style="background:#1e293b; color:#cbd5e1; border:1px solid #475569;">👤 موظف عام</span>`;
  }
}

function renderEmployeesTableHtml(list) {
  if (!list || list.length === 0) {
    return `
      <div style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
        <div style="font-size:3.5rem; margin-bottom:0.75rem; opacity:0.8;">👨‍💼</div>
        <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا يوجد موظفون مطابقون للشروط</h3>
        <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.25rem;">يمكنك إضافة موظفين جدد وتحديد الصلاحيات الدقيقة لكل موظف ورقم PIN للدخول.</p>
        <button class="btn btn-success" onclick="openAddEmployeeModal()">+ إضافة أول موظف الآن</button>
      </div>
    `;
  }

  return `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>الموظف</th>
            <th>رقم الهاتف</th>
            <th>البريد الإلكتروني</th>
            <th>الدور والصلاحيات</th>
            <th>حالة الحساب</th>
            <th>رمز الدخول (PIN)</th>
            <th style="text-align:center;">إجراءات الإدارة</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(emp => {
            const isManager = emp.role === 'MANAGER';
            const isActive = emp.status === 'ACTIVE';
            const isSuspended = emp.status === 'SUSPENDED';
            const isArchived = emp.status === 'ARCHIVED';
            const isLocked = emp.lockedUntil && new Date(emp.lockedUntil).getTime() > Date.now();
            const permCount = isManager ? 'كاملة (مدير)' : (Array.isArray(emp.permissions) ? emp.permissions.length : 0);

            return `
              <tr>
                <td>
                  <strong style="color:#f8fafc; font-size:0.95rem;">${escapeHtmlAttr(emp.name)}</strong>
                  ${emp.jobTitle ? `<div style="font-size:0.75rem; color:#94a3b8;">${escapeHtmlAttr(emp.jobTitle)}</div>` : ''}
                </td>
                <td><span style="color:#38bdf8; font-family:monospace; font-weight:bold;">${escapeHtmlAttr(emp.phone)}</span></td>
                <td style="color:#cbd5e1; font-size:0.85rem;">${escapeHtmlAttr(emp.email || '—')}</td>
                <td>
                  ${getEmployeeRoleBadge(emp.role)}
                  <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.25rem;">
                    الصلاحيات: <span style="color:#38bdf8;">${permCount}</span>
                  </div>
                </td>
                <td>
                  ${isActive ? '<span class="badge" style="background:#064e3b; color:#86efac;">نشط 🟢</span>' :
                    (isSuspended ? '<span class="badge" style="background:#7f1d1d; color:#fca5a5;">موقوف 🔴</span>' :
                    '<span class="badge" style="background:#334155; color:#94a3b8;">مؤرشف 🗄️</span>')}
                </td>
                <td>
                  ${isLocked ? '<span class="badge" style="background:#78350f; color:#fde047;">محظور مؤقتاً ⏳</span>' :
                    '<span class="badge" style="background:#0f172a; color:#38bdf8; border:1px solid #0284c7;">محمي بـ PIN 🔒</span>'}
                </td>
                <td>
                  <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
                    <button class="btn" style="padding:0.3rem 0.65rem; font-size:0.75rem; background:#0284c7;" onclick="openEditEmployeeModal('${emp.id}')" title="تعديل البيانات الأساسية">✏️ تعديل</button>
                    <button class="btn" style="padding:0.3rem 0.65rem; font-size:0.75rem; background:#8b5cf6;" onclick="openEmployeePermissionsModal('${emp.id}')" title="تخصيص الصلاحيات">🔑 الصلاحيات</button>
                    <button class="btn" style="padding:0.3rem 0.65rem; font-size:0.75rem; background:#d97706;" onclick="openResetEmployeePinModal('${emp.id}')" title="إعادة تعيين الرقم السري">🔢 تغيير PIN</button>
                    ${!isArchived ? (isActive ? `
                      <button class="btn btn-danger" style="padding:0.3rem 0.65rem; font-size:0.75rem;" onclick="toggleEmployeeStatusAction('${emp.id}', 'SUSPENDED')" title="إيقاف الموظف مؤقتاً">⏸️ إيقاف</button>
                    ` : `
                      <button class="btn btn-success" style="padding:0.3rem 0.65rem; font-size:0.75rem;" onclick="toggleEmployeeStatusAction('${emp.id}', 'ACTIVE')" title="إعادة تفعيل الموظف">▶️ تفعيل</button>
                    `) : ''}
                    ${!isArchived ? `
                      <button class="btn" style="padding:0.3rem 0.65rem; font-size:0.75rem; background:#475569; color:#f1f5f9;" onclick="archiveEmployeeAction('${emp.id}')" title="أرشفة الموظف">🗄️ أرشفة</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 11.8 Center Audit Logs View (Modernized & Professional)
function getAuditActionMetadata(action = '') {
  const act = String(action).toUpperCase();
  const map = {
    // Finance & Vouchers
    RECORD_PAYMENT: { label: 'تحصيل مالي وسند قبض', icon: '💳', category: 'FINANCE', catLabel: 'الماليات والتحصيل', bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
    REDEEM_AI_VOUCHER: { label: 'تفعيل كود VIP ذكي', icon: '🎟️', category: 'FINANCE', catLabel: 'الماليات والتحصيل', bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    GENERATE_AI_VOUCHERS: { label: 'توليد أكواد VIP للمساعد الذكي', icon: '✨', category: 'FINANCE', catLabel: 'الماليات والتحصيل', bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    UPDATE_INVOICE_CONFIG: { label: 'تحديث ترويسة الفاتورة والإيصالات', icon: '🧾', category: 'FINANCE', catLabel: 'الماليات والتحصيل', bg: 'rgba(56,189,248,0.15)', text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
    CHARGE_CREATE: { label: 'تسجيل مستحق مالي', icon: '⚖️', category: 'FINANCE', catLabel: 'الماليات والتحصيل', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },

    // Students
    CREATE_STUDENT: { label: 'إضافة طالب جديد', icon: '🎓', category: 'STUDENTS', catLabel: 'الطلاب والقيد', bg: 'rgba(56,189,248,0.15)', text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
    UPDATE_STUDENT: { label: 'تعديل بيانات طالب', icon: '✏️', category: 'STUDENTS', catLabel: 'الطلاب والقيد', bg: 'rgba(56,189,248,0.15)', text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
    ARCHIVE_STUDENT: { label: 'أرشفة طالب', icon: '📁', category: 'STUDENTS', catLabel: 'الطلاب والقيد', bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', border: 'rgba(148,163,184,0.3)' },
    DELETE_STUDENT: { label: 'حذف طالب نهائياً', icon: '🗑️', category: 'STUDENTS', catLabel: 'الطلاب والقيد', bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
    ENROLL_STUDENT_IN_GROUP: { label: 'قيد طالب بمجموعة دراسية', icon: '➕', category: 'STUDENTS', catLabel: 'الطلاب والقيد', bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
    REMOVE_STUDENT_FROM_GROUP: { label: 'إلغاء قيد طالب من مجموعة', icon: '➖', category: 'STUDENTS', catLabel: 'الطلاب والقيد', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },

    // Attendance & Cards
    RECORD_ATTENDANCE: { label: 'تسجيل حضور بالكارت الذكي', icon: '⏱️', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(6,182,212,0.15)', text: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
    CORRECT_ATTENDANCE: { label: 'تعديل سجل حضور', icon: '✏️', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(6,182,212,0.15)', text: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
    MARK_SESSION_ABSENT_BULK: { label: 'رصد غياب جماعي لحصة', icon: '❌', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
    GENERATE_STUDENT_CARDS: { label: 'توليد دفعة كروت ذكية', icon: '🪪', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(99,102,241,0.15)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    ASSIGN_STUDENT_CARD: { label: 'ربط كارت ذكي بطالب', icon: '🔗', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(99,102,241,0.15)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    REPLACE_STUDENT_CARD: { label: 'استبدال كارت ذكي تالف/مفقود', icon: '🔄', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    SET_STUDENT_CARD_STATUS: { label: 'تغيير حالة كارت ذكي', icon: '🔒', category: 'ATTENDANCE_CARDS', catLabel: 'الحضور والكروت', bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', border: 'rgba(148,163,184,0.3)' },

    // Teachers & Groups
    CREATE_TEACHER: { label: 'إضافة مدرس جديد', icon: '👨‍🏫', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    UPDATE_TEACHER: { label: 'تعديل بيانات مدرس', icon: '✏️', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    DELETE_TEACHER: { label: 'حذف مدرس', icon: '🗑️', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
    CREATE_GROUP: { label: 'إنشاء مجموعة جديدة', icon: '👥', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    UPDATE_GROUP: { label: 'تعديل بيانات مجموعة', icon: '✏️', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    ARCHIVE_GROUP: { label: 'أرشفة مجموعة', icon: '📁', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', border: 'rgba(148,163,184,0.3)' },
    DELETE_GROUP: { label: 'حذف مجموعة', icon: '🗑️', category: 'TEACHERS_GROUPS', catLabel: 'المدرسين والمجموعات', bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },

    // Sessions & Schedules
    CREATE_SESSION: { label: 'إنشاء حصة جديدة', icon: '📅', category: 'SESSIONS', catLabel: 'الحصص والجداول', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    UPDATE_SESSION: { label: 'تعديل بيانات حصة', icon: '✏️', category: 'SESSIONS', catLabel: 'الحصص والجداول', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    SET_SESSION_STATUS: { label: 'تغيير حالة الحصة', icon: '🔔', category: 'SESSIONS', catLabel: 'الحصص والجداول', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    CREATE_SCHEDULE: { label: 'إنشاء جدول حصص دوري', icon: '🗓️', category: 'SESSIONS', catLabel: 'الحصص والجداول', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    UPDATE_SCHEDULE: { label: 'تعديل جدول حصص', icon: '✏️', category: 'SESSIONS', catLabel: 'الحصص والجداول', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    DELETE_SCHEDULE: { label: 'حذف جدول حصص', icon: '🗑️', category: 'SESSIONS', catLabel: 'الحصص والجداول', bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },

    // System & Settings
    UPDATE_CENTER_INFO: { label: 'تعديل بيانات السنتر الرسمية', icon: '🏢', category: 'SYSTEM', catLabel: 'النظام والإعدادات', bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', border: 'rgba(148,163,184,0.3)' },
    UPDATE_WHATSAPP_CONFIG: { label: 'تحديث إعدادات ربط الواتس', icon: '💬', category: 'SYSTEM', catLabel: 'النظام والإعدادات', bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' }
  };

  return map[act] || {
    label: act.replace(/_/g, ' '),
    icon: '⚡',
    category: 'SYSTEM',
    catLabel: 'عمليات عامة',
    bg: 'rgba(51,65,85,0.4)',
    text: '#94a3b8',
    border: '#475569'
  };
}

function formatAuditDetailsSummary(action = '', details = {}, targetType = '', targetId = '') {
  if (!details || (typeof details !== 'object' && !details.toString)) return '—';
  const d = typeof details === 'object' ? details : {};
  const act = String(action).toUpperCase();

  if (act === 'RECORD_PAYMENT') {
    const student = d.studentName ? `الطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(d.studentName)}</strong>` : '';
    const amt = d.amount !== undefined ? `<span style="color:#4ade80; font-weight:bold;">${fmtMoney(d.amount)}</span>` : '';
    const rec = d.receiptNumber || d.humanNumber ? `<span class="code-box" style="color:#38bdf8; font-size:0.75rem;">إيصال: ${escapeHtmlAttr(d.receiptNumber || d.humanNumber)}</span>` : '';
    const disc = d.discount && Number(d.discount) > 0 ? `<span class="badge" style="background:rgba(245,158,11,0.15); color:#fbbf24; font-size:0.7rem;">خصم -${fmtMoney(d.discount)}</span>` : '';
    return [student, amt, rec, disc].filter(Boolean).join(' • ');
  }

  if (act === 'REDEEM_AI_VOUCHER') {
    return `تفعيل كود VIP: <span class="code-box" style="color:#c084fc;">${escapeHtmlAttr(d.code || targetId)}</span> للطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(d.studentName || '—')}</strong> (+${d.addedQuota || 0} سؤال ذكي)`;
  }

  if (act === 'GENERATE_AI_VOUCHERS') {
    return `توليد دفعة بعدد: <strong style="color:#c084fc;">${d.count || 0} كود</strong> بقيمة <strong style="color:#4ade80;">${fmtMoney(d.price || 0)}</strong> للكود`;
  }

  if (act === 'CREATE_STUDENT') {
    return `الطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(d.name || d.studentName || targetId)}</strong> ${d.phone ? `(هاتف: <span dir="ltr">${escapeHtmlAttr(d.phone)}</span>)` : ''}`;
  }

  if (act === 'UPDATE_STUDENT') {
    return `تعديل ملف الطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(d.name || targetId)}</strong>`;
  }

  if (act === 'DELETE_STUDENT' || act === 'ARCHIVE_STUDENT') {
    return `الطالب المستهدف: <strong style="color:#f87171;">${escapeHtmlAttr(d.name || targetId)}</strong>`;
  }

  if (act === 'ENROLL_STUDENT_IN_GROUP') {
    return `قيد الطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(d.studentName || targetId)}</strong> في مجموعة <span style="color:#a855f7; font-weight:bold;">${escapeHtmlAttr(d.groupName || d.groupId || '')}</span>`;
  }

  if (act === 'REMOVE_STUDENT_FROM_GROUP') {
    return `إلغاء قيد من مجموعة <span style="color:#f59e0b; font-weight:bold;">${escapeHtmlAttr(d.groupName || d.groupId || '')}</span>`;
  }

  if (act === 'RECORD_ATTENDANCE' || act === 'CORRECT_ATTENDANCE') {
    const stName = d.studentName || targetId;
    const stStatus = d.status === 'PRESENT' ? 'حاضر' : (d.status === 'LATE' ? 'متأخر' : (d.status === 'ABSENT' ? 'غائب' : d.status || 'حاضر'));
    return `الطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(stName)}</strong> • الحالة: <span class="badge" style="background:#0284c7; color:#fff;">${stStatus}</span> ${d.sessionTitle ? `(حصة: ${escapeHtmlAttr(d.sessionTitle)})` : ''}`;
  }

  if (act === 'ASSIGN_STUDENT_CARD') {
    return `ربط الكارت: <span class="code-box" style="color:#38bdf8;">${escapeHtmlAttr(d.cardCode || targetId)}</span> بالطالب: <strong style="color:#f8fafc;">${escapeHtmlAttr(d.studentName || d.studentId)}</strong>`;
  }

  if (act === 'GENERATE_STUDENT_CARDS') {
    return `توليد عدد: <strong style="color:#38bdf8;">${d.count || 0} كارت ذكي</strong> للسنتر`;
  }

  if (act === 'CREATE_GROUP' || act === 'UPDATE_GROUP') {
    return `المجموعة: <strong style="color:#c084fc;">${escapeHtmlAttr(d.name || targetId)}</strong> ${d.maxCapacity ? `(السعة: ${d.maxCapacity} طالب)` : ''}`;
  }

  if (act === 'CREATE_TEACHER' || act === 'UPDATE_TEACHER') {
    return `المدرس: <strong style="color:#c084fc;">${escapeHtmlAttr(d.name || targetId)}</strong> ${d.teacherCode ? `[كود: ${escapeHtmlAttr(d.teacherCode)}]` : ''}`;
  }

  if (act === 'CREATE_SESSION' || act === 'UPDATE_SESSION') {
    return `حصة: <strong style="color:#fbbf24;">${escapeHtmlAttr(d.title || targetId)}</strong> ${d.date ? `بتاريخ: ${escapeHtmlAttr(d.date)}` : ''}`;
  }

  const keys = Object.keys(d).filter(k => k !== 'byEmployeeId' && k !== 'byName' && k !== 'password' && k !== 'token' && k !== 'secret');
  if (keys.length === 0) return `<span style="color:#64748b;">معرّف الكيان: ${escapeHtmlAttr(targetId || '—')}</span>`;

  return keys.slice(0, 3).map(k => {
    let val = d[k];
    if (typeof val === 'object') val = JSON.stringify(val).slice(0, 30);
    return `<span style="background:#1e293b; padding:0.15rem 0.45rem; border-radius:4px; font-size:0.75rem; border:1px solid #334155; margin-left:0.25rem;"><strong style="color:#94a3b8;">${escapeHtmlAttr(k)}:</strong> <span style="color:#cbd5e1;">${escapeHtmlAttr(String(val))}</span></span>`;
  }).join(' ');
}

async function renderAuditView(container) {
  let logs = [];
  try {
    logs = await callBackend('getAuditLogs', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  } catch (err) {
    logs = [];
  }

  window._auditLogsData = logs;

  // Compute KPI breakdown
  const finCount = logs.filter(l => ['RECORD_PAYMENT', 'REDEEM_AI_VOUCHER', 'GENERATE_AI_VOUCHERS', 'UPDATE_INVOICE_CONFIG', 'CHARGE_CREATE'].includes(l.action)).length;
  const stuCount = logs.filter(l => ['CREATE_STUDENT', 'UPDATE_STUDENT', 'ARCHIVE_STUDENT', 'DELETE_STUDENT', 'ENROLL_STUDENT_IN_GROUP', 'REMOVE_STUDENT_FROM_GROUP'].includes(l.action)).length;
  const attCount = logs.filter(l => ['RECORD_ATTENDANCE', 'CORRECT_ATTENDANCE', 'MARK_SESSION_ABSENT_BULK', 'GENERATE_STUDENT_CARDS', 'ASSIGN_STUDENT_CARD', 'REPLACE_STUDENT_CARD', 'SET_STUDENT_CARD_STATUS'].includes(l.action)).length;
  const sysCount = logs.length - (finCount + stuCount + attCount);

  container.innerHTML = `
    <div class="view-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:1.35rem; font-weight:bold; color:#f8fafc;">📜 سجل الرقابة وتدقيق العمليات الحركية (Audit Log)</span>
          <span class="badge" style="background:#0284c7; color:#fff; font-size:0.85rem;">${logs.length} عملية موثقة</span>
        </div>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          سجل رقمي مشفر غير قابل للتعديل يوثق جميع العمليات الإدارية، التحصيلات المالية، وحركات الحضور لضمان النزاهة والشفافية.
        </div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn" style="background:#334155; color:#f8fafc; display:flex; align-items:center; gap:0.35rem;" onclick="renderActiveView('audit')" title="تحديث السجل الآن">
          <span>🔄 تحديث السجل</span>
        </button>
        <button class="btn btn-primary" style="display:flex; align-items:center; gap:0.35rem;" onclick="exportAuditLogsCsv()" title="تصدير السجل كملف Excel / CSV">
          <span>📥 تصدير CSV</span>
        </button>
        <button class="btn btn-success" style="display:flex; align-items:center; gap:0.35rem;" onclick="window.print()" title="طباعة السجل">
          <span>🖨️ طباعة</span>
        </button>
      </div>
    </div>

    <!-- 4 KPI Statistical Cards -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
      <div class="card" style="padding:1rem; border-right:4px solid #38bdf8; display:flex; align-items:center; gap:0.85rem; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
        <div style="font-size:2.2rem; background:rgba(56,189,248,0.1); padding:0.5rem 0.75rem; border-radius:8px;">📊</div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">إجمالي العمليات الموثقة</div>
          <div style="font-size:1.45rem; font-weight:800; color:#f8fafc;">${logs.length}</div>
        </div>
      </div>
      <div class="card" style="padding:1rem; border-right:4px solid #22c55e; display:flex; align-items:center; gap:0.85rem; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
        <div style="font-size:2.2rem; background:rgba(34,197,94,0.1); padding:0.5rem 0.75rem; border-radius:8px;">💳</div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">العمليات المالية والتحصيل</div>
          <div style="font-size:1.45rem; font-weight:800; color:#4ade80;">${finCount}</div>
        </div>
      </div>
      <div class="card" style="padding:1rem; border-right:4px solid #a855f7; display:flex; align-items:center; gap:0.85rem; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
        <div style="font-size:2.2rem; background:rgba(168,85,247,0.1); padding:0.5rem 0.75rem; border-radius:8px;">🎓</div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">حركات الطلاب وشؤون القيد</div>
          <div style="font-size:1.45rem; font-weight:800; color:#c084fc;">${stuCount}</div>
        </div>
      </div>
      <div class="card" style="padding:1rem; border-right:4px solid #06b6d4; display:flex; align-items:center; gap:0.85rem; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
        <div style="font-size:2.2rem; background:rgba(6,182,212,0.1); padding:0.5rem 0.75rem; border-radius:8px;">⏱️</div>
        <div>
          <div style="font-size:0.8rem; color:#94a3b8;">حركات الحضور والكروت</div>
          <div style="font-size:1.45rem; font-weight:800; color:#22d3ee;">${attCount}</div>
        </div>
      </div>
    </div>

    <!-- Advanced Filter & Search Bar -->
    <div class="card" style="padding:1rem; margin-bottom:1.25rem; background:#1e293b; border:1px solid #334155; box-shadow:0 4px 15px rgba(0,0,0,0.25);">
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
        <div style="flex:2; min-width:240px; position:relative;">
          <input type="text" id="auditSearchInput" oninput="filterAuditLogsTable()" placeholder="ابحث باسم العملية، اسم الطالب، رقم الإيصال، أو اسم الموظف..."
            style="width:100%; padding:0.65rem 0.85rem; background:#0f172a; border:1px solid #475569; border-radius:6px; color:#fff; font-size:0.88rem;">
        </div>
        <div style="flex:1; min-width:180px;">
          <select id="auditCategoryFilter" onchange="filterAuditLogsTable()"
            style="width:100%; padding:0.65rem; background:#0f172a; border:1px solid #475569; border-radius:6px; color:#fff; font-size:0.88rem;">
            <option value="">جميع التصنيفات</option>
            <option value="FINANCE">💳 الماليات والتحصيل</option>
            <option value="STUDENTS">🎓 الطلاب وشؤون القيد</option>
            <option value="ATTENDANCE_CARDS">⏱️ الحضور والكروت الذكية</option>
            <option value="TEACHERS_GROUPS">👥 المدرسين والمجموعات</option>
            <option value="SESSIONS">📅 الحصص والجداول</option>
            <option value="SYSTEM">⚙️ النظام والإعدادات</option>
          </select>
        </div>
        <div style="flex:1; min-width:160px;">
          <select id="auditDateFilter" onchange="filterAuditLogsTable()"
            style="width:100%; padding:0.65rem; background:#0f172a; border:1px solid #475569; border-radius:6px; color:#fff; font-size:0.88rem;">
            <option value="ALL">جميع الأوقات</option>
            <option value="TODAY">سجلات اليوم فقط</option>
            <option value="WEEK">آخر 7 أيام</option>
            <option value="MONTH">هذا الشهر</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Main Audit Table Container -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3); padding:0; overflow:hidden;">
      <div id="auditLogsTableContainer">
        ${renderAuditLogsTableHtml(logs)}
      </div>
    </div>
  `;
}

function renderAuditLogsTableHtml(logs = []) {
  if (!logs || logs.length === 0) {
    return `
      <div style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
        <div style="font-size:3.5rem; margin-bottom:0.75rem; opacity:0.8;">📜</div>
        <h3 style="color:#f8fafc; margin:0 0 0.5rem 0;">لا توجد عمليات مطابقة في سجل الرقابة</h3>
        <p style="color:#94a3b8; font-size:0.9rem;">جرب تغيير كلمات البحث أو إلغاء الفلاتر المحددة.</p>
      </div>
    `;
  }

  return `
    <div style="overflow-x:auto;">
      <table class="data-table" id="auditTable">
        <thead>
          <tr style="background:#0f172a; border-bottom:1px solid #334155;">
            <th style="padding:0.85rem 1rem;">نوع العملية</th>
            <th>التصنيف</th>
            <th>الفاعل (المستخدم / الموظف)</th>
            <th style="min-width:280px;">بيان وملخص العملية المعتمد</th>
            <th>التاريخ والوقت</th>
            <th style="text-align:center;">إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map((l, idx) => {
            const meta = getAuditActionMetadata(l.action);
            const summaryHtml = formatAuditDetailsSummary(l.action, l.details, l.targetType, l.targetId);
            const actorName = l.actorNameSnapshot || l.byName || l.actorUid || 'مدير السنتر';
            const actorRole = l.actorRole === 'owner' ? 'مالك السنتر' : (l.actorRole === 'superadmin' ? 'الإدارة العامة' : (l.actorRole === 'cashier' ? 'الخزينة' : (l.actorRole || 'مشرف')));
            const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const timeStr = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

            return `
              <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                <td>
                  <span class="badge" style="background:${meta.bg}; color:${meta.text}; border:1px solid ${meta.border}; font-size:0.82rem; padding:0.3rem 0.65rem; display:inline-flex; align-items:center; gap:0.35rem;">
                    <span>${meta.icon}</span>
                    <strong>${meta.label}</strong>
                  </span>
                </td>
                <td>
                  <span style="font-size:0.75rem; color:#94a3b8; background:#0f172a; padding:0.2rem 0.5rem; border-radius:4px; border:1px solid #334155;">
                    ${meta.catLabel}
                  </span>
                </td>
                <td>
                  <div style="font-weight:700; color:#f8fafc; font-size:0.88rem;">${escapeHtmlAttr(actorName)}</div>
                  <div style="font-size:0.72rem; color:#64748b;">${escapeHtmlAttr(actorRole)}</div>
                </td>
                <td style="font-size:0.84rem; color:#cbd5e1; line-height:1.5;">
                  ${summaryHtml}
                </td>
                <td>
                  <div style="color:#f8fafc; font-size:0.82rem; font-weight:600;">${dateStr}</div>
                  <div style="color:#64748b; font-size:0.74rem;">${timeStr}</div>
                </td>
                <td style="text-align:center;">
                  <button class="btn" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:0.25rem 0.65rem; font-size:0.78rem;"
                    onclick="openAuditDetailModal(${idx})" title="عرض بطاقة تفاصيل العملية كاملة">
                    👁️ التفاصيل
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterAuditLogsTable() {
  const allLogs = window._auditLogsData || [];
  const query = (document.getElementById('auditSearchInput')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('auditCategoryFilter')?.value || '';
  const dateRange = document.getElementById('auditDateFilter')?.value || 'ALL';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = allLogs.filter(l => {
    // 1. Category filter
    if (cat) {
      const meta = getAuditActionMetadata(l.action);
      if (meta.category !== cat) return false;
    }

    // 2. Date filter
    if (dateRange !== 'ALL' && l.timestamp) {
      const lDate = new Date(l.timestamp);
      if (dateRange === 'TODAY' && l.timestamp.split('T')[0] !== todayStr) return false;
      if (dateRange === 'WEEK' && lDate < weekAgo) return false;
      if (dateRange === 'MONTH' && lDate < startOfMonth) return false;
    }

    // 3. Search query filter
    if (query) {
      const meta = getAuditActionMetadata(l.action);
      const strToSearch = [
        l.action,
        meta.label,
        meta.catLabel,
        l.actorNameSnapshot,
        l.byName,
        l.actorUid,
        l.targetType,
        l.targetId,
        typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details || '')
      ].join(' ').toLowerCase();

      if (!strToSearch.includes(query)) return false;
    }

    return true;
  });

  const container = document.getElementById('auditLogsTableContainer');
  if (container) {
    container.innerHTML = renderAuditLogsTableHtml(filtered);
  }
}

function openAuditDetailModal(index) {
  const logs = window._auditLogsData || [];
  const log = logs[index];
  if (!log) return;

  const meta = getAuditActionMetadata(log.action);
  const container = document.getElementById('modalContainer');
  const d = log.details && typeof log.details === 'object' ? log.details : {};
  const dateFormatted = log.timestamp ? new Date(log.timestamp).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'medium' }) : '—';
  const actorName = log.actorNameSnapshot || log.byName || log.actorUid || 'مدير السنتر';
  const actorRole = log.actorRole === 'owner' ? 'مالك السنتر' : (log.actorRole === 'superadmin' ? 'الإدارة العامة' : (log.actorRole === 'cashier' ? 'الخزينة' : (log.actorRole || 'مشرف')));

  const keys = Object.keys(d);

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:680px; max-height:88vh; overflow-y:auto; background:#0f172a; border:1px solid #38bdf8; box-shadow:0 10px 30px rgba(0,0,0,0.6);">
        <!-- Header -->
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:0.75rem; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:1.5rem;">${meta.icon}</span>
            <div>
              <div style="font-weight:bold; color:#38bdf8; font-size:1.1rem;">${meta.label}</div>
              <div style="font-size:0.75rem; color:#94a3b8;">${meta.catLabel} • كود العملية: <span class="code-box" style="font-size:0.72rem;">${escapeHtmlAttr(log.action)}</span></div>
            </div>
          </div>
          <button class="btn" style="background:#475569; padding:0.25rem 0.65rem;" onclick="closeModal()">✖️</button>
        </div>

        <!-- Metadata Cards Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.25rem;">
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border:1px solid #334155;">
            <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:0.2rem;">👤 منفذ العملية (الفاعل):</div>
            <div style="font-weight:bold; color:#f8fafc; font-size:0.95rem;">${escapeHtmlAttr(actorName)}</div>
            <div style="font-size:0.75rem; color:#38bdf8;">الرتبة / الدور: ${escapeHtmlAttr(actorRole)}</div>
          </div>
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border:1px solid #334155;">
            <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:0.2rem;">⏱️ تاريخ ووقت التنفيذ:</div>
            <div style="font-weight:bold; color:#4ade80; font-size:0.9rem;">${dateFormatted}</div>
            <div style="font-size:0.75rem; color:#64748b;">معرّف السجل: ${escapeHtmlAttr(log.logId || log.id || '—')}</div>
          </div>
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border:1px solid #334155; grid-column:span 2;">
            <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:0.2rem;">🎯 الكيان أو المستهدف بالعملية:</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="badge" style="background:#0f172a; color:#cbd5e1; border:1px solid #475569;">نوع الكيان: ${escapeHtmlAttr(log.targetType || 'SYSTEM')}</span>
              <span style="font-size:0.8rem; color:#94a3b8;">المعرّف: <span class="code-box" style="color:#38bdf8;">${escapeHtmlAttr(log.targetId || 'none')}</span></span>
            </div>
          </div>
        </div>

        <!-- Detailed Attributes Table -->
        <div style="margin-bottom:1.25rem;">
          <div style="font-weight:bold; color:#cbd5e1; font-size:0.92rem; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
            <span>📋 بيانات ومتغيرات العملية المسجلة:</span>
            <span style="font-size:0.78rem; color:#64748b;">${keys.length} حقل مسجل</span>
          </div>
          ${keys.length > 0 ? `
            <div style="overflow-x:auto; border:1px solid #334155; border-radius:8px;">
              <table class="data-table" style="margin:0;">
                <thead>
                  <tr style="background:#1e293b;">
                    <th style="width:35%;">الحقل / البيان</th>
                    <th>القيمة المسجلة</th>
                  </tr>
                </thead>
                <tbody>
                  ${keys.map(k => {
                    let v = d[k];
                    const isObj = typeof v === 'object' && v !== null;
                    return `
                      <tr>
                        <td><strong style="color:#94a3b8;">${escapeHtmlAttr(k)}</strong></td>
                        <td>
                          ${isObj ? `
                            <pre style="margin:0; background:#0f172a; padding:0.4rem; border-radius:4px; font-size:0.75rem; color:#38bdf8; max-height:120px; overflow-y:auto;" dir="ltr">${escapeHtmlAttr(JSON.stringify(v, null, 2))}</pre>
                          ` : `
                            <span style="color:#f8fafc; font-weight:600;">${escapeHtmlAttr(String(v))}</span>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align:center; padding:1.5rem; background:#1e293b; border-radius:8px; color:#94a3b8; font-size:0.85rem;">
              لا توجد متغيرات فرعية إضافية مسجلة لهذه العملية
            </div>
          `}
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #334155; padding-top:0.75rem;">
          <button class="btn" style="background:#334155; color:#fff;" onclick="navigator.clipboard.writeText(JSON.stringify(${escapeHtmlAttr(JSON.stringify(log))}, null, 2)); showToast('تم نسخ بيانات العملية للحافظة ✅');">
            📋 نسخ بيانات السجل
          </button>
          <button class="btn btn-primary" onclick="closeModal()">إغلاق النافذة</button>
        </div>
      </div>
    </div>
  `;
}

function exportAuditLogsCsv() {
  const logs = window._auditLogsData || [];
  if (logs.length === 0) return showToast('لا توجد سجلات لتصديرها', true);

  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
  csvContent += 'نوع العملية,التصنيف,الفاعل,الدور,الكيان المستهدف,معرف الكيان,التفاصيل والبيان,التاريخ والوقت\n';

  logs.forEach(l => {
    const meta = getAuditActionMetadata(l.action);
    const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('ar-EG') : '';
    const detailsStr = JSON.stringify(l.details || {}).replace(/"/g, '""');
    const actor = (l.actorNameSnapshot || l.byName || l.actorUid || 'مدير السنتر').replace(/"/g, '""');
    const role = (l.actorRole || 'role').replace(/"/g, '""');
    const target = (l.targetType || 'ENTITY').replace(/"/g, '""');
    const targetId = (l.targetId || '').replace(/"/g, '""');

    csvContent += `"${meta.label}","${meta.catLabel}","${actor}","${role}","${target}","${targetId}","${detailsStr}","${dateStr}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `سجل_الرقابة_والعمليات_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('✅ تم تصدير سجل الرقابة كملف CSV بنجاح!');
}

// 12. Center Info View
async function renderCenterInfoView(container) {
  const info = await callBackend('getCenterInfo', currentCallerToken, currentCallerToken.institutionId).catch(() => null);
  container.innerHTML = `
    <div class="view-title">
      <span>⚙️ معلومات وبيانات السنتر الرسمية</span>
    </div>
    <div class="card" style="max-width:680px; box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div class="card-title">بيانات المركز التعليمي وترويسة الإيصالات المطبوعة</div>
      <form onsubmit="event.preventDefault(); saveCenterInfoAction();">
        <div class="form-group">
          <label>اسم السنتر / المؤسسة *</label>
          <input type="text" id="infoName" value="${escapeHtmlAttr(info ? info.name : '')}" required style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>
        <div class="form-group">
          <label>رقم هاتف السنتر الرسمي *</label>
          <input type="text" id="infoPhone" value="${escapeHtmlAttr(info ? info.phone : '')}" required style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>
        <div class="form-group">
          <label>عنوان ومقر السنتر</label>
          <input type="text" id="infoAddress" value="${escapeHtmlAttr(info ? info.address : '')}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>
        <div class="form-group">
          <label>نص ترويسة الإيصالات المالية المطبوعة (Header Text)</label>
          <input type="text" id="infoReceipt" value="${escapeHtmlAttr(info ? info.receiptHeader : '')}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          <small style="color:#94a3b8; display:block; margin-top:0.35rem;">يظهر هذا النص أعلى إيصالات التحصيل المطبوعة للطلاب وأولياء الأمور</small>
        </div>
        <button type="submit" class="btn btn-success" id="btnSaveCenterInfo" style="padding:0.75rem 1.5rem; font-weight:bold; font-size:0.95rem; box-shadow:0 4px 12px rgba(34,197,94,0.3); margin-top:0.5rem;">💾 حفظ بيانات السنتر في Firestore</button>
      </form>
    </div>
  `;
}

// 12.5 WhatsApp Settings & Automation View
async function renderWhatsAppSettingsView(container) {
  const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})) || {};

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>💬 إعدادات وربط نظام الواتس آب وجدولة الإرسال التلقائي</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          التحكم الكامل في ربط السنتر بالواتس وتحديد المميزات التي ترسل تلقائياً للطلاب وأولياء الأمور
        </div>
      </div>
      <button class="btn btn-success" onclick="saveWhatsAppSettingsAction()" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);">
        💾 حفظ إعدادات الواتس
      </button>
    </div>

    <!-- Explanatory Banner: How Center Number is Linked -->
    <div style="background: linear-gradient(135deg, rgba(3,105,161,0.2) 0%, rgba(16,185,129,0.15) 100%); border: 1px solid #0284c7; border-radius: 10px; padding: 1.15rem; margin-bottom: 1.25rem; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
      <div style="display:flex; align-items:flex-start; gap:0.85rem;">
        <span style="font-size:2rem; line-height:1;">💡</span>
        <div style="flex:1;">
          <h4 style="margin:0 0 0.35rem 0; color:#38bdf8; font-size:1.05rem;">كيف يتم ربط رقم هاتف السنتر لإرسال الرسائل والإشعارات؟</h4>
          <div style="color:#cbd5e1; font-size:0.85rem; line-height:1.65;">
            تتيح المنصة طريقتين متكاملتين لربط رقم السنتر بالواتس آب:
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.6rem;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:0.75rem;">
                <strong style="color:#4ade80; display:block; margin-bottom:0.25rem;">1. الربط التلقائي عبر مسح رمز QR (Instance Gateway):</strong>
                <p style="margin:0; font-size:0.8rem; color:#94a3b8;">
                  يتم ربط رقم هاتف السنتر عن طريق فتح تطبيق واتساب في موبايل السنتر ← <strong>الأجهزة المرتبطة (Linked Devices) ← مسح كود الـ QR</strong> التابع للجلسة (مثل Green-API أو UltraMsg). بمجرد الربط، تخرج كافة الرسائل التلقائية (حضور، غياب، نتائج، فواتير) مباشرة من رقم السنتر الرسمي دون تدخل يدوي!
                </p>
              </div>
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:0.75rem;">
                <strong style="color:#38bdf8; display:block; margin-bottom:0.25rem;">2. الإرسال المباشر المجاني (Direct Web / App wa.me):</strong>
                <p style="margin:0; font-size:0.8rem; color:#94a3b8;">
                  <strong>بدون أي اشتراك مالي أو بوابات مدفوعة!</strong> يقوم البرنامج بفتح محادثة واتساب الرسمية برقم ولي الأمر مباشرة بنقرة واحدة عبر تطبيق WhatsApp المثبت على جهاز الكمبيوتر أو WhatsApp Web محملاً بنص الرسالة الجاهزة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">
      <!-- Column 1: Connection & Gateway -->
      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title">1) بوابة وتوصيل الواتس آب (Gateway Connection)</div>
        
        <div class="form-group" style="background:#0f172a; padding:0.9rem; border-radius:8px; border:1px solid #334155; margin-bottom:1rem;">
          <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; color:#f8fafc; font-weight:bold; font-size:1rem;">
            <input type="checkbox" id="waEnabled" ${config.enabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:#22c55e;">
            <span>تفعيل نظام إشعارات الواتس آب للمركز 🟢</span>
          </label>
          <small style="color:#94a3b8; display:block; margin-top:0.35rem; margin-right:1.9rem;">
            عند التعطيل، لن يتم إرسال أي رسائل تلقائية في الخلفية.
          </small>
        </div>

        <div class="form-group">
          <label>رقم هاتف السنتر المعتمد للإرسال والتواصل (WhatsApp Phone) *</label>
          <input type="text" id="waSenderPhone" value="${escapeHtmlAttr(config.senderPhone || '')}" placeholder="مثال: 01012345678" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          <small style="color:#94a3b8; display:block; margin-top:0.25rem;">رقم هاتف السنتر الذي يستقبل استفسارات أولياء الأمور وتخرج منه الإشعارات.</small>
        </div>

        <div class="form-group">
          <label>نوع البوابة ومزود الخدمة (Provider) *</label>
          <select id="waProvider" onchange="toggleWaGatewayFields()" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            <option value="direct_web" ${config.provider === 'direct_web' ? 'selected' : ''}>واتساب مباشر مجاني (Direct Web / App wa.me) — بدون اشتراك API</option>
            <option value="green_api" ${config.provider === 'green_api' ? 'selected' : ''}>Green-API (بوابة سحابية مع ربط رقم السنتر بمسح QR)</option>
            <option value="ultramsg" ${config.provider === 'ultramsg' ? 'selected' : ''}>UltraMsg (بوابة WhatsApp Instance بمسح QR)</option>
            <option value="custom_gateway" ${config.provider === 'custom_gateway' ? 'selected' : ''}>بوابة ويب هوك خاصة (Custom HTTP Gateway)</option>
          </select>
        </div>

        <div id="waApiFields" style="display:${config.provider !== 'direct_web' ? 'block' : 'none'};">
          <div class="form-group">
            <label>عنوان خادم الـ API (API URL / Webhook Endpoint)</label>
            <input type="text" id="waApiUrl" value="${escapeHtmlAttr(config.apiUrl || '')}" placeholder="https://api.green-api.com/waInstance.../sendMessage" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
          <div class="form-group">
            <label>مفتاح التوثيق (API Token / Secret Key)</label>
            <input type="password" id="waApiToken" value="${escapeHtmlAttr(config.apiToken || '')}" placeholder="••••••••" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
          <div class="form-group">
            <label>معرف الجلسة / الرقم (Instance ID)</label>
            <input type="text" id="waInstanceId" value="${escapeHtmlAttr(config.instanceId || '')}" placeholder="110182..." style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
          </div>
          
          <div style="margin-top:0.75rem; text-align:left;">
            <button type="button" class="btn" onclick="checkWhatsAppConnectionStatusAction()" style="background:#0284c7; font-size:0.85rem; padding:0.45rem 0.9rem;">
              🔍 فحص وتأكيد حالة اتصال الرقم بالبوابة
            </button>
          </div>
        </div>

        <!-- Test Dispatch Box -->
        <div style="background:#0f172a; padding:1rem; border-radius:8px; border:1px solid #38bdf8; margin-top:1.5rem;">
          <strong style="color:#38bdf8; font-size:0.9rem; display:block; margin-bottom:0.5rem;">🧪 تجربة واختبار الإرسال الفوري</strong>
          <div style="display:flex; gap:0.5rem;">
            <input type="text" id="waTestPhone" placeholder="رقم الهاتف (مثال: 01012345678)" style="flex:1; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
            <button class="btn btn-primary" onclick="sendTestWhatsAppAction()" style="white-space:nowrap; padding:0.5rem 0.9rem;">إرسال تجريبي 📲</button>
          </div>
        </div>
      </div>

      <!-- Column 2: Scheduled & Automated Feature Toggles -->
      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title">2) المميزات والرسائل التي ترسل تلقائياً (Automated Triggers)</div>
        <p style="color:#94a3b8; font-size:0.82rem; margin-top:0;">حدد الأحداث التي يقوم النظام بإرسال رسائل واتس آب تلقائية بشأنها لأولياء الأمور والطلاب:</p>
        
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #334155;">
            <input type="checkbox" id="waAutoAttendance" ${config.autoSendAttendance ? 'checked' : ''} style="margin-top:0.2rem; width:18px; height:18px; accent-color:#0284c7;">
            <div>
              <strong style="color:#f8fafc; font-size:0.9rem;">حضور الطالب السنتر والحصة</strong>
              <div style="color:#94a3b8; font-size:0.75rem;">إرسال رسالة فورية لولي الأمر عند مسح باركود الطالب بدخول السنتر مع توقيت الحضور واسم المادة.</div>
            </div>
          </label>

          <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #334155;">
            <input type="checkbox" id="waAutoAbsence" ${config.autoSendAbsence ? 'checked' : ''} style="margin-top:0.2rem; width:18px; height:18px; accent-color:#ef4444;">
            <div>
              <strong style="color:#f8fafc; font-size:0.9rem;">تنبيه غياب الطالب عن الحصة</strong>
              <div style="color:#94a3b8; font-size:0.75rem;">إشعار عاجل لولي الأمر في حال تغيب الطالب عن موعد الحصة المقررة.</div>
            </div>
          </label>

          <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #334155;">
            <input type="checkbox" id="waAutoReceipt" ${config.autoSendPaymentReceipt ? 'checked' : ''} style="margin-top:0.2rem; width:18px; height:18px; accent-color:#22c55e;">
            <div>
              <strong style="color:#f8fafc; font-size:0.9rem;">إرسال إيصال تسديد المصروفات</strong>
              <div style="color:#94a3b8; font-size:0.75rem;">إرسال إيصال الدفع وسند القبض وتفاصيل المبلغ المالي فور تسجيل الكاشير للتحصيل.</div>
            </div>
          </label>

          <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #334155;">
            <input type="checkbox" id="waAutoDueReminder" ${config.autoSendPaymentDueReminder ? 'checked' : ''} style="margin-top:0.2rem; width:18px; height:18px; accent-color:#f59e0b;">
            <div>
              <strong style="color:#f8fafc; font-size:0.9rem;">جدولة تنبيه تلقائي بقرب موعد تسديد المصروفات</strong>
              <div style="color:#94a3b8; font-size:0.75rem;">تتبع دوري للطلاب الذين حضروا حصصاً ولم يسددوا، وإرسال تذكير ودود لولي الأمر.</div>
            </div>
          </label>

          <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #334155;">
            <input type="checkbox" id="waAutoExamResult" ${config.autoSendExamResult ? 'checked' : ''} style="margin-top:0.2rem; width:18px; height:18px; accent-color:#8b5cf6;">
            <div>
              <strong style="color:#f8fafc; font-size:0.9rem;">إرسال نتائج الاختبارات والتقييمات</strong>
              <div style="color:#94a3b8; font-size:0.75rem;">إرسال درجات الطالب والنسبة المئوية فور رصد أو اعتماد نتيجة الاختبار في سجل الدرجات.</div>
            </div>
          </label>

          <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #334155;">
            <input type="checkbox" id="waAutoParentCredentials" ${config.autoSendParentCredentials ? 'checked' : ''} style="margin-top:0.2rem; width:18px; height:18px; accent-color:#06b6d4;">
            <div>
              <strong style="color:#f8fafc; font-size:0.9rem;">إرسال بيانات دخول وحساب ولي الأمر (PIN)</strong>
              <div style="color:#94a3b8; font-size:0.75rem;">إرسال الرقم السري ورابط التطبيق عند إضافة الطالب أو مزامنة بيانات أولياء الأمور.</div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <!-- Templates Customization Section -->
    <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3); margin-top:1.5rem;">
      <div class="card-title">3) تخصيص قوالب ونصوص الرسائل (Message Templates)</div>
      <p style="color:#94a3b8; font-size:0.82rem; margin-top:0;">
        يمكنك استخدام المتغيرات التالية داخل النصوص: <span class="code-box">{studentName}</span>, <span class="code-box">{parentName}</span>, <span class="code-box">{subjectName}</span>, <span class="code-box">{amount}</span>, <span class="code-box">{dueAmount}</span>, <span class="code-box">{receiptNumber}</span>, <span class="code-box">{examTitle}</span>, <span class="code-box">{score}</span>, <span class="code-box">{pin}</span>, <span class="code-box">{time}</span>, <span class="code-box">{date}</span>, <span class="code-box">{centerName}</span>
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label>📝 نص رسالة الحضور:</label>
          <textarea id="waTemplateAttendance" rows="3" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(config.attendanceTemplate || '')}</textarea>
        </div>

        <div class="form-group">
          <label>📝 نص رسالة الغياب:</label>
          <textarea id="waTemplateAbsence" rows="3" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(config.absenceTemplate || '')}</textarea>
        </div>

        <div class="form-group">
          <label>📝 نص إيصال السداد المالي:</label>
          <textarea id="waTemplateReceipt" rows="3" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(config.receiptTemplate || '')}</textarea>
        </div>

        <div class="form-group">
          <label>📝 نص تذكير قرب تسديد المصروفات:</label>
          <textarea id="waTemplateDueReminder" rows="3" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(config.dueReminderTemplate || '')}</textarea>
        </div>

        <div class="form-group">
          <label>📝 نص نتيجة ودرجات الاختبار:</label>
          <textarea id="waTemplateExam" rows="3" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(config.examResultTemplate || '')}</textarea>
        </div>

        <div class="form-group">
          <label>📝 نص بيانات دخول ولي الأمر PIN:</label>
          <textarea id="waTemplateParentCreds" rows="3" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">${escapeHtmlAttr(config.parentCredentialsTemplate || '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function toggleWaGatewayFields() {
  const provider = document.getElementById('waProvider')?.value;
  const fields = document.getElementById('waApiFields');
  if (fields) {
    fields.style.display = provider !== 'direct_web' ? 'block' : 'none';
  }
}

async function checkWhatsAppConnectionStatusAction() {
  const provider = document.getElementById('waProvider')?.value || 'direct_web';
  const apiUrl = document.getElementById('waApiUrl')?.value?.trim();
  const apiToken = document.getElementById('waApiToken')?.value?.trim();
  const senderPhone = document.getElementById('waSenderPhone')?.value?.trim();

  if (provider === 'direct_web') {
    return showToast(`✅ وضع الواتساب المباشر جاهز ونشط! سيتم الإرسال عبر تطبيق الواتساب برقم السنتر: ${senderPhone || 'المسجل'}`);
  }

  if (!apiUrl || !apiToken) {
    return showToast('يرجى إدخال عنوان الـ API ومفتاح التوثيق للفحص', true);
  }

  showToast('جاري فحص حالة اتصال رقم السنتر بالبوابة...');
  try {
    const res = await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: senderPhone || '01000000000',
      message: 'Connection healthcheck'
    }).catch(err => ({ error: err.message }));

    if (res && res.error && !res.error.includes('fallback')) {
      showToast(`تنبيه: ${res.error}`, true);
    } else {
      showToast(`🟢 بوابة الواتس آب متصلة بنجاح وجاهزة للإرسال من رقم السنتر!`);
    }
  } catch (e) {
    showToast(`حالة الاتصال: ${e.message}`, true);
  }
}

async function saveWhatsAppSettingsAction() {
  const enabled = document.getElementById('waEnabled')?.checked;
  const senderPhone = document.getElementById('waSenderPhone')?.value?.trim() || '';
  const provider = document.getElementById('waProvider')?.value || 'direct_web';
  const apiUrl = document.getElementById('waApiUrl')?.value || '';
  const apiToken = document.getElementById('waApiToken')?.value || '';
  const instanceId = document.getElementById('waInstanceId')?.value || '';

  const autoSendAttendance = document.getElementById('waAutoAttendance')?.checked;
  const autoSendAbsence = document.getElementById('waAutoAbsence')?.checked;
  const autoSendPaymentReceipt = document.getElementById('waAutoReceipt')?.checked;
  const autoSendPaymentDueReminder = document.getElementById('waAutoDueReminder')?.checked;
  const autoSendExamResult = document.getElementById('waAutoExamResult')?.checked;
  const autoSendParentCredentials = document.getElementById('waAutoParentCredentials')?.checked;

  const attendanceTemplate = document.getElementById('waTemplateAttendance')?.value || '';
  const absenceTemplate = document.getElementById('waTemplateAbsence')?.value || '';
  const receiptTemplate = document.getElementById('waTemplateReceipt')?.value || '';
  const dueReminderTemplate = document.getElementById('waTemplateDueReminder')?.value || '';
  const examResultTemplate = document.getElementById('waTemplateExam')?.value || '';
  const parentCredentialsTemplate = document.getElementById('waTemplateParentCreds')?.value || '';

  try {
    await callBackend('updateWhatsAppConfig', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      enabled,
      senderPhone,
      provider,
      apiUrl,
      apiToken,
      instanceId,
      autoSendAttendance,
      autoSendAbsence,
      autoSendPaymentReceipt,
      autoSendPaymentDueReminder,
      autoSendExamResult,
      autoSendParentCredentials,
      attendanceTemplate,
      absenceTemplate,
      receiptTemplate,
      dueReminderTemplate,
      examResultTemplate,
      parentCredentialsTemplate
    });
    showToast('✅ تم حفظ وتحديث إعدادات الواتس آب بنجاح!');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function sendTestWhatsAppAction() {
  const phone = document.getElementById('waTestPhone')?.value?.trim();
  if (!phone) return showToast('يرجى إدخال رقم الهاتف لإرسال التجربة', true);
  try {
    const res = await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone,
      message: 'مرحباً بك! هذه رسالة تجريبية لتأكيد ربط سنتر رماس التعليمي بالواتس آب بنجاح. 🚀'
    });
    if (res.mode === 'api') {
      showToast('✅ تم إرسال الرسالة التجريبية بنجاح عبر البوابة!');
    } else {
      openWhatsAppExternalUrl(res.directUrl || res.waMeUrl);
      showToast('تم فتح نافذة الواتس آب للمحادثة التجريبية');
    }
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// 12.6 Invoice Settings View
async function renderInvoiceSettingsView(container) {
  const [config, centerInfo, branding] = await Promise.all([
    callBackend('getInvoiceConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})),
    callBackend('getCenterInfo', currentCallerToken, currentCallerToken.institutionId).catch(() => null),
    callBackend('getBranding', currentCallerToken, currentCallerToken.institutionId).catch(() => null)
  ]);

  const effectiveCenterName = config?.centerName || centerInfo?.name || branding?.centerName || 'مؤسسة تعليمية';
  const effectiveSubHeader = config?.subHeader || centerInfo?.receiptHeader || 'إيصال تحصيل وسند قبض رسمي معتمد';
  const effectivePhone = config?.phone || centerInfo?.phone || '';
  const effectiveAddress = config?.address || centerInfo?.address || '';
  const effectiveTaxNumber = config?.taxNumber || centerInfo?.taxNumber || centerInfo?.commercialRecord || '';
  const effectiveLogo = config?.logoUrl || branding?.logoUrl || centerInfo?.logoUrl || '';

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>🧾 إعدادات ترويسة الفاتورة وإيصالات السداد المطبوعة</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">
          تخصيص بيانات الترويسة الرسمية، الشعار، الشروط والملاحظات وتنسيق الطباعة (A4 وحراري 80mm)
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn" onclick="syncCenterInfoIntoInvoiceAction()" style="background:#0284c7; box-shadow:0 4px 12px rgba(2,132,199,0.3);">
          🔄 استيراد بيانات السنتر الحالية
        </button>
        <button class="btn btn-success" onclick="saveInvoiceConfigAction()" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);">
          💾 حفظ إعدادات الفاتورة
        </button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">
      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title">بيانات الترويسة الرسمية للفاتورة</div>
        
        <div class="form-group">
          <label>اسم السنتر / المؤسسة في الترويسة *</label>
          <input type="text" id="invCenterName" value="${escapeHtmlAttr(effectiveCenterName)}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>

        <div class="form-group">
          <label>الترخيص / السجل التجاري / الشعار الفرعي</label>
          <input type="text" id="invSubHeader" value="${escapeHtmlAttr(effectiveSubHeader)}" placeholder="سجل تجاري وترخيص تعليمي معتمد" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>

        <div class="form-group">
          <label>رقم هاتف المركز الرسمي</label>
          <input type="text" id="invPhone" value="${escapeHtmlAttr(effectivePhone)}" placeholder="01000000000" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>

        <div class="form-group">
          <label>عنوان ومقر المركز</label>
          <input type="text" id="invAddress" value="${escapeHtmlAttr(effectiveAddress)}" placeholder="القاهرة - مصر" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>

        <div class="form-group">
          <label>الرقم الضريبي / السجل التجاري (إن وجد)</label>
          <input type="text" id="invTaxNumber" value="${escapeHtmlAttr(effectiveTaxNumber)}" placeholder="123-456-789" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
        </div>
      </div>

      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title">خيارات الطباعة والشروط</div>

        <div class="form-group">
          <label>صيغة وتنسيق الطباعة الافتراضي</label>
          <select id="invFormat" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
            <option value="both" ${config?.receiptFormat === 'both' ? 'selected' : ''}>كلا الخيارين (حراري 80mm وورق عادي A4)</option>
            <option value="thermal" ${config?.receiptFormat === 'thermal' ? 'selected' : ''}>طابعة فواتير حرارية (Thermal POS 80mm)</option>
            <option value="a4" ${config?.receiptFormat === 'a4' ? 'selected' : ''}>ورق عادي مقاس (A4 Standard)</option>
          </select>
        </div>

        <div class="form-group">
          <label style="font-weight:600; color:#f8fafc; display:block; margin-bottom:0.4rem;">شعار الفاتورة والإيصالات (من جهاز الكمبيوتر):</label>
          <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
            <button type="button" class="btn" style="background:#0284c7; color:#fff; display:flex; align-items:center; gap:0.4rem;" onclick="document.getElementById('invLogoFileInput').click()">
              🖼️ اختيار صورة الشعار من الكمبيوتر
            </button>
            <input type="file" id="invLogoFileInput" accept="image/*" style="display:none;" onchange="previewInvoiceLogoFile(this)">
            <div id="invLogoPreviewBox" style="${effectiveLogo ? 'display:flex;' : 'display:none;'} align-items:center; gap:0.5rem; background:#0f172a; padding:4px 10px; border-radius:6px; border:1px solid #334155;">
              <img id="invLogoImg" src="${escapeHtmlAttr(effectiveLogo)}" alt="شعار الفاتورة" style="max-height:42px; max-width:130px; object-fit:contain; background:#fff; padding:2px; border-radius:4px;">
              <button type="button" class="btn btn-danger" style="padding:0.2rem 0.45rem; font-size:0.7rem;" onclick="clearInvoiceLogo()">حذف ✕</button>
            </div>
          </div>
          <input type="hidden" id="invLogoUrl" value="${escapeHtmlAttr(effectiveLogo)}">
          <small style="color:#94a3b8; display:block; margin-top:0.35rem;">يُطبع هذا الشعار أعلى إيصالات وفواتير السنتر للطلاب وأولياء الأمور</small>
        </div>

        <div class="form-group">
          <label>شروط وملاحظات أسفل الإيصال (Terms & Footer)</label>
          <textarea id="invTerms" rows="4" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">${escapeHtmlAttr(config?.terms || 'المصروفات لا تسترد بعد الحصة الثانية. يرجى إبراز الإيصال عند أي مراجعة بالسنتر.')}</textarea>
          <small style="color:#94a3b8; display:block; margin-top:0.25rem;">تظهر هذه التعليمات أسفل كل إيصال مطبوع للطلاب وأولياء الأمور</small>
        </div>

        <div class="form-group" style="margin-top:1rem;">
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:#f8fafc;">
            <input type="checkbox" id="invAutoPrint" ${config?.autoPrintOnPayment !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
            <span>فتح نافذة الطباعة التلقائية فور تسجيل أي تحصيل نقدية</span>
          </label>
        </div>

        <div style="margin-top:1.5rem; text-align:left;">
          <button class="btn btn-primary" onclick="openReceiptPreviewModal({ receiptNumber: '000001', studentName: 'أحمد محمود علي', amount: 350, remainingAfter: 0, paymentDate: '2026-10-22', category: 'مصاريف شهرية - لغة عربية + رياضيات' })">
            👁️ معاينة شكل الإيصال المطبوع الآن
          </button>
        </div>
      </div>
    </div>
  `;
}

async function syncCenterInfoIntoInvoiceAction() {
  try {
    const centerInfo = await callBackend('getCenterInfo', currentCallerToken, currentCallerToken.institutionId).catch(() => null);
    const branding = await callBackend('getBranding', currentCallerToken, currentCallerToken.institutionId).catch(() => null);

    if (centerInfo) {
      if (document.getElementById('invCenterName')) document.getElementById('invCenterName').value = centerInfo.name || branding?.centerName || '';
      if (document.getElementById('invSubHeader')) document.getElementById('invSubHeader').value = centerInfo.receiptHeader || branding?.loginSubtitle || '';
      if (document.getElementById('invPhone')) document.getElementById('invPhone').value = centerInfo.phone || '';
      if (document.getElementById('invAddress')) document.getElementById('invAddress').value = centerInfo.address || '';
      if (document.getElementById('invTaxNumber')) document.getElementById('invTaxNumber').value = centerInfo.taxNumber || centerInfo.commercialRecord || '';
      if (document.getElementById('invLogoUrl')) document.getElementById('invLogoUrl').value = branding?.logoUrl || centerInfo.logoUrl || '';
      showToast('✅ تم استيراد بيانات السنتر الرسمية وتعبئة الترويسة بنجاح!');
    } else {
      showToast('لم يتم العثور على بيانات إضافية للسنتر');
    }
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function saveInvoiceConfigAction() {
  const centerName = document.getElementById('invCenterName')?.value?.trim();
  const subHeader = document.getElementById('invSubHeader')?.value?.trim();
  const phone = document.getElementById('invPhone')?.value?.trim();
  const address = document.getElementById('invAddress')?.value?.trim();
  const taxNumber = document.getElementById('invTaxNumber')?.value?.trim();
  const receiptFormat = document.getElementById('invFormat')?.value || 'both';
  const logoUrl = document.getElementById('invLogoUrl')?.value?.trim();
  const terms = document.getElementById('invTerms')?.value?.trim();
  const autoPrintOnPayment = document.getElementById('invAutoPrint')?.checked;

  try {
    await callBackend('updateInvoiceConfig', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      centerName,
      subHeader,
      phone,
      address,
      taxNumber,
      receiptFormat,
      logoUrl,
      terms,
      autoPrintOnPayment
    });
    showToast('✅ تم حفظ ترويسة وإعدادات الفواتير بنجاح!');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

function previewInvoiceLogoFile(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 2 * 1024 * 1024) {
    showToast('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت', true);
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    document.getElementById('invLogoUrl').value = dataUrl;
    const img = document.getElementById('invLogoImg');
    if (img) img.src = dataUrl;
    const box = document.getElementById('invLogoPreviewBox');
    if (box) box.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function clearInvoiceLogo() {
  const hiddenInput = document.getElementById('invLogoUrl');
  if (hiddenInput) hiddenInput.value = '';
  const fileInput = document.getElementById('invLogoFileInput');
  if (fileInput) fileInput.value = '';
  const box = document.getElementById('invLogoPreviewBox');
  if (box) box.style.display = 'none';
  const img = document.getElementById('invLogoImg');
  if (img) img.src = '';
}

// 13. License View
async function renderLicenseView(container) {
  const lic = await callBackend('getLicenseStatus', currentCallerToken, currentCallerToken.institutionId).catch(() => null);
  container.innerHTML = `
    <div class="view-title">
      <span>🔒 ترخيص النظام وتوثيق الجهاز</span>
    </div>
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">حالة الترخيص السحابي</div>
            <div class="stat-value" style="color:#4ade80;">${lic ? lic.status : 'ACTIVE'}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">🔒</div>
        </div>
        <div class="stat-sub"><span>🟢 جهاز موثق ومربوط حصرياً بالسنتر</span></div>
      </div>
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">فترة السماح أوفلاين (Grace)</div>
            <div class="stat-value" style="color:#38bdf8;">${lic ? lic.graceHoursRemaining : 72} ساعة</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">⏱️</div>
        </div>
        <div class="stat-sub"><span>يعمل تلقائياً عند انقطاع الإنترنت</span></div>
      </div>
    </div>
    <div class="card" style="max-width:680px; box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
      <div class="card-title">تفاصيل الترخيص والبصمة العتادية للجهاز</div>
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <div><strong>معرف السنتر (Institution ID):</strong> <span class="code-box" style="color:#38bdf8;">${currentCallerToken.institutionId}</span></div>
        <div><strong>بريد المالك المرخص:</strong> <span class="code-box">${currentCallerToken.email || 'مالك معتمد'}</span></div>
        <div><strong>إصدار التطبيق المكتبي:</strong> <span class="code-box">v1.0.0-release.52.3.0</span></div>
        <div><strong>حالة الحماية العتادية:</strong> <span class="badge" style="background:#064e3b; color:#86efac; border:1px solid #10b981;">HARDWARE BOUND 🔒</span></div>
      </div>
    </div>
  `;
}

// 13.1 System Updates & Releases View
let latestCachedUpdateInfo = null;

async function renderSystemUpdatesView(container) {
  let currentVer = '1.0.0-release.52.5.0';
  if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
    try {
      const v = await window.electronAPI.getAppVersion();
      if (v) currentVer = v;
    } catch (_) {}
  }
  
  container.innerHTML = `
    <div class="view-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <div style="display:flex; align-items:center; gap:0.6rem;">
        <span style="font-size:1.8rem;">📦</span>
        <div>
          <h2 style="margin:0; font-size:1.4rem; color:#f8fafc;">تحديثات وإصدارات نظام السنتر</h2>
          <span style="font-size:0.85rem; color:#94a3b8;">إدارة وتنزيل التحديثات التلقائية المباشرة عبر سيرفر التحديث السحابي GitHub Releases</span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="performSystemUpdatesViewCheck()" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.2rem; font-weight:bold;">
        <span>🔄</span> <span>فحص التحديثات الآن من السيرفر</span>
      </button>
    </div>

    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">الإصدار المثبت حالياً</div>
            <div class="stat-value" style="color:#38bdf8; font-size:1.4rem;">v${currentVer}</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">💻</div>
        </div>
        <div class="stat-sub"><span>النسخة المشغلة حالياً على هذا الكمبيوتر</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #22c55e;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">قناة التحديثات السحابية</div>
            <div class="stat-value" style="color:#4ade80; font-size:1.3rem;">نشطة ومباشرة 🟢</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);">☁️</div>
        </div>
        <div class="stat-sub"><span>GitHub Releases (ahpalll/remas)</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #f59e0b;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">حالة التحديثات التلقائية</div>
            <div class="stat-value" id="systemUpdatesCardStatus" style="color:#f59e0b; font-size:1.2rem;">جاهز للفحص</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);">🚀</div>
        </div>
        <div class="stat-sub"><span id="systemUpdatesCardSub">يتم الفحص تلقائياً عند فتح البرنامج</span></div>
      </div>
    </div>

    <!-- Live Status / Result Container -->
    <div id="updatesMainResultBox" class="card" style="box-shadow:0 8px 24px rgba(0,0,0,0.3); border:1px solid #334155; margin-bottom:1.5rem; background:#0f172a;">
      <div style="text-align:center; padding:2rem 1rem;">
        <div style="font-size:3rem; margin-bottom:0.75rem;">🔍</div>
        <h3 style="color:#f8fafc; margin-bottom:0.5rem;">جاهز للتحقق من وجود أي إصدارات جديدة</h3>
        <p style="color:#94a3b8; font-size:0.9rem; max-width:500px; margin:0 auto 1.5rem auto;">
          يقوم النظام بالاتصال بسيرفر GitHub مباشرة للاستعلام عن أحدث نسخة معتمدة لبرنامج السنتر وتحميلها وتثبيتها بنقرة واحدة.
        </p>
        <button class="btn btn-primary" onclick="performSystemUpdatesViewCheck()" style="padding:0.75rem 2rem; font-size:1rem; font-weight:bold;">
          🔄 ابدأ فحص التحديثات الآن
        </button>
      </div>
    </div>

    <!-- Changelog & Release History -->
    <div class="card" style="background:#1e293b; border:1px solid #334155; margin-bottom:1.5rem;">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:1.3rem;">📋</span> <span style="color:#f8fafc; font-size:1.1rem; font-weight:bold;">سجل الإصلاحات والتحسينات المعتمدة في هذا الإصدار (v${currentVer})</span>
        </div>
        <span class="badge" style="background:#0284c7; color:#fff; font-size:0.8rem; padding:0.25rem 0.75rem; border-radius:20px;">أحدث إصدار نشط ومطبق 🟢</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem; margin-top:1rem;">
        <div style="background:#0f172a; padding:1.1rem; border-radius:8px; border-right:4px solid #38bdf8;">
          <strong style="color:#38bdf8; display:block; margin-bottom:0.35rem; font-size:0.95rem;">🌐 حماية تجميد النت ورسائل الدخول الصريحة</strong>
          <span style="color:#cbd5e1; font-size:0.85rem; line-height:1.6; display:block;">
            تم التخلص نهائياً من تجميد الشاشة عند انقطاع الاتصال، وإظهار رسائل عربية صريحة للسبب الحقيقي (انقطاع الإنترنت) بدلاً من رسالة خطأ بيانات الدخول المضللة.
          </span>
        </div>
        <div style="background:#0f172a; padding:1.1rem; border-radius:8px; border-right:4px solid #22c55e;">
          <strong style="color:#4ade80; display:block; margin-bottom:0.35rem; font-size:0.95rem;">⚡ دمج محرك الذكاء الاصطناعي السريع (Groq)</strong>
          <span style="color:#cbd5e1; font-size:0.85rem; line-height:1.6; display:block;">
            تفعيل نموذج Llama 3.3 70B المجاني الفائق السرعة كأساسي لبنك الأسئلة والامتحانات، ليعمل خلال ثانيتين فقط وبدون أي حظر أو حدود يومية خانقة.
          </span>
        </div>
        <div style="background:#0f172a; padding:1.1rem; border-radius:8px; border-right:4px solid #f59e0b;">
          <strong style="color:#fbbf24; display:block; margin-bottom:0.35rem; font-size:0.95rem;">🖨️ تصحيح معاينة وطباعة الإيصالات والواتساب</strong>
          <span style="color:#cbd5e1; font-size:0.85rem; line-height:1.6; display:block;">
            توليد لقطة فائقة الدقة ونظيفة للفاتورة وحدها وإرسالها مباشرة لرقم ولي الأمر أو الطالب على واتساب بدون التقاط خلفيات أو أزرار الشاشة.
          </span>
        </div>
        <div style="background:#0f172a; padding:1.1rem; border-radius:8px; border-right:4px solid #a855f7;">
          <strong style="color:#c084fc; display:block; margin-bottom:0.35rem; font-size:0.95rem;">👁️ تطوير سجل الرقابة والعمليات (Audit Log)</strong>
          <span style="color:#cbd5e1; font-size:0.85rem; line-height:1.6; display:block;">
            إعادة تصميم شاملة لسجل الرقابة ليعرض 4 بطاقات إحصائية ذكية وتفاصيل باللغة العربية مع فلاتر حسب نوع العملية وتصدير ملفات إكسيل.
          </span>
        </div>
        <div style="background:#0f172a; padding:1.1rem; border-radius:8px; border-right:4px solid #06b6d4;">
          <strong style="color:#22d3ee; display:block; margin-bottom:0.35rem; font-size:0.95rem;">🚀 نظام التحديثات الفورية الهوائية (OTA Fleet)</strong>
          <span style="color:#cbd5e1; font-size:0.85rem; line-height:1.6; display:block;">
            ربط برنامج السنتر مع تطبيق السوبر أدمن لاستقبال التحديثات الفورية الخفيفة أونلاين وتطبيقها بلحظة واحدة وبحجم أقل من 1 ميجابايت.
          </span>
        </div>
      </div>
    </div>

    <div class="card" style="background:#1e293b; border:1px solid #334155;">
      <div class="card-title" style="display:flex; align-items:center; gap:0.5rem;">
        <span>ℹ️</span> <span>كيف يعمل نظام التحديث التلقائي في السنتر؟</span>
      </div>
      <div style="color:#cbd5e1; font-size:0.9rem; line-height:1.8;">
        <p style="margin-bottom:0.5rem;">1. <strong>فحص تلقائي صامت:</strong> في كل مرة يتم فيها فتح برنامج السنتر مع وجود اتصال بالإنترنت، يفحص البرنامج تلقائياً في الخلفية وجود أي إصدار جديد.</p>
        <p style="margin-bottom:0.5rem;">2. <strong>إشعار فوري:</strong> عند توفر إصدار أحدث، يظهر زر تنبيه علوي في أعلى الشاشة <code>🚀 يتوفر تحديث جديد!</code>، ويضاف تنبيه داخل جرس الإشعارات 🔔، وتظهر نافذة منبثقة تفصيلية.</p>
        <p style="margin-bottom:0.5rem;">3. <strong>تثبيت آمن بنقرة واحدة:</strong> يتم تنزيل التحديث في الخلفية واستبدال البرنامج بأحدث نسخة بدون التأثير على بيانات الطلاب أو التراخيص أو السجلات المحلية.</p>
      </div>
    </div>
  `;

  setTimeout(() => {
    performSystemUpdatesViewCheck();
  }, 200);
}

async function performSystemUpdatesViewCheck() {
  const resultBox = document.getElementById('updatesMainResultBox');
  const cardStatus = document.getElementById('systemUpdatesCardStatus');
  const cardSub = document.getElementById('systemUpdatesCardSub');
  if (!resultBox) return;

  if (!navigator.onLine) {
    if (cardStatus) cardStatus.innerHTML = '<span style="color:#ef4444;">غير متصل</span>';
    if (cardSub) cardSub.innerText = 'يرجى الاتصال بالإنترنت أولاً';
    resultBox.innerHTML = `
      <div style="text-align:center; padding:2rem 1rem;">
        <div style="font-size:3rem; margin-bottom:0.75rem;">📡</div>
        <h3 style="color:#ef4444; margin-bottom:0.5rem;">جهاز الكمبيوتر غير متصل بالإنترنت</h3>
        <p style="color:#94a3b8; font-size:0.9rem;">تعذر فحص التحديثات بسبب انقطاع اتصال الإنترنت. يرجى إعادة الاتصال ثم المحاولة مجدداً.</p>
      </div>
    `;
    return;
  }

  if (cardStatus) cardStatus.innerHTML = '<span style="color:#38bdf8;">جاري الفحص...</span>';
  resultBox.innerHTML = `
    <div style="text-align:center; padding:2.5rem 1rem;">
      <div class="spinner" style="margin:0 auto 1rem auto; width:45px; height:45px; border-width:4px;"></div>
      <h3 style="color:#38bdf8; margin-bottom:0.3rem;">جاري الاتصال بالسيرفر السحابي وفحص التحديثات...</h3>
      <p style="color:#94a3b8; font-size:0.85rem;">يتم الاستعلام المباشر من GitHub Releases</p>
    </div>
  `;

  try {
    // 1. Check for Lightweight Hotpatch First (< 1 MB)
    if (window.electronAPI && typeof window.electronAPI.checkForHotpatch === 'function') {
      try {
        const hp = await window.electronAPI.checkForHotpatch();
        if (hp && hp.success && hp.available) {
          if (cardStatus) cardStatus.innerHTML = '<span style="color:#38bdf8;">تحديث فوري جاهز ⚡</span>';
          if (cardSub) cardSub.innerText = `الإصدار ${hp.patchVersion} (حجم خفيف)`;

          const totalBytes = Array.isArray(hp.files) ? hp.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0;
          const sizeKb = totalBytes ? `${(totalBytes / 1024).toFixed(0)} KB` : '< 1 MB';

          resultBox.innerHTML = `
            <div style="padding:1.5rem; text-align:right;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1px solid #334155; padding-bottom:1rem; margin-bottom:1rem;">
                <div>
                  <span class="badge" style="background:#0284c7; color:#fff; font-size:0.85rem; padding:0.3rem 0.8rem; margin-left:0.5rem;">تحديث فوري مباشر (OTA) ⚡</span>
                  <h2 style="display:inline-block; margin:0; font-size:1.4rem; color:#38bdf8;">${escapeHtmlAttr(hp.patchVersion)}</h2>
                  <span style="color:#94a3b8; font-size:0.9rem; margin-right:0.5rem;">(${sizeKb})</span>
                </div>
                <button class="btn btn-primary" id="btnPageHotpatchInstall" onclick="applyHotpatchAction('${encodeURIComponent(JSON.stringify(hp))}')" style="padding:0.7rem 1.8rem; font-size:1rem; font-weight:bold; display:flex; align-items:center; gap:0.5rem; background:#0284c7;">
                  <span>⚡</span> <span>تطبيق التحديث الفوري الآن (ثانية واحدة)</span>
                </button>
              </div>

              <div style="background:#1e293b; padding:1.2rem; border-radius:8px; border-right:4px solid #38bdf8; margin-bottom:1.5rem;">
                <strong style="color:#f8fafc; font-size:1rem; display:block; margin-bottom:0.5rem;">بيان التعديلات الفورية:</strong>
                <p style="color:#cbd5e1; font-size:0.95rem; line-height:1.7; margin:0;">
                  ${escapeHtmlAttr(hp.description || 'تحديث فوري وخفيف لكود البرنامج لا يتطلب تحميل ملف الـ 93 ميجا ويتم تفعيله لحظياً.')}
                </p>
              </div>
            </div>
          `;
          return;
        }
      } catch (_) {}
    }

    const res = await window.electronAPI.checkForUpdates();
    if (res && res.success && res.available && res.downloadUrl) {
      latestCachedUpdateInfo = res;
      if (cardStatus) cardStatus.innerHTML = '<span style="color:#38bdf8;">يوجد إصدار جديد! 🚀</span>';
      if (cardSub) cardSub.innerText = `الإصدار v${res.version} جاهز للتثبيت`;
      
      const sizeMb = res.size ? `(${(res.size / 1048576).toFixed(1)} ميجابايت)` : '';
      
      resultBox.innerHTML = `
        <div style="padding:1.5rem; text-align:right;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1px solid #334155; padding-bottom:1rem; margin-bottom:1rem;">
            <div>
              <span class="badge" style="background:#0284c7; color:#fff; font-size:0.85rem; padding:0.3rem 0.8rem; margin-left:0.5rem;">تحديث جديد متوفر</span>
              <h2 style="display:inline-block; margin:0; font-size:1.4rem; color:#38bdf8;">v${escapeHtmlAttr(res.version)}</h2>
              <span style="color:#94a3b8; font-size:0.9rem; margin-right:0.5rem;">${sizeMb}</span>
            </div>
            <button class="btn btn-primary" id="btnPageUpdateInstall" onclick="startUpdateDownloadAction(${JSON.stringify(res).replace(/"/g, '&quot;')})" style="padding:0.7rem 1.8rem; font-size:1rem; font-weight:bold; display:flex; align-items:center; gap:0.5rem;">
              <span>⬇️</span> <span>تحديث وتثبيت النسخة الآن تلقائياً</span>
            </button>
          </div>

          <div style="background:#1e293b; padding:1.2rem; border-radius:8px; border-right:4px solid #38bdf8; margin-bottom:1.5rem;">
            <strong style="color:#f8fafc; font-size:1rem; display:block; margin-bottom:0.5rem;">سجل التحسينات والإصلاحات في هذا الإصدار:</strong>
            <p style="color:#cbd5e1; font-size:0.95rem; line-height:1.7; margin:0; white-space:pre-line;">
              ${escapeHtmlAttr(res.releaseNotes || 'يتضمن هذا التحديث إصلاحات مهمة لحل مشكلة انقطاع الإنترنت، وضبط طباعة وإرسال الإيصالات بدقة، وتطوير سرعة واستقرار النظام.')}
            </p>
          </div>

          <!-- Progress box in page -->
          <div id="updateDownloadProgressBoxInView" style="display:none; background:#1e293b; padding:1.5rem; border-radius:8px; border:1px solid #38bdf8;">
            <div style="display:flex; justify-content:space-between; font-size:0.95rem; color:#38bdf8; font-weight:bold; margin-bottom:0.6rem;">
              <span id="updateProgressStatusInView">جاري تنزيل التحديث من السيرفر...</span>
              <span id="updateProgressPercentInView">0%</span>
            </div>
            <div style="width:100%; height:12px; background:#334155; border-radius:6px; overflow:hidden;">
              <div id="updateProgressBarInView" style="width:0%; height:100%; background:linear-gradient(90deg, #38bdf8, #0284c7); transition:width 0.2s;"></div>
            </div>
          </div>
        </div>
      `;

      updateGlobalNotificationBadges(res);
    } else {
      if (cardStatus) cardStatus.innerHTML = '<span style="color:#22c55e;">محدّث بالكامل ✅</span>';
      if (cardSub) cardSub.innerText = 'أنت تستخدم أحدث إصدار معتمد';
      resultBox.innerHTML = `
        <div style="text-align:center; padding:2rem 1rem;">
          <div style="font-size:3rem; margin-bottom:0.75rem;">✅</div>
          <h3 style="color:#22c55e; margin-bottom:0.5rem;">نظام السنتر محدّث بالكامل</h3>
          <p style="color:#94a3b8; font-size:0.95rem; margin-bottom:1.2rem;">
            أنت تستخدم بالفعل أحدث إصدار معتمد ومستقر من البرنامج (v${escapeHtmlAttr(res?.currentVersion || currentVer || '1.0.0-release.52.5.0')}).
          </p>
          <button class="btn" onclick="performSystemUpdatesViewCheck()" style="background:#334155; padding:0.5rem 1.2rem;">
            🔄 إعادة الفحص
          </button>
        </div>
      `;
    }
  } catch (err) {
    if (cardStatus) cardStatus.innerHTML = '<span style="color:#ef4444;">خطأ في الفحص</span>';
    resultBox.innerHTML = `
      <div style="text-align:center; padding:2rem 1rem;">
        <div style="font-size:3rem; margin-bottom:0.75rem;">⚠️</div>
        <h3 style="color:#ef4444; margin-bottom:0.5rem;">تعذر فحص التحديثات من السيرفر</h3>
        <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1rem;">${escapeHtmlAttr(err.message)}</p>
        <button class="btn btn-primary" onclick="performSystemUpdatesViewCheck()">إعادة المحاولة</button>
      </div>
    `;
  }
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
  let config = {};
  try {
    config = await callBackend('getSuperAdminAiConfig', currentCallerToken) || {};
  } catch (err) {
    config = {};
  }

  const isConfigured = config.isConfigured;
  const pool = Array.isArray(config.geminiKeys) ? config.geminiKeys : [];

  container.innerHTML = `
    <div class="view-title">
      <div>
        <span>🤖 إدارة مفاتيح ومزودي الذكاء الاصطناعي (SuperAdmin AI Console)</span>
        <div style="font-size:0.85rem; color:#94a3b8; font-weight:normal; margin-top:0.25rem;">إدخال وإدارة مفاتيح Gemini و Groq المجانية، اختبار الاتصال، والتحكم في تفعيل الميزة للمراكز والطلاب</div>
      </div>
      <button class="btn" onclick="renderActiveView('superadmin_ai')">🔄 تحديث</button>
    </div>

    <!-- Stats Card -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card-modern" style="border-right: 4px solid ${isConfigured ? '#22c55e' : '#ef4444'};">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">حالة المحرك السحابي</div>
            <div class="stat-value" style="color:${isConfigured ? '#4ade80' : '#f87171'}; font-size:1.2rem;">
              ${isConfigured ? '🟢 مفعل وجاهز' : '🔴 غير مهيأ'}
            </div>
          </div>
          <div class="stat-icon-bubble" style="background:${isConfigured ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};">⚡</div>
        </div>
        <div class="stat-sub"><span>${isConfigured ? 'المفتاح مربوط ويعمل' : 'يلزم إدخال مفتاح Gemini'}</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #38bdf8;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">المزود الأساسي</div>
            <div class="stat-value" style="color:#38bdf8; font-size:1.1rem;">Google Gemini Flash</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(56,189,248,0.15);">🤖</div>
        </div>
        <div class="stat-sub"><span>مجاني 100% (1,000,000 توكن سياق)</span></div>
      </div>

      <div class="stat-card-modern" style="border-right: 4px solid #a855f7;">
        <div class="stat-card-header">
          <div>
            <div class="stat-label">مجمع المفاتيح (Multi-Key Pool)</div>
            <div class="stat-value" style="color:#c084fc;">${(config.geminiKey ? 1 : 0) + pool.length} مفاتيح</div>
          </div>
          <div class="stat-icon-bubble" style="background:rgba(168,85,247,0.15);">🔄</div>
        </div>
        <div class="stat-sub"><span>تدوير تلقائي عند بلوغ الحد</span></div>
      </div>
    </div>

    <!-- AI Keys Management Form -->
    <div class="card" style="max-width:750px; box-shadow:0 8px 24px -4px rgba(0,0,0,0.3);">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>🔐 ضبط المفاتيح المجانية للمنصة</span>
        <span class="badge" style="background:#0f172a; color:#38bdf8; border:1px solid #334155;">SUPERADMIN ONLY</span>
      </div>

      <form onsubmit="event.preventDefault(); saveSuperAdminAiConfigAction();">
        <div class="form-group">
          <label>مفتاح Google Gemini الرئيسي (Free API Key) *</label>
          <input type="text" id="saAiGeminiKey" value="${escapeHtmlAttr(config.geminiKey || '')}" placeholder="AIzaSy..." style="font-family:monospace; width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#4ade80;">
          <small style="color:#94a3b8; display:block; margin-top:0.35rem;">احصل عليه مجاناً بدون بطاقة بنكية من <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#38bdf8;">Google AI Studio</a> (15 طلب/دقيقة مجاناً للأبد).</small>
        </div>

        <div class="form-group">
          <label>مفاتيح Gemini إضافية للتدوير التلقائي (اختياري - مفتاح في كل سطر)</label>
          <textarea id="saAiGeminiPool" rows="3" placeholder="AIzaSyKey2...&#10;AIzaSyKey3..." style="font-family:monospace; width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1;">${escapeHtmlAttr(pool.join('\n'))}</textarea>
          <small style="color:#94a3b8; display:block; margin-top:0.35rem;">عند استهلاك الحد المؤقت لأي مفتاح، ينتقل النظام تلقائياً للمفتاح التالي دون توقف.</small>
        </div>

        <div class="form-group">
          <label>مفتاح Groq Cloud الاحتياطي (Free Llama 3.3 70B Key)</label>
          <input type="text" id="saAiGroqKey" value="${escapeHtmlAttr(config.groqKey || '')}" placeholder="gsk_..." style="font-family:monospace; width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1;">
          <small style="color:#94a3b8; display:block; margin-top:0.35rem;">مجاني تماماً من Groq Cloud — يعمل تلقائياً كاحتياطي في حال تعطل Google.</small>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem; padding:0.75rem; background:#0f172a; border-radius:6px; border:1px solid #1e293b;">
          <div>
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:#f8fafc; font-weight:bold;">
              <input type="checkbox" id="saAiEnabled" ${config.enabledForCenters !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#22c55e;">
              تفعيل ميزات الذكاء الاصطناعي لكافة المراكز
            </label>
            <small style="color:#94a3b8; display:block; margin-top:0.25rem;">إتاحة توليد الامتحانات للمراكز ومساعد الطالب الذكي.</small>
          </div>
          <div>
            <label>الحد الأقصى لأسئلة كل طالب يومياً</label>
            <input type="number" id="saAiDailyLimit" value="${config.dailyStudentLimit || 15}" min="5" max="100" style="width:100%; padding:0.4rem; background:#1e293b; border:1px solid #334155; border-radius:4px; color:#fff;">
          </div>
        </div>

        <div id="saAiTestStatusBox" style="margin-top:1rem; display:none;"></div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:1.5rem; padding-top:1rem; border-top:1px solid #1e293b;">
          <button type="button" class="btn" id="btnTestAiKey" style="background:#0284c7; font-weight:bold;" onclick="testSuperAdminAiKeyAction()">⚡ فحص واختبار الاتصال بالمفتاح</button>
          <button type="submit" class="btn btn-success" id="btnSaveAiConfig" style="box-shadow:0 4px 14px rgba(34,197,94,0.4); font-weight:bold; padding:0.65rem 1.5rem;">💾 حفظ وتفعيل المفاتيح بالمنصة</button>
        </div>
      </form>
    </div>
  `;
}

async function testSuperAdminAiKeyAction() {
  const btn = document.getElementById('btnTestAiKey');
  const box = document.getElementById('saAiTestStatusBox');
  const key = document.getElementById('saAiGeminiKey')?.value.trim();

  if (!key) return showToast('الرجاء إدخال مفتاح Gemini أولاً لفحصه', true);

  if (btn) { btn.disabled = true; btn.innerText = 'جاري الفحص... ⏳'; }
  if (box) { box.style.display = 'block'; box.innerHTML = '<div style="padding:0.75rem; background:#0f172a; border:1px solid #38bdf8; border-radius:6px; color:#38bdf8;">جاري الاتصال المباشر بـ Google Gemini 2.0 Flash...</div>'; }

  try {
    const res = await callBackend('testAiKeyConnection', currentCallerToken, key);
    if (box) {
      box.innerHTML = `<div style="padding:0.75rem; background:#064e3b; border:1px solid #22c55e; border-radius:6px; color:#86efac; font-weight:bold;">${res.message || 'الاتصال ناجح وسريع 100%!'}</div>`;
    }
    showToast('الاتصال بمحرك الذكاء الاصطناعي ناجح 100% 🟢');
  } catch (err) {
    if (box) {
      box.innerHTML = `<div style="padding:0.75rem; background:#7f1d1d; border:1px solid #ef4444; border-radius:6px; color:#fca5a5; font-weight:bold;">فشل الاتصال: ${escapeHtmlAttr(err.message)}</div>`;
    }
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = '⚡ فحص واختبار الاتصال بالمفتاح'; }
  }
}

async function saveSuperAdminAiConfigAction() {
  const btn = document.getElementById('btnSaveAiConfig');
  const geminiKey = document.getElementById('saAiGeminiKey')?.value.trim();
  const rawPool = document.getElementById('saAiGeminiPool')?.value || '';
  const groqKey = document.getElementById('saAiGroqKey')?.value.trim();
  const enabledForCenters = document.getElementById('saAiEnabled')?.checked;
  const dailyStudentLimit = Number(document.getElementById('saAiDailyLimit')?.value || 15);

  const geminiKeys = rawPool.split('\n').map(s => s.trim()).filter(s => s.length > 10);

  if (btn) { btn.disabled = true; btn.innerText = 'جاري الحفظ... ⏳'; }

  try {
    await callBackend('saveSuperAdminAiConfig', currentCallerToken, {
      geminiKey,
      geminiKeys,
      groqKey,
      enabledForCenters,
      dailyStudentLimit
    });
    showToast('تم حفظ وتفعيل مفاتيح الذكاء الاصطناعي بنجاح بالمنصة! 🟢');
    await renderActiveView('superadmin_ai');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = '💾 حفظ وتفعيل المفاتيح بالمنصة'; }
  }
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
        <div style="background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid #1e293b; margin-top:0.75rem;">
          <p style="color:#38bdf8; font-size:0.8rem; margin:0 0 0.3rem 0; font-weight:bold;">🔑 نظام دخول المعلم عبر التطبيق:</p>
          <p style="color:#94a3b8; font-size:0.75rem; margin:0; line-height:1.4;">سيتم تلقائياً توليد كود المعلم (TCH-0001) وإنشاء حساب دخول لتطبيق المعلم مع <strong>رقم سري ابتدائي مؤقت (PIN مكون من 6 أرقام)</strong>. سيظهر لك الـ PIN فور الحفظ لتسليمه للمعلم، وسيُطلب منه التطبيق إجبارياً تعيين كلمة مروره الخاصة عند أول دخول.</p>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" onclick="submitAddTeacher()">حفظ وتوليد الـ PIN</button>
        </div>
      </div>
    </div>
  `;
}

async function submitAddTeacher() {
  const fullName = (document.getElementById('mTchName').value || '').trim();
  const phone = (document.getElementById('mTchPhone').value || '').trim();
  const email = (document.getElementById('mTchEmail').value || '').trim();
  const specialization = (document.getElementById('mTchSpec').value || '').trim();
  const selectedSubjects = Array.from(document.querySelectorAll('.mTchSubjectChk:checked')).map(cb=>cb.value);
  const selectedStages = Array.from(document.querySelectorAll('.mTchStageChk:checked')).map(cb=>cb.value);

  if (!fullName) { showToast('يرجى إدخال اسم المعلم', true); return; }
  if (!phone) { showToast('يرجى إدخال رقم هاتف المعلم', true); return; }

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

    await renderActiveView('teachers');

    // Display PIN confirmation modal immediately so admin can deliver it to the teacher
    const container = document.getElementById('modalContainer');
    const teacherName = escapeHtmlAttr(res.fullName || res.name || fullName);
    const teacherPin = res.tempPassword || '123456';
    const teacherPhone = res.phone || phone;
    const teacherCode = res.teacherCode || res.id;

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:520px; text-align:center;">
          <div style="font-size:2.8rem; margin-bottom:0.25rem;">👨‍🏫 ✨</div>
          <div class="modal-header" style="justify-content:center; color:#10b981; font-size:1.2rem;">تمت إضافة المعلم بنجاح!</div>
          <div style="background:#0f172a; padding:1.2rem; border-radius:10px; margin:1rem 0; border:1px solid #334155; text-align:right;">
            <p style="margin:0 0 0.5rem 0;"><strong>اسم المعلم:</strong> ${teacherName}</p>
            <p style="margin:0 0 0.5rem 0;"><strong>كود المعلم:</strong> <span class="code-box">${teacherCode}</span></p>
            <p style="margin:0 0 0.5rem 0;"><strong>رقم هاتف الدخول:</strong> <span class="code-box">${teacherPhone}</span></p>
            <div style="background:#1e293b; padding:1rem; border-radius:8px; margin-top:0.8rem; text-align:center; border:2px dashed #38bdf8;">
              <p style="margin:0 0 0.4rem 0; font-size:0.85rem; color:#94a3b8;">الرقم السري الابتدائي لتطبيق المعلم (PIN):</p>
              <div style="font-size:2.2rem; font-weight:bold; letter-spacing:4px; color:#38bdf8; font-family:monospace;">${teacherPin}</div>
            </div>
            <p style="margin:0.8rem 0 0 0; font-size:0.8rem; color:#94a3b8; line-height:1.5;">
              💡 <strong>طريقة الدخول:</strong> يقوم المعلم بفتح <em>تطبيق المعلم</em>، وكتابة رقم هاتفه وهذا الـ PIN. سيطلب منه التطبيق فوراً وبشكل إجباري إنشاء كلمة مرور شخصية له للمرات القادمة.
            </p>
          </div>
          <div style="display:flex; justify-content:center; gap:0.8rem;">
            <button class="btn btn-primary" onclick="copyTeacherCredentials('${teacherName}', '${teacherPhone}', '${teacherPin}', '${teacherCode}')">📋 نسخ بيانات الدخول</button>
            <button class="btn btn-success" onclick="closeModal()">حسناً، تم</button>
          </div>
        </div>
      </div>
    `;

    if (failMessages.length > 0) {
      showToast('تم حفظ المعلم لكن بعض التخصصات فشلت: ' + failMessages.join(' | '), true);
    }
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
          <div class="form-group"><label>المادة الدراسية *</label><select id="mGrpSubject" onchange="onGroupModalSubjectChange()">${activeSubjects.map(s => `<option value="${s.id}" data-stage="${s.stageId || ''}" data-year="${s.academicYearId || ''}">${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المعلم *</label><select id="mGrpTeacher">${activeTeachers.map(t => `<option value="${t.id}">${escapeHtmlAttr(t.fullName || t.name)} (${t.teacherCode || t.id})</option>`).join('')}</select></div>
          <div class="form-group"><label>القاعة *</label><select id="mGrpRoom">${activeRooms.map(r => `<option value="${r.id}">${escapeHtmlAttr(r.name)} — ${r.capacity} مقعد</option>`).join('')}</select></div>
          <div class="form-group"><label>السعة القصوى *</label><input type="number" id="mGrpCapacity" value="20" min="1"><div style="color:#94a3b8; font-size:0.72rem;">يجب أن تكون رقماً صحيحاً موجباً</div></div>
        </div>
        <div class="form-group"><label>المواعيد (وصف حر)</label><input type="text" id="mGrpSchedule" placeholder="الأحد والأربعاء 04:00 مساءً"></div>
        <div class="form-group">
          <label>سعر المجموعة (محسوب تلقائياً = عدد الطلاب × سعر المادة)</label>
          <input type="text" id="mGrpFeeDisplay" readonly style="background:#0f172a; border:1px solid #38bdf8; color:#38bdf8; font-weight:bold; cursor:not-allowed;" value="0 ج.م (0 طلاب مسجلين)">
          <input type="hidden" id="mGrpFee" value="0">
          <div id="mGrpFeeHelper" style="font-size:0.75rem; color:#94a3b8; margin-top:0.25rem;">سعر مادة المجموعة: — | يتم تحديث إجمالي سعر المجموعة تلقائياً مع تسجيل الطلاب.</div>
        </div>
        <div id="mGrpErr" style="color:#fca5a5; font-size:0.8rem;"></div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnSaveGroup" onclick="submitAddGroup()">إنشاء المجموعة في Firestore</button>
        </div>
      </div>
    </div>`;
    onGroupModalYearChange();
    onGroupModalSubjectChange();
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
  onGroupModalSubjectChange();
}

function onGroupModalSubjectChange() {
  const subjId = document.getElementById('mGrpSubject')?.value || '';
  const helper = document.getElementById('mGrpFeeHelper');
  const subjects = (window._batchAGroup && window._batchAGroup.subjects) || [];
  const subj = subjects.find(s => s.id === subjId);
  const price = Math.max(0, Number(subj?.price || 0));
  if (helper) {
    helper.innerText = subjId ? `سعر مادة المجموعة: ${fmtMoney(price)} | السعر المبدئي: 0 ج.م (0 طلاب مسجلين حالياً) — يُحسب إجمالي المجموعة تلقائياً فور اشتراك الطلاب.` : 'سعر مادة المجموعة: —';
  }
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

// Attendance Modal & Session Files
async function openRecordAttendanceModal(preselectedSessionId = null) {
  const container = document.getElementById('modalContainer');
  let openSessions = [];
  try {
    const list = await callBackend('getSessions', currentCallerToken, { institutionId: currentCallerToken.institutionId, status: 'OPEN' }) || [];
    openSessions = list.filter(s => s.status === 'OPEN');
  } catch (_) {}

  if (openSessions.length === 0) {
    showToast('لا توجد حصص مفتوحة حالياً لتسجيل الحضور — ابدأ حصة من الجدول أولاً', true);
    return;
  }
  const defaultSession = preselectedSessionId || (openSessions[0] ? openSessions[0].id : '');

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-card" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title">📋 تسجيل حضور طالب (يدوي / باركود)</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitRecordAttendance();">
          <div class="form-group">
            <label>الحصة الدراسية المفتوحة *</label>
            <select id="mAttSessionId" required>
              ${openSessions.map(s => `<option value="${s.id}" ${s.id === defaultSession ? 'selected' : ''}>${escapeHtmlAttr(s.title || 'حصة')} (${escapeHtmlAttr(s.startTime || '')} - ${escapeHtmlAttr(s.room || 'القاعة')})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>كود كارنيه الطالب / كود الباركود *</label>
            <input type="text" id="mAttStudentId" required placeholder="مرر قارئ الباركود أو أدخل كود الكارنيه STU_1001" autofocus dir="ltr">
          </div>
          <div class="form-group">
            <label>حالة تسجيل الحضور</label>
            <select id="mAttStatus">
              <option value="PRESENT">حاضر (PRESENT) ✅</option>
              <option value="LATE">متأخر (LATE) ⏰</option>
              <option value="EXCUSED">بعذر مقبول (EXCUSED) 📝</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnSubmitAtt">💾 تسجيل الحضور الآن</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitRecordAttendance() {
  const sessionId = document.getElementById('mAttSessionId')?.value;
  const rawCode = document.getElementById('mAttStudentId')?.value?.trim();
  const status = document.getElementById('mAttStatus')?.value || 'PRESENT';

  if (!sessionId || !rawCode) {
    return showToast('يرجى اختيار الحصة وإدخال كود الكارنيه', true);
  }

  try {
    const res = await callBackend('recordCardScan', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      cardCode: rawCode,
      sessionId
    });
    playAudioBeep(true);
    showToast(`✅ تم تسجيل حضور الطالب (${res.student?.name || rawCode}) بنجاح!`);
    closeModal();
    if (activeView === 'attendance') await renderAttendanceView(document.getElementById('mainView'));
  } catch (err) {
    try {
      await callBackend('recordAttendance', currentCallerToken, {
        institutionId: currentCallerToken.institutionId,
        studentId: rawCode,
        sessionId,
        status
      });
      playAudioBeep(true);
      showToast('✅ تم تسجيل الحضور بنجاح!');
      closeModal();
      if (activeView === 'attendance') await renderAttendanceView(document.getElementById('mainView'));
    } catch (err2) {
      playAudioBeep(false);
      showToast(friendlyBatchAError(err2), true);
    }
  }
}

async function openSessionFilesModal(sessionId) {
  const container = document.getElementById('modalContainer');
  let session = null;
  try {
    session = await callBackend('getSessionById', currentCallerToken, sessionId, currentCallerToken.institutionId);
  } catch (_) {
    const list = window._allSessionsCache || [];
    session = list.find(s => s.id === sessionId);
  }
  if (!session) return showToast('تعذر العثور على بيانات الحصة', true);

  const attachments = Array.isArray(session.attachments) ? session.attachments : [];
  const isOpen = session.status === 'OPEN';

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-card" style="max-width:620px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">📁 ملفات ومذكرات الحصة: "${escapeHtmlAttr(session.title || 'حصة')}"</div>
            <div style="font-size:0.8rem; margin-top:0.25rem;">
              ${isOpen ? '<span class="badge" style="background:#065f46; color:#a7f3d0; border:1px solid #10b981;">🟢 الحصة مفتوحة حالياً — الملفات متاحة لجميع طلاب المجموعة</span>' : '<span class="badge" style="background:#0369a1; color:#e0f2fe; border:1px solid #0284c7;">⏳ الحصة مجدولة — ستتاح الملفات فور فتح الحصة</span>'}
            </div>
          </div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <div style="margin-bottom:1.25rem;">
          <div style="background:#0f172a; border:2px dashed #38bdf8; border-radius:10px; padding:1.25rem; text-align:center; cursor:pointer;" onclick="document.getElementById('sessionModalFileInput').click()">
            <div style="font-size:2.2rem; margin-bottom:0.3rem;">📤</div>
            <div style="color:#f8fafc; font-weight:bold; font-size:0.95rem;">انقر لاختيار ملفات لرفعها وإرفاقها بالحصة</div>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.25rem;">يدعم مذكرات PDF، واجبات، ملخصات، صور وتمارين (PDF, DOC, DOCX, PPT, JPG, PNG)</div>
            <input type="file" id="sessionModalFileInput" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png" style="display:none;" onchange="handleSessionFilesUpload(event, '${session.id}')">
          </div>
        </div>

        <div>
          <h4 style="color:#f8fafc; margin:0 0 0.75rem 0; font-size:0.95rem;">الملفات المرفوعة للحصة (${attachments.length}):</h4>
          ${attachments.length === 0 ? `
            <div style="text-align:center; padding:1.5rem; color:#64748b; background:#0f172a; border-radius:8px;">
              لا توجد ملفات مرفوعة لهذه الحصة بعد. ارفع أول مذكرة أو واجب ليظهر للطلاب.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:260px; overflow-y:auto;">
              ${attachments.map((file, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:0.65rem 0.9rem;">
                  <div style="display:flex; align-items:center; gap:0.6rem; overflow:hidden;">
                    <span style="font-size:1.3rem;">${(file.name || '').endsWith('.pdf') ? '📕' : '📄'}</span>
                    <div style="overflow:hidden;">
                      <div style="color:#f8fafc; font-weight:bold; font-size:0.85rem; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">${escapeHtmlAttr(file.name || 'ملف')}</div>
                      <div style="font-size:0.7rem; color:#94a3b8;">${file.size ? (file.size / 1024).toFixed(1) + ' KB' : ''} • ${file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('ar-EG') : ''}</div>
                    </div>
                  </div>
                  <div style="display:flex; gap:0.35rem;">
                    ${file.dataUrl ? `<button class="btn" style="padding:0.25rem 0.55rem; font-size:0.75rem; background:#0284c7;" onclick="viewSessionFile('${escapeHtmlAttr(file.dataUrl)}', '${escapeHtmlAttr(file.name)}')">👁️ فتح</button>` : ''}
                    <button class="btn btn-danger" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="deleteSessionFileAction('${session.id}', ${idx})">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem; border-top:1px solid #334155; padding-top:1rem;">
          <button type="button" class="btn" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

async function handleSessionFilesUpload(event, sessionId) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  let session = null;
  try {
    session = await callBackend('getSessionById', currentCallerToken, sessionId, currentCallerToken.institutionId);
  } catch (_) {
    session = (window._allSessionsCache || []).find(s => s.id === sessionId);
  }
  if (!session) return showToast('تعذر العثور على الحصة', true);

  const currentAttachments = Array.isArray(session.attachments) ? [...session.attachments] : [];

  for (const f of files) {
    try {
      const dUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.readAsDataURL(f);
      });
      currentAttachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        dataUrl: dUrl,
        uploadedAt: new Date().toISOString()
      });
    } catch (_) {}
  }

  try {
    await callBackend('updateSession', currentCallerToken, sessionId, {
      institutionId: currentCallerToken.institutionId,
      attachments: currentAttachments
    });
    showToast(`تم رفع وإرفاق ${files.length} ملف بالحصة بنجاح!`);
    await openSessionFilesModal(sessionId);
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

function viewSessionFile(dataUrl, fileName) {
  const w = window.open('');
  if (w) {
    if (dataUrl.startsWith('data:application/pdf') || dataUrl.startsWith('data:image/')) {
      w.document.write(`<iframe src="${dataUrl}" style="border:none; width:100vw; height:100vh; margin:0;"></iframe>`);
    } else {
      w.document.write(`<div style="font-family:sans-serif; text-align:center; padding:3rem;"><a href="${dataUrl}" download="${fileName}" style="display:inline-block; padding:1rem 2rem; background:#0284c7; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold;">تحميل ${fileName}</a></div>`);
    }
  }
}

async function deleteSessionFileAction(sessionId, fileIndex) {
  if (!confirm('هل أنت متأكد من حذف هذا الملف من الحصة؟')) return;
  try {
    let session = await callBackend('getSessionById', currentCallerToken, sessionId, currentCallerToken.institutionId).catch(() => null);
    if (!session) session = (window._allSessionsCache || []).find(s => s.id === sessionId);
    if (!session) return;
    const atts = Array.isArray(session.attachments) ? [...session.attachments] : [];
    atts.splice(fileIndex, 1);
    await callBackend('updateSession', currentCallerToken, sessionId, {
      institutionId: currentCallerToken.institutionId,
      attachments: atts
    });
    showToast('تم حذف الملف بنجاح');
    await openSessionFilesModal(sessionId);
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// Finance Modals
async function openRecordPaymentModal() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل بيانات الطلاب والمواد...</p></div></div>';
  try {
    const instId = currentCallerToken.institutionId;
    const [students, groups, subjects] = await Promise.all([
      callBackend('getStudents', currentCallerToken, { institutionId: instId }).catch(() => []) || [],
      callBackend('getGroups', currentCallerToken, { institutionId: instId }).catch(() => []) || [],
      callBackend('getSubjects', currentCallerToken, { institutionId: instId }).catch(() => []) || []
    ]);
    const activeStudents = (students || []).filter(s => s.status !== 'ARCHIVED');
    window._finPaymentState = { students: activeStudents, groups, subjects };

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:620px; max-height:88vh; overflow-y:auto;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <span>+ تسجيل تحصيل نقدية وإصدار إيصال معتمد</span>
            <span style="font-size:0.8rem; color:#94a3b8; font-weight:normal;">تطبيق خصم تلقائي أو مباشر</span>
          </div>
          
          <div class="form-group">
            <label>اختيار الطالب المسجل * (لحساب إجمالي المواد تلقائياً)</label>
            <select id="mPayStudent" onchange="onPayStudentChange()" style="width:100%; padding:0.6rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
              <option value="">-- اختر الطالب لحساب المواد المشترك بها --</option>
              ${activeStudents.map(s => `<option value="${s.id}">${escapeHtmlAttr(s.name || s.fullName)} ${s.phone ? `(${s.phone})` : ''}</option>`).join('')}
            </select>
          </div>

          <div id="mPaySubjectsPanel"></div>

          <div class="form-group"><label>اسم الطالب (بالإيصال)</label><input type="text" id="mPayStudentName" placeholder="أحمد محمد علي"></div>

          <!-- Original Fee Before Discount -->
          <div class="form-group">
            <label>المبلغ الأصلي قبل الخصم (جنيه) * — محسوب تلقائياً من إجمالي المواد</label>
            <input type="number" id="mPayOriginalAmount" value="0" min="0" step="1" oninput="recalcPaymentNetWithDiscount()" style="width:100%; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-weight:bold;">
          </div>

          <!-- Discount Feature Box -->
          <div style="background:#1e293b; border:1px solid #f59e0b; border-radius:8px; padding:0.85rem; margin-bottom:1rem;">
            <div style="font-weight:bold; color:#fbbf24; font-size:0.92rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
              <span>🏷️ ميزة تطبيق خصم على الرسوم</span>
              <span id="mPayDiscountPill" style="font-size:0.75rem; color:#fde047; background:rgba(245,158,11,0.2); padding:0.15rem 0.5rem; border-radius:4px; border:1px solid rgba(245,158,11,0.4);">لا يوجد خصم (0 ج.م)</span>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:0.6rem;">
              <div>
                <label style="font-size:0.8rem; color:#94a3b8; display:block; margin-bottom:0.25rem;">نوع الخصم</label>
                <select id="mPayDiscountType" onchange="recalcPaymentNetWithDiscount()" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
                  <option value="FIXED">مبلغ نقدي مباشر (ج.م)</option>
                  <option value="PERCENT">نسبة مئوية (%)</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem; color:#94a3b8; display:block; margin-bottom:0.25rem;" id="mPayDiscountValLabel">قيمة الخصم (ج.م)</label>
                <input type="number" id="mPayDiscountValue" value="0" min="0" step="1" oninput="recalcPaymentNetWithDiscount()" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
              </div>
            </div>

            <div>
              <label style="font-size:0.8rem; color:#94a3b8; display:block; margin-bottom:0.25rem;">سبب / بند الخصم</label>
              <div style="display:flex; gap:0.4rem;">
                <select id="mPayDiscountPreset" onchange="onDiscountPresetChange()" style="padding:0.45rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.82rem; width:45%;">
                  <option value="">-- اختر سبب الخصم --</option>
                  <option value="خصم أشقاء وإخوة">خصم أشقاء وإخوة</option>
                  <option value="خصم تفوق دراسي">خصم تفوق دراسي</option>
                  <option value="إعفاء جزئي / ظروف خاصة">إعفاء جزئي / ظروف خاصة</option>
                  <option value="خصم سداد دورة مقدماً">سداد دورة مقدماً</option>
                  <option value="عرض ترويجي خاص">عرض ترويجي خاص</option>
                </select>
                <input type="text" id="mPayDiscountReason" placeholder="أو اكتب سبب الخصم هنا..." style="flex:1; padding:0.45rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.82rem;">
              </div>
            </div>
          </div>

          <!-- Net Amount to Collect -->
          <div class="form-group" style="background:#052e16; border:2px solid #22c55e; border-radius:8px; padding:0.85rem; margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <label style="color:#86efac; font-weight:bold; font-size:0.95rem; margin:0; display:block;">صافي المبلغ المطلوب تحصيله (جنيه) *</label>
                <span style="font-size:0.75rem; color:#4ade80;" id="mPayNetSummaryText">المبلغ الأصلي محسوب تلقائياً</span>
              </div>
              <input type="number" id="mPayAmount" value="0" min="0" step="1" style="width:140px; font-size:1.35rem; font-weight:900; color:#4ade80; background:#0f172a; border:1px solid #22c55e; border-radius:6px; padding:0.4rem 0.6rem; text-align:center;">
            </div>
          </div>

          <div class="form-group"><label>البيان / الفئة</label><input type="text" id="mPayCategory" value="مصاريف دراسية شهرية"></div>
          
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
            <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
            <button class="btn btn-success" onclick="submitRecordPayment()">حفظ وإصدار الإيصال</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    showToast(err.message, true);
  }
}

function recalcPaymentNetWithDiscount() {
  const origInput = document.getElementById('mPayOriginalAmount');
  const typeSelect = document.getElementById('mPayDiscountType');
  const valInput = document.getElementById('mPayDiscountValue');
  const netInput = document.getElementById('mPayAmount');
  const pill = document.getElementById('mPayDiscountPill');
  const valLabel = document.getElementById('mPayDiscountValLabel');
  const summaryText = document.getElementById('mPayNetSummaryText');

  const orig = Math.max(0, Number(origInput?.value || 0));
  const type = typeSelect?.value || 'FIXED';
  const val = Math.max(0, Number(valInput?.value || 0));

  if (valLabel) {
    valLabel.innerText = type === 'PERCENT' ? 'نسبة الخصم (%)' : 'قيمة الخصم (ج.م)';
  }

  let discountPounds = 0;
  if (type === 'PERCENT') {
    discountPounds = Math.round((orig * (val / 100)) * 100) / 100;
  } else {
    discountPounds = Math.min(orig, val);
  }

  const net = Math.max(0, Math.round((orig - discountPounds) * 100) / 100);

  if (netInput) {
    netInput.value = net;
  }

  if (pill) {
    if (discountPounds > 0) {
      pill.innerText = `خصم مفعّل: -${fmtMoney(discountPounds)} (${type === 'PERCENT' ? `${val}%` : `${Math.round((discountPounds / (orig || 1)) * 100)}%`})`;
      pill.style.background = 'rgba(239,68,68,0.2)';
      pill.style.color = '#f87171';
      pill.style.borderColor = 'rgba(239,68,68,0.4)';
    } else {
      pill.innerText = 'لا يوجد خصم (0 ج.م)';
      pill.style.background = 'rgba(245,158,11,0.2)';
      pill.style.color = '#fde047';
      pill.style.borderColor = 'rgba(245,158,11,0.4)';
    }
  }

  if (summaryText) {
    if (discountPounds > 0) {
      summaryText.innerText = `تم تطبيق خصم بقيمة ${fmtMoney(discountPounds)} من أصل ${fmtMoney(orig)}`;
    } else {
      summaryText.innerText = `المبلغ الأصلي قبل أي خصم: ${fmtMoney(orig)}`;
    }
  }
}

function onDiscountPresetChange() {
  const preset = document.getElementById('mPayDiscountPreset')?.value || '';
  const reasonInput = document.getElementById('mPayDiscountReason');
  if (preset && reasonInput) {
    reasonInput.value = preset;
  }
}

function onPayStudentChange() {
  const sid = document.getElementById('mPayStudent')?.value || '';
  const nameInput = document.getElementById('mPayStudentName');
  const origInput = document.getElementById('mPayOriginalAmount');
  const catInput = document.getElementById('mPayCategory');
  const panel = document.getElementById('mPaySubjectsPanel');
  const st = window._finPaymentState || {};
  const student = (st.students || []).find(s => s.id === sid);

  if (!student) {
    if (panel) panel.innerHTML = '';
    return;
  }

  if (nameInput) nameInput.value = student.name || student.fullName || '';

  const groupIds = canonicalIdsOf(student);
  const groups = st.groups || [];
  const subjects = st.subjects || [];
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  const breakdown = [];
  let totalSubjectsFee = 0;

  for (const gid of groupIds) {
    const grp = groupMap.get(gid);
    if (!grp) continue;
    const subj = subjectMap.get(grp.subjectId);
    const subjName = subj?.name || grp.subjectName || grp.name || 'مادة دراسية';
    const subjPrice = Math.max(0, Number(subj?.price !== undefined ? subj.price : (grp.subjectPrice || 0)));
    totalSubjectsFee += subjPrice;
    breakdown.push({
      groupId: gid,
      groupName: grp.name,
      subjectName: subjName,
      price: subjPrice
    });
  }

  if (panel) {
    if (breakdown.length > 0) {
      panel.innerHTML = `
        <div style="background:#0f172a; border:1px solid #8b5cf6; border-radius:8px; padding:0.75rem; margin-bottom:0.75rem;">
          <div style="font-weight:bold; color:#c084fc; margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center;">
            <span>📚 المواد والمجموعات المشترك بها الطالب (${breakdown.length})</span>
            <span style="font-size:1rem; color:#a855f7; background:#2e1065; padding:0.2rem 0.6rem; border-radius:6px; border:1px solid #7e22ce;">إجمالي المواد: ${fmtMoney(totalSubjectsFee)}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.35rem; font-size:0.82rem;">
            ${breakdown.map((item, idx) => `
              <div style="display:flex; justify-content:space-between; padding:0.25rem 0.5rem; background:#1e293b; border-radius:4px;">
                <span>${idx + 1}. <strong>${escapeHtmlAttr(item.subjectName)}</strong> <small style="color:#94a3b8;">(${escapeHtmlAttr(item.groupName)})</small></span>
                <span style="color:#38bdf8; font-weight:bold;">${fmtMoney(item.price)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div style="background:#0f172a; border:1px dashed #475569; border-radius:8px; padding:0.6rem; font-size:0.8rem; color:#94a3b8; margin-bottom:0.75rem;">
          ℹ️ الطالب غير مسجل في أي مجموعات دراسية حالياً.
        </div>
      `;
    }
  }

  if (origInput) {
    origInput.value = totalSubjectsFee;
  }
  if (catInput && breakdown.length > 0) {
    catInput.value = 'مصاريف شهرية: ' + breakdown.map(b => b.subjectName).join(' + ');
  }

  // Recalculate net according to current discount inputs
  recalcPaymentNetWithDiscount();
}

async function submitRecordPayment() {
  const sid = document.getElementById('mPayStudent')?.value || '';
  const studentName = document.getElementById('mPayStudentName')?.value || '';
  const originalAmount = Number(document.getElementById('mPayOriginalAmount')?.value || 0);
  const discountType = document.getElementById('mPayDiscountType')?.value || 'FIXED';
  const discountVal = Number(document.getElementById('mPayDiscountValue')?.value || 0);
  const discountReason = (document.getElementById('mPayDiscountReason')?.value || '').trim();
  const amount = Number(document.getElementById('mPayAmount')?.value || 0);
  const category = document.getElementById('mPayCategory')?.value || 'مصاريف دراسية';

  // Calculate actual discount in pounds
  let discountAmount = 0;
  if (discountType === 'PERCENT') {
    discountAmount = Math.round((originalAmount * (discountVal / 100)) * 100) / 100;
  } else {
    discountAmount = Math.min(originalAmount, discountVal);
  }

  const st = window._finPaymentState || {};
  let student = (st.students || []).find(s => s.id === sid);
  if (!student && studentName) {
    student = (st.students || []).find(s => s.name && s.name.trim().toLowerCase() === studentName.trim().toLowerCase());
  }
  if (!student) {
    student = { id: sid, name: studentName };
  }
  const guardianPhone = student.guardianPhone || student.parentPhone || student.guardianMobile || student.parentMobile || '';
  const studentPhone = student.phone || student.normalizedPhone || student.mobile || '';

  try {
    const res = await callBackend('recordPayment', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      studentId: student.id || sid,
      studentName,
      guardianPhone,
      studentPhone,
      amount,
      originalAmount,
      discount: discountAmount,
      discountType,
      discountPercent: discountType === 'PERCENT' ? discountVal : (originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0),
      discountReason,
      category
    });

    playAudioNotification('payment');
    closeModal();
    const discountMsg = discountAmount > 0 ? ` (بعد خصم ${fmtMoney(discountAmount)})` : '';
    showToast(`تم تحصيل مبلغ ${fmtMoney(res.amount)}${discountMsg} وإصدار إيصال (${res.receiptNumber})! 💳`);
    
    // Auto WhatsApp dispatch if enabled
    autoDispatchPaymentReceiptWhatsApp(res, { ...student, guardianPhone: res.guardianPhone || guardianPhone, phone: res.studentPhone || studentPhone });

    // Open live receipt preview modal with pre-populated phone numbers
    openReceiptPreviewModal(res, { ...student, guardianPhone: res.guardianPhone || guardianPhone, phone: res.studentPhone || studentPhone });

    await renderActiveView('finance');
  } catch (err) { showToast(err.message, true); }
}

async function openReceiptPreviewModal(receipt, student = {}) {
  const container = document.getElementById('modalContainer');
  let invoiceConfig = await callBackend('getInvoiceConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})) || {};
  let branding = await callBackend('getBranding', currentCallerToken, currentCallerToken.institutionId).catch(() => null);

  const centerName = invoiceConfig.centerName || branding?.name || 'مركز رماس التعليمي';
  const subHeader = invoiceConfig.subHeader || 'إيصال تحصيل وسند قبض رسمي معتمد';
  const phone = invoiceConfig.phone || branding?.phone || '';
  const address = invoiceConfig.address || branding?.address || '';
  const taxNumber = invoiceConfig.taxNumber || '';
  const terms = invoiceConfig.terms || 'المصروفات لا تسترد بعد الحصة الثانية. يرجى إبراز الإيصال عند أي مراجعة بالسنتر.';
  const logoUrl = invoiceConfig.logoUrl || branding?.logoUrl || '';

  const receiptNo = receipt.receiptNumber || receipt.humanNumber || receipt.id || '000001';
  const studentName = receipt.studentName || student.name || 'طالب';
  const amount = Number(receipt.amount || 0);
  const discount = Number(receipt.discount || 0);
  const originalAmount = Number(receipt.originalAmount || (amount + discount));
  const discountReason = receipt.discountReason || '';
  const remaining = receipt.remainingAfter !== undefined ? Number(receipt.remainingAfter) : 0;
  const dateStr = receipt.paymentDate || new Date().toISOString().split('T')[0];
  const timeStr = receipt.paymentTime ? new Date(receipt.paymentTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  let cashierName = receipt.collectorName || receipt.createdByNameSnapshot || currentCallerToken?.displayName || currentCallerToken?.username || (currentCallerToken?.email ? currentCallerToken.email.split('@')[0] : 'الخزينة');
  if (cashierName && typeof cashierName === 'string' && cashierName.includes('@')) {
    cashierName = cashierName.split('@')[0];
  }
  const category = receipt.category || 'مصاريف دراسية';

  let guardianPhone = receipt.guardianPhone || receipt.parentPhone || student.guardianPhone || student.parentPhone || student.guardianMobile || student.parentMobile || '';
  let studentPhone = receipt.studentPhone || student.phone || student.normalizedPhone || student.mobile || '';

  // Auto-lookup student details if phone numbers are missing (e.g. from archive)
  const targetStudentId = receipt.studentId || student.id;
  if ((!guardianPhone || !studentPhone) && targetStudentId) {
    try {
      const fetched = await callBackend('getStudentById', currentCallerToken, targetStudentId, currentCallerToken.institutionId).catch(() => null);
      if (fetched) {
        if (!guardianPhone) guardianPhone = fetched.guardianPhone || fetched.parentPhone || fetched.guardianMobile || fetched.parentMobile || '';
        if (!studentPhone) studentPhone = fetched.phone || fetched.normalizedPhone || fetched.mobile || '';
      }
    } catch (_) {}
  }
  if ((!guardianPhone || !studentPhone) && (receipt.studentName || student.name)) {
    const sName = (receipt.studentName || student.name || '').trim().toLowerCase();
    try {
      const stList = (window._finPaymentState && window._finPaymentState.students)
        ? window._finPaymentState.students
        : await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
      const match = stList.find(s => s && s.name && s.name.trim().toLowerCase() === sName);
      if (match) {
        if (!guardianPhone) guardianPhone = match.guardianPhone || match.parentPhone || match.guardianMobile || match.parentMobile || '';
        if (!studentPhone) studentPhone = match.phone || match.normalizedPhone || match.mobile || '';
      }
    } catch (_) {}
  }

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:580px; max-height:92vh; overflow-y:auto; padding:1.5rem; background:#0f172a; border:1px solid #38bdf8;">
        <!-- Modal Actions Bar (No Print) -->
        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; padding-bottom:0.75rem; border-bottom:1px solid #334155;">
          <div style="font-weight:bold; color:#38bdf8; font-size:1.1rem; display:flex; align-items:center; gap:0.4rem;">
            <span>🧾 معاينة إيصال التحصيل الرسمي</span>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="btn btn-success" onclick="printReceiptDirectly()" style="padding:0.4rem 0.8rem; font-size:0.85rem;">🖨️ طباعة</button>
            <button class="btn btn-primary" onclick="saveReceiptPdfDirectly('${escapeHtmlAttr(receiptNo)}')" style="padding:0.4rem 0.8rem; font-size:0.85rem;">💾 حفظ PDF</button>
            <button class="btn" style="background:#0284c7; color:#fff; padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="saveReceiptImageDirectly('${escapeHtmlAttr(receiptNo)}')" title="حفظ الإيصال كصورة PNG على الجهاز">🖼️ حفظ صورة</button>
            <button class="btn" style="background:#475569; padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="closeModal()">✖️ إغلاق</button>
          </div>
        </div>

        <!-- Printable Document Area -->
        <div id="printableReceiptArea" class="printable-receipt-area" style="background:#ffffff; color:#0f172a; padding:1.5rem; border-radius:8px; border:2px dashed #94a3b8; font-family:'Segoe UI', Tahoma, sans-serif;">
          <!-- Receipt Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0284c7; padding-bottom:1rem; margin-bottom:1rem;">
            <div>
              <h2 style="margin:0; font-size:1.4rem; color:#0284c7; font-weight:900;">${escapeHtmlAttr(centerName)}</h2>
              <div style="font-size:0.85rem; color:#475569; margin-top:0.2rem;">${escapeHtmlAttr(subHeader)}</div>
              ${address ? `<div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">📍 ${escapeHtmlAttr(address)}</div>` : ''}
              ${phone ? `<div style="font-size:0.78rem; color:#64748b;">📞 ${escapeHtmlAttr(phone)}</div>` : ''}
              ${taxNumber ? `<div style="font-size:0.75rem; color:#64748b;">س.ت / ضريبي: ${escapeHtmlAttr(taxNumber)}</div>` : ''}
            </div>
            ${logoUrl ? `<img src="${escapeHtmlAttr(logoUrl)}" style="height:55px; max-width:110px; object-fit:contain;" alt="شعار">` : `<div style="font-size:2.5rem;">🏫</div>`}
          </div>

          <!-- Document Title & Serial -->
          <div style="background:#f1f5f9; border-radius:6px; padding:0.6rem 0.9rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-right:4px solid #0284c7;">
            <div>
              <span style="font-size:0.75rem; color:#64748b; display:block;">رقم الإيصال الرسمي:</span>
              <strong style="font-size:1.15rem; color:#0f172a; font-family:monospace; letter-spacing:1px;">#${escapeHtmlAttr(receiptNo)}</strong>
            </div>
            <div style="text-align:left;">
              <span style="font-size:0.75rem; color:#64748b; display:block;">التاريخ والوقت:</span>
              <strong style="font-size:0.9rem; color:#0f172a;">${dateStr} | ${timeStr}</strong>
            </div>
          </div>

          <!-- Student & Details Table -->
          <table style="width:100%; border-collapse:collapse; margin-bottom:1rem; font-size:0.9rem;">
            <tbody>
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:0.5rem 0; color:#64748b; width:30%;">اسم الطالب:</td>
                <td style="padding:0.5rem 0; font-weight:bold; color:#0f172a; font-size:1.05rem;">${escapeHtmlAttr(studentName)}</td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:0.5rem 0; color:#64748b;">بند التحصيل:</td>
                <td style="padding:0.5rem 0; font-weight:600; color:#334155;">${escapeHtmlAttr(category)}</td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:0.5rem 0; color:#64748b;">طريقة الدفع:</td>
                <td style="padding:0.5rem 0; font-weight:bold; color:#15803d;">نقدي (CASH) ✅</td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:0.5rem 0; color:#64748b;">المستلم / الكاشير:</td>
                <td style="padding:0.5rem 0; color:#334155;">${escapeHtmlAttr(cashierName)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Discount Details Banner (If discount > 0) -->
          ${discount > 0 ? `
            <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:6px; padding:0.6rem 0.9rem; margin-bottom:0.75rem; font-size:0.85rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                <span style="color:#64748b;">المبلغ الأصلي قبل الخصم:</span>
                <strong style="color:#334155;">${fmtMoney(originalAmount)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; color:#b45309; font-weight:bold;">
                <span>قيمة الخصم الممنوح ${discountReason ? `(${escapeHtmlAttr(discountReason)})` : ''}:</span>
                <span style="direction:ltr;">-${fmtMoney(discount)}</span>
              </div>
            </div>
          ` : ''}

          <!-- Amount Banner -->
          <div style="background:#ecfdf5; border:2px solid #10b981; border-radius:8px; padding:0.9rem 1.2rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <span style="color:#047857; font-weight:bold; font-size:0.9rem; display:block;">المبلغ المستلم المدفوع:</span>
              <span style="color:#065f46; font-size:0.8rem;">سند قبض رسمي مبرئ للذمة</span>
            </div>
            <div style="font-size:1.7rem; font-weight:900; color:#047857;">
              ${fmtMoney(amount)}
            </div>
          </div>

          ${remaining > 0 ? `
            <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:6px; padding:0.5rem 0.8rem; display:flex; justify-content:space-between; margin-bottom:1rem; font-size:0.85rem; color:#b45309;">
              <span>المتبقي على الطالب:</span>
              <strong>${fmtMoney(remaining)}</strong>
            </div>
          ` : `
            <div style="background:#f0fdf4; border:1px solid #22c55e; border-radius:6px; padding:0.4rem 0.8rem; text-align:center; margin-bottom:1rem; font-size:0.8rem; color:#15803d; font-weight:bold;">
              ✨ تم سداد كامل المستحق المالي
            </div>
          `}

          <!-- Footer & Terms -->
          <div style="border-top:1px dashed #cbd5e1; padding-top:0.75rem; text-align:center; font-size:0.75rem; color:#64748b;">
            <p style="margin:0 0 0.25rem 0;">${escapeHtmlAttr(terms)}</p>
            <p style="margin:0; font-weight:600; color:#94a3b8;">نظام رماس لإدارة المراكز التعليمية — إيصال إلكتروني مشفر</p>
          </div>
        </div>

        <!-- WhatsApp Quick Image & Text Share to Parent & Student -->
        <div class="no-print" style="margin-top:1.2rem; background:#1e293b; padding:1.1rem; border-radius:10px; border:1px solid #334155; box-shadow:0 4px 15px rgba(0,0,0,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid #334155; padding-bottom:0.5rem;">
            <div style="color:#38bdf8; font-weight:bold; font-size:0.95rem; display:flex; align-items:center; gap:0.4rem;">
              <span>📸 إرسال الإيصال كصورة عبر الواتساب</span>
            </div>
            <span style="font-size:0.75rem; color:#a5b4fc; background:rgba(99,102,241,0.15); padding:0.2rem 0.5rem; border-radius:4px; border:1px solid rgba(99,102,241,0.3);">
              نسخ صورة الإيصال تلقائياً للحافظة
            </span>
          </div>

          <!-- 1. Send to Guardian (Parent) -->
          <div style="margin-bottom:0.9rem; background:#0f172a; padding:0.75rem; border-radius:8px; border:1px solid #334155;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span style="font-size:0.84rem; color:#cbd5e1; font-weight:700;">👨‍👦 رقم ولي الأمر:</span>
              <span style="font-size:0.75rem; color:${guardianPhone ? '#4ade80' : '#f87171'};">
                ${guardianPhone ? '✅ تم جلب الرقم تلقائياً' : '⚠️ غير مسجل (اكتب الرقم بالأسفل)'}
              </span>
            </div>
            <div style="display:flex; gap:0.45rem; align-items:center; margin-bottom:0.45rem;">
              <input id="receiptWhatsAppGuardianPhone" type="tel" value="${escapeHtmlAttr(guardianPhone)}" placeholder="رقم واتساب ولي الأمر (مثال: 01012345678)"
                style="flex:1; padding:0.5rem 0.8rem; background:#1e293b; border:1px solid #475569; border-radius:6px; color:#fff; font-size:0.88rem;" dir="ltr">
            </div>
            <div style="display:flex; gap:0.45rem;">
              <button class="btn btn-success" onclick="shareReceiptImageWhatsApp('guardian', 'desktop')"
                style="flex:1; display:flex; justify-content:center; align-items:center; gap:0.35rem; padding:0.45rem; font-weight:bold; font-size:0.8rem; box-shadow:0 2px 8px rgba(34,197,94,0.3);"
                title="فتح المحادثة مباشرة في تطبيق واتساب المكتبي">
                <span>💬 تطبيق الواتس (Desktop)</span>
              </button>
              <button class="btn" onclick="shareReceiptImageWhatsApp('guardian', 'web')"
                style="background:#0284c7; color:#fff; display:flex; justify-content:center; align-items:center; gap:0.35rem; padding:0.45rem 0.9rem; font-weight:bold; font-size:0.8rem; box-shadow:0 2px 8px rgba(2,132,199,0.3);"
                title="فتح المحادثة مباشرة في واتساب ويب بالمتصفح">
                <span>🌐 واتساب ويب (Web)</span>
              </button>
            </div>
          </div>

          <!-- 2. Send to Student -->
          <div style="margin-bottom:0.6rem; background:#0f172a; padding:0.75rem; border-radius:8px; border:1px solid #334155;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span style="font-size:0.84rem; color:#cbd5e1; font-weight:700;">🎓 رقم الطالب:</span>
              <span style="font-size:0.75rem; color:${studentPhone ? '#4ade80' : '#f87171'};">
                ${studentPhone ? '✅ تم جلب الرقم تلقائياً' : '⚠️ غير مسجل (اكتب الرقم بالأسفل)'}
              </span>
            </div>
            <div style="display:flex; gap:0.45rem; align-items:center; margin-bottom:0.45rem;">
              <input id="receiptWhatsAppStudentPhone" type="tel" value="${escapeHtmlAttr(studentPhone)}" placeholder="رقم واتساب الطالب (مثال: 01112345678)"
                style="flex:1; padding:0.5rem 0.8rem; background:#1e293b; border:1px solid #475569; border-radius:6px; color:#fff; font-size:0.88rem;" dir="ltr">
            </div>
            <div style="display:flex; gap:0.45rem;">
              <button class="btn btn-success" onclick="shareReceiptImageWhatsApp('student', 'desktop')"
                style="flex:1; display:flex; justify-content:center; align-items:center; gap:0.35rem; padding:0.45rem; font-weight:bold; font-size:0.8rem; box-shadow:0 2px 8px rgba(34,197,94,0.3);"
                title="فتح المحادثة مباشرة في تطبيق واتساب المكتبي">
                <span>💬 تطبيق الواتس (Desktop)</span>
              </button>
              <button class="btn" onclick="shareReceiptImageWhatsApp('student', 'web')"
                style="background:#0284c7; color:#fff; display:flex; justify-content:center; align-items:center; gap:0.35rem; padding:0.45rem 0.9rem; font-weight:bold; font-size:0.8rem; box-shadow:0 2px 8px rgba(2,132,199,0.3);"
                title="فتح المحادثة مباشرة في واتساب ويب بالمتصفح">
                <span>🌐 واتساب ويب (Web)</span>
              </button>
            </div>
          </div>

          <!-- Helpful Instructions Hint -->
          <div style="margin-top:0.75rem; padding:0.55rem 0.8rem; background:rgba(245,158,11,0.1); border-right:3px solid #f59e0b; border-radius:4px; font-size:0.76rem; color:#fde68a; line-height:1.5;">
            💡 <strong>ملاحظة هامة:</strong> يتم تحويل الرقم تلقائياً للصيغة الدولية الرسمية (+20) لفتح شاشة المحادثة المباشرة فوراً. عند فتح المحادثة، اضغط <strong>(Ctrl + V)</strong> للصق صورة الإيصال وإرسالها.
          </div>
        </div>
      </div>
    </div>
  `;

  window._currentPreviewReceipt = {
    receiptNo,
    studentName,
    amount,
    remaining,
    guardianPhone,
    studentPhone,
    centerName
  };
}

function formatWhatsAppInternationalPhone(phoneInput) {
  if (!phoneInput) return '';
  let cleaned = String(phoneInput).replace(/[^\d]/g, '');
  if (!cleaned) return '';

  // Strip leading 00
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Egyptian standard mobile (11 digits: 010, 011, 012, 015)
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    cleaned = '2' + cleaned;
  } else if (cleaned.length === 10 && (cleaned.startsWith('10') || cleaned.startsWith('11') || cleaned.startsWith('12') || cleaned.startsWith('15'))) {
    cleaned = '20' + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('05')) {
    // Saudi Arabia (05...)
    cleaned = '966' + cleaned.substring(1);
  } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
    cleaned = '966' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = '20' + cleaned.replace(/^0+/, '');
  }

  return cleaned;
}

async function shareReceiptImageWhatsApp(targetType = 'guardian', platform = 'desktop') {
  const pData = window._currentPreviewReceipt || {};
  let rawPhone = '';
  let recipientLabel = '';

  if (targetType === 'student') {
    const input = document.getElementById('receiptWhatsAppStudentPhone');
    rawPhone = input ? input.value.trim() : (pData.studentPhone || '');
    recipientLabel = 'الطالب';
  } else {
    const input = document.getElementById('receiptWhatsAppGuardianPhone');
    rawPhone = input ? input.value.trim() : (pData.guardianPhone || '');
    recipientLabel = 'ولي الأمر';
  }

  if (!rawPhone) {
    return showToast(`يرجى كتابة أو تحديد رقم هاتف ${recipientLabel} أولاً`, true);
  }

  const cleanPhone = formatWhatsAppInternationalPhone(rawPhone);
  if (!cleanPhone || cleanPhone.length < 9) {
    return showToast(`رقم هاتف ${recipientLabel} (${rawPhone}) غير صالح. يرجى التأكد من كتابة الرقم بشكل صحيح`, true);
  }

  // 1. Render isolated receipt HTML to native PNG and copy directly to Windows Clipboard
  const area = document.getElementById('printableReceiptArea');
  if (area && window.electronAPI && typeof window.electronAPI.copyReceiptImageToClipboard === 'function') {
    try {
      await window.electronAPI.copyReceiptImageToClipboard({
        html: area.outerHTML
      });
      playAudioNotification('payment');
    } catch (captureErr) {
      console.warn('Failed to capture receipt to clipboard:', captureErr);
    }
  }

  // 2. Prepare receipt message text
  const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})) || {};
  let template = config.receiptTemplate || 'تم استلام دفعة بقيمة {amount} ج.م للطالب {studentName} لإيصال رقم {receiptNumber}. شكراً لتعاملكم مع {centerName}. (مرفق صورة الإيصال 🧾)';
  
  const text = template
    .replace(/{studentName}/g, pData.studentName || 'الطالب')
    .replace(/{amount}/g, pData.amount || 0)
    .replace(/{receiptNumber}/g, pData.receiptNo || 'إيصال')
    .replace(/{remainingBalance}/g, pData.remaining || 0)
    .replace(/{centerName}/g, pData.centerName || 'السنتر');

  // 3. Launch WhatsApp directly to the chat
  if (platform === 'web') {
    const webUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    showToast(`🌐 جاري فتح محادثة ${recipientLabel} في واتساب ويب بالمتصفح...`);
    await openWhatsAppExternalUrl(webUrl);
  } else {
    // Native WhatsApp Desktop via protocol scheme with full international phone number
    const nativeAppUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    showToast(`💬 جاري فتح محادثة ${recipientLabel} في تطبيق الواتس آب المكتبي...`);
    await openWhatsAppExternalUrl(nativeAppUrl);
  }

  showToast(`📸 تم نسخ صورة الإيصال للحافظة بنجاح! اضغط (Ctrl + V) داخل المحادثة للصق الصورة وإرسالها فوراً 🚀`);
}

async function saveReceiptImageDirectly(receiptNo = '') {
  const area = document.getElementById('printableReceiptArea');
  if (!area) return showToast('تعذر العثور على محتوى الفاتورة', true);

  if (window.electronAPI && typeof window.electronAPI.saveReceiptImage === 'function') {
    showToast('جاري تجهيز وحفظ صورة الإيصال (PNG)...');
    const filename = `فاتورة_تحصيل_${receiptNo || 'إيصال'}_${Date.now()}.png`;
    const res = await window.electronAPI.saveReceiptImage({
      html: area.outerHTML,
      defaultFilename: filename
    });

    if (res && res.success) {
      showToast(`✅ تم حفظ صورة الإيصال بنجاح في:\n${res.filePath}`);
    } else if (res && res.canceled) {
      // User canceled
    } else {
      showToast(`تعذر حفظ الصورة: ${res?.error || 'خطأ أثناء المعالجة'}`, true);
    }
  } else {
    showToast('ميزة حفظ الصورة غير مدعومة في هذه البيئة', true);
  }
}

async function openWhatsAppExternalUrl(targetUrl) {
  if (!targetUrl) return;

  if (window.electronAPI && typeof window.electronAPI.openExternalUrl === 'function') {
    await window.electronAPI.openExternalUrl(targetUrl);
  } else {
    window.open(targetUrl, '_blank');
  }
}

async function printReceiptDirectly() {
  const area = document.getElementById('printableReceiptArea');
  if (!area) return showToast('تعذر العثور على محتوى الفاتورة', true);

  if (window.electronAPI && typeof window.electronAPI.printReceiptNative === 'function') {
    await window.electronAPI.printReceiptNative({ html: area.outerHTML });
  } else {
    window.print();
  }
}

async function saveReceiptPdfDirectly(receiptNo = '') {
  const area = document.getElementById('printableReceiptArea');
  if (!area) return showToast('تعذر العثور على محتوى الفاتورة', true);

  if (window.electronAPI && typeof window.electronAPI.saveReceiptPdf === 'function') {
    showToast('جاري إنشاء ملف PDF وتحديد موقع الحفظ...');
    const filename = `فاتورة_تحصيل_${receiptNo || 'إيصال'}_${Date.now()}.pdf`;
    const res = await window.electronAPI.saveReceiptPdf({
      html: area.outerHTML,
      defaultFilename: filename
    });

    if (res && res.success) {
      showToast(`✅ تم حفظ الفاتورة بنجاح كملف PDF في:\n${res.filePath}`);
    } else if (res && res.canceled) {
      // User canceled
    } else {
      showToast(`تعذر حفظ ملف الـ PDF: ${res?.error || 'خطأ أثناء المعالجة'}`, true);
    }
  } else {
    window.print();
  }
}

async function shareReceiptViaWhatsApp(receiptNo, studentName, amount, remaining, phone, centerName) {
  let targetPhone = phone;
  if (!targetPhone) {
    const input = document.getElementById('receiptWhatsAppPhoneInput');
    if (input && input.value.trim()) targetPhone = input.value.trim();
  }
  if (!targetPhone) {
    return showToast('يرجى إدخال رقم هاتف ولي الأمر (واتساب) أولاً', true);
  }
  const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => ({})) || {};
  let template = config.receiptTemplate || 'تم استلام دفعة بقيمة {amount} ج.م للطالب {studentName} لإيصال رقم {receiptNumber}. شكراً لتعاملكم مع {centerName}.';
  
  const text = template
    .replace(/{studentName}/g, studentName)
    .replace(/{amount}/g, amount)
    .replace(/{receiptNumber}/g, receiptNo)
    .replace(/{remainingBalance}/g, remaining)
    .replace(/{centerName}/g, centerName || 'السنتر');

  try {
    const res = await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: targetPhone,
      message: text
    });
    if (res.mode === 'api') {
      showToast('✅ تم إرسال الإيصال عبر بوابة الواتس بنجاح!');
    } else {
      openWhatsAppExternalUrl(res.appUrl || res.directUrl || res.waMeUrl);
      showToast('تم فتح محادثة الواتس لإرسال الإيصال');
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

async function autoDispatchPaymentReceiptWhatsApp(receipt, student = {}) {
  try {
    const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId });
    if (!config || !config.enabled || !config.autoSendPaymentReceipt) return;

    const guardianPhone = student.guardianPhone || student.parentPhone || receipt.studentPhone;
    if (!guardianPhone) return;

    const studentName = receipt.studentName || student.name || 'الطالب';
    let text = config.receiptTemplate || 'تم استلام دفعة بقيمة {amount} ج.م للطالب {studentName} لإيصال رقم {receiptNumber}. شكراً لتعاملكم مع {centerName}.';
    text = text
      .replace(/{studentName}/g, studentName)
      .replace(/{amount}/g, receipt.amount)
      .replace(/{receiptNumber}/g, receipt.receiptNumber || receipt.humanNumber || receipt.id)
      .replace(/{remainingBalance}/g, receipt.remainingAfter || 0)
      .replace(/{centerName}/g, 'السنتر');

    if (receipt.discount && Number(receipt.discount) > 0) {
      text += `\n🏷️ تم تطبيق خصم: ${receipt.discount} ج.م${receipt.discountReason ? ` (${receipt.discountReason})` : ''} — من أصل ${receipt.originalAmount || (Number(receipt.amount) + Number(receipt.discount))} ج.م`;
    }

    await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: guardianPhone,
      message: text
    });
    addNotificationAlert('واتس آب: إيصال سداد', `تم إرسال إيصال السداد للطالب ${studentName} لولي أمره.`, 'payment');
  } catch (e) {
    console.warn('[WhatsApp] Auto receipt dispatch failed:', e.message);
  }
}

async function autoDispatchAttendanceWhatsApp(scanPayload) {
  try {
    const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId });
    if (!config || !config.enabled || !config.autoSendAttendance) return;

    const student = scanPayload.student || {};
    const guardianPhone = student.guardianPhone || student.parentPhone;
    if (!guardianPhone) return;

    const studentName = student.name || 'الطالب';
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const date = new Date().toISOString().split('T')[0];
    
    let text = config.attendanceTemplate || 'عزيزي ولي أمر الطالب {studentName}، تم بحمد الله تسجيل حضور الطالب السنتر لمادة {subjectName} (مجموعة {groupName}) اليوم {date} الساعة {time}.';
    text = text
      .replace(/{studentName}/g, studentName)
      .replace(/{date}/g, date)
      .replace(/{time}/g, time)
      .replace(/{subjectName}/g, scanPayload.subjectName || 'الحصة الدراسية')
      .replace(/{groupName}/g, scanPayload.groupName || 'المجموعة');

    await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: guardianPhone,
      message: text
    });
    addNotificationAlert('واتس آب: حضور الطالب', `تم إرسال إشعار حضور الطالب ${studentName} لولي أمره بنجاح.`, 'attendance');
  } catch (e) {
    console.warn('[WhatsApp] Auto attendance dispatch failed:', e.message);
  }
}

async function autoDispatchAbsenceWhatsApp(payload) {
  try {
    const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => null);
    if (!config || !config.enabled || !config.autoSendAbsence) return;

    let guardianPhone = payload.guardianPhone;
    let studentName = payload.studentName;

    if (!guardianPhone && payload.studentId) {
      const student = await callBackend('getStudentById', currentCallerToken, payload.studentId).catch(() => null);
      if (student) {
        guardianPhone = student.guardianPhone || student.parentPhone;
        if (!studentName) studentName = student.name;
      }
    }
    if (!guardianPhone) return;

    const date = payload.date || new Date().toISOString().split('T')[0];
    let text = config.absenceTemplate || 'تنبيه غياب: نود إحاطتكم بتغيب الطالب {studentName} عن حصة {subjectName} المقررة اليوم {date}.';
    text = text
      .replace(/{studentName}/g, studentName || 'الطالب')
      .replace(/{subjectName}/g, payload.subjectName || 'الحصة الدراسية')
      .replace(/{groupName}/g, payload.groupName || 'المجموعة')
      .replace(/{date}/g, date)
      .replace(/{centerName}/g, 'السنتر');

    await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: guardianPhone,
      message: text
    });
    addNotificationAlert('واتس آب: تنبيه غياب ⚠️', `تم إرسال تنبيه غياب الطالب ${studentName} لولي أمره.`, 'warning');
  } catch (e) {
    console.warn('[WhatsApp] Auto absence dispatch failed:', e.message);
  }
}

async function autoDispatchExamGradeWhatsApp(payload) {
  try {
    const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => null);
    if (!config || !config.enabled || !config.autoSendExamResult) return;

    let guardianPhone = payload.guardianPhone;
    let studentName = payload.studentName;

    if (!guardianPhone && payload.studentId) {
      const student = await callBackend('getStudentById', currentCallerToken, payload.studentId).catch(() => null);
      if (student) {
        guardianPhone = student.guardianPhone || student.parentPhone;
        if (!studentName) studentName = student.name;
      }
    }
    if (!guardianPhone) return;

    const score = Number(payload.score) || 0;
    const maxScore = Number(payload.maxScore) || 100;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    let grade = 'مقبول';
    if (percentage >= 85) grade = 'ممتاز 🌟';
    else if (percentage >= 75) grade = 'جيد جداً 👏';
    else if (percentage >= 65) grade = 'جيد 👍';
    else if (percentage < 50) grade = 'يحتاج إلى متابعة ⚠️';

    let text = config.examResultTemplate || 'تهانينا! تم رصد نتيجة اختبار {examTitle} للطالب {studentName} بمادة {subjectName}: الدرجة {score}/{totalScore} بنسبة {percentage}%. التقدير: {grade}.';
    text = text
      .replace(/{studentName}/g, studentName || 'الطالب')
      .replace(/{examTitle}/g, payload.examTitle || 'الاختبار الدوري')
      .replace(/{subjectName}/g, payload.subjectName || 'المادة الدراسية')
      .replace(/{score}/g, score)
      .replace(/{totalScore}/g, maxScore)
      .replace(/{percentage}/g, percentage)
      .replace(/{grade}/g, grade)
      .replace(/{centerName}/g, 'السنتر');

    await callBackend('sendWhatsAppMessage', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      phone: guardianPhone,
      message: text
    });
    addNotificationAlert('واتس آب: نتيجة اختبار 📝', `تم إرسال نتيجة اختبار ${payload.examTitle || ''} للطالب ${studentName} بنجاح.`, 'attendance');
  } catch (e) {
    console.warn('[WhatsApp] Auto exam grade dispatch failed:', e.message);
  }
}

let _scheduledWhatsAppWorkerTimer = null;
let _lastWhatsAppReminderDate = null;

function startScheduledWhatsAppWorker() {
  if (_scheduledWhatsAppWorkerTimer) {
    clearInterval(_scheduledWhatsAppWorkerTimer);
    _scheduledWhatsAppWorkerTimer = null;
  }

  // Periodic worker checking rules every 10 minutes
  _scheduledWhatsAppWorkerTimer = setInterval(async () => {
    try {
      if (!currentCallerToken || !currentCallerToken.institutionId) return;
      const config = await callBackend('getWhatsAppConfig', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => null);
      if (!config || !config.enabled || !config.autoSendPaymentDueReminder) return;

      const now = new Date();
      const currentHour = now.getHours();
      const scheduledHour = Number(config.scheduleReminderHour || 10);
      const todayDateStr = now.toISOString().split('T')[0];

      // Dispatch dues reminders once per day when current hour >= scheduledHour
      if (currentHour >= scheduledHour && _lastWhatsAppReminderDate !== todayDateStr) {
        _lastWhatsAppReminderDate = todayDateStr;
        console.log('[WhatsApp Worker] Executing scheduled student dues reminder for date:', todayDateStr);

        const duesResult = await callBackend('calcAccruedStudentDues', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => null);
        if (!duesResult || !Array.isArray(duesResult.studentsBreakdown)) return;

        const studentsWithDues = duesResult.studentsBreakdown.filter(s => s.netDue > 0 && (s.guardianPhone || s.studentPhone));
        let sentCount = 0;

        for (const st of studentsWithDues) {
          const targetPhone = st.guardianPhone || st.studentPhone;
          if (!targetPhone) continue;

          const firstGrp = (st.groupsBreakdown && st.groupsBreakdown.length) ? st.groupsBreakdown[0] : {};
          let text = config.dueReminderTemplate || 'تذكير بموعد السداد: نود تذكير سيادتكم بقرب موعد تسديد مصروفات الطالب {studentName} لمادة {subjectName}. المبلغ المستحق: {dueAmount} ج.م.';
          text = text
            .replace(/{studentName}/g, st.studentName || 'الطالب')
            .replace(/{guardianName}/g, st.guardianName || 'ولي الأمر')
            .replace(/{subjectName}/g, firstGrp.subjectName || 'المواد الدراسية')
            .replace(/{dueAmount}/g, st.netDue)
            .replace(/{centerName}/g, 'السنتر');

          await callBackend('sendWhatsAppMessage', currentCallerToken, {
            institutionId: currentCallerToken.institutionId,
            phone: targetPhone,
            message: text
          }).catch(err => console.warn('[WhatsApp Worker] Failed for', st.studentName, err.message));

          sentCount++;
          // Rate-limiting delay between background automated dispatches
          await new Promise(r => setTimeout(r, 600));
        }

        if (sentCount > 0) {
          addNotificationAlert(
            'جدولة الواتس آب: تذكير المصروفات ⏰',
            `تم بنجاح إرسال تذكير المصروفات التلقائي لعدد (${sentCount}) من أولياء الأمور والطلاب المستحق عليهم مبالغ مالية.`,
            'payment'
          );
        }
      }
    } catch (workerErr) {
      console.warn('[WhatsApp Worker] Background worker error:', workerErr.message);
    }
  }, 10 * 60 * 1000);
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
  if (!list || list.length === 0) {
    return `
      <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
        <div style="font-size:2.5rem; margin-bottom:0.5rem; opacity:0.8;">💳</div>
        <div style="font-weight:600; color:#94a3b8; font-size:0.95rem; margin-bottom:0.3rem;">لا توجد مدفوعات مسجلة مؤخراً</div>
        <div style="font-size:0.8rem; color:#64748b; margin-bottom:1rem;">قم بتسجيل عمليات تحصيل الرسوم ومصروفات المواد للمجموعات الدراسية</div>
        <button class="btn btn-success" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="openRecordPaymentModal()">+ تسجيل تحصيل جديد</button>
      </div>
    `;
  }
  return `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr style="background:rgba(30,41,59,0.7);">
            <th>رقم الإيصال</th>
            <th>الطالب</th>
            <th>البيان</th>
            <th>المبلغ المحصل</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => {
            const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-EG') : (p.date || '—');
            const receipt = p.receiptNumber || p.id || '—';
            return `
              <tr>
                <td><span class="code-box" style="font-size:0.78rem; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25);">${escapeHtmlAttr(receipt)}</span></td>
                <td><strong style="color:#f1f5f9;">${escapeHtmlAttr(p.studentName || 'طالب غير محدد')}</strong></td>
                <td><span style="font-size:0.82rem; color:#cbd5e1; background:#1e293b; padding:0.2rem 0.5rem; border-radius:4px; border:1px solid #334155;">${escapeHtmlAttr(p.category || 'رسوم دراسية')}</span></td>
                <td>
                  <span style="color:#4ade80; font-weight:800; font-size:0.95rem; background:rgba(34,197,94,0.1); padding:0.25rem 0.55rem; border-radius:6px; border:1px solid rgba(34,197,94,0.25);">${fmtMoney(p.amount)}</span>
                  ${p.discount && Number(p.discount) > 0 ? `
                    <span class="badge" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); font-size:0.72rem; margin-right:0.35rem;" title="خصم: ${p.discount} ج.م ${p.discountReason ? `(${escapeHtmlAttr(p.discountReason)})` : ''}">
                      خصم -${fmtMoney(p.discount)}
                    </span>
                  ` : ''}
                </td>
                <td style="color:#94a3b8; font-size:0.8rem;">${dateStr}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAttendanceTable(list) {
  if (!list || list.length === 0) {
    return `
      <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
        <div style="font-size:2.5rem; margin-bottom:0.5rem; opacity:0.8;">⏱️</div>
        <div style="font-weight:600; color:#94a3b8; font-size:0.95rem; margin-bottom:0.3rem;">لا توجد سجلات حضور لليوم</div>
        <div style="font-size:0.8rem; color:#64748b; margin-bottom:1rem;">استخدم قارئ الباركود أو التسجيل اليدوي لتسجيل حضور الطلاب</div>
        <button class="btn" style="background:#0284c7; font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="navigate('attendance')">📋 فتح شاشة الحضور</button>
      </div>
    `;
  }
  return `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr style="background:rgba(30,41,59,0.7);">
            <th>الطالب</th>
            <th>وقت التسجيل</th>
            <th>الحالة</th>
            <th>طريقة التسجيل</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(a => {
            const isPresent = (a.status || '').includes('حاضر') || a.status === 'present';
            const isLate = (a.status || '').includes('متأخر') || a.status === 'late';
            const badgeColor = isPresent ? 'background:#064e3b; color:#86efac; border:1px solid #10b981;' : (isLate ? 'background:#7c2d12; color:#fdba74; border:1px solid #f97316;' : 'background:#7f1d1d; color:#fca5a5; border:1px solid #ef4444;');
            const methodIcon = (a.method || '').includes('كارت') || (a.method || '').includes('باركود') ? '🪪 باركود' : '✍️ يدوي';
            return `
              <tr>
                <td><strong style="color:#f1f5f9;">${escapeHtmlAttr(a.studentName || a.studentId || '—')}</strong></td>
                <td style="color:#38bdf8; font-size:0.85rem; font-weight:600;">⏱️ ${escapeHtmlAttr(a.time || '—')}</td>
                <td><span class="badge" style="${badgeColor}">${escapeHtmlAttr(a.status || 'حاضر')}</span></td>
                <td style="color:#94a3b8; font-size:0.82rem;">${methodIcon}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
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
    b = await callBackend('getBranding', currentCallerToken, currentCallerToken.institutionId) || {};
  } catch (e) {
    b = {
      centerName: 'سنتر التفوق التعليمي',
      colors: { primary: '#0F172A', secondary: '#0284C7', accent: '#D97706', backgroundColor: '#FFFFFF' },
      loginTitle: 'مرحباً بكم في المنظومة التعليمية',
      loginSubtitle: 'منظومة المتابعة والإدارة',
      welcomeMessage: 'إدارة أذكى.. تعليم أفضل'
    };
  }

  try {
    const local = localStorage.getItem('remas_branding_' + currentCallerToken.institutionId);
    if (local) {
      const parsed = JSON.parse(local);
      b = { ...b, ...parsed };
    }
  } catch (_) {}

  window._currentBrandingLogoUrl = b.logoUrl || null;

  container.innerHTML = `
    <div class="view-title">
      <span>🎨 الهوية والعلامة التجارية للسنتر (White-Label Branding)</span>
      <span class="badge" style="background:#0284C7; color:#fff;">REMAS EDU Platform</span>
    </div>
    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title">تخصيص هوية السنتر البصرية</div>
        <form onsubmit="event.preventDefault(); saveBrandingAction();">
          <div class="form-group">
            <label>اسم السنتر أو الأكاديمية (يظهر في الشريط العلوي وشاشة الدخول): *</label>
            <input type="text" id="brandCenterName" value="${escapeHtmlAttr(b.centerName || '')}" required placeholder="مثال: سنتر اللؤلؤة التعليمي أو أكاديمية الرواد" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="updateLivePreview()">
          </div>
          <div class="form-group" style="display:flex; gap:1rem;">
            <div style="flex:1;">
              <label>اللون الرئيسي (Primary):</label>
              <input type="color" id="brandPrimaryColor" value="${b.colors ? b.colors.primary : (b.primaryColor || '#0F172A')}" style="width:100%; height:40px; padding:2px; cursor:pointer; background:#1e293b; border:1px solid #334155; border-radius:6px;" onchange="updateLivePreview()">
            </div>
            <div style="flex:1;">
              <label>اللون الثانوي (Secondary):</label>
              <input type="color" id="brandSecondaryColor" value="${b.colors ? b.colors.secondary : (b.secondaryColor || '#0284C7')}" style="width:100%; height:40px; padding:2px; cursor:pointer; background:#1e293b; border:1px solid #334155; border-radius:6px;" onchange="updateLivePreview()">
            </div>
            <div style="flex:1;">
              <label>لون التمييز (Accent):</label>
              <input type="color" id="brandAccentColor" value="${b.colors ? b.colors.accent : (b.accentColor || '#D97706')}" style="width:100%; height:40px; padding:2px; cursor:pointer; background:#1e293b; border:1px solid #334155; border-radius:6px;" onchange="updateLivePreview()">
            </div>
          </div>
          <div class="form-group">
            <label>عنوان شاشة الدخول:</label>
            <input type="text" id="brandLoginTitle" value="${escapeHtmlAttr(b.loginTitle || '')}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="updateLivePreview()">
          </div>
          <div class="form-group">
            <label>الوصف الفرعي لشاشة الدخول:</label>
            <input type="text" id="brandLoginSubtitle" value="${escapeHtmlAttr(b.loginSubtitle || '')}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="updateLivePreview()">
          </div>
          <div class="form-group">
            <label>رسالة الترحيب:</label>
            <input type="text" id="brandWelcomeMessage" value="${escapeHtmlAttr(b.welcomeMessage || '')}" style="width:100%; padding:0.65rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" oninput="updateLivePreview()">
          </div>
          <div class="form-group">
            <label>شعار السنتر الرسمي (يظهر في الشريط العلوي وشاشة الدخول):</label>
            <input type="file" id="brandLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="width:100%; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" onchange="previewLogoFile(this)">
            <div id="logoPreviewHolder" style="margin-top:0.5rem; ${b.logoUrl ? '' : 'display:none;'}">
              <img id="logoPreviewImg" src="${b.logoUrl || ''}" alt="الشعار الحالي" style="max-height:65px; max-width:200px; border-radius:8px; background:#fff; padding:5px; box-shadow:0 2px 10px rgba(0,0,0,0.3);">
            </div>
          </div>
          <button type="submit" class="btn btn-success" id="btnSaveBranding" style="width:100%; padding:0.8rem; font-size:1rem; font-weight:bold; margin-top:1rem; box-shadow:0 4px 12px rgba(34,197,94,0.3);">💾 حفظ الهوية وتفعيل التغييرات بالسنتر</button>
        </form>
      </div>

      <div class="card" style="box-shadow:0 8px 20px -4px rgba(0,0,0,0.3);">
        <div class="card-title">معاينة حية لشاشة تسجيل الدخول والهوية</div>
        <div id="brandingLivePreview" style="background:#0a192f; border:2px solid #0284c7; border-radius:12px; padding:1.75rem; text-align:center; color:#fff;">
          <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.75rem;">REMAS EDU PLATFORM IDENTITY</div>
          <div id="previewLogoBox" style="margin-bottom:0.75rem; ${b.logoUrl ? '' : 'display:none;'}">
            <img id="previewLogoImg" src="${b.logoUrl || ''}" alt="Logo" style="max-height:55px; border-radius:6px; background:#fff; padding:4px;">
          </div>
          <div id="previewCenterName" style="font-size:1.45rem; font-weight:800; color:#38bdf8; margin-bottom:0.5rem;">${escapeHtmlAttr(b.centerName || 'اسم السنتر')}</div>
          <div id="previewLoginTitle" style="font-size:1.15rem; font-weight:700; margin-bottom:0.25rem;">${escapeHtmlAttr(b.loginTitle || 'عنوان شاشة الدخول')}</div>
          <div id="previewLoginSubtitle" style="font-size:0.85rem; color:#94a3b8; margin-bottom:1.25rem;">${escapeHtmlAttr(b.loginSubtitle || 'الوصف الفرعي')}</div>
          <div id="previewWelcome" style="background:#0f172a; padding:0.85rem; border-radius:8px; border-right:4px solid #d97706; font-size:0.92rem; margin-bottom:1.25rem;">
            ${escapeHtmlAttr(b.welcomeMessage || 'إدارة أذكى.. تعليم أفضل')}
          </div>
          <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
            <button id="previewBtnPrimary" style="background:#0f172a; color:#fff; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:bold;">الزر الرئيسي</button>
            <button id="previewBtnSecondary" style="background:#0284c7; color:#fff; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:bold;">الزر الثانوي</button>
            <button id="previewBtnAccent" style="background:#d97706; color:#fff; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:bold;">تمييز</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function previewLogoFile(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      window._currentBrandingLogoUrl = e.target.result;
      const prev = document.getElementById('logoPreviewHolder');
      const img = document.getElementById('logoPreviewImg');
      const box = document.getElementById('previewLogoBox');
      const boxImg = document.getElementById('previewLogoImg');
      if (prev && img) {
        img.src = e.target.result;
        prev.style.display = 'block';
      }
      if (box && boxImg) {
        boxImg.src = e.target.result;
        box.style.display = 'block';
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function updateLivePreview() {
  const name = document.getElementById('brandCenterName')?.value || 'اسم السنتر';
  const primary = document.getElementById('brandPrimaryColor')?.value || '#0F172A';
  const secondary = document.getElementById('brandSecondaryColor')?.value || '#0284C7';
  const accent = document.getElementById('brandAccentColor')?.value || '#D97706';
  const title = document.getElementById('brandLoginTitle')?.value || 'عنوان الدخول';
  const subtitle = document.getElementById('brandLoginSubtitle')?.value || 'الوصف الفرعي';
  const welcome = document.getElementById('brandWelcomeMessage')?.value || 'رسالة الترحيب';

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
  const btn = document.getElementById('btnSaveBranding');
  const centerName = document.getElementById('brandCenterName')?.value || '';
  const primaryColor = document.getElementById('brandPrimaryColor')?.value || '#0F172A';
  const secondaryColor = document.getElementById('brandSecondaryColor')?.value || '#0284C7';
  const accentColor = document.getElementById('brandAccentColor')?.value || '#D97706';
  const loginTitle = document.getElementById('brandLoginTitle')?.value || '';
  const loginSubtitle = document.getElementById('brandLoginSubtitle')?.value || '';
  const welcomeMessage = document.getElementById('brandWelcomeMessage')?.value || '';

  if (btn) btn.disabled = true;

  try {
    let logoUrl = window._currentBrandingLogoUrl || null;
    const fileInput = document.getElementById('brandLogoFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        showToast('حجم الشعار كبير — يرجى اختيار صورة أقل من 2 ميجابايت', true);
        if (btn) btn.disabled = false;
        return;
      }
      logoUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      window._currentBrandingLogoUrl = logoUrl;
    }

    const payload = {
      institutionId: currentCallerToken.institutionId,
      centerName,
      primaryColor,
      secondaryColor,
      accentColor,
      loginTitle,
      loginSubtitle,
      welcomeMessage,
      logoUrl
    };

    await callBackend('updateBranding', currentCallerToken, payload);

    try {
      localStorage.setItem('remas_branding_' + currentCallerToken.institutionId, JSON.stringify(payload));
      localStorage.setItem('remas_active_branding', JSON.stringify(payload));
    } catch (_) {}

    applyBrandingToUI(payload);
    showToast('تم حفظ وتحديث هوية السنتر بنجاح!');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
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
        <div class="form-group"><label>سعر المادة (جنيه شهرياً) *</label><input type="number" id="mSubjPrice" min="0" step="1" value="150" placeholder="150"></div>
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
  const price = Math.max(0, Number(document.getElementById('mSubjPrice')?.value || 0));
  const code = document.getElementById('mSubjCode').value;
  try {
    const res = await callBackend('createSubject', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      academicYearId,
      stageId,
      name,
      price,
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
        <div class="form-group"><label>سعر المادة (جنيه شهرياً) *</label><input type="number" id="mEditSubjPrice" min="0" step="1" value="${subject.price !== undefined ? subject.price : 0}"></div>
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
  const price = Math.max(0, Number(document.getElementById('mEditSubjPrice')?.value || 0));
  const code = document.getElementById('mEditSubjCode').value;
  try {
    await callBackend('updateSubject', currentCallerToken, id, {
      institutionId: currentCallerToken.institutionId,
      academicYearId,
      stageId,
      name,
      price,
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
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري تحميل ملف الطالب الشامل (360° Profile)...</p></div></div>';
  try {
    const [student, groups, years, stages, subjects, teachers, rooms, attendance, payments, dues] = await Promise.all([
      callBackend('getStudentById', currentCallerToken, studentId, currentCallerToken.institutionId),
      callBackend('getStudentGroups', currentCallerToken, studentId, currentCallerToken.institutionId).catch(() => []) || [],
      callBackend('getAcademicYears', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getStages', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getSubjects', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getRooms', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getAttendanceRecords', currentCallerToken, { studentId, institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('getPayments', currentCallerToken, { studentId, institutionId: currentCallerToken.institutionId }).catch(() => []) || [],
      callBackend('calcAccruedStudentDues', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => null)
    ]);

    const yearMap = new Map(years.map(y => [y.id, y.name]));
    const stageMap = new Map(stages.map(s => [s.id, s.name]));
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const teacherMap = new Map(teachers.map(t => [t.id, t.fullName || t.name]));
    const roomMap = new Map(rooms.map(r => [r.id, r.name]));

    const stDues = (dues?.studentsBreakdown || []).find(s => s.studentId === student.id) || {
      attendedSessionsCount: attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
      totalAccrued: 0,
      totalPaid: (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      netDue: 0
    };

    const totalPaid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const attendedCount = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const absentCount = attendance.filter(a => a.status === 'ABSENT').length;
    const totalSessions = attendedCount + absentCount;
    const attendanceRate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

    const guardianPhone = student.guardianPhone || student.parentPhone || student.phone || '';
    const guardianName = student.guardianName || student.parentName || 'ولي الأمر';

    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:780px; max-height:90vh; overflow-y:auto; background:#0f172a; border:1px solid #38bdf8;">
        <!-- Header Banner -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:1rem; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:0.9rem;">
            <div style="width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:bold;">
              ${(student.name || 'ط').charAt(0)}
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <h2 style="margin:0; font-size:1.35rem; color:#f8fafc; font-weight:800;">${escapeHtmlAttr(student.name)}</h2>
                <span class="code-box" style="color:#38bdf8;">#${student.studentCode || student.id}</span>
                ${student.isVip ? '<span class="badge" style="background:#4c1d95; color:#c084fc; border:1px solid #7c3aed;">⭐ VIP AI</span>' : ''}
              </div>
              <div style="color:#94a3b8; font-size:0.82rem; margin-top:0.2rem;">
                ${escapeHtmlAttr(stageMap.get(student.stageId) || student.stage || 'مرحلة دراسية')} | ${escapeHtmlAttr(yearMap.get(student.academicYearId) || 'عام دراسي')}
              </div>
            </div>
          </div>
          <button class="btn" style="background:#475569; padding:0.3rem 0.7rem;" onclick="closeModal()">✖️</button>
        </div>

        <!-- Metric KPI Cards -->
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border-right:3px solid #22c55e;">
            <span style="font-size:0.75rem; color:#94a3b8; display:block;">نسبة الحضور</span>
            <strong style="font-size:1.25rem; color:#4ade80;">${attendanceRate}%</strong>
            <small style="color:#64748b; display:block; font-size:0.7rem;">${attendedCount} حضور / ${absentCount} غياب</small>
          </div>
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border-right:3px solid #0284c7;">
            <span style="font-size:0.75rem; color:#94a3b8; display:block;">إجمالي المسدد</span>
            <strong style="font-size:1.25rem; color:#38bdf8;">${fmtMoney(totalPaid)}</strong>
            <small style="color:#64748b; display:block; font-size:0.7rem;">${payments.length} إيصالات</small>
          </div>
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border-right:3px solid ${stDues.netDue > 0 ? '#ef4444' : '#22c55e'};">
            <span style="font-size:0.75rem; color:#94a3b8; display:block;">المستحق المطلوب</span>
            <strong style="font-size:1.25rem; color:${stDues.netDue > 0 ? '#f87171' : '#4ade80'};">${fmtMoney(stDues.netDue)}</strong>
            <small style="color:#64748b; display:block; font-size:0.7rem;">حسب الحصص المحضورة</small>
          </div>
          <div style="background:#1e293b; padding:0.75rem; border-radius:8px; border-right:3px solid #8b5cf6;">
            <span style="font-size:0.75rem; color:#94a3b8; display:block;">المساعد الذكي VIP</span>
            <strong style="font-size:1.25rem; color:#c084fc;">${student.aiQuestionsBalance || 0}</strong>
            <small style="color:#64748b; display:block; font-size:0.7rem;">سؤال متبقي بالرصيد</small>
          </div>
        </div>

        <!-- 2 Columns Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem; margin-bottom:1rem;">
          <!-- Basic & Parent Info -->
          <div class="card" style="margin:0; padding:1rem; box-shadow:none; border:1px solid #334155;">
            <div class="card-title" style="margin-bottom:0.6rem;">📱 بيانات الاتصال وولي الأمر</div>
            <p style="margin:0 0 0.4rem 0;"><strong>هاتف الطالب:</strong> <span class="code-box">${student.phone || '-'}</span></p>
            <p style="margin:0 0 0.4rem 0;"><strong>ولي الأمر:</strong> ${escapeHtmlAttr(guardianName)}</p>
            <p style="margin:0 0 0.4rem 0;"><strong>هاتف ولي الأمر:</strong> <span class="code-box">${guardianPhone || '-'}</span></p>
            <p style="margin:0 0 0.4rem 0;"><strong>كود QR الحضور:</strong> <span class="code-box" style="font-size:0.8rem;">${student.qrToken || ('QR_' + student.id)}</span></p>
            ${guardianPhone ? `
              <div style="margin-top:0.75rem;">
                <button class="btn btn-success" style="padding:0.35rem 0.75rem; font-size:0.8rem; width:100%; display:flex; justify-content:center; align-items:center; gap:0.35rem;" onclick="window.open('https://web.whatsapp.com/send?phone=20${guardianPhone.replace(/\\D/g,'').replace(/^0+/,'')}', '_blank')">
                  <span>💬 محادثة واتساب فورية مع ولي الأمر</span>
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Academic & Groups -->
          <div class="card" style="margin:0; padding:1rem; box-shadow:none; border:1px solid #334155;">
            <div class="card-title" style="margin-bottom:0.6rem;">📚 المجموعات المسجل بها (${groups.length})</div>
            ${groups.length ? `
              <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:160px; overflow-y:auto;">
                ${groups.map(g => `
                  <div style="background:#0f172a; padding:0.45rem 0.65rem; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong style="color:#f8fafc; font-size:0.85rem;">${escapeHtmlAttr(g.name)}</strong>
                      <div style="color:#94a3b8; font-size:0.72rem;">${escapeHtmlAttr(subjectMap.get(g.subjectId) || g.subjectName || '-')} — ${escapeHtmlAttr(teacherMap.get(g.teacherId) || '-')}</div>
                    </div>
                    <span style="color:#38bdf8; font-weight:bold; font-size:0.8rem;">${fmtMoney(g.price || 200)}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p style="color:#94a3b8; font-size:0.85rem;">الطالب غير مسجل في أي مجموعة حالياً.</p>'}
          </div>
        </div>

        <!-- Financial Receipts History -->
        <div class="card" style="margin:0 0 1rem 0; padding:1rem; box-shadow:none; border:1px solid #334155;">
          <div class="card-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span>💳 سجل إيصالات المدفوعات الأخيرة (${payments.length})</span>
            <button class="btn btn-success" style="padding:0.25rem 0.65rem; font-size:0.75rem;" onclick="closeModal(); openRecordPaymentModal(); setTimeout(() => { const ni = document.getElementById('mPayStudentName'); if (ni) ni.value = '${escapeHtmlAttr(student.name)}'; const ai = document.getElementById('mPayAmount'); if (ai && ${stDues.netDue > 0}) ai.value = ${stDues.netDue}; }, 200);">
              💳 + تحصيل نقدية الآن
            </button>
          </div>
          ${payments.length ? `
            <div style="max-height:140px; overflow-y:auto;">
              <table class="data-table" style="font-size:0.82rem;">
                <thead><tr><th>رقم الإيصال</th><th>التاريخ</th><th>البند</th><th>المبلغ</th><th>معاينة</th></tr></thead>
                <tbody>
                  ${payments.slice(0, 5).map(p => `
                    <tr>
                      <td><span class="code-box" style="color:#38bdf8;">${escapeHtmlAttr(p.humanReceiptNumber || p.receiptNumber || p.id)}</span></td>
                      <td>${p.paymentDate || '—'}</td>
                      <td>${escapeHtmlAttr(p.category || 'مصاريف')}</td>
                      <td style="color:#4ade80; font-weight:bold;">
                        ${fmtMoney(p.amount)}
                        ${p.discount && Number(p.discount) > 0 ? `<small class="badge" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); font-size:0.68rem; margin-right:0.25rem;">خصم -${fmtMoney(p.discount)}</small>` : ''}
                      </td>
                      <td>
                        <button class="btn btn-primary" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="openReceiptPreviewModal(${escapeHtmlAttr(JSON.stringify(p))}, ${escapeHtmlAttr(JSON.stringify(student))})">
                          🧾 طباعة
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p style="color:#94a3b8; font-size:0.85rem;">لا توجد إيصالات مدفوعات مسجلة لهذا الطالب حتى الآن.</p>'}
        </div>

        <!-- Action Footer -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.75rem; border-top:1px solid #334155;">
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-warning" style="padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="openRedeemVoucherModal(''); setTimeout(() => { const si = document.getElementById('mRedeemStudentId'); if (si) si.value = '${student.id}'; }, 200);">
              🎟️ شحن كود VIP ذكي
            </button>
            <button class="btn" style="background:#475569; padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="openStudentGroupsModal('${student.id}')">
              إدارة المجموعات
            </button>
            <button class="btn" style="background:#334155; padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="openEditStudentModal('${student.id}')">
              تعديل البيانات
            </button>
          </div>
          <button class="btn btn-primary" style="padding:0.45rem 1.2rem;" onclick="closeModal()">إغلاق النافذة</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

async function showStudentPinModal(studentId) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري جلب بيانات الدخول...</p></div></div>';
  try {
    const student = await callBackend('getStudentById', currentCallerToken, studentId, currentCallerToken.institutionId);
    const pinDisplay = student.tempPassword || 'تم تعيين كلمة مرور خاصة بالطالب';
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:480px;">
        <div class="modal-header">🔑 بيانات دخول الطالب — تطبيق الهاتف</div>
        <div style="background:#0f172a; padding:1.2rem; border-radius:10px; margin-bottom:1rem; border:1px solid #334155;">
          <p style="margin:0 0 0.5rem 0;"><strong>اسم الطالب:</strong> ${escapeHtmlAttr(student.name)}</p>
          <p style="margin:0 0 0.5rem 0;"><strong>رقم هاتف الدخول:</strong> <span class="code-box">${student.phone || student.normalizedPhone}</span></p>
          <p style="margin:0 0 0.5rem 0;"><strong>الرقم السري الابتدائي (PIN):</strong> <span class="code-box" style="font-size:1.3rem; color:#38bdf8; font-weight:bold; letter-spacing:2px;">${pinDisplay}</span></p>
          <p style="margin:0; font-size:0.8rem; color:#94a3b8;">يدخل الطالب برقم هاتفه وهذا الرقم السري، ثم يُجبر تلقائياً على إنشاء كلمة مروره الخاصة عند أول دخول.</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-warning" onclick="doResetStudentPinAction('${student.id}')">🔄 إعادة تعيين الـ PIN الآن</button>
          <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>`;
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function doResetStudentPinAction(studentId) {
  if (!confirm('هل تريد فعلاً إعادة تعيين الرقم السري لهذا الطالب؟ سيتم توليد PIN جديد وإجبار الطالب على تعديله فور تسجيل الدخول.')) return;
  try {
    const res = await callBackend('resetStudentPassword', currentCallerToken, { studentId });
    alert(`✅ تم إعادة تعيين الرقم السري بنجاح!\nالرقم السري الجديد هو: ${res.pin}\nيُرجى تسليمه للطالب.`);
    showStudentPinModal(studentId);
    renderStudentsView(document.getElementById('mainView'));
  } catch (err) {
    alert('فشل إعادة تعيين الرقم السري: ' + (err.message || err));
  }
}

async function showTeacherPinModal(teacherId, overridePin = null) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="color:#94a3b8;">جاري جلب بيانات الدخول...</p></div></div>';
  try {
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const teacher = teachers.find(t => t.id === teacherId) || await callBackend('getTeacherById', currentCallerToken, teacherId, currentCallerToken.institutionId);
    const pinDisplay = overridePin || teacher.tempPassword || 'تم تعيين كلمة مرور خاصة بالمعلم';
    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:480px;">
        <div class="modal-header">🔑 بيانات دخول المعلم — تطبيق المعلم</div>
        <div style="background:#0f172a; padding:1.2rem; border-radius:10px; margin-bottom:1rem; border:1px solid #334155;">
          <p style="margin:0 0 0.5rem 0;"><strong>اسم المعلم:</strong> ${escapeHtmlAttr(teacher.fullName || teacher.name)}</p>
          <p style="margin:0 0 0.5rem 0;"><strong>رقم هاتف الدخول:</strong> <span class="code-box">${teacher.phone || teacher.normalizedPhone}</span></p>
          <p style="margin:0 0 0.5rem 0;"><strong>الرقم السري الابتدائي (PIN):</strong> <span class="code-box" style="font-size:1.3rem; color:#38bdf8; font-weight:bold; letter-spacing:2px;">${pinDisplay}</span></p>
          <p style="margin:0; font-size:0.8rem; color:#94a3b8;">يدخل المعلم برقم هاتفه وهذا الرقم السري، ثم يُجبر تلقائياً على إنشاء كلمة مروره الخاصة عند أول دخول.</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
          <button class="btn btn-warning" onclick="doResetTeacherPinAction('${teacher.id}')">🔄 إعادة تعيين الـ PIN الآن</button>
          ${overridePin || teacher.tempPassword ? `<button class="btn" style="background:#10b981; color:#fff;" onclick="copyTeacherCredentials('${escapeHtmlAttr(teacher.fullName || teacher.name)}', '${teacher.phone || teacher.normalizedPhone}', '${pinDisplay}', '${teacher.teacherCode || teacher.id}')">📋 نسخ</button>` : ''}
          <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>`;
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function doResetTeacherPinAction(teacherId) {
  if (!confirm('هل تريد فعلاً إعادة تعيين الرقم السري لهذا المعلم؟ سيتم توليد PIN جديد وإجبار المعلم على تعديله فور تسجيل الدخول.')) return;
  try {
    const res = await callBackend('resetTeacherPassword', currentCallerToken, { teacherId });
    alert(`✅ تم إعادة تعيين الرقم السري بنجاح!\nالرقم السري الجديد هو: ${res.pin}\nيُرجى تسليمه للمعلم.`);
    showTeacherPinModal(teacherId, res.pin);
    renderTeachersView(document.getElementById('mainView'));
  } catch (err) {
    alert('فشل إعادة تعيين الرقم السري: ' + (err.message || err));
  }
}

function copyTeacherCredentials(name, phone, pin, code) {
  const text = `بيانات الدخول لتطبيق المعلم:\n• اسم المعلم: ${name}\n• كود المعلم: ${code}\n• رقم الهاتف: ${phone}\n• الرقم السري المؤقت (PIN): ${pin}\n\nيرجى فتح تطبيق المعلم والدخول برقم الهاتف والـ PIN أعلاه، وسيطلب منك التطبيق إنشاء كلمة مرور جديدة خاصة بك.`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    showToast('تم نسخ بيانات الدخول إلى الحافظة!');
  } else {
    alert(text);
  }
}

function copyAllTeachersCredentials(results) {
  const lines = results.map(r => `${r.name} | كود: ${r.code || '-'} | هاتف: ${r.phone} | PIN: ${r.pin}`).join('\n');
  const fullText = `قائمة بيانات دخول المعلمين:\n-------------------------\n${lines}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(fullText);
    showToast('تم نسخ جميع الحسابات إلى الحافظة!');
  } else {
    alert(fullText);
  }
}

async function batchSyncAllTeachersPin() {
  try {
    const teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    const activeTeachers = teachers.filter(t => t.status !== 'ARCHIVED');
    
    if (activeTeachers.length === 0) {
      alert('لا يوجد معلمون مسجلون في هذا المركز.');
      return;
    }

    const confirmMsg = `يوجد ${activeTeachers.length} معلماً مسجلاً في المركز.\n\nهل تريد توليد/مزامنة الرقم السري (PIN) وتفعيل حساب الدخول لجميع المعلمين في خطوة واحدة؟\n(سيتمكن جميع المعلمين من الدخول برقم الهاتف والـ PIN الجديد فوراً)`;
    if (!confirm(confirmMsg)) return;

    const container = document.getElementById('modalContainer');
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:650px; text-align:center;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">⏳</div>
          <div class="modal-header" style="justify-content:center;">جاري مزامنة وتوليد PIN لجميع المعلمين...</div>
          <p id="batchSyncProgress" style="padding:1rem; color:#94a3b8;">يرجى الانتظار، جاري معالجة حسابات المعلمين (0 / ${activeTeachers.length})...</p>
        </div>
      </div>
    `;

    const results = [];
    let count = 0;
    for (const t of activeTeachers) {
      const pElem = document.getElementById('batchSyncProgress');
      if (pElem) pElem.textContent = `جاري معالجة المعلم: ${t.fullName || t.name} (${++count} / ${activeTeachers.length})...`;
      try {
        const res = await callBackend('resetTeacherPassword', currentCallerToken, { teacherId: t.id });
        results.push({ name: t.fullName || t.name, phone: t.phone || t.normalizedPhone, pin: res.pin, code: t.teacherCode, success: true });
      } catch (e) {
        results.push({ name: t.fullName || t.name, phone: t.phone || t.normalizedPhone, pin: t.tempPassword || '—', code: t.teacherCode, success: false, error: e.message });
      }
    }

    await renderActiveView('teachers');

    const successCount = results.filter(r => r.success).length;
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" style="width:700px; max-height:85vh; overflow-y:auto;">
          <div class="modal-header" style="color:#10b981; font-size:1.15rem;">
            ✅ اكتملت مزامنة حسابات المعلمين (${successCount} من أصل ${results.length})
          </div>
          <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:1rem; line-height:1.5;">
            تم توليد أرقام سرية (PIN) وتفعيل حسابات الدخول لجميع المعلمين بنجاح. يمكنك تسليم كل معلم رقمه السري أو نسخ القائمة كاملة:
          </p>
          <div style="max-height:350px; overflow-y:auto; border:1px solid #334155; border-radius:6px; margin-bottom:1.2rem;">
            <table class="data-table" style="font-size:0.85rem; margin:0;">
              <thead>
                <tr>
                  <th>كود المعلم</th>
                  <th>اسم المعلم</th>
                  <th>الهاتف</th>
                  <th>الرقم السري (PIN)</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(r => `
                  <tr>
                    <td><span class="code-box">${escapeHtmlAttr(r.code || '-')}</span></td>
                    <td><strong>${escapeHtmlAttr(r.name)}</strong></td>
                    <td><span class="code-box">${escapeHtmlAttr(r.phone || '-')}</span></td>
                    <td><span class="code-box" style="font-size:1.15rem; color:#38bdf8; font-weight:bold; letter-spacing:2px;">${escapeHtmlAttr(r.pin)}</span></td>
                    <td>${r.success ? '<span class="badge" style="background:#14532d; color:#86efac;">جاهز للدخول</span>' : `<span class="badge revoked" title="${escapeHtmlAttr(r.error||'')}">فشل</span>`}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn btn-primary" id="btnCopyAllTch">📋 نسخ جميع الحسابات والـ PINs</button>
            <button class="btn btn-success" onclick="closeModal()">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    const copyBtn = document.getElementById('btnCopyAllTch');
    if (copyBtn) {
      copyBtn.onclick = () => copyAllTeachersCredentials(results);
    }
  } catch (err) {
    showToast('حدث خطأ أثناء المزامنة: ' + (err.message || err), true);
  }
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
    const curSubj = subjects.find(s => s.id === group.subjectId);
    const subjPrice = Number(group.subjectPrice !== undefined ? group.subjectPrice : (curSubj?.price || 0));
    const enrolledCount = Number(group.enrolledCount || 0);
    const totalGroupFee = enrolledCount * subjPrice;
    window._batchAGroupEdit = { group, subjects };

    container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:600px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">تعديل المجموعة — ${escapeHtmlAttr(group.name)}</div>
        <div class="form-group"><label>اسم المجموعة *</label><input type="text" id="eGrpName" value="${escapeHtmlAttr(group.name || '')}"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group"><label>السنة</label><select id="eGrpYear">${years.map(y => `<option value="${y.id}" ${y.id === group.academicYearId ? 'selected' : ''}>${escapeHtmlAttr(y.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المرحلة</label><select id="eGrpStage">${stages.map(s => `<option value="${s.id}" ${s.id === group.stageId ? 'selected' : ''}>${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المادة</label><select id="eGrpSubject" onchange="onEditGroupSubjectChange()">${subjects.map(s => `<option value="${s.id}" ${s.id === group.subjectId ? 'selected' : ''}>${escapeHtmlAttr(s.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>المعلم</label><select id="eGrpTeacher">${teachers.filter(t => t.status === 'ACTIVE').map(t => `<option value="${t.id}" ${t.id === group.teacherId ? 'selected' : ''}>${escapeHtmlAttr(t.fullName || t.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>القاعة</label><select id="eGrpRoom">${rooms.filter(r => r.status !== 'ARCHIVED').map(r => `<option value="${r.id}" ${r.id === group.roomId ? 'selected' : ''}>${escapeHtmlAttr(r.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label>السعة * (المسجلون حالياً: ${group.enrolledCount || 0})</label><input type="number" id="eGrpCapacity" min="1" value="${group.maxCapacity || group.capacity || 30}"></div>
        </div>
        <div class="form-group"><label>المواعيد</label><input type="text" id="eGrpSchedule" value="${escapeHtmlAttr(group.schedule || '')}"></div>
        <div class="form-group">
          <label>سعر المجموعة (محسوب تلقائياً = عدد الطلاب المشتركين × سعر المادة)</label>
          <input type="text" id="eGrpFeeDisplay" readonly style="background:#0f172a; border:1px solid #38bdf8; color:#38bdf8; font-weight:bold; cursor:not-allowed;" value="${fmtMoney(totalGroupFee)} (${enrolledCount} طالب × ${fmtMoney(subjPrice)})">
          <input type="hidden" id="eGrpFee" value="${totalGroupFee}">
          <div id="eGrpFeeHelper" style="font-size:0.75rem; color:#94a3b8; margin-top:0.25rem;">سعر مادة المجموعة: ${fmtMoney(subjPrice)} | عدد الطلاب المشتركين: ${enrolledCount} طالب.</div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button class="btn" style="background:#475569;" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-success" id="btnUpdateGroup" onclick="submitEditGroup('${group.id}')">حفظ التعديلات</button>
        </div>
      </div>
    </div>`;
  } catch (err) { showToast(friendlyBatchAError(err), true); }
}

function onEditGroupSubjectChange() {
  const subjId = document.getElementById('eGrpSubject')?.value || '';
  const st = window._batchAGroupEdit || {};
  const subjects = st.subjects || [];
  const group = st.group || {};
  const subj = subjects.find(s => s.id === subjId);
  const enrolled = Number(group.enrolledCount || 0);
  const price = Math.max(0, Number(subj?.price || 0));
  const total = enrolled * price;
  const disp = document.getElementById('eGrpFeeDisplay');
  const hid = document.getElementById('eGrpFee');
  const hlp = document.getElementById('eGrpFeeHelper');
  if (disp) disp.value = `${fmtMoney(total)} (${enrolled} طالب × ${fmtMoney(price)})`;
  if (hid) hid.value = total;
  if (hlp) hlp.innerText = `سعر مادة المجموعة: ${fmtMoney(price)} | عدد الطلاب المشتركين: ${enrolled} طالب.`;
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

// ============================================================================
// EMPLOYEES & PERMISSIONS MODALS & ACTIONS
// ============================================================================

const PERMISSION_MATRIX_DEF = {
  students: { label: 'الطلاب', actions: { view: 'عرض الطلاب', create: 'إضافة طالب', update: 'تعديل طالب', archive: 'أرشفة طالب' } },
  groups: { label: 'المجموعات والمواد', actions: { view: 'عرض المجموعات', create: 'إنشاء مجموعة', update: 'تعديل مجموعة', archive: 'أرشفة مجموعة', approve: 'اعتماد مجموعة' } },
  attendance: { label: 'الحضور والانضباط', actions: { view: 'عرض الحضور', create: 'تسجيل الحضور', correct: 'تصحيح الحضور', approve: 'اعتماد الحضور' } },
  finance: { label: 'المالية والخزينة', actions: { view: 'عرض المالية', collect: 'تحصيل الرسوم', createCharge: 'إنشاء مستحق', createExpense: 'تسجيل مصروف', createOtherIncome: 'إيراد آخر', printReceipt: 'طباعة الإيصالات', viewReports: 'التقارير المالية', approve: 'اعتماد العمليات', reverse: 'عكس عملية' } },
  teachers: { label: 'المعلمون', actions: { view: 'عرض المعلمين', create: 'إضافة معلم', update: 'تعديل معلم', archive: 'أرشفة معلم' } },
  content: { label: 'المحتوى والدروس', actions: { view: 'عرض المحتوى', create: 'رفع محتوى', update: 'تعديل محتوى', publish: 'نشر محتوى', archive: 'أرشفة محتوى' } },
  homework: { label: 'الواجبات', actions: { view: 'عرض الواجبات', create: 'إنشاء واجب', update: 'تعديل واجب', publish: 'نشر واجب', grade: 'تصحيح', close: 'إغلاق واجب' } },
  exams: { label: 'الاختبارات والنتائج', actions: { view: 'عرض الاختبارات', create: 'إنشاء اختبار', update: 'تعديل اختبار', grade: 'رصد درجات', publish: 'نشر نتائج' } },
  employees: { label: 'الموظفون والصلاحيات', actions: { view: 'عرض الموظفين', create: 'إضافة موظف', update: 'تعديل موظف', suspend: 'إيقاف موظف', archive: 'أرشفة موظف', managePermissions: 'إدارة الصلاحيات' } },
  settings: { label: 'الإعدادات والهوية', actions: { view: 'عرض الإعدادات', update: 'تعديل الإعدادات' } },
  reports: { label: 'التقارير والإحصائيات', actions: { view: 'عرض التقارير', export: 'تصدير التقارير' } },
  audit: { label: 'سجل التدقيق والأمان', actions: { view: 'عرض سجل التدقيق' } }
};

function filterEmployeesTable() {
  const q = (document.getElementById('employeeSearchInput')?.value || '').toLowerCase().trim();
  const roleF = document.getElementById('employeeRoleFilter')?.value || 'ALL';
  const statusF = document.getElementById('employeeStatusFilter')?.value || 'ALL';

  const all = window._allEmployeesCache || [];
  const filtered = all.filter(emp => {
    if (roleF !== 'ALL' && emp.role !== roleF) return false;
    if (statusF !== 'ALL' && emp.status !== statusF) return false;
    if (q) {
      const match = (emp.name || '').toLowerCase().includes(q) ||
                    (emp.phone || '').includes(q) ||
                    (emp.email || '').toLowerCase().includes(q) ||
                    (emp.jobTitle || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const wrapper = document.getElementById('employeesTableWrapper');
  if (wrapper) wrapper.innerHTML = renderEmployeesTableHtml(filtered);
}

async function openAddEmployeeModal() {
  const modal = document.getElementById('modalContainer');
  let teachers = [];
  try {
    teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  } catch (_) {}

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:620px;">
        <div class="modal-header">
          <div class="modal-title">👨‍💼 إضافة موظف جديد وتحديد الصلاحيات</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitCreateEmployee();">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>اسم الموظف الثلاثي / الرباعي *</label>
              <input type="text" id="mEmpName" required placeholder="أحمد محمد محمود">
            </div>
            <div class="form-group">
              <label>رقم هاتف الموظف *</label>
              <input type="tel" id="mEmpPhone" required placeholder="01012345678">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>البريد الإلكتروني (اختياري)</label>
              <input type="email" id="mEmpEmail" placeholder="employee@center.com">
            </div>
            <div class="form-group">
              <label>المسمى الوظيفي</label>
              <input type="text" id="mEmpJobTitle" placeholder="مسؤول شؤون طلاب / كاشير">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>الدور الوظيفي في النظام *</label>
              <select id="mEmpRole" onchange="onAddEmployeeRoleChange()" required>
                <option value="STAFF">موظف عام (STAFF)</option>
                <option value="MANAGER">مدير عام (MANAGER) — صلاحيات كاملة</option>
                <option value="ACCOUNTANT">محاسب (ACCOUNTANT)</option>
                <option value="CASHIER">كاشير وخزينة (CASHIER)</option>
                <option value="RECEPTIONIST">استقبال وشؤون طلاب (RECEPTIONIST)</option>
                <option value="TEACHER_LINKED">معلم مرتبط بنظام (TEACHER_LINKED)</option>
              </select>
            </div>
            <div class="form-group" id="mEmpTeacherGroup" style="display:none;">
              <label>ربط بحساب المعلم</label>
              <select id="mEmpTeacherId">
                <option value="">— اختر المعلم —</option>
                ${teachers.map(t => `<option value="${t.id}">${escapeHtmlAttr(t.name)} (${t.phone || '-'})</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="background:#0f172a; padding:1rem; border-radius:8px; border:1px solid #1e293b; margin:0.75rem 0;">
            <div style="font-weight:bold; color:#38bdf8; margin-bottom:0.5rem; font-size:0.9rem;">🔒 ضبط رمز الدخول السري (PIN)</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
              <div class="form-group" style="margin-bottom:0;">
                <label>الرقم السري PIN (من 4 إلى 8 أرقام) *</label>
                <input type="password" id="mEmpPin" required maxlength="8" pattern="[0-9]{4,8}" placeholder="4-8 أرقام">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label>تأكيد الرقم السري *</label>
                <input type="password" id="mEmpPinConfirm" required maxlength="8" pattern="[0-9]{4,8}" placeholder="أعد إدخال الرقم السري">
              </div>
            </div>
            <small style="color:#94a3b8; display:block; margin-top:0.35rem;">يُستخدم رمز PIN للدخول السريع وتسجيل العمليات والتحصيلات بدون الحاجة لكلمة مرور السنتر الرئيسية.</small>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnSubmitAddEmployee">💾 حفظ الموظف وتفعيله</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function onAddEmployeeRoleChange() {
  const role = document.getElementById('mEmpRole')?.value;
  const grp = document.getElementById('mEmpTeacherGroup');
  if (grp) grp.style.display = role === 'TEACHER_LINKED' ? 'block' : 'none';
}

async function submitCreateEmployee() {
  const btn = document.getElementById('btnSubmitAddEmployee');
  const name = document.getElementById('mEmpName')?.value.trim();
  const phone = document.getElementById('mEmpPhone')?.value.trim();
  const email = document.getElementById('mEmpEmail')?.value.trim();
  const jobTitle = document.getElementById('mEmpJobTitle')?.value.trim();
  const role = document.getElementById('mEmpRole')?.value;
  const teacherId = document.getElementById('mEmpTeacherId')?.value || '';
  const pin = document.getElementById('mEmpPin')?.value.trim();
  const pinConfirm = document.getElementById('mEmpPinConfirm')?.value.trim();

  if (!name || !phone) return showToast('الاسم ورقم الهاتف مطلوبان', true);
  if (!pin || pin.length < 4 || pin.length > 8) return showToast('الرقم السري يجب أن يتكون من 4 إلى 8 أرقام', true);
  if (pin !== pinConfirm) return showToast('تأكيد الرقم السري غير متطابق', true);

  if (btn) btn.disabled = true;
  try {
    const payload = {
      institutionId: currentCallerToken.institutionId,
      name, phone, email, jobTitle, role, teacherId, pin, pinConfirm
    };
    await callBackend('createEmployee', currentCallerToken, payload);
    showToast(`تمت إضافة الموظف (${name}) بنجاح!`);
    closeModal();
    if (activeView === 'employees') await renderActiveView('employees');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function openEditEmployeeModal(employeeId) {
  const modal = document.getElementById('modalContainer');
  let emp = null;
  let teachers = [];
  try {
    emp = await callBackend('getEmployeeById', currentCallerToken, employeeId, currentCallerToken.institutionId);
    teachers = await callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }) || [];
  } catch (err) {
    return showToast(friendlyBatchAError(err), true);
  }
  if (!emp) return showToast('لم يتم العثور على بيانات الموظف', true);

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:580px;">
        <div class="modal-header">
          <div class="modal-title">✏️ تعديل بيانات الموظف: ${escapeHtmlAttr(emp.name)}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitUpdateEmployee('${emp.id}');">
          <div class="form-group">
            <label>اسم الموظف *</label>
            <input type="text" id="mEditEmpName" required value="${escapeHtmlAttr(emp.name)}">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>رقم الهاتف *</label>
              <input type="tel" id="mEditEmpPhone" required value="${escapeHtmlAttr(emp.phone)}">
            </div>
            <div class="form-group">
              <label>البريد الإلكتروني</label>
              <input type="email" id="mEditEmpEmail" value="${escapeHtmlAttr(emp.email || '')}">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المسمى الوظيفي</label>
              <input type="text" id="mEditEmpJobTitle" value="${escapeHtmlAttr(emp.jobTitle || '')}">
            </div>
            <div class="form-group">
              <label>ربط بحساب معلم (اختياري)</label>
              <select id="mEditEmpTeacherId">
                <option value="">— غير مرتبط بمعلم —</option>
                ${teachers.map(t => `<option value="${t.id}" ${t.id === emp.teacherId ? 'selected' : ''}>${escapeHtmlAttr(t.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-primary" id="btnSubmitEditEmployee">💾 حفظ التعديلات</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitUpdateEmployee(employeeId) {
  const btn = document.getElementById('btnSubmitEditEmployee');
  const name = document.getElementById('mEditEmpName')?.value.trim();
  const phone = document.getElementById('mEditEmpPhone')?.value.trim();
  const email = document.getElementById('mEditEmpEmail')?.value.trim();
  const jobTitle = document.getElementById('mEditEmpJobTitle')?.value.trim();
  const teacherId = document.getElementById('mEditEmpTeacherId')?.value || '';

  if (!name || !phone) return showToast('الاسم ورقم الهاتف مطلوبان', true);

  if (btn) btn.disabled = true;
  try {
    await callBackend('updateEmployee', currentCallerToken, employeeId, {
      institutionId: currentCallerToken.institutionId,
      name, phone, email, jobTitle, teacherId
    });
    showToast('تم تحديث بيانات الموظف بنجاح');
    closeModal();
    if (activeView === 'employees') await renderActiveView('employees');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function openEmployeePermissionsModal(employeeId) {
  const modal = document.getElementById('modalContainer');
  let emp = null;
  try {
    emp = await callBackend('getEmployeeById', currentCallerToken, employeeId, currentCallerToken.institutionId);
  } catch (err) {
    return showToast(friendlyBatchAError(err), true);
  }
  if (!emp) return showToast('لم يتم العثور على الموظف', true);

  const isManager = emp.role === 'MANAGER';
  const currentPerms = new Set(Array.isArray(emp.permissions) ? emp.permissions : []);

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:760px; max-height:85vh; display:flex; flex-direction:column;">
        <div class="modal-header">
          <div>
            <div class="modal-title">🔑 إدارة صلاحيات: ${escapeHtmlAttr(emp.name)} (${getEmployeeRoleBadge(emp.role)})</div>
            <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.25rem;">
              ${isManager ? '⚠️ الموظف يمتلك دور المدير العام (MANAGER) ويمتلك كافة الصلاحيات تلقائياً.' : 'حدد الصلاحيات الممنوحة لهذا الموظف في مختلف أقسام ووظائف السنتر.'}
            </div>
          </div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        ${!isManager ? `
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; padding:0.75rem 0; border-bottom:1px solid #1e293b;">
            <button type="button" class="btn" style="font-size:0.75rem; padding:0.3rem 0.75rem; background:#0284c7;" onclick="toggleAllPermissions(true)">✅ تحديد كل الصلاحيات</button>
            <button type="button" class="btn" style="font-size:0.75rem; padding:0.3rem 0.75rem; background:#475569;" onclick="selectViewOnlyPermissions()">👀 صلاحيات العرض فقط</button>
            <button type="button" class="btn" style="font-size:0.75rem; padding:0.3rem 0.75rem; background:#7f1d1d; color:#fca5a5;" onclick="toggleAllPermissions(false)">❌ إلغاء تحديد الكل</button>
          </div>
        ` : ''}

        <div style="flex:1; overflow-y:auto; padding:0.75rem 0;">
          <form id="employeePermissionsForm" onsubmit="event.preventDefault(); submitAssignPermissions('${emp.id}');">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem;">
              ${Object.entries(PERMISSION_MATRIX_DEF).map(([mod, def]) => `
                <div style="background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:0.75rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:0.4rem; margin-bottom:0.6rem;">
                    <strong style="color:#38bdf8; font-size:0.9rem;">📌 ${def.label}</strong>
                    ${!isManager ? `
                      <button type="button" class="btn" style="padding:0.15rem 0.5rem; font-size:0.68rem; background:#334155;" onclick="toggleModulePermissions('${mod}')">تبديل الكل</button>
                    ` : ''}
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                    ${Object.entries(def.actions).map(([act, actLabel]) => {
                      const permKey = `${mod}:${act}`;
                      const checked = isManager || currentPerms.has('*') || currentPerms.has(permKey);
                      return `
                        <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; color:#cbd5e1; cursor:${isManager ? 'not-allowed' : 'pointer'};">
                          <input type="checkbox" name="empPermCheckbox" data-mod="${mod}" value="${permKey}" ${checked ? 'checked' : ''} ${isManager ? 'disabled' : ''}>
                          <span>${actLabel}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem; border-top:1px solid #1e293b; padding-top:1rem;">
              <button type="button" class="btn" onclick="closeModal()">إغلاق</button>
              ${!isManager ? `
                <button type="submit" class="btn btn-success" id="btnSavePermissions">💾 حفظ الصلاحيات المحددة</button>
              ` : ''}
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function toggleAllPermissions(check) {
  document.querySelectorAll('input[name="empPermCheckbox"]:not(:disabled)').forEach(cb => {
    cb.checked = check;
  });
}

function selectViewOnlyPermissions() {
  document.querySelectorAll('input[name="empPermCheckbox"]:not(:disabled)').forEach(cb => {
    cb.checked = cb.value.endsWith(':view');
  });
}

function toggleModulePermissions(mod) {
  const cbs = Array.from(document.querySelectorAll(`input[name="empPermCheckbox"][data-mod="${mod}"]:not(:disabled)`));
  const someUnchecked = cbs.some(c => !c.checked);
  cbs.forEach(c => { c.checked = someUnchecked; });
}

async function submitAssignPermissions(employeeId) {
  const btn = document.getElementById('btnSavePermissions');
  const selected = [];
  document.querySelectorAll('input[name="empPermCheckbox"]:checked').forEach(cb => {
    selected.push(cb.value);
  });

  if (btn) btn.disabled = true;
  try {
    await callBackend('assignEmployeePermissions', currentCallerToken, employeeId, selected, currentCallerToken.institutionId);
    showToast(`تم حفظ الصلاحيات بنجاح (${selected.length} صلاحية مفعّلة)`);
    closeModal();
    if (activeView === 'employees') await renderActiveView('employees');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function openResetEmployeePinModal(employeeId) {
  const modal = document.getElementById('modalContainer');
  let emp = null;
  try {
    emp = await callBackend('getEmployeeById', currentCallerToken, employeeId, currentCallerToken.institutionId);
  } catch (err) {
    return showToast(friendlyBatchAError(err), true);
  }
  if (!emp) return showToast('لم يتم العثور على الموظف', true);

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:440px;">
        <div class="modal-header">
          <div class="modal-title">🔢 تغيير رمز PIN للموظف: ${escapeHtmlAttr(emp.name)}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitResetPin('${emp.id}');">
          <div class="form-group">
            <label>رمز PIN الجديد (4 إلى 8 أرقام) *</label>
            <input type="password" id="mResetPinNew" required maxlength="8" pattern="[0-9]{4,8}" placeholder="4-8 أرقام">
          </div>
          <div class="form-group">
            <label>تأكيد رمز PIN *</label>
            <input type="password" id="mResetPinConfirm" required maxlength="8" pattern="[0-9]{4,8}" placeholder="أعد إدخال الرقم">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-warning" id="btnSubmitResetPin">🔒 تعيين PIN الجديد</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitResetPin(employeeId) {
  const btn = document.getElementById('btnSubmitResetPin');
  const newPin = document.getElementById('mResetPinNew')?.value.trim();
  const pinConfirm = document.getElementById('mResetPinConfirm')?.value.trim();

  if (!newPin || newPin.length < 4 || newPin.length > 8) {
    return showToast('الرقم السري يجب أن يتكون من 4 إلى 8 أرقام', true);
  }
  if (newPin !== pinConfirm) {
    return showToast('تأكيد الرقم السري غير متطابق', true);
  }

  if (btn) btn.disabled = true;
  try {
    await callBackend('resetEmployeePin', currentCallerToken, employeeId, newPin, currentCallerToken.institutionId);
    showToast('تمت إعادة تعيين الرقم السري للموظف بنجاح');
    closeModal();
    if (activeView === 'employees') await renderActiveView('employees');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function toggleEmployeeStatusAction(employeeId, nextStatus) {
  const actionText = nextStatus === 'ACTIVE' ? 'تفعيل وتنشيط' : 'إيقاف';
  if (!confirm(`هل أنت متأكد من ${actionText} هذا الموظف؟`)) return;

  try {
    await callBackend('setEmployeeStatus', currentCallerToken, employeeId, nextStatus, currentCallerToken.institutionId);
    showToast(`تم ${actionText} الموظف بنجاح`);
    if (activeView === 'employees') await renderActiveView('employees');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function archiveEmployeeAction(employeeId) {
  if (!confirm('هل أنت متأكد من أرشفة هذا الموظف؟ لن يتمكن من تسجيل الدخول بعد الآن.')) return;

  try {
    await callBackend('setEmployeeStatus', currentCallerToken, employeeId, 'ARCHIVED', currentCallerToken.institutionId);
    showToast('تمت أرشفة الموظف بنجاح');
    if (activeView === 'employees') await renderActiveView('employees');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// ============================================================================
// SESSIONS / SCHEDULE MODALS & ACTIONS
// ============================================================================

function filterSessionsTable() {
  const q = (document.getElementById('sessionSearchInput')?.value || '').toLowerCase().trim();
  const st = document.getElementById('sessionStatusFilter')?.value || 'ALL';
  const all = window._allSessionsCache || [];

  const filtered = all.filter(s => {
    if (st !== 'ALL' && s.status !== st) return false;
    if (q) {
      const match = (s.title || '').toLowerCase().includes(q) ||
                    (s.room || '').toLowerCase().includes(q) ||
                    (s.date || '').includes(q);
      if (!match) return false;
    }
    return true;
  });

  const wrapper = document.getElementById('sessionsTableWrapper');
  if (wrapper) wrapper.innerHTML = renderSessionsTableHtml(filtered);
}

async function openAddSessionModal() {
  const modal = document.getElementById('modalContainer');
  let groups = [];
  let rooms = [];
  let teachers = [];
  try {
    const [gRes, rRes, tRes] = await Promise.all([
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getRooms', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getTeachers', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    groups = (gRes || []).filter(g => g.status === 'ACTIVE');
    rooms = rRes || [];
    teachers = tRes || [];
  } catch (_) {}

  const today = new Date().toISOString().split('T')[0];

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:580px;">
        <div class="modal-header">
          <div class="modal-title">🗓️ إضافة حصة دراسية جديدة في الجدول</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitCreateSession();">
          <div class="form-group">
            <label>عنوان الحصة / الموضوع *</label>
            <input type="text" id="mSessionTitle" required placeholder="مثال: حصة مراجعة نهائية فيزياء">
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المجموعة الدراسية *</label>
              <select id="mSessionGroup" required onchange="onSessionGroupChange()">
                <option value="">— اختر المجموعة —</option>
                ${groups.map(g => `<option value="${g.id}" data-room="${escapeHtmlAttr(g.room || '')}" data-teacher="${g.teacherId || ''}">${escapeHtmlAttr(g.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>القاعة الدراسية</label>
              <input type="text" id="mSessionRoom" placeholder="مثال: قاعة 1" value="${rooms[0]?.name || 'قاعة 1'}">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>تاريخ الحصة *</label>
              <input type="date" id="mSessionDate" required value="${today}">
            </div>
            <div class="form-group">
              <label>وقت البداية *</label>
              <input type="time" id="mSessionStart" required value="16:00">
            </div>
            <div class="form-group">
              <label>وقت النهاية *</label>
              <input type="time" id="mSessionEnd" required value="18:00">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; background:#0f172a; padding:0.85rem; border-radius:8px; border:1px solid #334155; margin-bottom:1rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label style="color:#fbbf24; font-weight:600; font-size:0.85rem;">⏱️ مدة السماح قبل احتساب التأخير (بالدقائق) *</label>
              <input type="number" id="mSessionLateThreshold" min="0" max="180" value="15" required style="width:100%; padding:0.45rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" placeholder="15">
              <small style="color:#94a3b8; font-size:0.72rem; display:block; margin-top:3px;">بعد مرورها من فتح الحصة يُسجل الطالب (متأخر LATE)</small>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label style="color:#f87171; font-weight:600; font-size:0.85rem;">🔒 مدة غلق الحضور واحتساب الغياب (بالدقائق) *</label>
              <input type="number" id="mSessionCloseAttendance" min="1" max="300" value="45" required style="width:100%; padding:0.45rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;" placeholder="45">
              <small style="color:#94a3b8; font-size:0.72rem; display:block; margin-top:3px;">بعدها يُغلق تسجيل الحضور ويُحتسب باقي الطلاب (غياب ABSENT)</small>
            </div>
          </div>

          <div class="form-group">
            <label>📁 ملفات ومذكرات الحصة (اختياري - مذكرات، واجبات، ملخصات PDF أو صور)</label>
            <input type="file" id="mSessionFiles" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png" style="padding:0.4rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; width:100%;">
            <small style="color:#94a3b8; display:block; margin-top:0.35rem;">ستظهر هذه الملفات لجميع طلاب المجموعة فور فتح الحصة 🟢</small>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnSubmitAddSession">💾 حفظ وجدولة الحصة</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function onSessionGroupChange() {
  const sel = document.getElementById('mSessionGroup');
  const opt = sel?.options[sel.selectedIndex];
  const room = opt?.getAttribute('data-room');
  if (room && document.getElementById('mSessionRoom')) {
    document.getElementById('mSessionRoom').value = room;
  }
}

async function submitCreateSession() {
  const btn = document.getElementById('btnSubmitAddSession');
  const title = document.getElementById('mSessionTitle')?.value.trim();
  const groupId = document.getElementById('mSessionGroup')?.value;
  const room = document.getElementById('mSessionRoom')?.value.trim() || 'قاعة 1';
  const date = document.getElementById('mSessionDate')?.value;
  const startTime = document.getElementById('mSessionStart')?.value;
  const endTime = document.getElementById('mSessionEnd')?.value;
  const lateThresholdMinutes = Number(document.getElementById('mSessionLateThreshold')?.value || 15);
  const closeAttendanceMinutes = Number(document.getElementById('mSessionCloseAttendance')?.value || 45);

  if (!title || !groupId || !date || !startTime || !endTime) {
    return showToast('جميع الحقول المؤشر عليها بـ (*) مطلوبة', true);
  }

  const fileInput = document.getElementById('mSessionFiles');
  const attachments = [];
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (const f of fileInput.files) {
      try {
        const dUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.readAsDataURL(f);
        });
        attachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: f.name,
          size: f.size,
          type: f.type,
          dataUrl: dUrl,
          uploadedAt: new Date().toISOString()
        });
      } catch (_) {}
    }
  }

  if (btn) btn.disabled = true;
  try {
    await callBackend('createSession', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      title, groupId, room, date, startTime, endTime, lateThresholdMinutes, closeAttendanceMinutes, attachments
    });
    showToast('تمت إضافة وجدولة الحصة بنجاح!');
    closeModal();
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function startSessionAction(sessionId) {
  try {
    await callBackend('startSession', currentCallerToken, sessionId, currentCallerToken.institutionId);
    showToast('تم بدء الحصة بنجاح — أصبحت الحصة مفتوحة لاستقبال الحضور بالباركود 🟢');
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function closeSessionAction(sessionId) {
  if (!confirm('هل تريد إنهاء وإغلاق هذه الحصة الآن؟ لن يُسمح بتسجيل حضور إضافي بعد الإغلاق.')) return;
  try {
    await callBackend('closeSession', currentCallerToken, sessionId, currentCallerToken.institutionId);
    showToast('تم إغلاق الحصة بنجاح ✅');
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function cancelSessionAction(sessionId) {
  if (!confirm('هل أنت متأكد من إلغاء هذه الحصة الدراسية؟')) return;
  try {
    await callBackend('cancelSession', currentCallerToken, sessionId, currentCallerToken.institutionId);
    showToast('تم إلغاء الحصة الدراسية');
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function openEditSessionModal(sessionId) {
  const modal = document.getElementById('modalContainer');
  let s = null;
  try {
    s = await callBackend('getSessionById', currentCallerToken, sessionId, currentCallerToken.institutionId);
  } catch (_) {
    s = (window._allSessionsCache || []).find(item => item.id === sessionId);
  }
  if (!s) return showToast('تعذر العثور على الحصة', true);

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:540px;">
        <div class="modal-header">
          <div class="modal-title">✏️ تعديل موعد الحصة: ${escapeHtmlAttr(s.title)}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitUpdateSession('${s.id}');">
          <div class="form-group">
            <label>عنوان الحصة</label>
            <input type="text" id="mEditSesTitle" value="${escapeHtmlAttr(s.title)}" required>
          </div>
          <div class="form-group">
            <label>القاعة الدراسية</label>
            <input type="text" id="mEditSesRoom" value="${escapeHtmlAttr(s.room || 'قاعة 1')}" required>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>التاريخ</label>
              <input type="date" id="mEditSesDate" value="${s.date || s.sessionDate || ''}" required>
            </div>
            <div class="form-group">
              <label>وقت البداية</label>
              <input type="time" id="mEditSesStart" value="${s.startTime || '16:00'}" required>
            </div>
            <div class="form-group">
              <label>وقت النهاية</label>
              <input type="time" id="mEditSesEnd" value="${s.endTime || '18:00'}" required>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; background:#0f172a; padding:0.85rem; border-radius:8px; border:1px solid #334155; margin-bottom:1rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label style="color:#fbbf24; font-weight:600; font-size:0.85rem;">⏱️ مدة السماح قبل التأخير (بالدقائق)</label>
              <input type="number" id="mEditSesLateThreshold" min="0" max="180" value="${s.lateThresholdMinutes !== undefined ? s.lateThresholdMinutes : 15}" required style="width:100%; padding:0.45rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
              <small style="color:#94a3b8; font-size:0.72rem; display:block; margin-top:3px;">الوصول بعدها يُسجل الطالب (متأخر LATE)</small>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label style="color:#f87171; font-weight:600; font-size:0.85rem;">🔒 مدة غلق الحضور للغياب (بالدقائق)</label>
              <input type="number" id="mEditSesCloseAttendance" min="1" max="300" value="${s.closeAttendanceMinutes !== undefined ? s.closeAttendanceMinutes : 45}" required style="width:100%; padding:0.45rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff;">
              <small style="color:#94a3b8; font-size:0.72rem; display:block; margin-top:3px;">بعدها يُغلق الكشك ويُحتسب الباقي (غياب ABSENT)</small>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-primary" id="btnSubmitEditSession">💾 حفظ التعديلات</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitUpdateSession(sessionId) {
  const btn = document.getElementById('btnSubmitEditSession');
  const title = document.getElementById('mEditSesTitle')?.value.trim();
  const room = document.getElementById('mEditSesRoom')?.value.trim();
  const date = document.getElementById('mEditSesDate')?.value;
  const startTime = document.getElementById('mEditSesStart')?.value;
  const endTime = document.getElementById('mEditSesEnd')?.value;
  const lateThresholdMinutes = Number(document.getElementById('mEditSesLateThreshold')?.value || 15);
  const closeAttendanceMinutes = Number(document.getElementById('mEditSesCloseAttendance')?.value || 45);

  if (btn) btn.disabled = true;
  try {
    await callBackend('updateSession', currentCallerToken, sessionId, {
      institutionId: currentCallerToken.institutionId,
      title, room, date, startTime, endTime, lateThresholdMinutes, closeAttendanceMinutes
    });
    showToast('تم تعديل بيانات وموعد الحصة بنجاح');
    closeModal();
    if (activeView === 'schedule') await renderActiveView('schedule');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function confirmMarkSessionAbsent(sessionId) {
  if (!confirm('هل تريد غلق تسجيل الحضور ورصد الغياب التلقائي لجميع الطلاب المقيدين الذين لم يحضروا في هذه الحصة؟')) return;
  try {
    const res = await callBackend('markSessionRemainingAbsent', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      sessionId,
      closeSessionAfter: false
    });
    playAudioNotification('alert');
    showToast(`تم رصد غياب (${res.markedAbsentCount}) طالب من إجمالي (${res.totalEnrolled}) بنجاح!`);
    addNotificationAlert(`تم احتساب غياب (${res.markedAbsentCount}) طالب في حصة: ${res.sessionTitle || ''}`, 'warning');

    // Auto-dispatch WhatsApp absence alerts to parents if enabled
    if (res.absentStudents && res.absentStudents.length > 0) {
      for (const st of res.absentStudents) {
        autoDispatchAbsenceWhatsApp({
          studentId: st.id,
          studentName: st.name,
          guardianPhone: st.guardianPhone,
          sessionTitle: res.sessionTitle,
          date: new Date().toISOString().split('T')[0]
        });
      }
    }
    if (activeView === 'schedule') await renderActiveView('schedule');
    if (activeView === 'attendance') await renderActiveView('attendance');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// ============================================================================
// CONTENT & LESSONS MODALS & ACTIONS
// ============================================================================

async function openAddLessonModal() {
  const modal = document.getElementById('modalContainer');
  let stages = [];
  let subjects = [];
  let groups = [];
  try {
    const [stRes, subRes, gRes] = await Promise.all([
      callBackend('getStages', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getSubjects', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    stages = stRes || [];
    subjects = subRes || [];
    groups = gRes || [];
  } catch (_) {}

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:580px;">
        <div class="modal-header">
          <div class="modal-title">📖 إضافة درس تعليمي جديد للمكتبة</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitCreateLesson();">
          <div class="form-group">
            <label>عنوان الدرس *</label>
            <input type="text" id="mLessonTitle" required placeholder="مثال: الدرس الأول — قوانين نيوتن للحركة">
          </div>
          <div class="form-group">
            <label>وصف الدرس وملاحظات الشرح</label>
            <textarea id="mLessonDesc" rows="2" placeholder="أدخل أهداف الدرس أو ملخص المحتوى..."></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المرحلة الدراسية *</label>
              <select id="mLessonStage" required>
                <option value="">— اختر المرحلة —</option>
                ${stages.map(st => `<option value="${st.id}">${escapeHtmlAttr(st.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>المادة الدراسية *</label>
              <select id="mLessonSubject" required>
                <option value="">— اختر المادة —</option>
                ${subjects.map(sb => `<option value="${sb.id}">${escapeHtmlAttr(sb.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المجموعة المستهدفة (اختياري)</label>
              <select id="mLessonGroup">
                <option value="">— كل مجموعات المادة —</option>
                ${groups.map(g => `<option value="${g.id}">${escapeHtmlAttr(g.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>ترتيب الدرس (رقم الدرس)</label>
              <input type="number" id="mLessonOrder" min="1" value="1">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnSubmitAddLesson">💾 حفظ الدرس الجديد</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitCreateLesson() {
  const btn = document.getElementById('btnSubmitAddLesson');
  const title = document.getElementById('mLessonTitle')?.value.trim();
  const description = document.getElementById('mLessonDesc')?.value.trim();
  const stageId = document.getElementById('mLessonStage')?.value;
  const subjectId = document.getElementById('mLessonSubject')?.value;
  const groupId = document.getElementById('mLessonGroup')?.value || null;
  const lessonOrder = Number(document.getElementById('mLessonOrder')?.value || 1);

  if (!title || !stageId || !subjectId) {
    return showToast('العنوان والمرحلة والمادة مطلوبة', true);
  }

  if (btn) btn.disabled = true;
  try {
    await callBackend('createLesson', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      title, description, stageId, subjectId, groupId,
      groupIds: groupId ? [groupId] : [],
      lessonOrder, lessonNumber: lessonOrder
    });
    showToast('تمت إضافة الدرس بنجاح!');
    closeModal();
    if (activeView === 'content') await renderActiveView('content');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function publishLessonAction(lessonId) {
  try {
    await callBackend('setLessonStatus', currentCallerToken, lessonId, 'PUBLISHED', currentCallerToken.institutionId);
    showToast('تم نشر الدرس بنجاح — متاح للطلاب الآن 🟢');
    if (activeView === 'content') await renderActiveView('content');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function archiveLessonAction(lessonId) {
  if (!confirm('هل تريد أرشفة هذا الدرس؟')) return;
  try {
    await callBackend('setLessonStatus', currentCallerToken, lessonId, 'ARCHIVED', currentCallerToken.institutionId);
    showToast('تمت أرشفة الدرس');
    if (activeView === 'content') await renderActiveView('content');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function openAddContentModal() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title">📁 إضافة مذكرة أو ملف تعليمي رقمي</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitCreateContent();">
          <div class="form-group">
            <label>عنوان المذكرة أو الملخص *</label>
            <input type="text" id="mContentTitle" required placeholder="مثال: مذكرة مراجعة ليلة الامتحان PDF">
          </div>
          <div class="form-group">
            <label>نوع الملف / المحتوى *</label>
            <select id="mContentType">
              <option value="PDF">مذكرة رقمية (PDF)</option>
              <option value="SUMMARY">ملخص تدريبي</option>
              <option value="EXERCISES">نماذج تدريبية وتدريبات</option>
              <option value="VIDEO_LINK">رابط فيديو شرح</option>
            </select>
          </div>
          <div class="form-group">
            <label>رابط الملف أو ملاحظة المصدر</label>
            <input type="text" id="mContentUrl" placeholder="مثال: https://... أو اسم المجلد">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-primary" id="btnSubmitAddContent">💾 حفظ في المكتبة</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitCreateContent() {
  const btn = document.getElementById('btnSubmitAddContent');
  const title = document.getElementById('mContentTitle')?.value.trim();
  const type = document.getElementById('mContentType')?.value || 'PDF';
  const url = document.getElementById('mContentUrl')?.value.trim();

  if (!title) return showToast('عنوان المذكرة مطلوب', true);

  if (btn) btn.disabled = true;
  try {
    const payload = {
      institutionId: currentCallerToken.institutionId,
      title, type, url: url || null,
      createdAt: new Date().toISOString()
    };
    await callBackend('createLessonContent', currentCallerToken, payload).catch(async () => {});
    showToast('تمت إضافة المذكرة بنجاح في المكتبة الرقمية!');
    closeModal();
    if (activeView === 'content') await renderActiveView('content');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================================
// EXAMS MODALS & ACTIONS (FULL LIFECYCLE & GRADEBOOK)
// ============================================================================

async function openAddExamModal() {
  const modal = document.getElementById('modalContainer');
  let stages = [];
  let subjects = [];
  let groups = [];
  try {
    const [stRes, subRes, gRes] = await Promise.all([
      callBackend('getStages', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getSubjects', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    stages = stRes || [];
    subjects = subRes || [];
    groups = gRes || [];
  } catch (_) {}

  const today = new Date().toISOString().split('T')[0];

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:640px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">
          <div class="modal-title">📝 إنشاء اختبار دوري وتقييم جديد</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitCreateExam();">
          <div class="form-group">
            <label>عنوان الاختبار *</label>
            <input type="text" id="mExamTitle" required placeholder="مثال: اختبار شهر أكتوبر - ميكانيكا وقوانين نيوتن">
          </div>
          <div class="form-group">
            <label>وصف الاختبار وتعليمات الطلاب</label>
            <textarea id="mExamDesc" rows="2" placeholder="أدخل تعليمات الإجابة، الملاحظات المسموح بها، وتوزيع الدرجات..."></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المرحلة الدراسية *</label>
              <select id="mExamStage" required>
                <option value="">— اختر المرحلة —</option>
                ${stages.map(st => `<option value="${st.id}">${escapeHtmlAttr(st.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>المادة الدراسية *</label>
              <select id="mExamSubject" required>
                <option value="">— اختر المادة —</option>
                ${subjects.map(sb => `<option value="${sb.id}">${escapeHtmlAttr(sb.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المجموعة المستهدفة</label>
              <select id="mExamGroup">
                <option value="">— جميع مجموعات المادة —</option>
                ${groups.map(g => `<option value="${g.id}">${escapeHtmlAttr(g.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>طريقة الانعقاد والنمط</label>
              <select id="mExamType">
                <option value="PAPER" selected>📝 حضوري بالسنتر (ورقي)</option>
                <option value="DIGITAL">📲 إلكتروني عبر التطبيق</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>الدرجة الكلية العظمى *</label>
              <input type="number" id="mExamMaxScore" min="1" value="100" required oninput="document.getElementById('mExamPassingScore').value = Math.round(this.value * 0.5)">
            </div>
            <div class="form-group">
              <label>درجة النجاح</label>
              <input type="number" id="mExamPassingScore" min="1" value="50">
            </div>
            <div class="form-group">
              <label>مدة الاختبار (دقيقة)</label>
              <input type="number" id="mExamDuration" min="10" step="5" value="60">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>تاريخ وموعد الاختبار</label>
              <input type="date" id="mExamDate" value="${today}">
            </div>
            <div class="form-group">
              <label>رابط ورقة الأسئلة / نموذج الاختبار (PDF / Drive)</label>
              <input type="url" id="mExamPaperUrl" placeholder="https://... اختياري">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnSubmitAddExam">💾 حفظ الاختبار</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitCreateExam() {
  const btn = document.getElementById('btnSubmitAddExam');
  const title = document.getElementById('mExamTitle')?.value.trim();
  const description = document.getElementById('mExamDesc')?.value.trim();
  const stageId = document.getElementById('mExamStage')?.value;
  const subjectId = document.getElementById('mExamSubject')?.value;
  const groupId = document.getElementById('mExamGroup')?.value || null;
  const examType = document.getElementById('mExamType')?.value || 'PAPER';
  const maxScore = Number(document.getElementById('mExamMaxScore')?.value || 100);
  const passingScore = Number(document.getElementById('mExamPassingScore')?.value || Math.round(maxScore * 0.5));
  const durationMinutes = Number(document.getElementById('mExamDuration')?.value || 60);
  const examDate = document.getElementById('mExamDate')?.value;
  const paperUrl = document.getElementById('mExamPaperUrl')?.value.trim() || null;

  if (!title || !stageId || !subjectId) {
    return showToast('العنوان والمرحلة والمادة مطلوبة', true);
  }

  if (btn) btn.disabled = true;
  try {
    await callBackend('createExam', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      title, description, stageId, subjectId, groupId,
      groupIds: groupId ? [groupId] : [],
      examType, maxScore, passingScore,
      totalMarksHundredths: maxScore * 100,
      passingMarksHundredths: passingScore * 100,
      durationMinutes, examDate, paperUrl
    });
    showToast('تم إنشاء الاختبار بنجاح!');
    closeModal();
    if (activeView === 'exams') await renderActiveView('exams');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function publishExamAction(examId) {
  try {
    await callBackend('setCenterExamStatus', currentCallerToken, examId, 'PUBLISHED', currentCallerToken.institutionId);
    showToast('تم نشر الاختبار بنجاح — أصبح متاحاً لرصد النتائج 🟢');
    if (activeView === 'exams') await renderActiveView('exams');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function closeExamAction(examId) {
  if (!confirm('هل تريد إنهاء وإغلاق هذا الاختبار؟')) return;
  try {
    await callBackend('setCenterExamStatus', currentCallerToken, examId, 'CLOSED', currentCallerToken.institutionId);
    showToast('تم إغلاق الاختبار بنجاح ✅');
    if (activeView === 'exams') await renderActiveView('exams');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// Full Interactive Gradebook & Attendance for Exam
async function openRecordGradesModal(examId) {
  const modal = document.getElementById('modalContainer');
  let exam = (window._allExamsCache || []).find(x => x.id === examId);
  let students = [];
  let existingGrades = [];
  let groupName = 'جميع الطلاب';

  try {
    const [allGrades, gRes] = await Promise.all([
      callBackend('getGrades', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    existingGrades = (allGrades || []).filter(g => g.examId === examId);

    if (exam && exam.groupId) {
      const g = (gRes || []).find(x => x.id === exam.groupId);
      if (g) groupName = g.name;
      students = await callBackend('getGroupStudents', currentCallerToken, exam.groupId, currentCallerToken.institutionId).catch(() => []) || [];
    } else {
      const allSt = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
      students = exam && exam.stageId ? allSt.filter(s => s.stageId === exam.stageId && s.status !== 'ARCHIVED') : allSt;
    }
  } catch (_) {
    students = [];
  }

  const maxScore = Number(exam?.maxScore || 100);
  const passingScore = Number(exam?.passingScore || Math.round(maxScore * 0.5));
  const gradeMap = new Map(existingGrades.map(g => [g.studentId, g]));

  window._activeGradebook = {
    examId, maxScore, passingScore,
    studentIds: students.map(s => s.id)
  };

  const getRating = (pct) => {
    if (pct >= 85) return { text: 'ممتاز ⭐', color: '#4ade80' };
    if (pct >= 75) return { text: 'جيد جداً', color: '#38bdf8' };
    if (pct >= 65) return { text: 'جيد', color: '#818cf8' };
    if (pct >= 50) return { text: 'مقبول', color: '#facc15' };
    return { text: 'راسب ⚠️', color: '#f87171' };
  };

  let presentCount = 0;
  let absentCount = 0;
  let gradedCount = 0;

  students.forEach(st => {
    const g = gradeMap.get(st.id);
    if (g) {
      gradedCount++;
      if (g.attendanceStatus === 'ABSENT') absentCount++;
      else presentCount++;
    }
  });

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:850px; max-height:90vh; display:flex; flex-direction:column;">
        <div class="modal-header">
          <div>
            <div class="modal-title">📊 كشف رصد درجات الاختبار: ${escapeHtmlAttr(exam?.title || 'الاختبار')}</div>
            <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.25rem;">
              المجموعة: <strong style="color:#38bdf8;">${escapeHtmlAttr(groupName)}</strong> | 
              الدرجة العظمى: <strong style="color:#4ade80;">${maxScore} درجة</strong> | 
              درجة النجاح: <strong style="color:#facc15;">${passingScore} درجة</strong>
            </div>
          </div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <!-- Gradebook Quick Stats -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; padding: 0.75rem 0; border-bottom: 1px solid #1e293b;">
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">إجمالي الطلاب</div><div style="font-weight:bold; font-size:1.1rem; color:#f8fafc;">${students.length}</div></div>
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">تم رصدهم</div><div style="font-weight:bold; font-size:1.1rem; color:#38bdf8;" id="gbStatRecorded">${gradedCount}</div></div>
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">حاضرون</div><div style="font-weight:bold; font-size:1.1rem; color:#4ade80;" id="gbStatPresent">${presentCount}</div></div>
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">غائبون</div><div style="font-weight:bold; font-size:1.1rem; color:#f87171;" id="gbStatAbsent">${absentCount}</div></div>
        </div>

        <!-- Search Bar -->
        <div style="padding:0.6rem 0;">
          <input type="text" id="gbSearchInput" placeholder="🔍 بحث سريع في طلاب الكشف بالاسم أو الكود..." oninput="filterGradebookRows()" style="width:100%; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
        </div>

        <!-- Students Grade Table -->
        <div style="flex:1; overflow-y:auto; padding:0.25rem 0;">
          <table class="data-table" id="gbTable">
            <thead>
              <tr>
                <th style="width:40px;">#</th>
                <th>بيانات الطالب</th>
                <th style="width:125px;">الحضور</th>
                <th style="width:110px;">الدرجة / ${maxScore}</th>
                <th style="width:110px;">التقدير</th>
                <th>ملاحظات وتوجيهات</th>
                <th style="width:70px; text-align:center;">إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${students.length ? students.map((st, idx) => {
                const g = gradeMap.get(st.id);
                const score = g && g.score !== undefined ? g.score : '';
                const att = g?.attendanceStatus || 'PRESENT';
                const notes = g?.notes || '';
                const pct = score !== '' && att !== 'ABSENT' ? Math.round((Number(score) / maxScore) * 100) : 0;
                const rating = att === 'ABSENT' ? { text: 'غائب 🔴', color: '#f87171' } : (score !== '' ? getRating(pct) : { text: 'بانتظار الرصد', color: '#94a3b8' });

                return `
                  <tr class="gb-row" data-search="${escapeHtmlAttr(((st.name || '') + ' ' + (st.studentCode || '') + ' ' + (st.phone || '')).toLowerCase())}">
                    <td style="color:#64748b; font-size:0.8rem;">${idx + 1}</td>
                    <td>
                      <strong style="color:#f8fafc;">${escapeHtmlAttr(st.name)}</strong>
                      <div style="font-size:0.72rem; color:#94a3b8;"><span class="code-box" style="font-size:0.65rem;">${st.studentCode || st.id}</span> ${st.phone || ''}</div>
                    </td>
                    <td>
                      <select id="gb_att_${st.id}" onchange="onGbAttendanceChange('${st.id}')" style="width:100%; padding:0.35rem; background:#1e293b; border:1px solid #334155; border-radius:4px; color:#fff; font-size:0.8rem;">
                        <option value="PRESENT" ${att === 'PRESENT' ? 'selected' : ''}>🟢 حاضر</option>
                        <option value="ABSENT" ${att === 'ABSENT' ? 'selected' : ''}>🔴 غائب</option>
                        <option value="EXCUSED" ${att === 'EXCUSED' ? 'selected' : ''}>🟡 معتذر</option>
                      </select>
                    </td>
                    <td>
                      <input type="number" id="gb_score_${st.id}" value="${score}" min="0" max="${maxScore}" step="0.5" placeholder="0" oninput="onGbScoreChange('${st.id}')" ${att === 'ABSENT' ? 'disabled' : ''} style="width:100%; padding:0.35rem; background:#1e293b; border:1px solid #334155; border-radius:4px; color:#4ade80; font-weight:bold; text-align:center; font-size:0.9rem;">
                    </td>
                    <td>
                      <span id="gb_badge_${st.id}" class="badge" style="background:#0f172a; border:1px solid ${rating.color}; color:${rating.color}; font-size:0.75rem;">${rating.text}</span>
                    </td>
                    <td>
                      <input type="text" id="gb_notes_${st.id}" value="${escapeHtmlAttr(notes)}" placeholder="ملاحظة المعلم..." style="width:100%; padding:0.35rem; background:#1e293b; border:1px solid #334155; border-radius:4px; color:#cbd5e1; font-size:0.8rem;">
                    </td>
                    <td style="text-align:center;">
                      <button class="btn btn-success" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="submitGbSingleGrade('${st.id}', '${escapeHtmlAttr(st.name)}', '${escapeHtmlAttr(st.studentCode || '')}')">💾</button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="7" style="text-align:center; padding:2rem; color:#94a3b8;">لا يوجد طلاب مسجلون في هذه المجموعة حالياً.</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Gradebook Footer Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:1rem; border-top:1px solid #1e293b; padding-top:0.75rem;">
          <div style="display:flex; gap:0.5rem;">
            <button type="button" class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="submitGbBulkGrades()">💾 حفظ درجات جميع الطلاب دفعة واحدة</button>
            <button type="button" class="btn" style="background:#0284c7;" onclick="printExamGradesReport('${examId}')">🖨️ طباعة كشف الدرجات المعتمد</button>
          </div>
          <button type="button" class="btn" onclick="closeModal()">تم والإغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function onGbAttendanceChange(studentId) {
  const attSelect = document.getElementById(`gb_att_${studentId}`);
  const scoreInput = document.getElementById(`gb_score_${studentId}`);
  const badge = document.getElementById(`gb_badge_${studentId}`);
  if (!attSelect || !scoreInput || !badge) return;

  if (attSelect.value === 'ABSENT') {
    scoreInput.value = '0';
    scoreInput.disabled = true;
    badge.innerText = 'غائب 🔴';
    badge.style.borderColor = '#f87171';
    badge.style.color = '#f87171';
  } else {
    scoreInput.disabled = false;
    onGbScoreChange(studentId);
  }
}

function onGbScoreChange(studentId) {
  const scoreInput = document.getElementById(`gb_score_${studentId}`);
  const badge = document.getElementById(`gb_badge_${studentId}`);
  const attSelect = document.getElementById(`gb_att_${studentId}`);
  if (!scoreInput || !badge) return;

  if (attSelect && attSelect.value === 'ABSENT') {
    badge.innerText = 'غائب 🔴';
    badge.style.borderColor = '#f87171';
    badge.style.color = '#f87171';
    return;
  }

  const max = window._activeGradebook?.maxScore || 100;
  const raw = scoreInput.value;
  if (raw === '') {
    badge.innerText = 'بانتظار الرصد';
    badge.style.borderColor = '#94a3b8';
    badge.style.color = '#94a3b8';
    return;
  }

  const score = Math.max(0, Math.min(max, Number(raw)));
  const pct = Math.round((score / max) * 100);

  if (pct >= 85) {
    badge.innerText = `ممتاز (${pct}%) ⭐`;
    badge.style.borderColor = '#4ade80';
    badge.style.color = '#4ade80';
  } else if (pct >= 75) {
    badge.innerText = `جيد جداً (${pct}%)`;
    badge.style.borderColor = '#38bdf8';
    badge.style.color = '#38bdf8';
  } else if (pct >= 65) {
    badge.innerText = `جيد (${pct}%)`;
    badge.style.borderColor = '#818cf8';
    badge.style.color = '#818cf8';
  } else if (pct >= 50) {
    badge.innerText = `مقبول (${pct}%)`;
    badge.style.borderColor = '#facc15';
    badge.style.color = '#facc15';
  } else {
    badge.innerText = `راسب (${pct}%) ⚠️`;
    badge.style.borderColor = '#f87171';
    badge.style.color = '#f87171';
  }
}

function filterGradebookRows() {
  const q = (document.getElementById('gbSearchInput')?.value || '').trim().toLowerCase();
  const rows = document.querySelectorAll('.gb-row');
  rows.forEach(r => {
    const s = r.getAttribute('data-search') || '';
    r.style.display = s.includes(q) ? '' : 'none';
  });
}

async function submitGbSingleGrade(studentId, studentName, studentCode) {
  const gb = window._activeGradebook;
  if (!gb) return;
  const att = document.getElementById(`gb_att_${studentId}`)?.value || 'PRESENT';
  const scoreInput = document.getElementById(`gb_score_${studentId}`);
  const notes = document.getElementById(`gb_notes_${studentId}`)?.value || '';
  const score = att === 'ABSENT' ? 0 : Number(scoreInput?.value || 0);

  try {
    await callBackend('recordGrade', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      examId: gb.examId,
      studentId,
      studentName,
      studentCode,
      attendanceStatus: att,
      score,
      maxScore: gb.maxScore,
      notes
    });
    showToast(`تم حفظ درجة الطالب (${studentName}): ${score} د بنجاح`);
    autoDispatchExamGradeWhatsApp({ studentId, studentName, score, maxScore: gb.maxScore, examTitle: gb.examTitle, notes });
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function submitGbBulkGrades() {
  const gb = window._activeGradebook;
  if (!gb || !gb.studentIds || !gb.studentIds.length) return;

  let saved = 0;
  for (const stId of gb.studentIds) {
    const att = document.getElementById(`gb_att_${stId}`)?.value || 'PRESENT';
    const scoreInput = document.getElementById(`gb_score_${stId}`);
    const notes = document.getElementById(`gb_notes_${stId}`)?.value || '';
    const rawVal = scoreInput?.value;

    if (rawVal !== '' || att === 'ABSENT') {
      const score = att === 'ABSENT' ? 0 : Number(rawVal || 0);
      await callBackend('recordGrade', currentCallerToken, {
        institutionId: currentCallerToken.institutionId,
        examId: gb.examId,
        studentId: stId,
        attendanceStatus: att,
        score,
        maxScore: gb.maxScore,
        notes
      }).catch(() => {});
      saved++;
      autoDispatchExamGradeWhatsApp({ studentId: stId, score, maxScore: gb.maxScore, examTitle: gb.examTitle, notes });
    }
  }

  showToast(`تم حفظ وتحديث درجات (${saved}) طالب بنجاح!`);
}

// Print Official Grade Report
async function printExamGradesReport(examId) {
  const exam = (window._allExamsCache || []).find(x => x.id === examId);
  const info = await callBackend('getCenterInfo', currentCallerToken, currentCallerToken.institutionId).catch(() => null);
  const allGrades = await callBackend('getGrades', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
  const grades = allGrades.filter(g => g.examId === examId);

  let students = [];
  if (exam && exam.groupId) {
    students = await callBackend('getGroupStudents', currentCallerToken, exam.groupId, currentCallerToken.institutionId).catch(() => []) || [];
  } else {
    const allSt = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
    students = exam && exam.stageId ? allSt.filter(s => s.stageId === exam.stageId) : allSt;
  }

  const gradeMap = new Map(grades.map(g => [g.studentId, g]));
  const maxScore = exam?.maxScore || 100;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return alert('الرجاء السماح بالنوافذ المنبثقة لطباعة التقرير');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>كشف درجات الاختبار — ${escapeHtmlAttr(exam?.title || '')}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 2rem; color: #1e293b; direction: rtl; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .title { font-size: 1.5rem; font-weight: bold; margin: 0 0 0.5rem 0; color: #0f172a; }
        .meta { font-size: 0.9rem; color: #475569; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { border: 1px solid #cbd5e1; padding: 0.6rem; text-align: right; font-size: 0.9rem; }
        th { background: #f1f5f9; font-weight: bold; }
        .center { text-align: center; }
        .footer { margin-top: 2.5rem; display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">${escapeHtmlAttr(info?.name || 'المركز التعليمي')}</div>
          <div class="meta">${escapeHtmlAttr(info?.address || '')} | هاتف: ${escapeHtmlAttr(info?.phone || '')}</div>
        </div>
        <div style="text-align:left;">
          <div style="font-weight:bold; font-size:1.1rem; color:#0284c7;">كشف رصد نتائج اختبار</div>
          <div class="meta">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>
      </div>
      <div style="background:#f8fafc; padding:0.75rem; border-radius:6px; margin-bottom:1rem; border:1px solid #e2e8f0; display:flex; justify-content:space-between;">
        <div><strong>الاختبار:</strong> ${escapeHtmlAttr(exam?.title || '-')}</div>
        <div><strong>الدرجة العظمى:</strong> ${maxScore} درجة</div>
        <div><strong>تاريخ الانعقاد:</strong> ${exam?.examDate || '-'}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="center" style="width:40px;">#</th>
            <th>كود الطالب</th>
            <th>اسم الطالب</th>
            <th class="center">الحالة</th>
            <th class="center">الدرجة المحصلة</th>
            <th class="center">النسبة %</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((st, i) => {
            const g = gradeMap.get(st.id);
            const isAbsent = g?.attendanceStatus === 'ABSENT';
            const score = g && g.score !== undefined ? g.score : '—';
            const pct = isAbsent ? '0%' : (score !== '—' ? `${Math.round((Number(score) / maxScore) * 100)}%` : '—');
            return `
              <tr>
                <td class="center">${i + 1}</td>
                <td>${st.studentCode || st.id}</td>
                <td><strong>${escapeHtmlAttr(st.name)}</strong></td>
                <td class="center">${isAbsent ? 'غائب' : 'حاضر'}</td>
                <td class="center"><strong>${score}</strong></td>
                <td class="center">${pct}</td>
                <td>${escapeHtmlAttr(g?.notes || '')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="footer">
        <div>توقيع مصحح المادة: ............................</div>
        <div>توقيع إدارة السنتر: ............................</div>
      </div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ============================================================================
// HOMEWORK MODALS & ACTIONS (FULL LIFECYCLE & SUBMISSIONS)
// ============================================================================

async function openAddHomeworkModal() {
  const modal = document.getElementById('modalContainer');
  let stages = [];
  let subjects = [];
  let groups = [];
  let lessons = [];
  try {
    const [stRes, subRes, gRes, lRes] = await Promise.all([
      callBackend('getStages', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getSubjects', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []),
      callBackend('getLessons', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    stages = stRes || [];
    subjects = subRes || [];
    groups = gRes || [];
    lessons = lRes || [];
  } catch (_) {}

  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:640px; max-height:88vh; overflow-y:auto;">
        <div class="modal-header">
          <div class="modal-title">📑 تكليف بواجب منزلي جديد</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="event.preventDefault(); submitCreateHomework();">
          <div class="form-group">
            <label>عنوان الواجب *</label>
            <input type="text" id="mHwTitle" required placeholder="مثال: واجب مسائل الحركة الدائرية صفحة 45 بالكتاب">
          </div>
          <div class="form-group">
            <label>تعليمات الحل وإرشادات المعلم</label>
            <textarea id="mHwInstructions" rows="2" placeholder="أدخل المطلوب حله وتوضيح طريقة الحل وملاحظات المعلم..."></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>المرحلة الدراسية *</label>
              <select id="mHwStage" required>
                <option value="">— اختر المرحلة —</option>
                ${stages.map(st => `<option value="${st.id}">${escapeHtmlAttr(st.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>المادة الدراسية *</label>
              <select id="mHwSubject" required>
                <option value="">— اختر المادة —</option>
                ${subjects.map(sb => `<option value="${sb.id}">${escapeHtmlAttr(sb.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>الدرس المرتبط *</label>
              <select id="mHwLesson" required>
                <option value="">— اختر الدرس —</option>
                ${lessons.map(l => `<option value="${l.id}">${escapeHtmlAttr(l.title)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>المجموعة المستهدفة</label>
              <select id="mHwGroup">
                <option value="">— جميع مجموعات المادة —</option>
                ${groups.map(g => `<option value="${g.id}">${escapeHtmlAttr(g.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label>نمط الواجب والتسليم</label>
              <select id="mHwMode">
                <option value="PAPER">📝 ورقي بالكشكول بالسنتر</option>
                <option value="HYBRID" selected>📲 مختلط (رفع صور الحلول)</option>
                <option value="DIGITAL">💻 إلكتروني كامل</option>
              </select>
            </div>
            <div class="form-group">
              <label>الدرجة القصوى</label>
              <input type="number" id="mHwScore" min="1" value="20">
            </div>
            <div class="form-group">
              <label>آخر موعد للتسليم (Due Date)</label>
              <input type="date" id="mHwDue" value="${nextWeek}">
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex; justify-content:space-between; align-items:center;">
              <span>مرفق ورقة الأسئلة أو الشيت (PDF / ملف / رابط):</span>
              <span style="font-size:0.75rem; color:#94a3b8;">اختيار من الجهاز أو رابط مباشر</span>
            </label>
            <div style="display:flex; gap:0.5rem; margin-bottom:0.4rem;">
              <button type="button" class="btn" style="background:#0284c7; color:#fff; font-size:0.8rem; display:flex; align-items:center; gap:0.35rem;" onclick="document.getElementById('mHwFileInput').click()">
                📎 اختيار ملف من الكمبيوتر
              </button>
              <input type="file" id="mHwFileInput" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" style="display:none;" onchange="handleHomeworkFilePick(this)">
              <div id="mHwFilePickedName" style="display:none; align-items:center; gap:0.4rem; background:#0f172a; padding:0.25rem 0.6rem; border-radius:6px; border:1px solid #334155; font-size:0.8rem; color:#38bdf8;">
                <span id="mHwFileNameLabel"></span>
                <button type="button" class="btn btn-danger" style="padding:0.1rem 0.35rem; font-size:0.7rem;" onclick="clearHomeworkPickedFile()">✕</button>
              </div>
            </div>
            <input type="url" id="mHwAttachmentUrl" placeholder="أو اكتب رابط الشيت (Google Drive / رابط خارجي)..." style="font-size:0.82rem;">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnSubmitAddHw">💾 تكليف الطلاب بالواجب</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function submitCreateHomework() {
  const btn = document.getElementById('btnSubmitAddHw');
  const title = document.getElementById('mHwTitle')?.value.trim();
  const instructions = document.getElementById('mHwInstructions')?.value.trim();
  const stageId = document.getElementById('mHwStage')?.value;
  const subjectId = document.getElementById('mHwSubject')?.value;
  const lessonId = document.getElementById('mHwLesson')?.value;
  const groupId = document.getElementById('mHwGroup')?.value || null;
  const mode = document.getElementById('mHwMode')?.value || 'HYBRID';
  const maxScore = Number(document.getElementById('mHwScore')?.value || 20);
  const dueAt = document.getElementById('mHwDue')?.value;
  const attachmentUrl = document.getElementById('mHwAttachmentUrl')?.value.trim() || null;

  if (!title || !stageId || !subjectId || !lessonId) {
    return showToast('العنوان والمرحلة والمادة والدرس مطلوبة', true);
  }

  if (btn) btn.disabled = true;
  try {
    await callBackend('createHomeworkRecord', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      title, instructions, description: instructions,
      stageId, subjectId, lessonId, groupId,
      groupIds: groupId ? [groupId] : [],
      mode, maxScore,
      attachmentUrl,
      dueAt: dueAt ? dueAt + 'T23:59:59Z' : null
    });
    showToast('تم تكليف الطلاب بالواجب بنجاح!');
    closeModal();
    if (activeView === 'homework') await renderActiveView('homework');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function handleHomeworkFilePick(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 10 * 1024 * 1024) {
    showToast('حجم الملف كبير، يرجى اختيار ملف أقل من 10 ميجابايت', true);
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const urlInput = document.getElementById('mHwAttachmentUrl');
    if (urlInput) urlInput.value = dataUrl;
    const label = document.getElementById('mHwFileNameLabel');
    if (label) label.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    const box = document.getElementById('mHwFilePickedName');
    if (box) box.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

function clearHomeworkPickedFile() {
  const fileInput = document.getElementById('mHwFileInput');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('mHwAttachmentUrl');
  if (urlInput) urlInput.value = '';
  const box = document.getElementById('mHwFilePickedName');
  if (box) box.style.display = 'none';
}

async function publishHomeworkAction(homeworkId) {
  try {
    await callBackend('setHomeworkStatusRecord', currentCallerToken, homeworkId, 'PUBLISHED', currentCallerToken.institutionId);
    showToast('تم نشر الواجب بنجاح — متاح للطلاب الآن 🟢');
    if (activeView === 'homework') await renderActiveView('homework');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function closeHomeworkAction(homeworkId) {
  if (!confirm('هل تريد إغلاق فترة تسليم هذا الواجب؟')) return;
  try {
    await callBackend('setHomeworkStatusRecord', currentCallerToken, homeworkId, 'CLOSED', currentCallerToken.institutionId);
    showToast('تم إغلاق تسليم الواجب بنجاح ✅');
    if (activeView === 'homework') await renderActiveView('homework');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// Full Submissions & Grading Modal for Homework
async function openHomeworkSubmissionsModal(homeworkId) {
  const modal = document.getElementById('modalContainer');
  let hw = (window._allHomeworkCache || []).find(h => h.id === homeworkId);
  let students = [];
  let submissions = [];
  let groupName = 'جميع الطلاب';

  try {
    const [subRes, gRes] = await Promise.all([
      callBackend('getHomeworkSubmissions', currentCallerToken, homeworkId, currentCallerToken.institutionId).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    submissions = subRes || [];

    if (hw && hw.groupId) {
      const g = (gRes || []).find(x => x.id === hw.groupId);
      if (g) groupName = g.name;
      students = await callBackend('getGroupStudents', currentCallerToken, hw.groupId, currentCallerToken.institutionId).catch(() => []) || [];
    } else {
      const allSt = await callBackend('getStudents', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => []) || [];
      students = hw && hw.stageId ? allSt.filter(s => s.stageId === hw.stageId && s.status !== 'ARCHIVED') : allSt;
    }
  } catch (_) {
    students = [];
  }

  const maxScore = Number(hw?.maxScore || 20);
  const subMap = new Map(submissions.map(s => [s.studentId, s]));

  window._activeHomeworkSubmissions = {
    homeworkId, maxScore,
    studentIds: students.map(s => s.id)
  };

  let submittedCount = 0;
  let gradedCount = 0;
  let lateCount = 0;

  students.forEach(st => {
    const s = subMap.get(st.id);
    if (s) {
      if (s.status === 'RETURNED' || s.status === 'GRADED') gradedCount++;
      else submittedCount++;
      if (s.status === 'LATE') lateCount++;
    }
  });

  const pendingCount = Math.max(0, students.length - (submittedCount + gradedCount));

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:880px; max-height:90vh; display:flex; flex-direction:column;">
        <div class="modal-header">
          <div>
            <div class="modal-title">📥 كشف تسليمات وتصحيح الواجب: ${escapeHtmlAttr(hw?.title || 'الواجب')}</div>
            <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.25rem;">
              المجموعة: <strong style="color:#38bdf8;">${escapeHtmlAttr(groupName)}</strong> | 
              الدرجة القصوى: <strong style="color:#4ade80;">${maxScore} درجة</strong> | 
              آخر موعد: <strong>${hw?.dueAt ? new Date(hw.dueAt).toLocaleDateString('ar-EG') : 'غير محدد'}</strong>
            </div>
          </div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <!-- Stats Bar -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; padding: 0.75rem 0; border-bottom: 1px solid #1e293b;">
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">إجمالي الطلاب</div><div style="font-weight:bold; font-size:1.1rem; color:#f8fafc;">${students.length}</div></div>
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">تم التسليم والتصحيح</div><div style="font-weight:bold; font-size:1.1rem; color:#4ade80;">${gradedCount}</div></div>
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">بانتظار التصحيح</div><div style="font-weight:bold; font-size:1.1rem; color:#38bdf8;">${submittedCount}</div></div>
          <div class="stat-card" style="padding:0.6rem; text-align:center;"><div class="label" style="font-size:0.75rem;">لم يسلموا بعد</div><div style="font-weight:bold; font-size:1.1rem; color:#f87171;">${pendingCount}</div></div>
        </div>

        <!-- Search Bar -->
        <div style="padding:0.6rem 0;">
          <input type="text" id="hwSubSearchInput" placeholder="🔍 بحث في تسليمات الطلاب بالاسم أو الكود..." oninput="filterHwSubRows()" style="width:100%; padding:0.5rem; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
        </div>

        <!-- Submissions Table -->
        <div style="flex:1; overflow-y:auto; padding:0.25rem 0;">
          <table class="data-table" id="hwSubTable">
            <thead>
              <tr>
                <th style="width:35px;">#</th>
                <th>بيانات الطالب</th>
                <th style="width:130px;">حالة التسليم</th>
                <th>إجابة / مرفق الطالب</th>
                <th style="width:95px;">الدرجة / ${maxScore}</th>
                <th>ملاحظات وتوجيهات المعلم</th>
                <th style="width:75px; text-align:center;">إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${students.length ? students.map((st, idx) => {
                const sub = subMap.get(st.id);
                const hasSub = !!sub;
                const status = sub?.status || 'NOT_SUBMITTED';
                const score = sub && sub.score !== undefined ? sub.score : '';
                const feedback = sub?.teacherFeedback || '';
                const hasAttachment = sub && (sub.attachmentUrl || sub.attachment?.url || sub.attachment?.r2Key);
                const attachUrl = sub?.attachmentUrl || sub?.attachment?.url;

                let statusBadge = '<span class="badge" style="background:#7f1d1d; color:#fca5a5;">❌ لم يسلّم بعد</span>';
                if (status === 'RETURNED' || status === 'GRADED') statusBadge = '<span class="badge" style="background:#064e3b; color:#86efac;">⭐ تم التصحيح</span>';
                else if (status === 'LATE') statusBadge = '<span class="badge" style="background:#78350f; color:#fde047;">⚠️ تسليم متأخر</span>';
                else if (status === 'SUBMITTED') statusBadge = '<span class="badge" style="background:#0c4a6e; color:#7dd3fc;">🟢 تم التسليم</span>';

                return `
                  <tr class="hw-sub-row" data-search="${escapeHtmlAttr(((st.name || '') + ' ' + (st.studentCode || '') + ' ' + (st.phone || '')).toLowerCase())}">
                    <td style="color:#64748b; font-size:0.8rem;">${idx + 1}</td>
                    <td>
                      <strong style="color:#f8fafc;">${escapeHtmlAttr(st.name)}</strong>
                      <div style="font-size:0.72rem; color:#94a3b8;"><span class="code-box" style="font-size:0.65rem;">${st.studentCode || st.id}</span> ${st.phone || ''}</div>
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                      ${attachUrl ? `
                        <a href="${escapeHtmlAttr(attachUrl)}" target="_blank" class="btn" style="padding:0.2rem 0.5rem; font-size:0.72rem; background:#0284c7;">📎 معاينة الحل</a>
                      ` : (sub?.textAnswer ? `
                        <span style="font-size:0.8rem; color:#cbd5e1; max-width:160px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtmlAttr(sub.textAnswer)}">💬 ${escapeHtmlAttr(sub.textAnswer)}</span>
                      ` : '<span style="color:#64748b; font-size:0.78rem;">تسليم ورقي بالكشكول</span>')}
                    </td>
                    <td>
                      <input type="number" id="hw_sc_${st.id}" value="${score}" min="0" max="${maxScore}" step="0.5" placeholder="0" style="width:100%; padding:0.35rem; background:#1e293b; border:1px solid #334155; border-radius:4px; color:#4ade80; font-weight:bold; text-align:center; font-size:0.9rem;">
                    </td>
                    <td>
                      <input type="text" id="hw_fb_${st.id}" value="${escapeHtmlAttr(feedback)}" placeholder="أدخل تقييمك للطالب..." style="width:100%; padding:0.35rem; background:#1e293b; border:1px solid #334155; border-radius:4px; color:#cbd5e1; font-size:0.8rem;">
                    </td>
                    <td style="text-align:center;">
                      <button class="btn btn-success" style="padding:0.25rem 0.55rem; font-size:0.75rem;" onclick="submitSingleHwGrade('${st.id}', '${escapeHtmlAttr(st.name)}', '${escapeHtmlAttr(st.studentCode || '')}')">💾 رصد</button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="7" style="text-align:center; padding:2rem; color:#94a3b8;">لا يوجد طلاب مسجلون في هذه المجموعة حالياً.</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:1rem; border-top:1px solid #1e293b; padding-top:0.75rem;">
          <button type="button" class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="submitBulkHwGrades()">💾 حفظ ورصد درجات جميع الطلاب المسلمين</button>
          <button type="button" class="btn" onclick="closeModal()">تم والإغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function filterHwSubRows() {
  const q = (document.getElementById('hwSubSearchInput')?.value || '').trim().toLowerCase();
  const rows = document.querySelectorAll('.hw-sub-row');
  rows.forEach(r => {
    const s = r.getAttribute('data-search') || '';
    r.style.display = s.includes(q) ? '' : 'none';
  });
}

async function submitSingleHwGrade(studentId, studentName, studentCode) {
  const hwSt = window._activeHomeworkSubmissions;
  if (!hwSt) return;
  const scoreInput = document.getElementById(`hw_sc_${studentId}`);
  const fbInput = document.getElementById(`hw_fb_${studentId}`);
  const score = Number(scoreInput?.value || 0);
  const feedback = fbInput?.value || '';

  try {
    await callBackend('recordHomeworkGradeDirect', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      homeworkId: hwSt.homeworkId,
      studentId,
      studentName,
      studentCode,
      score,
      maxScore: hwSt.maxScore,
      feedback,
      status: 'RETURNED'
    });
    showToast(`تم تصحيح ورصد واجب (${studentName}): ${score} د بنجاح ⭐`);
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

async function submitBulkHwGrades() {
  const hwSt = window._activeHomeworkSubmissions;
  if (!hwSt || !hwSt.studentIds || !hwSt.studentIds.length) return;

  let saved = 0;
  for (const stId of hwSt.studentIds) {
    const scoreInput = document.getElementById(`hw_sc_${stId}`);
    const fbInput = document.getElementById(`hw_fb_${stId}`);
    const rawVal = scoreInput?.value;

    if (rawVal !== '') {
      const score = Number(rawVal || 0);
      const feedback = fbInput?.value || '';
      await callBackend('recordHomeworkGradeDirect', currentCallerToken, {
        institutionId: currentCallerToken.institutionId,
        homeworkId: hwSt.homeworkId,
        studentId: stId,
        score,
        maxScore: hwSt.maxScore,
        feedback,
        status: 'RETURNED'
      }).catch(() => {});
      saved++;
    }
  }

  showToast(`تم حفظ وتحديث تقييمات (${saved}) طالب بنجاح!`);
}

// ============================================================================
// AI EXAM GENERATOR (FREE GEMINI FLASH / GROQ IN-CONTEXT & FILE UPLOAD)
// ============================================================================

window._aiUploadedFileText = '';
window._aiGeneratedExam = null;

function toggleAiSourceMode(mode) {
  const topicBox = document.getElementById('aiSourceTopicBox');
  const fileBox = document.getElementById('aiSourceFileBox');
  const textBox = document.getElementById('aiSourceTextBox');
  if (topicBox) topicBox.style.display = (mode === 'TOPIC_ONLY') ? 'block' : 'none';
  if (fileBox) fileBox.style.display = (mode === 'FILE_UPLOAD') ? 'block' : 'none';
  if (textBox) textBox.style.display = (mode === 'TEXT_PASTE') ? 'block' : 'none';
}

function filterAiGroupsByStage() {
  const stageId = document.getElementById('mAiStage')?.value;
  const groupSelect = document.getElementById('mAiGroup');
  if (!groupSelect) return;
  for (let i = 0; i < groupSelect.options.length; i++) {
    const opt = groupSelect.options[i];
    if (!opt.value) continue;
    const optStage = opt.getAttribute('data-stage');
    opt.style.display = (!stageId || !optStage || optStage === stageId) ? '' : 'none';
  }
}

function handleAiFileUpload(input) {
  const status = document.getElementById('aiFileStatus');
  if (!input.files || !input.files[0]) {
    window._aiUploadedFileText = '';
    if (status) status.innerText = 'لم يتم اختيار ملف.';
    return;
  }
  const file = input.files[0];
  if (status) status.innerHTML = `جاري قراءة الملف: <strong style="color:#38bdf8;">${escapeHtmlAttr(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)...`;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    if (typeof content === 'string') {
      window._aiUploadedFileText = content;
      if (status) status.innerHTML = `✅ تم استخراج نص الملف بنجاح: <strong style="color:#4ade80;">${escapeHtmlAttr(file.name)}</strong> (${content.length} حرف)`;
    } else {
      // Binary array buffer fallback
      const dec = new TextDecoder('utf-8');
      window._aiUploadedFileText = dec.decode(content);
      if (status) status.innerHTML = `✅ تم استخراج بيانات الملف بنجاح: <strong style="color:#4ade80;">${escapeHtmlAttr(file.name)}</strong>`;
    }
  };
  reader.onerror = function() {
    window._aiUploadedFileText = '';
    if (status) status.innerHTML = `<span style="color:#f87171;">⚠️ تعذر قراءة الملف — يمكنك نسخ ولصق النص مباشرة في خانة اللصق المباشر.</span>`;
  };

  reader.readAsText(file);
}

function backToAiConfig() {
  const formSec = document.getElementById('aiExamFormSection');
  const reviewSec = document.getElementById('aiExamReviewSection');
  const loadSec = document.getElementById('aiExamLoadingSection');
  if (formSec) formSec.style.display = 'block';
  if (reviewSec) reviewSec.style.display = 'none';
  if (loadSec) loadSec.style.display = 'none';
}

async function openAiExamGeneratorModal() {
  const modal = document.getElementById('modalContainer');
  let stages = [];
  let subjects = [];
  let groups = [];

  try {
    const [stRes, subRes, gRes] = await Promise.all([
      callBackend('getStages', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getSubjects', currentCallerToken, currentCallerToken.institutionId).catch(() => []),
      callBackend('getGroups', currentCallerToken, { institutionId: currentCallerToken.institutionId }).catch(() => [])
    ]);
    stages = stRes || [];
    subjects = subRes || [];
    groups = gRes || [];
  } catch (_) {}

  window._aiUploadedFileText = '';
  window._aiGeneratedExam = null;

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal-content" style="max-width:820px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden;">
        <div class="modal-header" style="background:linear-gradient(135deg, #1e1b4b, #311042); border-bottom:1px solid #4338ca; padding:1rem 1.25rem;">
          <div>
            <div class="modal-title" style="display:flex; align-items:center; gap:0.5rem; color:#fff; font-size:1.15rem;">
              <span>🤖 توليد بنك أسئلة واختبار بالذكاء الاصطناعي</span>
              <span class="badge" style="background:#059669; color:#fff; font-size:0.75rem;">مجاني 100% — Gemini Flash / Groq</span>
            </div>
            <div style="font-size:0.8rem; color:#c7d2fe; margin-top:0.25rem;">
              يمكنك رفع مذكرة/ملف الدرس أو إدخال الموضوع لتوليد أسئلة دقيقة مطابقة للمنهج ومراجعتها قبل اعتمادها ونشرها للمجموعة
            </div>
          </div>
          <button class="modal-close" onclick="closeModal()" style="color:#fff;">×</button>
        </div>

        <div style="flex:1; overflow-y:auto; padding:1.25rem;">
          <!-- Setup Form -->
          <div id="aiExamFormSection">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
              <div class="form-group">
                <label>المرحلة الدراسية *</label>
                <select id="mAiStage" required onchange="filterAiGroupsByStage()">
                  <option value="">— اختر المرحلة —</option>
                  ${stages.map(st => `<option value="${st.id}">${escapeHtmlAttr(st.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>المادة الدراسية *</label>
                <select id="mAiSubject" required>
                  <option value="">— اختر المادة —</option>
                  ${subjects.map(sb => `<option value="${sb.id}">${escapeHtmlAttr(sb.name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
              <div class="form-group">
                <label>المجموعة المستهدفة بالسنتر *</label>
                <select id="mAiGroup" required>
                  <option value="">— اختر المجموعة —</option>
                  ${groups.map(g => `<option value="${g.id}" data-stage="${g.stageId || ''}">${escapeHtmlAttr(g.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>عنوان الاختبار المقترح *</label>
                <input type="text" id="mAiTitle" placeholder="مثال: اختبار الوحدة الأولى - قوانين الحركة والسرعة">
              </div>
            </div>

            <!-- Knowledge Source Selection -->
            <div style="background:#0f172a; padding:1rem; border-radius:8px; border:1px solid #1e293b; margin:0.75rem 0;">
              <div style="font-weight:bold; color:#38bdf8; font-size:0.9rem; margin-bottom:0.6rem;">📂 مصدر الأسئلة والمحتوى التعليمي:</div>
              <div style="display:flex; gap:1.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.85rem; color:#f8fafc;">
                  <input type="radio" name="aiSourceMode" value="TOPIC_ONLY" checked onchange="toggleAiSourceMode('TOPIC_ONLY')">
                  💡 من موضوع محدد ومخرجات التعلم للمنهج
                </label>
                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.85rem; color:#f8fafc;">
                  <input type="radio" name="aiSourceMode" value="FILE_UPLOAD" onchange="toggleAiSourceMode('FILE_UPLOAD')">
                  📁 رفع ملف / مذكرة / شيت (PDF / TXT / Word)
                </label>
                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.85rem; color:#f8fafc;">
                  <input type="radio" name="aiSourceMode" value="TEXT_PASTE" onchange="toggleAiSourceMode('TEXT_PASTE')">
                  ✍️ لصق نص مباشر أو ملخص الدرس
                </label>
              </div>

              <!-- Topic Input -->
              <div id="aiSourceTopicBox" class="form-group" style="margin-bottom:0;">
                <label>موضوع الاختبار / الدرس أو الوحدة بالتفصيل</label>
                <input type="text" id="mAiTopic" placeholder="مثال: قانون نيوتن الثاني، كمية التحرك، وتطبيقات القوة والمقاومة">
              </div>

              <!-- File Upload Input -->
              <div id="aiSourceFileBox" class="form-group" style="display:none; margin-bottom:0;">
                <label>اختر ملف المذكرة أو ملخص الدرس من جهازك (TXT, MD, PDF, DOCX, JSON)</label>
                <input type="file" id="mAiFile" accept=".txt,.md,.text,.pdf,.doc,.docx,.json" onchange="handleAiFileUpload(this)" style="background:#1e293b; border:1px solid #334155; padding:0.4rem; border-radius:6px; width:100%; color:#fff;">
                <div id="aiFileStatus" style="font-size:0.8rem; margin-top:0.4rem; color:#94a3b8;">يرجى اختيار ملف المذكرة...</div>
              </div>

              <!-- Text Paste Input -->
              <div id="aiSourceTextBox" class="form-group" style="display:none; margin-bottom:0;">
                <label>الصق نص المذكرة أو أسئلة الاسترشاد أو شرح الدرس هنا</label>
                <textarea id="mAiContextText" rows="4" placeholder="انسخ والصق محتوى الدرس أو المذكرة هنا ليقوم الذكاء الاصطناعي باستخراج وتوليد أسئلة حصرية منها..."></textarea>
              </div>
            </div>

            <!-- Parameters Grid -->
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem;">
              <div class="form-group">
                <label>عدد الأسئلة</label>
                <select id="mAiCount">
                  <option value="3">3 أسئلة (تقييم سريع)</option>
                  <option value="5" selected>5 أسئلة (اختبار قصير)</option>
                  <option value="10">10 أسئلة (اختبار دوري)</option>
                  <option value="15">15 سؤال (شامل)</option>
                  <option value="20">20 سؤال (نهائي)</option>
                </select>
              </div>
              <div class="form-group">
                <label>نوع الأسئلة</label>
                <select id="mAiType">
                  <option value="MCQ" selected>اختيار من متعدد (MCQ)</option>
                  <option value="TRUE_FALSE">صواب وخطأ</option>
                  <option value="ESSAY">مقالي قصير وتعلِيل</option>
                  <option value="MIXED">منوع (اختياري + مقالي)</option>
                </select>
              </div>
              <div class="form-group">
                <label>مستوى الصعوبة</label>
                <select id="mAiDifficulty">
                  <option value="EASY">سهل (مباشر)</option>
                  <option value="MEDIUM" selected>متوسط (تطبيقي)</option>
                  <option value="HARD">صعب (مستويات عليا)</option>
                  <option value="MIXED">متدرج ومتنوع</option>
                </select>
              </div>
              <div class="form-group">
                <label>درجة كل سؤال</label>
                <input type="number" id="mAiScorePerQuestion" min="1" max="20" value="2">
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
              <button type="button" class="btn" onclick="closeModal()">إلغاء</button>
              <button type="button" class="btn" id="btnGenerateAiExam" style="background:linear-gradient(135deg, #7c3aed, #db2777); color:#fff; font-weight:bold; padding:0.65rem 1.4rem; box-shadow:0 4px 14px rgba(124,58,237,0.4);" onclick="submitGenerateAiQuestions()">
                ⚡ بدء توليد الأسئلة الذكية
              </button>
            </div>
          </div>

          <!-- Loading Spinner -->
          <div id="aiExamLoadingSection" style="display:none; text-align:center; padding:3rem 1rem;">
            <div style="font-size:3.5rem; animation: pulse 1.5s infinite;">🤖✨</div>
            <h3 style="color:#f8fafc; margin:0.75rem 0 0.5rem 0;">جاري صياغة وتوليد الأسئلة بالذكاء الاصطناعي...</h3>
            <p style="color:#94a3b8; font-size:0.9rem;" id="aiLoadingStatusText">يتم التواصل مع محرك Gemini Flash / Groq وتحليل المحتوى...</p>
          </div>

          <!-- Questions Review Section -->
          <div id="aiExamReviewSection" style="display:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:1px solid #334155;">
              <div>
                <h4 style="margin:0; color:#38bdf8; font-size:1.1rem;" id="aiReviewExamTitle">معاينة بنك الأسئلة المولد</h4>
                <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.2rem;" id="aiReviewExamMeta"></div>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button type="button" class="btn" style="background:#334155; font-size:0.8rem;" onclick="backToAiConfig()">🔄 تعديل الإعدادات</button>
                <button type="button" class="btn btn-success" style="box-shadow:0 4px 12px rgba(34,197,94,0.3); font-weight:bold;" onclick="adoptAndSaveAiExam()">💾 اعتماد ونشر الاختبار للمجموعة</button>
              </div>
            </div>

            <div id="aiGeneratedQuestionsList" style="display:flex; flex-direction:column; gap:0.85rem;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function submitGenerateAiQuestions() {
  const stageId = document.getElementById('mAiStage')?.value;
  const subjectId = document.getElementById('mAiSubject')?.value;
  const groupId = document.getElementById('mAiGroup')?.value;
  const title = (document.getElementById('mAiTitle')?.value || '').trim() || 'اختبار دوري بالذكاء الاصطناعي';
  const topic = (document.getElementById('mAiTopic')?.value || '').trim();
  const count = Number(document.getElementById('mAiCount')?.value || 5);
  const type = document.getElementById('mAiType')?.value || 'MCQ';
  const difficulty = document.getElementById('mAiDifficulty')?.value || 'MEDIUM';
  const scorePerQ = Number(document.getElementById('mAiScorePerQuestion')?.value || 2);

  const mode = document.querySelector('input[name="aiSourceMode"]:checked')?.value || 'TOPIC_ONLY';
  let contextText = '';
  if (mode === 'FILE_UPLOAD') {
    contextText = window._aiUploadedFileText || '';
  } else if (mode === 'TEXT_PASTE') {
    contextText = (document.getElementById('mAiContextText')?.value || '').trim();
  }

  if (!stageId || !subjectId) {
    return showToast('المرحلة والمادة الدراسية مطلوبة', true);
  }
  if (!topic && !contextText) {
    return showToast('يرجى تحديد موضوع الاختبار أو رفع مذكرة/لصق نص الدرس', true);
  }

  const formSec = document.getElementById('aiExamFormSection');
  const loadSec = document.getElementById('aiExamLoadingSection');
  const reviewSec = document.getElementById('aiExamReviewSection');

  if (formSec) formSec.style.display = 'none';
  if (loadSec) loadSec.style.display = 'block';

  try {
    const res = await callBackend('generateExamQuestionsAi', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      groupId,
      stageId,
      subjectId,
      topic,
      contextText,
      questionCount: count,
      difficulty,
      questionType: type
    });

    const questions = (res && Array.isArray(res.questions) && res.questions.length > 0)
      ? res.questions
      : [];

    if (!questions.length) {
      throw new Error('لم يتمكن محرك الذكاء الاصطناعي من استخراج أسئلة من المحتوى المقدم');
    }

    // Attach mark to each question
    questions.forEach(q => {
      if (!q.marks) q.marks = scorePerQ;
    });

    const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || scorePerQ), 0);

    window._aiGeneratedExam = {
      title,
      stageId,
      subjectId,
      groupId,
      totalMarks,
      passingScore: Math.round(totalMarks * 0.5),
      questions,
      provider: res.provider || 'Gemini Flash'
    };

    if (loadSec) loadSec.style.display = 'none';
    if (reviewSec) reviewSec.style.display = 'block';

    renderGeneratedQuestionsReview();
  } catch (err) {
    if (loadSec) loadSec.style.display = 'none';
    if (formSec) formSec.style.display = 'block';
    showToast(friendlyBatchAError(err), true);
  }
}

function renderGeneratedQuestionsReview() {
  const exam = window._aiGeneratedExam;
  if (!exam) return;

  const titleEl = document.getElementById('aiReviewExamTitle');
  const metaEl = document.getElementById('aiReviewExamMeta');
  const listEl = document.getElementById('aiGeneratedQuestionsList');

  if (titleEl) titleEl.innerText = exam.title;
  if (metaEl) {
    metaEl.innerHTML = `المحرك: <strong style="color:#4ade80;">${escapeHtmlAttr(exam.provider)}</strong> | إجمالي الأسئلة: <strong style="color:#38bdf8;">${exam.questions.length}</strong> | الدرجة الكلية: <strong style="color:#facc15;">${exam.totalMarks} درجة</strong>`;
  }

  if (!listEl) return;
  listEl.innerHTML = exam.questions.map((q, idx) => {
    const choices = Array.isArray(q.options) ? q.options : [];
    return `
      <div class="card" style="padding:1rem; background:#0f172a; border:1px solid #1e293b; border-radius:8px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
          <div style="font-weight:bold; color:#f8fafc; font-size:0.95rem; line-height:1.5;">
            <span style="color:#38bdf8; margin-left:0.35rem;">س ${idx + 1}:</span> ${escapeHtmlAttr(q.prompt || q.questionText || '')}
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
            <span class="badge" style="background:#1e293b; color:#fbbf24; border:1px solid #d97706;">${q.marks || 2} درجات</span>
            <button type="button" class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="removeAiGeneratedQuestion(${idx})">🗑️ حذف</button>
          </div>
        </div>

        ${choices.length ? `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin:0.6rem 0;">
            ${choices.map((c, cIdx) => {
              const optText = typeof c === 'string' ? c : (c.text || c.optionText || '');
              const isCorrect = (q.correctAnswer && (q.correctAnswer === optText || q.correctAnswer === String.fromCharCode(65 + cIdx) || q.correctAnswer === String(cIdx + 1)));
              return `
                <div style="padding:0.45rem 0.65rem; border-radius:6px; font-size:0.85rem; background:${isCorrect ? 'rgba(34,197,94,0.15)' : '#1e293b'}; border:1px solid ${isCorrect ? '#22c55e' : '#334155'}; color:${isCorrect ? '#86efac' : '#cbd5e1'};">
                  <strong>${String.fromCharCode(65 + cIdx)})</strong> ${escapeHtmlAttr(optText)} ${isCorrect ? '✓' : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${q.correctAnswer ? `
          <div style="font-size:0.8rem; color:#4ade80; margin-top:0.4rem;">
            <strong>الإجابة النموذجية:</strong> ${escapeHtmlAttr(String(q.correctAnswer))}
          </div>
        ` : ''}

        ${q.explanation ? `
          <div style="font-size:0.78rem; color:#94a3b8; margin-top:0.25rem;">
            <strong>الشرح والتوضيح:</strong> ${escapeHtmlAttr(q.explanation)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function removeAiGeneratedQuestion(index) {
  const exam = window._aiGeneratedExam;
  if (!exam || !exam.questions) return;
  exam.questions.splice(index, 1);
  exam.totalMarks = exam.questions.reduce((sum, q) => sum + (Number(q.marks) || 2), 0);
  exam.passingScore = Math.round(exam.totalMarks * 0.5);
  renderGeneratedQuestionsReview();
  showToast('تم حذف السؤال وتحديث مجموع الدرجات');
}

async function adoptAndSaveAiExam() {
  const exam = window._aiGeneratedExam;
  if (!exam || !exam.questions || !exam.questions.length) {
    return showToast('لا توجد أسئلة للاعتماد', true);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    await callBackend('createExam', currentCallerToken, {
      institutionId: currentCallerToken.institutionId,
      title: exam.title,
      description: `اختبار دوري مولد بالذكاء الاصطناعي (${exam.provider}) - يشمل ${exam.questions.length} سؤال`,
      stageId: exam.stageId,
      subjectId: exam.subjectId,
      groupId: exam.groupId || null,
      groupIds: exam.groupId ? [exam.groupId] : [],
      examType: 'DIGITAL',
      maxScore: exam.totalMarks,
      passingScore: exam.passingScore,
      totalMarksHundredths: exam.totalMarks * 100,
      passingMarksHundredths: exam.passingScore * 100,
      durationMinutes: exam.questions.length * 3,
      examDate: today,
      questions: exam.questions,
      source: 'AI_GEMINI_FLASH'
    });

    closeModal();
    showToast(`تم اعتماد وحفظ الاختبار (${exam.title}) ونشره بنجاح! 🟢`);
    await renderActiveView('exams');
  } catch (err) {
    showToast(friendlyBatchAError(err), true);
  }
}

// ----------------------------------------------------------------------------
// AUTO-UPDATE SYSTEM (DIRECT GITHUB RELEASES & ZERO-CONFIG)
// ----------------------------------------------------------------------------

let isUpdateModalOpen = false;

async function checkForAppUpdatesSilently(isManual = false) {
  if (!navigator.onLine) {
    if (isManual) showToast('جهاز الكمبيوتر غير متصل بالإنترنت لفحص التحديثات', true);
    return;
  }
  if (isManual) showToast('جاري فحص وجود تحديثات جديدة...');

  // 1. Check for Lightweight Hotpatch First (< 1 MB)
  if (window.electronAPI && typeof window.electronAPI.checkForHotpatch === 'function') {
    try {
      const hp = await window.electronAPI.checkForHotpatch();
      if (hp && hp.success && hp.available) {
        showHotpatchAvailableModal(hp);
        return;
      }
    } catch (_) {}
  }

  // 2. Fallback to Full Installer Update Check (93 MB)
  if (!window.electronAPI || typeof window.electronAPI.checkForUpdates !== 'function') return;
  try {
    const res = await window.electronAPI.checkForUpdates();
    if (res && res.success && res.available && res.downloadUrl) {
      latestCachedUpdateInfo = res;
      updateGlobalNotificationBadges(res);
      showUpdateAvailableModal(res);
    } else if (isManual) {
      showToast('أنت تستخدم أحدث إصدار من برنامج السنتر بالفعل ✅');
    }
  } catch (err) {
    if (isManual) showToast(`تعذر فحص التحديثات: ${err.message}`, true);
  }
}

function triggerManualUpdateCheck() {
  checkForAppUpdatesSilently(true);
}

function showHotpatchAvailableModal(patch) {
  if (isUpdateModalOpen) return;
  isUpdateModalOpen = true;

  const container = document.getElementById('modalContainer');
  if (!container) return;

  const totalBytes = Array.isArray(patch.files) ? patch.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0;
  const sizeKb = totalBytes ? `${(totalBytes / 1024).toFixed(0)} KB` : '< 1 MB';

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:520px; max-height:90vh; overflow-y:auto; padding:2rem; background:#0f172a; border:2px solid #38bdf8; border-radius:14px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.7);">
        <div style="font-size:3.2rem; margin-bottom:0.8rem;">⚡</div>
        <h2 style="color:#38bdf8; margin:0 0 0.5rem 0; font-size:1.4rem;">تحديث فوري خفيف متوفر! (OTA Hotpatch)</h2>
        <div style="display:inline-block; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; padding:0.3rem 0.9rem; border-radius:20px; font-weight:bold; font-size:0.85rem; margin-bottom:1.2rem;">
          الإصدار الفوري: ${escapeHtmlAttr(patch.patchVersion)} • الحجم: ${sizeKb}
        </div>
        
        <p style="color:#94a3b8; font-size:0.88rem; margin:0 0 1.25rem 0; line-height:1.6;">
          تحديث كود فوري وسريع لا يتطلب تحميل البرنامج كاملاً ويتم تطبيقه في ثانية واحدة فقط.
        </p>

        <div style="background:#1e293b; border-radius:8px; padding:1rem; text-align:right; margin-bottom:1.5rem; border-right:4px solid #38bdf8;">
          <strong style="color:#f8fafc; font-size:0.9rem; display:block; margin-bottom:0.4rem;">محتوى التعديل والتحسينات:</strong>
          <div style="color:#cbd5e1; font-size:0.85rem; line-height:1.6;">
            ${escapeHtmlAttr(patch.description || 'تحسينات وإصلاحات فورية لاستقرار البرنامج والواجهات.')}
          </div>
        </div>

        <div id="hotpatchActionControls" style="display:flex; justify-content:center; gap:0.75rem;">
          <button class="btn" onclick="closeHotpatchModal()" style="padding:0.6rem 1.5rem; background:#334155; color:#cbd5e1;">لاحقاً</button>
          <button class="btn btn-primary" id="btnApplyHotpatchNow" onclick="applyHotpatchAction('${encodeURIComponent(JSON.stringify(patch))}')" style="padding:0.6rem 1.8rem; font-weight:bold; background:#0284c7; color:#fff; display:flex; align-items:center; gap:0.4rem;">
            <span>⚡ تطبيق التحديث الآن فوراً</span>
          </button>
        </div>

        <div id="hotpatchProgressBox" style="display:none; margin-top:1.25rem;">
          <div class="spinner" style="margin:0 auto 0.75rem auto; width:35px; height:35px; border-width:3px;"></div>
          <div style="color:#38bdf8; font-size:0.9rem; font-weight:bold;">جاري تحميل وتطبيق التحديث الفوري...</div>
        </div>
      </div>
    </div>
  `;
}

function closeHotpatchModal() {
  isUpdateModalOpen = false;
  closeModal();
}

async function applyHotpatchAction(patchEncoded) {
  const actionControls = document.getElementById('hotpatchActionControls');
  const progressBox = document.getElementById('hotpatchProgressBox');

  if (actionControls) actionControls.style.display = 'none';
  if (progressBox) progressBox.style.display = 'block';

  try {
    const patch = JSON.parse(decodeURIComponent(patchEncoded));
    const res = await window.electronAPI.downloadApplyHotpatch({ patchInfo: patch });
    if (res && res.success) {
      if (progressBox) {
        progressBox.innerHTML = `
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">✅</div>
          <div style="color:#22c55e; font-size:1.1rem; font-weight:bold;">تم تطبيق التحديث الفوري بنجاح!</div>
          <div style="color:#94a3b8; font-size:0.85rem; margin-top:0.3rem;">جاري إعادة تشغيل الواجهة لتفعيل التعديلات...</div>
        `;
      }
      setTimeout(() => {
        if (window.electronAPI && typeof window.electronAPI.relaunchApp === 'function') {
          window.electronAPI.relaunchApp();
        } else {
          location.reload();
        }
      }, 1400);
    } else {
      throw new Error(res?.error || 'فشل تطبيق التحديث');
    }
  } catch (err) {
    if (actionControls) actionControls.style.display = 'flex';
    if (progressBox) progressBox.style.display = 'none';
    showToast(`خطأ أثناء تطبيق التحديث: ${err.message}`, true);
  }
}

if (window.electronAPI && typeof window.electronAPI.onHotpatchReady === 'function') {
  window.electronAPI.onHotpatchReady((patch) => {
    showHotpatchAvailableModal(patch);
  });
}

function showUpdateAvailableModal(release) {
  if (isUpdateModalOpen) return;
  isUpdateModalOpen = true;

  const container = document.getElementById('modalContainer');
  if (!container) return;

  const sizeMb = release.size ? `(${(release.size / 1048576).toFixed(1)} ميجابايت)` : '';

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="width:560px; max-height:90vh; overflow-y:auto; padding:2rem; background:#0f172a; border:2px solid #38bdf8; border-radius:14px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.7);">
        <div style="font-size:3.5rem; margin-bottom:1rem;">🚀</div>
        <h2 style="color:#38bdf8; margin:0 0 0.5rem 0; font-size:1.5rem;">تحديث جديد متوفر لبرنامج السنتر!</h2>
        <div style="display:inline-block; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; padding:0.3rem 0.9rem; border-radius:20px; font-weight:bold; font-size:0.9rem; margin-bottom:1.2rem;">
          الإصدار الجديد: v${escapeHtmlAttr(release.version)} ${sizeMb}
        </div>
        
        <p style="color:#cbd5e1; font-size:0.95rem; line-height:1.7; margin-bottom:1.5rem; text-align:right; background:#1e293b; padding:1rem; border-radius:8px; border-right:4px solid #38bdf8;">
          ${escapeHtmlAttr(release.releaseNotes || 'يتضمن هذا التحديث إصلاحات مهمة لاستقرار الاتصال بالإنترنت، وحل مشكلة طباعة الإيصالات، وتطوير سرعة واستقرار النظام.')}
        </p>

        <!-- Progress Container (Hidden initially) -->
        <div id="updateDownloadProgressBox" style="display:none; margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#94a3b8; margin-bottom:0.4rem;">
            <span id="updateProgressStatus">جاري تنزيل التحديث...</span>
            <span id="updateProgressPercent">0%</span>
          </div>
          <div style="width:100%; height:10px; background:#334155; border-radius:5px; overflow:hidden;">
            <div id="updateProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, #38bdf8, #0284c7); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="updateActionButtons" style="display:flex; gap:0.75rem; justify-content:center;">
          <button class="btn btn-primary" id="btnStartDownloadUpdate" onclick="startUpdateDownloadAction(${JSON.stringify(release).replace(/"/g, '&quot;')})" style="padding:0.75rem 1.8rem; font-weight:bold; font-size:1rem; display:inline-flex; align-items:center; gap:0.5rem;">
            <span>⬇️</span> <span>تحديث وتثبيت الآن تلقائياً</span>
          </button>
          <button class="btn" style="background:#475569; padding:0.75rem 1.5rem;" onclick="closeUpdateModal()">
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  `;
}

function closeUpdateModal() {
  isUpdateModalOpen = false;
  closeModal();
}

async function startUpdateDownloadAction(release) {
  const actionBtns = document.getElementById('updateActionButtons');
  const progressBox = document.getElementById('updateDownloadProgressBox');
  const progressBar = document.getElementById('updateProgressBar');
  const progressPercent = document.getElementById('updateProgressPercent');
  const progressStatus = document.getElementById('updateProgressStatus');

  // In-view elements if available
  const progressBoxInView = document.getElementById('updateDownloadProgressBoxInView');
  const progressBarInView = document.getElementById('updateProgressBarInView');
  const progressPercentInView = document.getElementById('updateProgressPercentInView');
  const progressStatusInView = document.getElementById('updateProgressStatusInView');
  const btnPageUpdateInstall = document.getElementById('btnPageUpdateInstall');

  if (actionBtns) actionBtns.style.display = 'none';
  if (progressBox) progressBox.style.display = 'block';

  if (btnPageUpdateInstall) btnPageUpdateInstall.style.display = 'none';
  if (progressBoxInView) progressBoxInView.style.display = 'block';

  let removeListener = null;
  if (window.electronAPI && typeof window.electronAPI.onUpdateProgress === 'function') {
    removeListener = window.electronAPI.onUpdateProgress((p) => {
      const pct = p.percent || 0;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPercent) progressPercent.innerText = `${pct}%`;
      if (progressBarInView) progressBarInView.style.width = `${pct}%`;
      if (progressPercentInView) progressPercentInView.innerText = `${pct}%`;
    });
  }

  try {
    const res = await window.electronAPI.downloadUpdate({ releaseInfo: release });
    if (removeListener) removeListener();

    if (res && res.success && res.path) {
      const successMsg = '✅ تم التنزيل بنجاح! جاري تثبيت التحديث وإعادة تشغيل البرنامج...';
      if (progressStatus) progressStatus.innerText = successMsg;
      if (progressBar) progressBar.style.width = '100%';
      if (progressPercent) progressPercent.innerText = '100%';

      if (progressStatusInView) progressStatusInView.innerText = successMsg;
      if (progressBarInView) progressBarInView.style.width = '100%';
      if (progressPercentInView) progressPercentInView.innerText = '100%';

      setTimeout(async () => {
        await window.electronAPI.installUpdate({ filePath: res.path });
      }, 1200);
    } else {
      throw new Error(res?.error || 'فشل تنزيل ملف التحديث');
    }
  } catch (err) {
    if (removeListener) removeListener();
    if (progressBox) progressBox.style.display = 'none';
    if (actionBtns) actionBtns.style.display = 'flex';
    if (progressBoxInView) progressBoxInView.style.display = 'none';
    if (btnPageUpdateInstall) btnPageUpdateInstall.style.display = 'inline-flex';
    showToast(`تعذر تثبيت التحديث: ${err.message}`, true);
  }
}

function updateGlobalNotificationBadges(release) {
  const headerBtn = document.getElementById('headerUpdateBtn');
  if (headerBtn) {
    headerBtn.style.display = 'inline-block';
    headerBtn.title = `إصدار جديد متوفر: v${release.version}`;
  }
  const sideBadge = document.getElementById('sidebarUpdateBadge');
  if (sideBadge) {
    sideBadge.style.display = 'inline-block';
  }
  addAppNotification(`🚀 تحديث نظام متوفر (v${release.version})`, 'يتوفر إصدار جديد لبرنامج السنتر - اضغط هنا للتثبيت المباشر', () => {
    navigate('system_updates');
  });
}

// Global Notification Center Drawer Handlers
let appNotificationsList = [];

function toggleNotificationDrawer() {
  const drawer = document.getElementById('notificationDrawer');
  if (!drawer) return;
  const isHidden = drawer.style.display === 'none' || !drawer.style.display;
  drawer.style.display = isHidden ? 'block' : 'none';
}

function clearNotifications() {
  appNotificationsList = [];
  const list = document.getElementById('notificationList');
  const countBadge = document.getElementById('unreadNotifCount');
  if (list) list.innerHTML = '<div style="color:#64748b; font-size:0.85rem; text-align:center; padding:1.5rem 0;">لا توجد تنبيهات جديدة</div>';
  if (countBadge) countBadge.style.display = 'none';
}

function addAppNotification(title, text, onClickAction) {
  const list = document.getElementById('notificationList');
  const countBadge = document.getElementById('unreadNotifCount');
  if (!list) return;

  appNotificationsList.push({ title, text });
  if (countBadge) {
    countBadge.innerText = appNotificationsList.length;
    countBadge.style.display = 'inline-block';
  }

  const item = document.createElement('div');
  item.style.cssText = 'padding:0.75rem; background:#1e293b; border-radius:6px; margin-bottom:0.5rem; cursor:pointer; border-right:3px solid #38bdf8; text-align:right;';
  item.innerHTML = `
    <div style="font-weight:bold; color:#38bdf8; font-size:0.85rem; margin-bottom:0.2rem;">${escapeHtmlAttr(title)}</div>
    <div style="font-size:0.8rem; color:#cbd5e1;">${escapeHtmlAttr(text)}</div>
  `;
  item.onclick = () => {
    toggleNotificationDrawer();
    if (typeof onClickAction === 'function') onClickAction();
  };

  if (appNotificationsList.length === 1) {
    list.innerHTML = '';
  }
  list.prepend(item);
}




