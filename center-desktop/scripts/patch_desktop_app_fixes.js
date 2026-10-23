const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'src', 'desktop_app.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Ensure openWhatsAppExternalUrl is defined and update printReceiptDirectly and saveReceiptPdfDirectly
const printFuncRegex = /function printReceiptDirectly\(\)[\s\S]*?function saveReceiptPdfDirectly\(\)[\s\S]*?printReceiptDirectly\(\);\s*\}/;

const newPrintAndPdfCode = `function openWhatsAppExternalUrl(targetUrl) {
  if (!targetUrl) return;
  if (window.electronAPI && typeof window.electronAPI.openExternalUrl === 'function') {
    window.electronAPI.openExternalUrl(targetUrl);
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
    const filename = \`فاتورة_تحصيل_\${receiptNo || 'إيصال'}_\${Date.now()}.pdf\`;
    const res = await window.electronAPI.saveReceiptPdf({
      html: area.outerHTML,
      defaultFilename: filename
    });

    if (res && res.success) {
      showToast(\`✅ تم حفظ الفاتورة بنجاح كملف PDF في:\\n\${res.filePath}\`);
    } else if (res && res.canceled) {
      // User canceled
    } else {
      showToast(\`تعذر حفظ ملف الـ PDF: \${res?.error || 'خطأ أثناء المعالجة'}\`, true);
    }
  } else {
    window.print();
  }
}`;

if (printFuncRegex.test(content)) {
  content = content.replace(printFuncRegex, newPrintAndPdfCode);
  console.log('✅ Replaced printReceiptDirectly & saveReceiptPdfDirectly');
} else {
  console.warn('⚠️ Could not match printReceiptDirectly regex, will check alternative');
}

// 2. Replace all window.open(res.directUrl || res.waMeUrl, '_blank')
const waRegex = /window\.open\(\s*res\.directUrl\s*\|\|\s*res\.waMeUrl\s*,\s*['_"]_blank['_"]\s*\);/g;
const waMatches = content.match(waRegex);
if (waMatches) {
  content = content.replace(waRegex, 'openWhatsAppExternalUrl(res.directUrl || res.waMeUrl);');
  console.log(`✅ Replaced ${waMatches.length} occurrences of window.open for WhatsApp`);
}

// 3. Ensure saveReceiptPdfDirectly receives receiptNo in openReceiptPreviewModal
content = content.replace(/onclick="saveReceiptPdfDirectly\(\)"/g, `onclick="saveReceiptPdfDirectly('\${escapeHtmlAttr(receiptNo)}')"` );

fs.writeFileSync(targetFile, content, 'utf8');
console.log('🎉 desktop_app.js successfully patched!');
