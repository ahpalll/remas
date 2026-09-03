class EphemeralMediaAccessDTO {
  final String objectKey;
  final String playbackUrl;
  final int expiresInSeconds;
  final String mediaStatus;

  EphemeralMediaAccessDTO({
    required this.objectKey,
    required this.playbackUrl,
    required this.expiresInSeconds,
    required this.mediaStatus,
  });

  factory EphemeralMediaAccessDTO.fromJson(Map<String, dynamic> json) {
    return EphemeralMediaAccessDTO(
      objectKey: json['objectKey'] ?? '',
      playbackUrl: json['playbackUrl'] ?? '',
      expiresInSeconds: json['expiresInSeconds'] ?? 900,
      mediaStatus: json['mediaStatus'] ?? 'READY',
    );
  }
}

class SecurePlaybackSessionDTO {
  final bool authorized;
  final String signedUrl;
  final int expiresInSeconds;

  SecurePlaybackSessionDTO({
    required this.authorized,
    required this.signedUrl,
    required this.expiresInSeconds,
  });

  factory SecurePlaybackSessionDTO.fromJson(Map<String, dynamic> json) {
    return SecurePlaybackSessionDTO(
      authorized: json['authorized'] ?? false,
      signedUrl: json['signedUrl'] ?? '',
      expiresInSeconds: json['expiresInSeconds'] ?? 900,
    );
  }
}
