/**
 * Windows Desktop Client Application Logic
 * REMAS Educational Center SaaS
 */

async function initDesktopApp() {
  if (!window.electronAPI) {
    console.log('Running in browser simulation mode');
    return;
  }

  try {
    const fp = await window.electronAPI.getDeviceFingerprint();
    const meta = await window.electronAPI.getSystemMetadata();
    
    document.getElementById('fpBox').innerText = `${fp.substring(0, 22)}...${fp.substring(fp.length - 8)}`;
    document.getElementById('deviceName').innerText = meta.deviceName;
    document.getElementById('osVersion').innerText = meta.osVersion;
    document.getElementById('lastValidatedTime').innerText = new Date().toLocaleTimeString('ar-EG');

    await checkDeviceStatus();

    // Periodic Heartbeat every 60 seconds
    setInterval(sendPeriodicHeartbeat, 60000);
  } catch (err) {
    console.error('Desktop init error:', err);
  }
}

async function checkDeviceStatus() {
  if (!window.electronAPI) return;

  const mockToken = { uid: 'center_admin', role: 'admin', institutionId: 'inst_bootstrap_001' };
  
  try {
    // 1. Activate / Register device if needed
    await window.electronAPI.activateDevice({
      institutionId: 'inst_bootstrap_001',
      callerToken: mockToken
    });

    // 2. Validate device status
    const validation = await window.electronAPI.validateDevice({
      institutionId: 'inst_bootstrap_001',
      callerToken: mockToken
    });

    updateUIStatus(validation);
  } catch (err) {
    console.error('Status check error:', err);
  }
}

function updateUIStatus(validation) {
  const lockScreen = document.getElementById('lockScreen');
  const badge = document.getElementById('statusBadge');
  const licenseState = document.getElementById('licenseState');

  if (validation.valid) {
    lockScreen.classList.add('hidden');
    badge.innerText = 'STATUS: BINDING ACTIVE 🟢';
    badge.className = 'badge';
    licenseState.innerText = 'مرخص ومربوط بالجهاز الحالي (ACTIVE)';
    licenseState.style.color = '#22c55e';
  } else {
    lockScreen.classList.remove('hidden');
    document.getElementById('lockReason').innerText = validation.reason || 'الجهاز غير مصرح له بتشغيل النظام';
    
    if (window.electronAPI) {
      window.electronAPI.getDeviceFingerprint().then(fp => {
        document.getElementById('lockFingerprint').innerText = fp;
      });
    }

    badge.innerText = `STATUS: ${validation.status} 🔴`;
    badge.className = 'badge revoked';
    licenseState.innerText = `غير مفعّل (${validation.status})`;
    licenseState.style.color = '#ef4444';
  }
}

async function sendPeriodicHeartbeat() {
  if (!window.electronAPI) return;
  const mockToken = { uid: 'center_admin', role: 'admin', institutionId: 'inst_bootstrap_001' };
  try {
    const hb = await window.electronAPI.sendHeartbeat({
      institutionId: 'inst_bootstrap_001',
      callerToken: mockToken
    });

    if (hb.status === 'REVOKED') {
      updateUIStatus({ valid: false, status: 'REVOKED', reason: 'تم إلغاء تفعيل هذا الجهاز من الخادم' });
    }
  } catch (err) {
    // Silent handle in heartbeat loop
  }
}

document.addEventListener('DOMContentLoaded', initDesktopApp);
