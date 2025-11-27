class PatrullaUbicacion {
  final String patrulleroId;
  final double lat;
  final double lon;
  final String estado;
  final int minutosDesdeUltimaActualizacion;

  PatrullaUbicacion({
    required this.patrulleroId,
    required this.lat,
    required this.lon,
    required this.estado,
    required this.minutosDesdeUltimaActualizacion,
  });

  factory PatrullaUbicacion.fromJson(Map<String, dynamic> json) {
    return PatrullaUbicacion(
      patrulleroId: json['patrulleroId'] ?? '',
      lat: (json['lat'] ?? 0.0).toDouble(),
      lon: (json['lon'] ?? 0.0).toDouble(),
      estado: json['estado'] ?? 'Inactiva',
      minutosDesdeUltimaActualizacion: json['minutosDesdeUltimaActualizacion'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'patrulleroId': patrulleroId,
      'lat': lat,
      'lon': lon,
      'estado': estado,
      'minutosDesdeUltimaActualizacion': minutosDesdeUltimaActualizacion,
    };
  }

  // Helper para determinar si la patrulla está activa
  bool get isActiva => estado.toLowerCase() == 'activa';
  
  // Helper para determinar el color del marcador
  String get colorMarcador => isActiva ? 'green' : 'orange';
}