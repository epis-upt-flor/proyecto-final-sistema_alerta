enum AlertaEstado {
  disponible,    // Nadie la ha tomado (rojo)
  tomada,        // Asignada a patrullero (amarillo)  
  enCamino,      // Patrullero en camino (azul)
  resuelto,      // Emergencia atendida (verde)
}

class Alert {
  final String id;               // ID único de la alerta
  final AlertaEstado estadoAlerta;
  final String nombre;
  final String? apellido;
  final String? dni;
  final double lat;
  final double lon;
  final double bateria;
  final String timestamp;
  final String? deviceId;
  
  // Nuevos campos para gestión de estados
  final String? patrulleroAsignado;  // ID del patrullero que tomó la alerta
  final String? fechaTomada;         // Cuándo fue tomada
  final String? fechaEnCamino;       // Cuándo cambió a "en camino"
  final String? fechaResuelto;       // Cuándo fue resuelta

  Alert({
    required this.id,
    required this.estadoAlerta,
    required this.nombre,
    this.apellido,
    this.dni,
    required this.lat,
    required this.lon,
    required this.bateria,
    required this.timestamp,
    this.deviceId,
    this.patrulleroAsignado,
    this.fechaTomada,
    this.fechaEnCamino,
    this.fechaResuelto,
  });

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      estadoAlerta: parseEstado(json['estado'] ?? json['estadoAlerta']),
      nombre: json['nombre'] ?? 'Sin asignar',
      apellido: json['apellido'],
      dni: json['dni'],
      lat: (json['lat'] ?? 0.0).toDouble(),
      lon: (json['lon'] ?? 0.0).toDouble(),
      bateria: (json['bateria'] ?? 0.0).toDouble(),
      timestamp: json['timestamp']?.toString() ?? '',
      deviceId: json['device_id'],
      patrulleroAsignado: json['patrulleroAsignado'],
      fechaTomada: json['fechaTomada'],
      fechaEnCamino: json['fechaEnCamino'],
      fechaResuelto: json['fechaResuelto'],
    );
  }

  // Helper para parsear el estado desde string a enum
  static AlertaEstado parseEstado(dynamic estadoValue) {
    if (estadoValue == null) return AlertaEstado.disponible;
    
    final estadoStr = estadoValue.toString().toLowerCase();
    switch (estadoStr) {
      case 'tomada':
      case 'asignada':
        return AlertaEstado.tomada;
      case 'en_camino':
      case 'encamino':
      case 'en camino':
        return AlertaEstado.enCamino;
      case 'resuelto':
      case 'resuelta':
      case 'completada':
        return AlertaEstado.resuelto;
      case 'disponible':
      case 'despachada':
      default:
        return AlertaEstado.disponible;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'estadoAlerta': _estadoToString(estadoAlerta),
      'nombre': nombre,
      'apellido': apellido,
      'dni': dni,
      'lat': lat,
      'lon': lon,
      'bateria': bateria,
      'timestamp': timestamp,
      'device_id': deviceId,
      'patrulleroAsignado': patrulleroAsignado,
      'fechaTomada': fechaTomada,
      'fechaEnCamino': fechaEnCamino,
      'fechaResuelto': fechaResuelto,
    };
  }

  // Helper para convertir enum a string
  String _estadoToString(AlertaEstado estado) {
    switch (estado) {
      case AlertaEstado.disponible:
        return 'disponible';
      case AlertaEstado.tomada:
        return 'tomada';
      case AlertaEstado.enCamino:
        return 'en_camino';
      case AlertaEstado.resuelto:
        return 'resuelto';
    }
  }

  // Helper para obtener el nombre completo
  String get nombreCompleto {
    if (apellido != null && apellido!.isNotEmpty) {
      return '$nombre $apellido';
    }
    return nombre;
  }

  // Helper para mostrar la batería como porcentaje
  String get bateriaDisplay => '${bateria.toInt()}%';

  // Helper para obtener el color del marcador según estado
  String get colorMarcador {
    switch (estadoAlerta) {
      case AlertaEstado.disponible:
        return 'red';      // Rojo - disponible para todos
      case AlertaEstado.tomada:
        return 'orange';   // Naranja - tomada pero no en camino
      case AlertaEstado.enCamino:
        return 'blue';     // Azul - patrullero en camino
      case AlertaEstado.resuelto:
        return 'green';    // Verde - emergencia resuelta
    }
  }

  // Helper para obtener el texto del estado
  String get estadoTexto {
    switch (estadoAlerta) {
      case AlertaEstado.disponible:
        return 'Disponible';
      case AlertaEstado.tomada:
        return 'Tomada';
      case AlertaEstado.enCamino:
        return 'En Camino';
      case AlertaEstado.resuelto:
        return 'Resuelto';
    }
  }

  // Helper para verificar si está disponible para tomar
  bool get estaDisponible => estadoAlerta == AlertaEstado.disponible;

  // Helper para verificar si fue tomada por un patrullero específico
  bool fueTomadaPor(String patrulleroId) => 
    patrulleroAsignado == patrulleroId && estadoAlerta != AlertaEstado.disponible;

  // Helper para verificar si puede cambiar de estado (solo el patrullero asignado)
  bool puedecambiarEstado(String patrulleroId) =>
    patrulleroAsignado == patrulleroId && 
    (estadoAlerta == AlertaEstado.tomada || estadoAlerta == AlertaEstado.enCamino);

  // Helper para verificar si la alerta es reciente (menos de X minutos)
  bool isRecent({int maxMinutesAgo = 30}) {
    try {
      final alertTimestamp = DateTime.parse(timestamp);
      final now = DateTime.now();
      final difference = now.difference(alertTimestamp);
      return difference.inMinutes <= maxMinutesAgo;
    } catch (e) {
      // Si no se puede parsear el timestamp, considerar como reciente
      return true;
    }
  }

  // Helper para obtener hace cuánto tiempo fue la alerta
  String get timeAgo {
    try {
      final alertTimestamp = DateTime.parse(timestamp);
      final now = DateTime.now();
      final difference = now.difference(alertTimestamp);
      
      if (difference.inMinutes < 1) {
        return 'Hace ${difference.inSeconds}s';
      } else if (difference.inMinutes < 60) {
        return 'Hace ${difference.inMinutes}m';
      } else if (difference.inHours < 24) {
        return 'Hace ${difference.inHours}h';
      } else {
        return 'Hace ${difference.inDays}d';
      }
    } catch (e) {
      return 'Tiempo desconocido';
    }
  }
}