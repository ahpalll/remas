process.env.NODE_ENV = 'test';
const assert = require('assert');
const services = require('./src/center_desktop_services.js');

async function runTests() {
  console.log('--- بدء اختبار الميزات الجديدة المضافة للسنتر ---');
  if (typeof services.setTestOffline === 'function') {
    services.setTestOffline(true);
  }
  const mockToken = {
    uid: 'test_admin_uid',
    role: 'owner',
    institutionId: 'inst_test_123',
    displayName: 'مدير السنتر'
  };

  // 1. Invoice Config & Customization Test
  console.log('1. اختبار إعدادات وترويسة الفاتورة الرسمية...');
  const initConfig = await services.getInvoiceConfig(mockToken, { institutionId: 'inst_test_123' });
  assert(initConfig !== null, 'يجب إرجاع إعدادات الفاتورة الافتراضية');
  
  await services.updateInvoiceConfig(mockToken, {
    institutionId: 'inst_test_123',
    centerName: 'أكاديمية النجاح التعليمية',
    subHeader: 'إيصال استلام مصروفات وسند قبض',
    phone: '01011112222',
    address: 'القاهرة - مدينة نصر',
    taxNumber: '123-456-789',
    terms: 'لا ترد المصروفات بعد بدء الدورة.'
  });

  const updatedConfig = await services.getInvoiceConfig(mockToken, { institutionId: 'inst_test_123' });
  assert.strictEqual(updatedConfig.centerName, 'أكاديمية النجاح التعليمية');
  assert.strictEqual(updatedConfig.phone, '01011112222');
  console.log('✅ اختبار إعدادات الفاتورة وترويستها نجح بنجاح.');

  // 2. Fee Collection with Discount Feature Test
  console.log('2. اختبار تحصيل الرسوم مع ميزة الخصم (المبلغ الأصلي - الخصم - الصافي)...');
  const paymentWithDiscount = await services.recordPayment(mockToken, {
    institutionId: 'inst_test_123',
    studentId: 'stud_discount_1',
    studentName: 'محمود أحمد شاكر',
    originalAmount: 600,
    discount: 100,
    discountType: 'FIXED',
    discountPercent: 16.67,
    discountReason: 'خصم أشقاء وتفوق دراسي',
    amount: 500,
    category: 'مصاريف شهرية لمادتين'
  });

  assert.strictEqual(paymentWithDiscount.amount, 500, 'الصافي يجب أن يكون 500');
  assert.strictEqual(paymentWithDiscount.originalAmount, 600, 'المبلغ الأصلي 600');
  assert.strictEqual(paymentWithDiscount.discount, 100, 'قيمة الخصم 100');
  assert.strictEqual(paymentWithDiscount.discountReason, 'خصم أشقاء وتفوق دراسي');
  assert(paymentWithDiscount.receiptNumber, 'يجب إصدار رقم إيصال');
  console.log('✅ اختبار تحصيل الرسوم وميزة الخصم وسند القبض نجح بنجاح.');

  // 3. Accrued Dues Equation Test (4 sessions per monthly cycle)
  console.log('3. اختبار معادلة احتساب مستحقات السنتر حسب حضور الحصص...');
  const duesReport = await services.calcAccruedStudentDues(mockToken, { institutionId: 'inst_test_123' });
  assert(duesReport !== null, 'يجب إرجاع تقرير المستحقات');
  assert(typeof duesReport.netDuesOwedToCenter === 'number', 'يجب أن يكون رقم صحيح');
  assert(Array.isArray(duesReport.studentsBreakdown), 'يجب أن يكون مصفوفة تفصيلية');
  console.log('✅ اختبار بطاقة مستحقات السنتر حسب الحضور نجح بنجاح.');

  // 4. WhatsApp Gateway & Auto Settings Test
  console.log('4. اختبار إعدادات ربط الواتس آب وإرسال الرسائل...');
  await services.updateWhatsAppConfig(mockToken, {
    institutionId: 'inst_test_123',
    enabled: true,
    mode: 'api',
    gatewayUrl: 'https://api.whatsapp-gateway.mock/send',
    apiToken: 'mock_token_xyz',
    autoSendAttendance: true,
    autoSendPaymentReceipt: true,
    receiptTemplate: 'تم استلام {amount} ج.م للطالب {studentName} لإيصال {receiptNumber}.'
  });

  const waConfig = await services.getWhatsAppConfig(mockToken, { institutionId: 'inst_test_123' });
  assert.strictEqual(waConfig.enabled, true);
  assert.strictEqual(waConfig.autoSendPaymentReceipt, true);

  const waSendResult = await services.sendWhatsAppMessage(mockToken, {
    institutionId: 'inst_test_123',
    phone: '01099998888',
    message: 'إشعار اختبار'
  });
  assert(waSendResult.success === true, 'يجب نجاح إرسال رسالة الواتس');
  console.log('✅ اختبار إعدادات وبوابة الواتس آب نجح بنجاح.');

  // 5. VIP AI Vouchers Generation & Redemption Test
  console.log('5. اختبار مركز باقات وأكواد VIP للمساعد الذكي...');
  const batchResult = await services.generateAiVoucherBatch(mockToken, {
    institutionId: 'inst_test_123',
    quotaQuestions: 50,
    price: 30,
    count: 3,
    notes: 'باقة مراجعة نهائية'
  });
  assert.strictEqual(batchResult.count, 3);
  assert.strictEqual(batchResult.vouchers.length, 3);
  
  const voucherCode = batchResult.vouchers[0].code;
  assert(voucherCode.startsWith('VIP-'), 'الكود يجب أن يبدأ بـ VIP-');

  // Create student first
  const newStudent = await services.createStudent(mockToken, {
    institutionId: 'inst_test_123',
    name: 'محمود أحمد شاكر',
    phone: '01012345678'
  });

  // Redeem voucher
  const redeemResult = await services.redeemAiVoucher(mockToken, {
    institutionId: 'inst_test_123',
    code: voucherCode,
    studentId: newStudent.id
  });
  assert.strictEqual(redeemResult.quotaAdded, 50);
  assert.strictEqual(redeemResult.voucher.status, 'REDEEMED');
  assert.strictEqual(redeemResult.student.isVip, true);
  console.log('✅ اختبار توليد وشحن أكواد VIP الذكية نجح بنجاح.');

  console.log('🎉 جميع اختبارات الميزات المطلوبة مرت بنجاح تام 100%!');
}

runTests().catch(err => {
  console.error('❌ فشل الاختبار:', err);
  process.exit(1);
});
