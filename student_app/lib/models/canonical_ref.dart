/// Canonical institution-scoped reference (subject / stage / term).
/// Read from `institutions/{institutionId}/{collection}/{id}` — collections
/// the student role is explicitly allowed to read (see firestore.rules).
class CanonicalRefDTO {
  final String id;
  final String institutionId;
  final String name;

  const CanonicalRefDTO({
    required this.id,
    required this.institutionId,
    required this.name,
  });

  factory CanonicalRefDTO.fromJson(Map<String, dynamic> json) {
    return CanonicalRefDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      name: json['name'] ?? json['title'] ?? '',
    );
  }
}
