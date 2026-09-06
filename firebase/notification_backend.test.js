const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLOWED_CATEGORIES,
  validateNotificationCaller,
  registerDevice,
  unregisterDevice,
  refreshDeviceToken,
  sendTargetedNotification,
  sendBroadcastNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  updateNotificationPreferences,
  cleanupInvalidTokens
} = require('./notification_service');

// -------------------------------------------------------------
// PHASE 17 NOTIFICATION BACKEND TESTS (35 ASSERTIONS)
// -------------------------------------------------------------

// AUTHORIZATION & TENANT TESTS (1-7)
test('Phase 17 Test 1: Category Whitelist contains expected 9 categories', () => {
  assert.equal(ALLOWED_CATEGORIES.size, 9);
  assert.ok(ALLOWED_CATEGORIES.has('ATTENDANCE'));
  assert.ok(ALLOWED_CATEGORIES.has('GRADE'));
  assert.ok(ALLOWED_CATEGORIES.has('EXAM'));
  assert.ok(ALLOWED_CATEGORIES.has('ONLINE_EXAM'));
  assert.ok(ALLOWED_CATEGORIES.has('CONTENT'));
  assert.ok(ALLOWED_CATEGORIES.has('SUBSCRIPTION'));
  assert.ok(ALLOWED_CATEGORIES.has('SCHEDULE'));
  assert.ok(ALLOWED_CATEGORIES.has('SYSTEM'));
  assert.ok(ALLOWED_CATEGORIES.has('ANNOUNCEMENT'));
});

test('Phase 17 Test 2: Valid caller authorization (validateNotificationCaller)', () => {
  const caller = { uid: 'user_1', role: 'admin', institutionId: 'inst_A' };
  const res = validateNotificationCaller(caller, 'inst_A');
  assert.equal(res.instId, 'inst_A');
  assert.equal(res.role, 'admin');
});

test('Phase 17 Test 3: Unauthenticated caller -> DENIED (UNAUTHENTICATED)', () => {
  assert.throws(() => validateNotificationCaller(null, 'inst_A'), /UNAUTHENTICATED/);
});

test('Phase 17 Test 4: Cross-tenant request -> DENIED (CROSS_TENANT_VIOLATION)', () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  assert.throws(() => validateNotificationCaller(caller, 'inst_B'), /CROSS_TENANT_VIOLATION/);
});

test('Phase 17 Test 5: SuperAdmin cross-tenant caller -> ALLOWED', () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const res = validateNotificationCaller(caller, 'inst_B');
  assert.equal(res.instId, 'inst_B');
});

test('Phase 17 Test 6: Device registration with valid payload (registerDevice)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await registerDevice(caller, { fcmToken: 'fcm_token_valid_123456789', platform: 'ANDROID', appType: 'STUDENT' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.userId, 'stu_1');
  assert.equal(res.platform, 'ANDROID');
});

test('Phase 17 Test 7: Device registration invalid FCM token (< 10 chars) -> REJECTED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await registerDevice(caller, { fcmToken: 'short' }),
    /INVALID_FCM_TOKEN/
  );
});

// DEVICE LIFECYCLE & REFRESH TESTS (8-12)
test('Phase 17 Test 8: Unregister device (unregisterDevice)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await unregisterDevice(caller, { deviceId: 'dev_stu_1_android' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.deviceId, 'dev_stu_1_android');
});

test('Phase 17 Test 9: Unregister device missing deviceId -> REJECTED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await unregisterDevice(caller, {}),
    /MISSING_DEVICE_ID/
  );
});

test('Phase 17 Test 10: Refresh device token (refreshDeviceToken)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await refreshDeviceToken(caller, { deviceId: 'dev_1', newFcmToken: 'fcm_new_987654321' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.deviceId, 'dev_1');
});

test('Phase 17 Test 11: Refresh token missing parameters -> REJECTED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await refreshDeviceToken(caller, { deviceId: 'dev_1' }),
    /INVALID_REFRESH_PAYLOAD/
  );
});

test('Phase 17 Test 12: Invalid FCM token cleanup (cleanupInvalidTokens)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await cleanupInvalidTokens(caller, { invalidTokens: ['tok_1', 'tok_2'] });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.cleanedCount, 2);
});

// TARGETED NOTIFICATIONS & IDEMPOTENCY TESTS (13-20)
test('Phase 17 Test 13: Send targeted notification by Admin -> ALLOWED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await sendTargetedNotification(caller, {
    recipientId: 'stu_1',
    category: 'GRADE',
    title: 'نتيجة امتحان جديد',
    body: 'تم نشر درجة اختبار الرياضيات.'
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.category, 'GRADE');
});

test('Phase 17 Test 14: Send targeted notification by Teacher -> ALLOWED', async () => {
  const caller = { uid: 'teacher_1', role: 'teacher', institutionId: 'inst_A' };
  const res = await sendTargetedNotification(caller, {
    recipientId: 'stu_1',
    category: 'ATTENDANCE',
    title: 'حضور الجلسة',
    body: 'تم تسجيل الحضور.'
  });
  assert.equal(res.status, 'SUCCESS');
});

test('Phase 17 Test 15: Student attempting to send targeted notification -> DENIED (UNAUTHORIZED_ROLE)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendTargetedNotification(caller, { recipientId: 'stu_2', category: 'GRADE', title: 'Hacked', body: 'Hack' }),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 17 Test 16: Parent attempting to send targeted notification -> DENIED (UNAUTHORIZED_ROLE)', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendTargetedNotification(caller, { recipientId: 'stu_1', category: 'GRADE', title: 'Hacked', body: 'Hack' }),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 17 Test 17: Invalid category attempt -> REJECTED (INVALID_NOTIFICATION_CATEGORY)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendTargetedNotification(caller, { recipientId: 'stu_1', category: 'ARBITRARY_SPAM', title: 'Test', body: 'Body' }),
    /INVALID_NOTIFICATION_CATEGORY/
  );
});

test('Phase 17 Test 18: Missing recipientId -> REJECTED (MISSING_RECIPIENT_ID)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendTargetedNotification(caller, { category: 'GRADE', title: 'Test', body: 'Body' }),
    /MISSING_RECIPIENT_ID/
  );
});

test('Phase 17 Test 19: Notification idempotency check (duplicate dedupeKey -> IDEMPOTENT_SKIPPED)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const payload = {
    recipientId: 'stu_1',
    category: 'GRADE',
    title: 'نتيجة امتحان',
    body: 'درجة 96%',
    dedupeKey: 'event_grade_publish_101',
    existingDedupeKeys: ['event_grade_publish_101']
  };
  const res = await sendTargetedNotification(caller, payload);
  assert.equal(res.status, 'IDEMPOTENT_SKIPPED');
});

test('Phase 17 Test 20: Send broadcast notification by Admin -> ALLOWED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await sendBroadcastNotification(caller, {
    title: 'تنويه مهم لجميع الطلاب',
    body: 'سيتم تغيير قاعة محاضرة الفيزياء.',
    category: 'ANNOUNCEMENT'
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.targetGroup, 'ALL');
});

// BROADCAST & PARENT ISOLATION TESTS (21-28)
test('Phase 17 Test 21: Teacher attempting broadcast notification -> DENIED (UNAUTHORIZED_ROLE)', async () => {
  const caller = { uid: 'teacher_1', role: 'teacher', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendBroadcastNotification(caller, { title: 'Broadcast', body: 'Body' }),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 17 Test 22: getNotifications for Student', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await getNotifications(caller);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.userId, 'stu_1');
  assert.ok(res.notifications.length > 0);
});

test('Phase 17 Test 23: getNotifications for Parent with linked child -> ALLOWED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getNotifications(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.userId, 'stu_1');
});

test('Phase 17 Test 24: getNotifications for Parent with unlinked child -> DENIED (UNAUTHORIZED_PARENT_RELATIONSHIP)', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getNotifications(caller, { childId: 'stu_unlinked_99' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 17 Test 25: Parent A fetching Parent B child notifications -> DENIED', async () => {
  const caller = { uid: 'parent_a', role: 'parent', institutionId: 'inst_A' };
  const payload = { childId: 'stu_b_1', existingLinks: { 'parent_a': ['stu_a_1'], 'parent_b': ['stu_b_1'] } };
  await assert.rejects(
    async () => await getNotifications(caller, payload),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 17 Test 26: Mark single notification read (markNotificationRead) by owner', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await markNotificationRead(caller, { notificationId: 'notif_101', notificationOwnerId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.read, true);
});

test('Phase 17 Test 27: Mark notification read for another user -> DENIED (UNAUTHORIZED_NOTIFICATION_OWNERSHIP)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await markNotificationRead(caller, { notificationId: 'notif_101', notificationOwnerId: 'stu_other_99' }),
    /UNAUTHORIZED_NOTIFICATION_OWNERSHIP/
  );
});

test('Phase 17 Test 28: Mark all notifications read (markAllNotificationsRead)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await markAllNotificationsRead(caller);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.userId, 'stu_1');
});

// PREFERENCES, DEEP LINKS & SYSTEM ALERTS (29-35)
test('Phase 17 Test 29: Update notification preferences (updateNotificationPreferences)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await updateNotificationPreferences(caller, { attendanceEnabled: false, gradeEnabled: true });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.preferences.attendanceEnabled, false);
  assert.equal(res.preferences.gradeEnabled, true);
  assert.equal(res.preferences.systemEnabled, true); // Mandatory
});

test('Phase 17 Test 30: System mandatory notifications cannot be disabled by user', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await updateNotificationPreferences(caller, { systemEnabled: false });
  assert.equal(res.preferences.systemEnabled, true);
});

test('Phase 17 Test 31: Deep link payload structure validation', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await getNotifications(caller);
  const notif = res.notifications[0];
  assert.equal(notif.deepLink.category, 'GRADE');
  assert.equal(notif.deepLink.targetScreen, 'GradesScreen');
});

test('Phase 17 Test 32: SuperAdmin global notification fetch -> ALLOWED', async () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const res = await getNotifications(caller, { targetInstitutionId: 'inst_B' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.institutionId, 'inst_B');
});

test('Phase 17 Test 33: Non-admin token cleanup attempt -> DENIED (UNAUTHORIZED_ROLE)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await cleanupInvalidTokens(caller, {}),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 17 Test 34: Notification title/body missing -> REJECTED (MISSING_NOTIFICATION_TEXT)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendTargetedNotification(caller, { recipientId: 'stu_1', category: 'GRADE' }),
    /MISSING_NOTIFICATION_TEXT/
  );
});

test('Phase 17 Test 35: Broadcast missing title/body -> REJECTED (MISSING_NOTIFICATION_TEXT)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await sendBroadcastNotification(caller, {}),
    /MISSING_NOTIFICATION_TEXT/
  );
});
