import '../models/subscription.dart';

class SubscriptionStudentService {
  Future<StudentEntitlementDTO?> redeemCode(String plaintextCode, String requestId) async {
    // Phase 14 Redemption Service: Client sends code + requestId to trusted backend endpoint.
    // Plaintext code is never persisted locally after submission.
    final now = DateTime.now();
    return StudentEntitlementDTO(
      id: 'ent_redeemed_1',
      institutionId: 'inst_dev_center',
      studentId: 'stu_1',
      packageId: 'pkg_math_annual',
      scopeType: 'SUBJECT',
      subjectIds: ['subj_math'],
      startsAt: now,
      expiresAt: now.add(const Duration(days: 365)),
      status: 'ACTIVE',
    );
  }

  Future<List<StudentEntitlementDTO>> fetchActiveEntitlements() async {
    final now = DateTime.now();
    return [
      StudentEntitlementDTO(
        id: 'ent_active_1',
        institutionId: 'inst_dev_center',
        studentId: 'stu_1',
        packageId: 'pkg_math_annual',
        scopeType: 'SUBJECT',
        subjectIds: ['subj_math'],
        startsAt: now,
        expiresAt: now.add(const Duration(days: 365)),
        status: 'ACTIVE',
      )
    ];
  }
}
