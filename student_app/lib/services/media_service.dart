import '../models/secure_media.dart';

class SecureMediaStudentService {
  Future<EphemeralMediaAccessDTO?> requestEphemeralPlayback(String objectKey) async {
    // Phase 13 Foundation: Request temporary presigned GET URL (~15 min expiry)
    // NOTE: Phase 14 will add subscription code and package entitlement checks before issuing access.
    if (objectKey.contains('../') || objectKey.contains('%2e%2e')) {
      throw Exception('PATH_TRAVERSAL_DETECTED');
    }

    final expiresAtMs = DateTime.now().millisecondsSinceEpoch + (15 * 60 * 1000);
    return EphemeralMediaAccessDTO(
      objectKey: objectKey,
      playbackUrl: 'https://media.educenter.local/$objectKey?expires=$expiresAtMs&sig=mock_sig',
      expiresInSeconds: 900,
      mediaStatus: 'READY',
    );
  }
}
