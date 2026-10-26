import '../models/secure_media.dart';

/// Canonical media errors.
class MediaAccessException implements Exception {
  final String code;
  final String message;
  const MediaAccessException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}

/// Canonical Student media layer.
///
/// STOP: there is no student-readable canonical content-list contract, so no
/// playback URL can be minted here. Hardcoded client-side signed URLs are
/// removed. Protected media must be streamed via the canonical Worker
/// `GET ?objectKey=` (Firebase JWT → membership → entitlement → private R2)
/// once an approved list contract provides the objectKey. Both methods fail
/// closed. Path-traversal rejection is preserved.
class MediaService {
  void _rejectTraversal(String value) {
    if (value.contains('../') ||
        value.contains('..\\') ||
        value.contains('%2e%2e')) {
      throw const MediaAccessException(
        'INVALID_OBJECT_KEY',
        'مفتاح الوسائط غير صالح',
      );
    }
  }

  Future<SecurePlaybackSessionDTO> requestPlaybackUrl(String contentId) async {
    _rejectTraversal(contentId);
    throw const MediaAccessException(
      'MEDIA_LISTING_UNSUPPORTED',
      'لا توجد قائمة محتوى معتمدة للطالب حاليًا — لا يمكن تشغيل الوسائط',
    );
  }

  Future<EphemeralMediaAccessDTO> requestEphemeralPlayback(
      String objectKey) async {
    _rejectTraversal(objectKey);
    throw const MediaAccessException(
      'MEDIA_LISTING_UNSUPPORTED',
      'لا توجد قائمة محتوى معتمدة للطالب حاليًا — لا يمكن تشغيل الوسائط',
    );
  }
}
