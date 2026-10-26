import '../models/subscription.dart';
import 'mobile_worker_client.dart';

/// Canonical subscription errors. Redemption has no client-writable
/// canonical contract (`subscriptionCodes`/`entitlements` are server-only in
/// Rules), so redeem ALWAYS fails closed — never a fake ACTIVE entitlement.
class SubscriptionException implements Exception {
  final String code;
  final String message;
  const SubscriptionException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}

/// Canonical Student subscription layer — served by the trusted access
/// layer (P2 `GET /mobile/student/entitlements`). The Worker verifies the
/// membership and returns ONLY entitlements with `studentId == caller uid`.
/// Expired/revoked rows are returned with their real status but grant no new
/// content access — gating happens per-request. Empty (not fake) when none.
class SubscriptionStudentService {
  final MobileWorkerClient _worker;
  SubscriptionStudentService({MobileWorkerClient? worker})
      : _worker = worker ?? MobileWorkerClient();

  /// Canonical entitlements of the current student within [institutionId].
  Future<List<StudentEntitlementDTO>> fetchActiveEntitlements({
    required String institutionId,
  }) async {
    late final List<dynamic> items;
    try {
      final body = await _worker.get('/mobile/student/entitlements', {
        'institutionId': institutionId,
      });
      items = (body['items'] as List?) ?? [];
    } on MobileWorkerException catch (e) {
      if (e.code == 'UNAUTHENTICATED') return [];
      throw SubscriptionException(e.code, e.message);
    }
    final now = DateTime.now();
    return items
        .map((e) => StudentEntitlementDTO.fromJson({
              ...(Map<String, dynamic>.from(e as Map)),
              'institutionId': institutionId,
            }))
        .where((e) => e.status == 'ACTIVE' && e.expiresAt.isAfter(now))
        .toList();
  }

  /// STOP: no client redemption contract exists. Codes are verified and
  /// entitlements minted server-side only. Always fails closed and clears
  /// nothing locally (the screen clears the input on any result).
  Future<StudentEntitlementDTO?> redeemCode(
    String plaintextCode,
    String requestId,
  ) async {
    throw const SubscriptionException(
      'REDEEM_UNSUPPORTED',
      'تفعيل الأكواد يتم عبر إدارة السنتر فقط — لا يوجد تفعيل ذاتي من التطبيق',
    );
  }
}
