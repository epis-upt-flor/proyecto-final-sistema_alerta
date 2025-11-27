enum AlertaEstado {
  disponible,    // Nadie la ha tomado (rojo)
  tomada,        // Asignada a patrullero (amarillo)  
  enCamino,      // Patrullero en camino (azul)
  resuelto,      // Emergencia atendida (verde)
}

// 🔥 NUEVO ENUM PARA NIVEL DE URGENCIA
enum NivelUrgencia {
  baja,    // 1 activación - amarillo
  media,   // 2-3 activaciones - naranja
  critica, // 4+ activaciones - rojo parpadeante
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

  // 🔥 NUEVOS CAMPOS SISTEMA DE PRIORIDADES
  final int cantidadActivaciones;
  final String? ultimaActivacion;
  final NivelUrgencia nivelUrgencia;
  final bool esRecurrente;
  final String? fechaCreacion;

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
    // 🔥 NUEVOS CAMPOS
    this.cantidadActivaciones = 1,
    this.ultimaActivacion,
    this.nivelUrgencia = NivelUrgencia.baja,
    this.esRecurrente = false,
    this.fechaCreacion,
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
      // 🔥 NUEVOS CAMPOS
      cantidadActivaciones: json['cantidadActivaciones'] ?? 1,
      ultimaActivacion: json['ultimaActivacion'],
      nivelUrgencia: parseNivelUrgencia(json['nivelUrgencia']),
      esRecurrente: json['esRecurrente'] ?? false,
      fechaCreacion: json['fechaCreacion'],
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

  // 🔥 HELPER PARA PARSEAR NIVEL DE URGENCIA
  static NivelUrgencia parseNivelUrgencia(dynamic urgenciaValue) {
    if (urgenciaValue == null) return NivelUrgencia.baja;
    
    final urgenciaStr = urgenciaValue.toString().toLowerCase();
    switch (urgenciaStr) {
      case 'critica':
      case 'crítica':
      case 'alta':
        return NivelUrgencia.critica;
      case 'media':
      case 'moderada':
        return NivelUrgencia.media;
      case 'baja':
      case 'low':
      default:
        return NivelUrgencia.baja;
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
      // 🔥 NUEVOS CAMPOS
      'cantidadActivaciones': cantidadActivaciones,
      'ultimaActivacion': ultimaActivacion,
      'nivelUrgencia': _urgenciaToString(nivelUrgencia),
      'esRecurrente': esRecurrente,
      'fechaCreacion': fechaCreacion,
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

  // 🔥 HELPER PARA CONVERTIR URGENCIA A STRING
  String _urgenciaToString(NivelUrgencia urgencia) {
    switch (urgencia) {
      case NivelUrgencia.baja:
        return 'baja';
      case NivelUrgencia.media:
        return 'media';
      case NivelUrgencia.critica:
        return 'critica';
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

  // 🔥 HELPER PARA COLOR SEGÚN URGENCIA (retorna hex)
  String get colorPorUrgencia {
    switch (nivelUrgencia) {
      case NivelUrgencia.critica:
        return '#FF0000';      // Rojo crítico
      case NivelUrgencia.media:
        return '#FFA500';   // Naranja medio
      case NivelUrgencia.baja:
        return '#FFD700';   // Amarillo bajo
    }
  }

  // 🔥 HELPER PARA ICONO DE URGENCIA
  String get iconoUrgencia {
    switch (nivelUrgencia) {
      case NivelUrgencia.critica:
        return '🔴';
      case NivelUrgencia.media:
        return '🟠';
      case NivelUrgencia.baja:
        return '🟡';
    }
  }

  // 🔥 VERIFICAR SI ES SIN SEÑAL (30+ min sin actualizar)
  bool get esSinSenal {
    if (ultimaActivacion == null) return false;
    
    try {
      final ultimaActualizacion = DateTime.parse(ultimaActivacion!);
      final ahora = DateTime.now();
      final diferencia = ahora.difference(ultimaActualizacion);
      return diferencia.inMinutes > 30;
    } catch (e) {
      return false;
    }
  }

  // 🔥 OBTENER TIEMPO DESDE CREACIÓN
  String get tiempoDesdeCreacion {
    if (fechaCreacion == null) return '';
    
    try {
      final creacion = DateTime.parse(fechaCreacion!);
      final ahora = DateTime.now();
      final diferencia = ahora.difference(creacion);
      
      if (diferencia.inMinutes < 60) {
        return '${diferencia.inMinutes}min';
      } else {
        final horas = diferencia.inHours;
        final minutosRestantes = diferencia.inMinutes % 60;
        return '${horas}h ${minutosRestantes}min';
      }
    } catch (e) {
      return '';
    }
  }

  // 🔥 VERIFICAR SI DEBE MOSTRAR ANIMACIÓN PARPADEANTE (crítica)
  bool get debeParpadear => nivelUrgencia == NivelUrgencia.critica;

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