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
