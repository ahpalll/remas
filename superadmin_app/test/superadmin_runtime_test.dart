import 'package:flutter_test/flutter_test.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

void main() {
  group('Phase 41 — SuperAdmin Mobile Flutter App Security & Runtime Suite', () {
    setUp(() {
      SuperAdminService.logout();
    });

    test('1. Role Authorization Assertion — SuperAdmin User Validation', () {
      final saUser = SuperAdminUser(
        uid: 'sa_01',
        email: 'superadmin@remas.edu',
        role: 'superadmin',
      );
      expect(saUser.isSuperAdmin, isTrue);

      final nonSaUser = SuperAdminUser(
        uid: 'owner_01',
        email: 'owner@remas.edu',
        role: 'institutionOwner',
      );
      expect(nonSaUser.isSuperAdmin, isFalse);
    });

    test('2. Authentication — Valid SuperAdmin Login Succeeds', () async {
      final user = await SuperAdminService.login(
        email: 'superadmin@remas.edu',
        password: 'valid_password_123',
      );

      expect(user.email, equals('superadmin@remas.edu'));
      expect(user.isSuperAdmin, isTrue);
      expect(SuperAdminService.currentUser, isNotNull);
    });

    test('3. Authentication — Non-SuperAdmin Login Throws UNAUTHORIZED_ROLE', () async {
      expect(
        () async => await SuperAdminService.login(
          email: 'center_owner@remas.edu',
          password: 'valid_password_123',
        ),
        throwsA(predicate((e) => e.toString().contains('UNAUTHORIZED_ROLE'))),
      );
    });

    test('4. Data Model Serialization — Institution & License Records', () {
      final inst = InstitutionRecord.fromJson({
        'institutionId': 'inst_test_01',
        'name': 'مركز الاختبار',
        'status': 'ACTIVE',
        'studentCount': 120,
        'teacherCount': 10,
      });
      expect(inst.institutionId, equals('inst_test_01'));
      expect(inst.studentCount, equals(120));

      final lic = LicenseRecord.fromJson({
        'licenseId': 'lic_01',
        'institutionId': 'inst_test_01',
        'licenseCode': 'REMAS-TEST-2026-X1Y2Z3',
        'status': 'ACTIVE',
        'issuedAt': '2026-01-01T00:00:00.000Z',
        'expiresAt': '2027-01-01T00:00:00.000Z',
        'deviceBindingStatus': 'BOUND',
      });
      expect(lic.licenseCode, equals('REMAS-TEST-2026-X1Y2Z3'));
      expect(lic.deviceBindingStatus, equals('BOUND'));
    });

    test('5. Privileged Operations Guard — Unauthenticated Service Throws Error', () async {
      expect(
        () async => await SuperAdminService.getInstitutions(),
        throwsA(predicate((e) => e.toString().contains('UNAUTHORIZED_CALLER_ROLE'))),
      );

      expect(
        () async => await SuperAdminService.suspendLicense(institutionId: 'inst_01', reason: 'Test'),
        throwsA(predicate((e) => e.toString().contains('UNAUTHORIZED_CALLER_ROLE'))),
      );
    });

    test('6. Privileged Operations — Authenticated SuperAdmin Execution Succeeds', () async {
      await SuperAdminService.login(
        email: 'superadmin@remas.edu',
        password: 'valid_password_123',
      );

      final instList = await SuperAdminService.getInstitutions();
      expect(instList.isNotEmpty, isTrue);

      final susRes = await SuperAdminService.suspendLicense(institutionId: 'inst_bootstrap_001', reason: 'Audit Test');
      expect(susRes['status'], equals('LICENSE_SUSPENDED_SUCCESSFULLY'));

      final revRes = await SuperAdminService.revokeLicense(institutionId: 'inst_bootstrap_001', reason: 'Audit Test');
      expect(revRes['status'], equals('LICENSE_REVOKED_SUCCESSFULLY'));

      final unbindRes = await SuperAdminService.unbindDevice(institutionId: 'inst_bootstrap_001', reason: 'Audit Test');
      expect(unbindRes['status'], equals('DEVICE_UNBOUND_SUCCESSFULLY'));
    });
  });
}
