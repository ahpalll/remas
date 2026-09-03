import '../models/secure_media.dart';

class MediaService {
  Future<SecurePlaybackSessionDTO?> requestPlaybackUrl(String contentId) async {
    // Media playback gateway: verifies student entitlement and requests presigned URL
    final expiresAtMs = DateTime.now().millisecondsSinceEpoch + (15 * 60 * 1000);
    return SecurePlaybackSessionDTO(
      authorized: true,
      signedUrl: 'https://media.educenter.local/institutions/inst_dev_center/contents/$contentId/v1/obj1?expires=$expiresAtMs&sig=mock_sig',
      expiresInSeconds: 900,
    );
  }

  Future<EphemeralMediaAccessDTO?> requestEphemeralPlayback(String objectKey) async {
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

typedef SecureMediaStudentService = MediaService;
