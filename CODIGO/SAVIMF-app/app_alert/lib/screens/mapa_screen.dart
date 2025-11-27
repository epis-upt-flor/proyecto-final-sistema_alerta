import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:polyline_codec/polyline_codec.dart';
import '../models/alert.dart';
import '../services/notification_service.dart';
import '../services/signalr_service.dart';
import '../services/backend_tester.dart';
import '../services/user_service.dart';
import 'welcome_screen.dart';
import 'atestado_policial_screen.dart';


class MapaScreen extends StatefulWidget {
  const MapaScreen({super.key});

  @override
  State<MapaScreen> createState() => _MapaScreenState();
}

class _MapaScreenState extends State<MapaScreen> {
  // Timers
  Timer? _locationTimer;
  Timer? _alertasRefreshTimer; // 🆕 Timer para refrescar alertas cada 30s

  // Servicios
  late NotificationService _notificationService;
  late SignalRService _signalRService;
  bool _isSignalRConnected = false;

  // Estados de ubicación
  Position? _posicionActual;
  GoogleMapController? _mapController;
  bool ubicacionEnviada = false;

  // ID del patrullero actual
  String? _patrulleroId;

  // Estados de alertas
  List<Alert> alertas = [];
  bool mostrarAlertas = true;

  // Marcadores seleccionados
  Alert? selectedAlerta;

  // Marcadores del mapa
  Set<Marker> markers = {};
  
  // Polilíneas para rutas
  Set<Polyline> polylines = {};
  bool mostrarRuta = false;
  Alert? alertaConRuta; // Alerta para la cual se está mostrando la ruta
  
  // Sistema de actualización de rutas híbrido (trimming + re-request)
  List<LatLng> _rutaOriginalCompleta = []; // Ruta completa desde Google Directions
  Timer? _routeUpdateTimer; // Timer para actualización inteligente de ruta
  double _lastRouteOriginLat = 0.0;
  double _lastRouteOriginLng = 0.0;
  DateTime? _lastDirectionsRequest; // Cuándo se pidió la ruta por última vez
  bool _isRequestingNewRoute = false; // Evitar múltiples requests simultáneos
  
  // Configuración del sistema híbrido
  static const double ROUTE_DEVIATION_THRESHOLD = 50.0; // metros - cuándo pedir nueva ruta
  static const int MAX_REQUERY_INTERVAL_SECONDS = 120; // 2 minutos máximo sin actualizar
  static const int ROUTE_UPDATE_INTERVAL_SECONDS = 8; // cada cuánto revisar si actualizar
  static const double MIN_MOVEMENT_THRESHOLD = 10.0; // metros mínimos para considerar movimiento

  static const String baseUrl = 'http://18.225.31.96:5000';
  
  static const String googleMapsApiKey = 'AIzaSyAH7CFT9j0qli9JizYQIrBLRGkCNg5Lwik';

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Inicializar servicios
    _notificationService = NotificationService();
    _signalRService = SignalRService();
    
    await _obtenerPatrulleroId();
    await _pedirPermisoYEnviar();
    await _initializeServices();
    await _loadAlertasIniciales();
    _startAutomaticAlertasRefresh(); // 🆕 Iniciar refresh automático
  }

  // Inicializar servicios de notificaciones y SignalR
  Future<void> _initializeServices() async {
    // Configurar callbacks para notificaciones
    _notificationService.setCallbacks(
      onReceived: (data) {
        print('🔔 Notificación recibida en foreground: $data');
        // Procesar notificación cuando app está abierta
        _processNotificationData(data);
      },
      onTapped: (data) {
        print('👆 Usuario tocó notificación: $data');
        // Procesar cuando usuario toca la notificación
        _processNotificationData(data);
      },
    );

    // Configurar callbacks para SignalR
    _signalRService.setCallbacks(
      onAlerta: (alertaData) {
        final nuevaAlerta = Alert.fromJson(alertaData);
        _handleNuevaAlerta(nuevaAlerta);
        
        // Mostrar notificación push
        _notificationService.showAlertNotification(
          title: '🚨 Nueva Alerta',
          body: '${nuevaAlerta.nombreCompleto} - ${nuevaAlerta.estadoTexto}',
          data: alertaData,
        );
      },
      onTomada: (data) {
        final alertaId = data['alertaId']?.toString();
        final patrulleroId = data['patrulleroId']?.toString();
        
        if (alertaId != null && patrulleroId != null) {
          _actualizarAlertaLocal(alertaId, AlertaEstado.tomada, patrulleroId);
          
          if (patrulleroId != _patrulleroId) {
            _mostrarNotificacionTomada(alertaId);
          }
        }
      },
      onEstadoCambiado: (data) {
        final alertaId = data['alertaId']?.toString();
        final patrulleroId = data['patrulleroId']?.toString();
        final nuevoEstado = data['nuevoEstado']?.toString();
        
        if (alertaId != null && patrulleroId != null && nuevoEstado != null) {
          final estadoEnum = Alert.parseEstado(nuevoEstado);
          _actualizarAlertaLocal(alertaId, estadoEnum, patrulleroId);
          _mostrarNotificacionEstadoCambiado(alertaId, estadoEnum, patrulleroId);
        }
      },
      onConnectionChanged: (connected) {
        setState(() {
          _isSignalRConnected = connected;
        });
        
        if (connected) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🟢 Conectado - Recibiendo alertas en tiempo real'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🔴 Desconectado - Reintentando...'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 2),
            ),
          );
        }
      },
    );

    // Inicializar SignalR
    final connected = await _signalRService.initialize();
    setState(() {
      _isSignalRConnected = connected;
    });
    
    // Enviar token FCM al backend si el patrullero está identificado
    if (_patrulleroId != null) {
      await _notificationService.sendTokenToBackend(baseUrl, _patrulleroId!);
    }
  }

  // Procesar datos de notificación
  void _processNotificationData(Map<String, dynamic> data) {
    try {
      if (data.containsKey('alertaId')) {
        final alertaId = data['alertaId']?.toString();
        if (alertaId != null) {
          // Buscar alerta y mostrar detalles
          final alerta = alertas.firstWhere((a) => a.id == alertaId, orElse: () => alertas.first);
          if (alerta != alertas.first) {
            _showAlertaDetails(alerta);
          }
        }
      }
    } catch (e) {
      print('❌ Error procesando datos de notificación: $e');
    }
  }

  // Manejar nueva alerta recibida
  void _handleNuevaAlerta(Alert nuevaAlerta) {
    // Evitar duplicados
    bool alertaExiste = alertas.any((a) => 
      a.deviceId == nuevaAlerta.deviceId && 
      a.timestamp == nuevaAlerta.timestamp
    );
    
    if (!alertaExiste) {
      setState(() {
        alertas.add(nuevaAlerta);
      });
      _updateMarkers();
      
      // Centrar mapa en la nueva alerta
      if (_mapController != null) {
        _mapController!.animateCamera(
          CameraUpdate.newLatLngZoom(
            LatLng(nuevaAlerta.lat, nuevaAlerta.lon), 
            16
          ),
        );
      }
      
      // Mostrar notificación in-app
      _showAlertNotification(nuevaAlerta);
      
      print('✅ Nueva alerta procesada: ${nuevaAlerta.nombreCompleto}');
    } else {
      print('⚠️ Alerta duplicada ignorada: ${nuevaAlerta.deviceId}');
    }
  }

  // Mostrar notificación cuando alerta es tomada
  void _mostrarNotificacionTomada(String alertaId) {
    try {
      final alerta = alertas.firstWhere((a) => a.id == alertaId);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('📍 Alerta tomada por otro patrullero: ${alerta.nombreCompleto}'),
          backgroundColor: Colors.orange,
          duration: const Duration(seconds: 3),
        ),
      );
    } catch (e) {
      print('⚠️ Alerta no encontrada para notificación tomada: $alertaId');
    }
  }

  // Mostrar notificación cuando estado de alerta cambia
  void _mostrarNotificacionEstadoCambiado(String alertaId, AlertaEstado estadoEnum, String patrulleroId) {
    try {
      final alerta = alertas.firstWhere((a) => a.id == alertaId);
      
      String mensaje = '';
      Color color = Colors.blue;
      
      switch (estadoEnum) {
        case AlertaEstado.enCamino:
          mensaje = patrulleroId == _patrulleroId 
            ? 'Marcaste en camino: ${alerta.nombreCompleto}'
            : 'Patrullero en camino: ${alerta.nombreCompleto}';
          color = Colors.blue;
          break;
        case AlertaEstado.resuelto:
          mensaje = patrulleroId == _patrulleroId 
            ? 'Marcaste como resuelto: ${alerta.nombreCompleto}'
            : 'Emergencia resuelta: ${alerta.nombreCompleto}';
          color = Colors.green;
          break;
        default:
          return;
      }
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(mensaje),
          backgroundColor: color,
          duration: const Duration(seconds: 3),
        ),
      );
    } catch (e) {
      print('⚠️ Alerta no encontrada para cambio de estado: $alertaId');
    }
  }
  Future<void> _obtenerPatrulleroId() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        _patrulleroId = user.uid; // Usar UID de Firebase como ID del patrullero
        print('Patrullero ID: $_patrulleroId');
      }
    } catch (e) {
      print('Error obteniendo patrullero ID: $e');
    }
  }

  Future<void> _pedirPermisoYEnviar() async {
    LocationPermission permiso = await Geolocator.requestPermission();
    if (permiso == LocationPermission.denied || permiso == LocationPermission.deniedForever) {
      _showPermissionDialog();
      return;
    }
    _startSendingLocation();
  }

  void _showPermissionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Permisos de Ubicación'),
        content: const Text('Esta aplicación necesita acceso a tu ubicación para funcionar correctamente.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _pedirPermisoYEnviar();
            },
            child: const Text('Intentar de nuevo'),
          ),
        ],
      ),
    );
  }

  Future<void> _getAndSendLocation() async {
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      
      setState(() {
        _posicionActual = position;
      });

      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) {
        final response = await http.post(
          Uri.parse('$baseUrl/api/patrulla/ubicacion'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'lat': position.latitude,
            'lon': position.longitude,
          }),
        );
        
        setState(() {
          ubicacionEnviada = response.statusCode == 200;
        });
      }

      // Actualizar cámara del mapa
      if (_mapController != null && _posicionActual != null) {
        _mapController!.animateCamera(
          CameraUpdate.newLatLng(
            LatLng(_posicionActual!.latitude, _posicionActual!.longitude),
          ),
        );
      }

      _updateMarkers();
    } catch (e) {
      setState(() {
        ubicacionEnviada = false;
      });
      print('Error obteniendo ubicación: $e');
    }
  }

  void _startSendingLocation() {
    _getAndSendLocation(); // Enviar inmediatamente
    _locationTimer = Timer.periodic(const Duration(seconds: 6), (timer) {
      _getAndSendLocation();
    });
  }

  // Cargar alertas existentes al iniciar
  Future<void> _loadAlertasIniciales({bool isAutoRefresh = false}) async {
    try {
      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) {
        // � TEMPORALMENTE usar endpoint original mientras se arreglan los nuevos métodos
        final response = await http.get(
          Uri.parse('$baseUrl/api/alerta/activas'), // 🔥 USAR ENDPOINT ACTIVAS
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        );

        if (response.statusCode == 200) {
          final List<dynamic> data = jsonDecode(response.body);
          setState(() {
            // 🔥 FILTRO ADICIONAL: Excluir alertas vencidas, resueltas y archivadas
            alertas = data
                .where((json) {
                  final estado = (json['estado'] ?? '').toString().toLowerCase().trim();
                  return !(estado == 'vencida' || estado == 'resuelto' || estado == 'resuelta' || estado == 'no-atendida');
                })
                .map((json) => Alert.fromJson(json))
                .toList();
          });
          _updateMarkers();
          
          if (isAutoRefresh) {
            print('🔄 Refresh automático completado: ${alertas.length} alertas');
          } else {
            print('✅ Alertas cargadas: ${alertas.length}');
          }
        } else {
          print('❌ Error cargando alertas - Status: ${response.statusCode}');
          print('Response body: ${response.body}');
        }
      }
    } catch (e) {
      print('❌ Error cargando alertas: $e');
    }
  }

  // Mostrar notificación de nueva alerta
  void _showAlertNotification(Alert alerta) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.warning, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '🚨 Nueva alerta: ${alerta.nombreCompleto}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.red[700],
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: 'Ver',
          textColor: Colors.white,
          onPressed: () => _showAlertaDetails(alerta),
        ),
      ),
    );
  }



  // Construir botones de acción según el estado de la alerta
  List<Widget> _buildBotonesAccion(Alert alerta) {
    if (_patrulleroId == null) return [];

    List<Widget> botones = [];

    // Si la alerta está disponible, mostrar botón "Tomar Alerta"
    if (alerta.estaDisponible) {
      botones.add(
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () => _tomarAlerta(alerta),
            icon: const Icon(Icons.assignment_ind),
            label: const Text('TOMAR ALERTA'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      );
    } 
    // Si fue tomada por mí, mostrar botones de cambio de estado
    else if (alerta.fueTomadaPor(_patrulleroId!)) {
      if (alerta.estadoAlerta == AlertaEstado.tomada) {
        botones.add(
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _cambiarEstadoAlerta(alerta, AlertaEstado.enCamino),
              icon: const Icon(Icons.directions_run),
              label: const Text('MARCAR EN CAMINO'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        );
      } else if (alerta.estadoAlerta == AlertaEstado.enCamino) {
        botones.add(
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _cambiarEstadoAlerta(alerta, AlertaEstado.resuelto),
              icon: const Icon(Icons.check_circle),
              label: const Text('MARCAR RESUELTO'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        );
      }
    }
    // Si fue tomada por otro patrullero, mostrar info
    else if (!alerta.estaDisponible) {
      botones.add(
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey[100],
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey[300]!),
          ),
          child: Row(
            children: [
              Icon(Icons.info, color: Colors.grey[600]),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Alerta tomada por otro patrullero',
                  style: TextStyle(
                    color: Colors.grey[700],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return botones;
  }

  // Tomar una alerta
  Future<void> _tomarAlerta(Alert alerta) async {
    if (_patrulleroId == null) return;

    try {
      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) {
        final response = await http.post(
          Uri.parse('$baseUrl/api/alerta/tomar'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'alertaId': alerta.id,
            'patrulleroId': _patrulleroId,
          }),
        );

        // Debug: mostrar qué se está enviando
        print('🚨 ENVIANDO AL BACKEND:');
        print('URL: $baseUrl/api/alerta/tomar');
        print('AlertaId: ${alerta.id}');
        print('PatrulleroId: $_patrulleroId');

        if (response.statusCode == 200) {
          Navigator.pop(context); // Cerrar modal
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check, color: Colors.white),
                  const SizedBox(width: 8),
                  Text('Alerta tomada: ${alerta.nombreCompleto}'),
                ],
              ),
              backgroundColor: Colors.green,
            ),
          );
          
          // Actualizar la alerta localmente
          _actualizarAlertaLocal(alerta.id, AlertaEstado.tomada, _patrulleroId);
        } else {
          _mostrarErrorAlerta('Error al tomar la alerta: ${response.statusCode}');
        }
      }
    } catch (e) {
      _mostrarErrorAlerta('Error al tomar la alerta: $e');
    }
  }

  // Cambiar estado de una alerta
  Future<void> _cambiarEstadoAlerta(Alert alerta, AlertaEstado nuevoEstado) async {
    if (_patrulleroId == null) return;

    // 🎯 SI SE VA A MARCAR COMO RESUELTO, NAVEGAR AL ATESTADO POLICIAL
    if (nuevoEstado == AlertaEstado.resuelto) {
      Navigator.pop(context); // Cerrar modal actual
      
      // Navegar al formulario de atestado policial
      final resultado = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => AtestadoPolicialScreen(
            alertaId: alerta.id,
            latitud: alerta.lat,
            longitud: alerta.lon,
            distrito: _obtenerDistrito(alerta.lat, alerta.lon),
            // 🆕 Pasar datos de la víctima desde la alerta
            nombreVictima: alerta.apellido != null 
              ? '${alerta.nombre} ${alerta.apellido}'.trim()
              : alerta.nombre,
            dniVictima: alerta.dni,
          ),
        ),
      );
      
      // Si el atestado se registró exitosamente, entonces cambiar estado
      if (resultado == true) {
        await _cambiarEstadoAlertaSinAtestado(alerta, nuevoEstado);
      }
      return;
    }
    
    // Para otros estados, flujo normal
    await _cambiarEstadoAlertaSinAtestado(alerta, nuevoEstado);
  }
  
  // Función auxiliar para cambiar estado sin atestado
  Future<void> _cambiarEstadoAlertaSinAtestado(Alert alerta, AlertaEstado nuevoEstado) async {
    if (_patrulleroId == null) return;

    try {
      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) {
        final response = await http.post(
          Uri.parse('$baseUrl/api/alerta/cambiar-estado'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'alertaId': alerta.id,
            'patrulleroId': _patrulleroId,
            'nuevoEstado': _estadoToString(nuevoEstado),
          }),
        );

        if (response.statusCode == 200) {
          if (mounted) Navigator.pop(context); // Cerrar modal si existe
          
          String mensaje = '';
          Color color = Colors.blue;
          
          switch (nuevoEstado) {
            case AlertaEstado.enCamino:
              mensaje = 'Marcado en camino hacia ${alerta.nombreCompleto}';
              color = Colors.blue;
              break;
            case AlertaEstado.resuelto:
              mensaje = 'Emergencia resuelta: ${alerta.nombreCompleto}';
              color = Colors.green;
              break;
            default:
              mensaje = 'Estado actualizado';
          }
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    const Icon(Icons.check, color: Colors.white),
                    const SizedBox(width: 8),
                    Expanded(child: Text(mensaje)),
                  ],
                ),
                backgroundColor: color,
              ),
            );
          }
          
          // Actualizar la alerta localmente
          _actualizarAlertaLocal(alerta.id, nuevoEstado, _patrulleroId);
        } else {
          _mostrarErrorAlerta('Error al cambiar estado: ${response.statusCode}');
        }
      }
    } catch (e) {
      _mostrarErrorAlerta('Error al cambiar estado: $e');
    }
  }
  
  // Helper para obtener nombre del distrito basado en coordenadas
  String _obtenerDistrito(double lat, double lon) {
    // Coordenadas aproximadas de distritos de Tacna
    final distritos = {
      'Centro': LatLng(-18.013, -70.245),
      'Alto de la Alianza': LatLng(-18.005, -70.240),
      'Ciudad Nueva': LatLng(-18.022, -70.252),
      'Gregorio Albarracín Lanchipa': LatLng(-18.034, -70.243),
      'Pocollay': LatLng(-17.995, -70.230),
    };
    
    double distanciaMinima = double.infinity;
    String distritoMasCercano = 'Centro';
    
    for (final entry in distritos.entries) {
      final distancia = Geolocator.distanceBetween(
        lat, 
        lon, 
        entry.value.latitude, 
        entry.value.longitude
      );
      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        distritoMasCercano = entry.key;
      }
    }
    
    return distritoMasCercano;
  }

  // Actualizar alerta localmente
  void _actualizarAlertaLocal(String alertaId, AlertaEstado nuevoEstado, String? patrulleroId) {
    setState(() {
      final index = alertas.indexWhere((a) => a.id == alertaId);
      if (index != -1) {
        final alertaOriginal = alertas[index];
        alertas[index] = Alert(
          id: alertaOriginal.id,
          estadoAlerta: nuevoEstado,
          nombre: alertaOriginal.nombre,
          apellido: alertaOriginal.apellido,
          dni: alertaOriginal.dni,
          lat: alertaOriginal.lat,
          lon: alertaOriginal.lon,
          bateria: alertaOriginal.bateria,
          timestamp: alertaOriginal.timestamp,
          deviceId: alertaOriginal.deviceId,
          patrulleroAsignado: patrulleroId,
          fechaTomada: nuevoEstado == AlertaEstado.tomada ? DateTime.now().toIso8601String() : alertaOriginal.fechaTomada,
          fechaEnCamino: nuevoEstado == AlertaEstado.enCamino ? DateTime.now().toIso8601String() : alertaOriginal.fechaEnCamino,
          fechaResuelto: nuevoEstado == AlertaEstado.resuelto ? DateTime.now().toIso8601String() : alertaOriginal.fechaResuelto,
        );
      }
    });
    _updateMarkers();
  }

  // Mostrar error de alerta
  void _mostrarErrorAlerta(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(child: Text(mensaje)),
          ],
        ),
        backgroundColor: Colors.red,
      ),
    );
  }

  // Helper para convertir estado a string para API
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



  void _updateMarkers() {
    Set<Marker> newMarkers = {};

    // Agregar marcador de mi ubicación actual
    if (_posicionActual != null) {
      newMarkers.add(
        Marker(
          markerId: const MarkerId('mi_ubicacion'),
          position: LatLng(_posicionActual!.latitude, _posicionActual!.longitude),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          infoWindow: const InfoWindow(
            title: "Mi Posición",
            snippet: "Patrulla activa",
          ),
        ),
      );
    }

    // Agregar marcadores de alertas
    if (mostrarAlertas && _patrulleroId != null) {
      for (final alerta in alertas) {
        // Lógica de visibilidad de alertas
        bool mostrarMarcador = false;
        double hue = BitmapDescriptor.hueRed;
        String emoji = "🚨";

        if (alerta.estaDisponible) {
          // Alertas disponibles: visibles para todos
          mostrarMarcador = true;
          
          // 🔥 USAR COLOR POR URGENCIA EN LUGAR DE ESTADO
          switch (alerta.nivelUrgencia) {
            case NivelUrgencia.critica:
              hue = BitmapDescriptor.hueRed;
              emoji = alerta.esRecurrente ? "🔁🔴" : "🔴";
              break;
            case NivelUrgencia.media:
              hue = BitmapDescriptor.hueOrange;
              emoji = alerta.esRecurrente ? "🔁🟠" : "🟠";
              break;
            case NivelUrgencia.baja:
              hue = BitmapDescriptor.hueYellow;
              emoji = alerta.esRecurrente ? "🔁🟡" : "🟡";
              break;
          }
          
          // Indicar si es sin señal
          if (alerta.esSinSenal) {
            emoji += "�";
          }
          
        } else if (alerta.fueTomadaPor(_patrulleroId!)) {
          // Mis alertas: siempre visibles con color según estado
          mostrarMarcador = true;
          switch (alerta.estadoAlerta) {
            case AlertaEstado.tomada:
              hue = BitmapDescriptor.hueOrange;
              emoji = "🟠";
              break;
            case AlertaEstado.enCamino:
              hue = BitmapDescriptor.hueBlue;
              emoji = "🔵";
              break;
            case AlertaEstado.resuelto:
              // Alertas resueltas desaparecen inmediatamente
              mostrarMarcador = false;
              break;
            default:
              break;
          }
        }

        if (mostrarMarcador) {
          newMarkers.add(
            Marker(
              markerId: MarkerId('alerta_${alerta.id}'),
              position: LatLng(alerta.lat, alerta.lon),
              icon: BitmapDescriptor.defaultMarkerWithHue(hue),
              infoWindow: InfoWindow(
                title: "$emoji ${alerta.nombreCompleto} ${alerta.esRecurrente ? '🔁' : ''}",
                snippet: "${alerta.nivelUrgencia.name.toUpperCase()} | ${alerta.cantidadActivaciones}x | ${alerta.bateriaDisplay}${alerta.esSinSenal ? ' 📵' : ''}",
              ),
              onTap: () {
                setState(() {
                  selectedAlerta = alerta;
                });
                _showAlertaDetails(alerta);
              },
            ),
          );
        }
      }
    }

    setState(() {
      markers = newMarkers;
    });
  }

  void _showAlertaDetails(Alert alerta) {
    // 🎨 Color de urgencia para UI
    Color urgencyColor;
    switch (alerta.nivelUrgencia) {
      case NivelUrgencia.critica:
        urgencyColor = Colors.red;
        break;
      case NivelUrgencia.media:
        urgencyColor = Colors.orange;
        break;
      case NivelUrgencia.baja:
        urgencyColor = Colors.amber;
        break;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true, // 🔥 PERMITIR SCROLL Y MÁS ALTURA
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7, // 70% de la pantalla inicialmente
        minChildSize: 0.5, // Mínimo 50%
        maxChildSize: 0.95, // Máximo 95%
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 🔥 HANDLE PARA INDICAR QUE ES DRAGGABLE
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                
                Row(
                  children: [
                    Icon(Icons.warning, color: urgencyColor, size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'ALERTA ${alerta.nivelUrgencia.name.toUpperCase()}',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: urgencyColor,
                        ),
                      ),
                    ),
                    if (alerta.esRecurrente) ...[
                      const SizedBox(width: 8),
                      const Text('🔁', style: TextStyle(fontSize: 18)),
                      const Text('RECURRENTE', 
                        style: TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.bold)
                      ),
                    ]
                  ],
                ),
                const SizedBox(height: 16),
                
                // 🔥 INFORMACIÓN DE PRIORIDAD
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: urgencyColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: urgencyColor.withOpacity(0.3)),
                  ),
                  child: Column(
                    children: [
                      _buildDetailRow('Nivel de Urgencia', '${alerta.iconoUrgencia} ${alerta.nivelUrgencia.name.toUpperCase()}'),
                      _buildDetailRow('Activaciones', '${alerta.cantidadActivaciones}${alerta.cantidadActivaciones > 1 ? ' veces' : ' vez'}'),
                      if (alerta.tiempoDesdeCreacion.isNotEmpty)
                        _buildDetailRow('Tiempo transcurrido', alerta.tiempoDesdeCreacion),
                      if (alerta.esSinSenal)
                        _buildDetailRow('Estado señal', '📵 SIN SEÑAL (30+ min)'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                
                _buildDetailRow('Estado', alerta.estadoTexto),
                _buildDetailRow('Nombre', alerta.nombreCompleto),
                _buildDetailRow('DNI', alerta.dni ?? 'No disponible'),
                _buildDetailRow('Batería', alerta.bateriaDisplay),
                _buildDetailRow('Ubicación', '${alerta.lat.toStringAsFixed(4)}, ${alerta.lon.toStringAsFixed(4)}'),
                _buildDetailRow('Distancia', _calcularDistancia(alerta)),
                _buildDetailRow('Timestamp', alerta.timestamp),
                _buildDetailRow('Device ID', alerta.deviceId ?? 'No disponible'),
                const SizedBox(height: 20),
                
                // Botones de acción según el estado de la alerta
                ..._buildBotonesAccion(alerta),
                const SizedBox(height: 12),
                
                // Botón para mostrar/ocultar ruta
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _toggleRuta(alerta);
                    },
                    icon: Icon(mostrarRuta ? Icons.navigation_outlined : Icons.navigation),
                    label: Text(mostrarRuta ? 'Ocultar Ruta' : 'Mostrar Ruta GPS'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: mostrarRuta ? Colors.orange : Colors.purple,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _centrarEnUbicacion(alerta.lat, alerta.lon);
                        },
                        icon: const Icon(Icons.my_location),
                        label: const Text('Ir a ubicación'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                        label: const Text('Cerrar'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                
                // 🔥 PADDING ADICIONAL PARA EVITAR CORTES EN LA PARTE INFERIOR
                SizedBox(height: MediaQuery.of(context).padding.bottom + 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              '$label:',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Text(value),
          ),
        ],
      ),
    );
  }

  void _centrarEnUbicacion(double lat, double lon) {
    _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(LatLng(lat, lon), 18),
    );
  }

  // Mostrar/ocultar ruta hacia la alerta usando SISTEMA HÍBRIDO
  Future<void> _toggleRuta(Alert alerta) async {
    if (_posicionActual == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ubicación no disponible'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() {
      mostrarRuta = !mostrarRuta;
      alertaConRuta = mostrarRuta ? alerta : null;
    });

    if (mostrarRuta) {
      // Mostrar indicador de carga
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              ),
              SizedBox(width: 12),
              Text('🚀 Iniciando navegación inteligente...'),
            ],
          ),
          backgroundColor: Colors.blue,
          duration: Duration(seconds: 2),
        ),
      );

      try {
        // 1. Obtener ruta inicial de Google Directions
        final rutaPuntos = await _obtenerRutaGoogleDirections(alerta);
        
        if (rutaPuntos.isNotEmpty) {
          // 2. Guardar ruta completa para el sistema híbrido
          _rutaOriginalCompleta = rutaPuntos;
          _lastRouteOriginLat = _posicionActual!.latitude;
          _lastRouteOriginLng = _posicionActual!.longitude;
          _lastDirectionsRequest = DateTime.now();
          
          // 3. Mostrar ruta inicial
          _updatePolylineOnMap(rutaPuntos, alerta);
          
          // 4. Iniciar sistema de actualización automática
          _startRouteUpdates(alerta);
          
          // 5. Ajustar cámara
          _ajustarCamaraParaRuta(alerta);
          
          // 6. Mostrar mensaje de éxito
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.navigation, color: Colors.white),
                  const SizedBox(width: 8),
                  Text('✅ Navegación activa: ${rutaPuntos.length} puntos | Sistema híbrido ON'),
                ],
              ),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 3),
            ),
          );
          
          print('🚀 SISTEMA HÍBRIDO ACTIVADO: Ruta inicial + actualización automática');
        } else {
          // Error: Usar ruta directa como fallback
          print('⚠️ Google Directions falló, usando ruta directa');
          _crearRutaDirecta(alerta);
          
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.warning, color: Colors.white),
                  SizedBox(width: 8),
                  Text('⚠️ Sin navegación GPS - Ruta directa mostrada'),
                ],
              ),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 4),
            ),
          );
        }
      } catch (e) {
        print('❌ EXCEPTION en _toggleRuta: $e');
        _crearRutaDirecta(alerta);
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error, color: Colors.white),
                const SizedBox(width: 8),
                Text('❌ Error: $e'),
              ],
            ),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } else {
      // Ocultar ruta y detener sistema
      _stopRouteUpdates();
      
      setState(() {
        polylines.clear();
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.visibility_off, color: Colors.white),
              SizedBox(width: 8),
              Text('🛑 Navegación desactivada'),
            ],
          ),
          backgroundColor: Colors.grey,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  // Crear ruta directa como fallback
  void _crearRutaDirecta(Alert alerta) {
    final polyline = Polyline(
      polylineId: PolylineId('ruta_directa_${alerta.id}'),
      points: [
        LatLng(_posicionActual!.latitude, _posicionActual!.longitude),
        LatLng(alerta.lat, alerta.lon),
      ],
      color: Color(int.parse(alerta.colorPorUrgencia.replaceFirst('#', '0xff'))), // Color según urgencia
      width: 4,
      patterns: [PatternItem.dash(15), PatternItem.gap(10)], // Línea punteada
      startCap: Cap.roundCap,
      endCap: Cap.roundCap,
    );
    
    setState(() {
      polylines = {polyline};
    });
    
    _ajustarCamaraParaRuta(alerta);
    
    print('⚠️ MOSTRANDO RUTA DIRECTA (FALLBACK)');
  }

  // Obtener ruta usando Google Directions API
  Future<List<LatLng>> _obtenerRutaGoogleDirections(Alert alerta) async {
    try {
      final origin = '${_posicionActual!.latitude},${_posicionActual!.longitude}';
      final destination = '${alerta.lat},${alerta.lon}';
      
      // Construir URL con parámetros adicionales para mejor routing
      final url = 'https://maps.googleapis.com/maps/api/directions/json'
          '?origin=$origin'
          '&destination=$destination'
          '&mode=driving'
          '&avoid=tolls'
          '&units=metric'
          '&language=es'
          '&region=pe'
          '&key=$googleMapsApiKey';

      print('🌐 GOOGLE DIRECTIONS URL: $url');
      print('📍 ORIGEN: $origin');
      print('📍 DESTINO: $destination');

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));
      
      print('📡 RESPONSE STATUS: ${response.statusCode}');
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        print('🔍 API STATUS: ${data['status']}');
        
        if (data['status'] == 'OK' && data['routes'] != null && data['routes'].isNotEmpty) {
          final route = data['routes'][0];
          
          // Verificar que la ruta tenga polyline
          if (route['overview_polyline'] != null && route['overview_polyline']['points'] != null) {
            final polylinePoints = route['overview_polyline']['points'] as String;
            
            print('✅ POLYLINE ENCONTRADA: ${polylinePoints.length} caracteres');
            
            try {
              // Decodificar los puntos de la polilínea
              final List<List<num>> decodedPoints = PolylineCodec.decode(polylinePoints);
              final rutaPuntos = decodedPoints.map((point) => 
                LatLng(point[0].toDouble(), point[1].toDouble())
              ).toList();
              
              print('✅ PUNTOS DECODIFICADOS: ${rutaPuntos.length} puntos');
              
              // Verificar que tenemos al menos 2 puntos
              if (rutaPuntos.length >= 2) {
                return rutaPuntos;
              } else {
                print('❌ Muy pocos puntos en la ruta: ${rutaPuntos.length}');
              }
            } catch (decodeError) {
              print('❌ ERROR DECODIFICANDO POLYLINE: $decodeError');
            }
          } else {
            print('❌ No se encontró polyline en la respuesta');
          }
        } else {
          print('❌ API ERROR: ${data['status']}');
          
          // Manejar errores específicos de la API
          if (data['status'] == 'REQUEST_DENIED') {
            final errorMsg = data['error_message'] ?? 'Acceso denegado';
            print('❌ ERROR MESSAGE: $errorMsg');
            
            // Mostrar mensaje específico según el tipo de error
            if (errorMsg.contains('referer restrictions')) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    '🔑 API Key con restricciones de referer:\n'
                    '• Ve a Google Cloud Console\n'
                    '• Cambia "Application restrictions" a "None"\n'
                    '• Habilita "Directions API"',
                  ),
                  backgroundColor: Colors.red,
                  duration: Duration(seconds: 8),
                ),
              );
            } else if (errorMsg.contains('not authorized')) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    '🚫 API Key no autorizada:\n'
                    '• Ve a Google Cloud Console\n'
                    '• Cambia "Application restrictions" a "None"\n'
                    '• O agrega tu app a las restricciones\n'
                    '• Habilita "Directions API"',
                  ),
                  backgroundColor: Colors.red,
                  duration: Duration(seconds: 8),
                ),
              );
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('🔑 API Key error: $errorMsg'),
                  backgroundColor: Colors.red,
                  duration: const Duration(seconds: 6),
                ),
              );
            }
          } else if (data['status'] == 'OVER_QUERY_LIMIT') {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('❌ Límite de consultas excedido en Google Maps API'),
                backgroundColor: Colors.red,
                duration: Duration(seconds: 4),
              ),
            );
          }
          
          if (data['error_message'] != null) {
            print('❌ ERROR MESSAGE: ${data['error_message']}');
          }
          
          // Imprimir respuesta completa para debug
          print('❌ RESPUESTA COMPLETA: ${response.body}');
        }
      } else {
        print('❌ HTTP ERROR: ${response.statusCode}');
        print('❌ RESPONSE BODY: ${response.body}');
      }
      
      return [];
    } catch (e) {
      print('❌ EXCEPTION en Google Directions API: $e');
      return [];
    }
  }

  // Ajustar cámara para mostrar la ruta completa
  void _ajustarCamaraParaRuta(Alert alerta) {
    if (_posicionActual == null || _mapController == null) return;

    final double minLat = [_posicionActual!.latitude, alerta.lat].reduce((a, b) => a < b ? a : b);
    final double maxLat = [_posicionActual!.latitude, alerta.lat].reduce((a, b) => a > b ? a : b);
    final double minLng = [_posicionActual!.longitude, alerta.lon].reduce((a, b) => a < b ? a : b);
    final double maxLng = [_posicionActual!.longitude, alerta.lon].reduce((a, b) => a > b ? a : b);

    final bounds = LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );

    _mapController!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 100.0),
    );
  }

  // Calcular distancia aproximada entre dos puntos
  String _calcularDistancia(Alert alerta) {
    if (_posicionActual == null) return 'N/A';
    
    final distancia = Geolocator.distanceBetween(
      _posicionActual!.latitude,
      _posicionActual!.longitude,
      alerta.lat,
      alerta.lon,
    );
    
    if (distancia < 1000) {
      return '${distancia.round()}m';
    } else {
      return '${(distancia / 1000).toStringAsFixed(1)}km';
    }
  }

  // ============================================================================
  // SISTEMA HÍBRIDO DE ACTUALIZACIÓN DE RUTAS (TRIMMING + RE-REQUEST)
  // ============================================================================

  // Helper: Distancia entre dos LatLng
  double _distanceBetweenLatLng(LatLng a, LatLng b) {
    return Geolocator.distanceBetween(a.latitude, a.longitude, b.latitude, b.longitude);
  }

  // Helper: Encuentra el punto más cercano en la polyline
  Map<String, dynamic> _nearestPointOnPolyline(List<LatLng> poly, LatLng pos) {
    if (poly.isEmpty) return {'index': 0, 'point': pos, 'distance': 0.0};
    
    double bestDist = double.infinity;
    LatLng bestPoint = poly.first;
    int bestIndex = 0;

    for (int i = 0; i < poly.length - 1; i++) {
      final a = poly[i];
      final b = poly[i + 1];

      // Proyección simple en el segmento a-b
      final double x1 = a.longitude;
      final double y1 = a.latitude;
      final double x2 = b.longitude;
      final double y2 = b.latitude;
      final double x0 = pos.longitude;
      final double y0 = pos.latitude;

      final dx = x2 - x1;
      final dy = y2 - y1;
      final denom = dx * dx + dy * dy;
      double t = 0.0;
      if (denom > 0) {
        t = ((x0 - x1) * dx + (y0 - y1) * dy) / denom;
        t = t.clamp(0.0, 1.0);
      }

      final projLon = x1 + t * dx;
      final projLat = y1 + t * dy;
      final proj = LatLng(projLat, projLon);

      final dist = _distanceBetweenLatLng(proj, pos);
      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = proj;
        bestIndex = i;
      }
    }

    return {'index': bestIndex, 'point': bestPoint, 'distance': bestDist};
  }

  // Recortar polyline desde posición actual (sin API calls)
  List<LatLng> _trimPolylineFromPosition(List<LatLng> poly, LatLng pos) {
    if (poly.isEmpty) return [];

    final nearest = _nearestPointOnPolyline(poly, pos);
    final int idx = nearest['index'] as int;
    final LatLng proj = nearest['point'] as LatLng;

    final newPoly = <LatLng>[proj];
    for (int i = idx + 1; i < poly.length; i++) {
      newPoly.add(poly[i]);
    }

    // Si el punto proyectado está muy lejos, usar posición actual como inicio
    final firstDist = _distanceBetweenLatLng(pos, newPoly.first);
    if (firstDist > 15.0) {
      newPoly.insert(0, pos);
    }

    return newPoly;
  }

  // Determinar si necesitamos nueva ruta (re-request) o solo trimming
  bool _shouldRequestNewRoute(LatLng currentPos) {
    if (_rutaOriginalCompleta.isEmpty) return true;
    if (_isRequestingNewRoute) return false;

    // 1. Verificar desviación de la ruta original
    final nearest = _nearestPointOnPolyline(_rutaOriginalCompleta, currentPos);
    final deviation = nearest['distance'] as double;
    
    if (deviation > ROUTE_DEVIATION_THRESHOLD) {
      print('🔄 Desviación de ${deviation.round()}m > ${ROUTE_DEVIATION_THRESHOLD}m - Nueva ruta necesaria');
      return true;
    }

    // 2. Verificar tiempo desde última petición
    if (_lastDirectionsRequest != null) {
      final timeSinceRequest = DateTime.now().difference(_lastDirectionsRequest!);
      if (timeSinceRequest.inSeconds > MAX_REQUERY_INTERVAL_SECONDS) {
        print('🔄 ${timeSinceRequest.inSeconds}s desde última petición > ${MAX_REQUERY_INTERVAL_SECONDS}s - Nueva ruta por tiempo');
        return true;
      }
    }

    // 3. Verificar movimiento significativo desde último origen
    final distanceFromLastOrigin = Geolocator.distanceBetween(
      _lastRouteOriginLat, _lastRouteOriginLng,
      currentPos.latitude, currentPos.longitude,
    );
    
    if (distanceFromLastOrigin > MIN_MOVEMENT_THRESHOLD * 3) { // 30m aprox
      print('🔄 Movimiento de ${distanceFromLastOrigin.round()}m desde último origen - Nueva ruta');
      return true;
    }

    return false;
  }

  // Iniciar sistema de actualización de ruta
  void _startRouteUpdates(Alert alerta) {
    _routeUpdateTimer?.cancel();
    
    _routeUpdateTimer = Timer.periodic(
      Duration(seconds: ROUTE_UPDATE_INTERVAL_SECONDS), 
      (_) => _updateRouteIntelligently(alerta),
    );
    
    print('🚀 Sistema de actualización de ruta iniciado para ${alerta.nombreCompleto}');
  }

  // Detener sistema de actualización de ruta
  void _stopRouteUpdates() {
    _routeUpdateTimer?.cancel();
    _routeUpdateTimer = null;
    _rutaOriginalCompleta.clear();
    _isRequestingNewRoute = false;
    
    print('🛑 Sistema de actualización de ruta detenido');
  }

  // Lógica principal: actualizar ruta inteligentemente
  Future<void> _updateRouteIntelligently(Alert alerta) async {
    if (_posicionActual == null || !mostrarRuta) return;
    
    final currentPos = LatLng(_posicionActual!.latitude, _posicionActual!.longitude);
    
    // Decidir: ¿nueva ruta o solo trimming?
    if (_shouldRequestNewRoute(currentPos)) {
      // Re-request: Pedir nueva ruta a Google Directions
      await _requestNewRouteFromGoogle(alerta, currentPos);
    } else {
      // Trimming: Solo recortar la ruta existente
      _updateRouteWithTrimming(currentPos);
    }
  }

  // Re-request: Obtener nueva ruta de Google Directions
  Future<void> _requestNewRouteFromGoogle(Alert alerta, LatLng currentPos) async {
    if (_isRequestingNewRoute) return;
    
    _isRequestingNewRoute = true;
    print('🌐 Solicitando nueva ruta desde Google Directions...');
    
    try {
      final nuevaRuta = await _obtenerRutaGoogleDirections(alerta);
      
      if (nuevaRuta.isNotEmpty) {
        _rutaOriginalCompleta = nuevaRuta;
        _lastRouteOriginLat = currentPos.latitude;
        _lastRouteOriginLng = currentPos.longitude;
        _lastDirectionsRequest = DateTime.now();
        
        _updatePolylineOnMap(nuevaRuta, alerta);
        print('✅ Nueva ruta obtenida: ${nuevaRuta.length} puntos');
      } else {
        print('❌ Error obteniendo nueva ruta - usando trimming como fallback');
        _updateRouteWithTrimming(currentPos);
      }
    } catch (e) {
      print('❌ Exception en nueva ruta: $e - usando trimming');
      _updateRouteWithTrimming(currentPos);
    } finally {
      _isRequestingNewRoute = false;
    }
  }

  // Trimming: Recortar ruta existente (sin API calls)
  void _updateRouteWithTrimming(LatLng currentPos) {
    if (_rutaOriginalCompleta.isEmpty) return;
    
    final trimmedRoute = _trimPolylineFromPosition(_rutaOriginalCompleta, currentPos);
    _updatePolylineOnMap(trimmedRoute, alertaConRuta);
    
    print('✂️ Ruta recortada: ${trimmedRoute.length} puntos restantes');
  }

  // Helper: Actualizar polyline en el mapa
  void _updatePolylineOnMap(List<LatLng> rutaPuntos, Alert? alerta) {
    if (rutaPuntos.isEmpty || alerta == null) return;
    
    final polyline = Polyline(
      polylineId: PolylineId('ruta_real_${alerta.id}'),
      points: rutaPuntos,
      color: Color(int.parse(alerta.colorPorUrgencia.replaceFirst('#', '0xff'))), // Color según urgencia
      width: 6,
      patterns: [],
      startCap: Cap.roundCap,
      endCap: Cap.roundCap,
      jointType: JointType.round,
    );
    
    setState(() {
      polylines = {polyline};
    });
  }

  // ============================================================================
  // FIN DEL SISTEMA HÍBRIDO
  // ============================================================================

  // Método para refrescar alertas manualmente
  // 🆕 Iniciar refresh automático cada 30 segundos
  void _startAutomaticAlertasRefresh() {
    print('🕐 Iniciando refresh automático de alertas cada 30 segundos...');
    
    // Ejecutar la primera vez inmediatamente no es necesario porque ya se llamó _loadAlertasIniciales
    
    // Configurar timer periódico cada 30 segundos
    _alertasRefreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      print('⏰ Ejecutando refresh automático...');
      _loadAlertasIniciales(isAutoRefresh: true);
    });
  }

  // Método para solicitar permisos críticos de notificaciones
  Future<void> _requestCriticalPermissions() async {
    print('🚨 Solicitando permisos críticos...');
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🚨 Configurando permisos para alertas...'),
        backgroundColor: Colors.red,
        duration: Duration(seconds: 2),
      ),
    );

    bool allGranted = await _notificationService.requestCriticalPermissions();
    
    if (allGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Permisos básicos configurados - Para alertas críticas habilita manualmente "Mostrar sobre otras apps" en configuración'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 6),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⚠️ Error en configuración - Intenta habilitar permisos manualmente'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 5),
        ),
      );
    }
  }

  // Método para probar conectividad del backend
  Future<void> _testBackendConnectivity() async {
    print('🔍 Probando conectividad del backend...');
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🔍 Probando endpoints del backend...'),
        backgroundColor: Colors.orange,
        duration: Duration(seconds: 2),
      ),
    );

    // Probar conectividad básica primero
    final isConnected = await BackendTester.testBasicConnectivity();
    
    if (!isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('❌ No hay conectividad con el backend'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 4),
        ),
      );
      return;
    }

    // Probar todos los endpoints
    await BackendTester.testEndpoints();
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('✅ Prueba de backend completada (revisa logs)'),
        backgroundColor: Colors.green,
        duration: Duration(seconds: 3),
      ),
    );
  }

  // Método para forzar reconexión de SignalR  
  Future<void> _reconnectSignalR() async {
    print('🔄 Forzando reconexión de SignalR...');
    
    setState(() {
      _isSignalRConnected = false;
    });
    
    // Reconectar usando el servicio
    final connected = await _signalRService.reconnect();
    
    setState(() {
      _isSignalRConnected = connected;
    });
    
    if (connected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ SignalR reconectado exitosamente'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('❌ Error al reconectar SignalR'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  // Método para verificar estado de conexión
  Future<void> _checkSignalRConnection() async {
    final connected = await _signalRService.checkConnection();
    final status = _signalRService.connectionStatus;
    
    print('🔍 Estado actual de SignalR: $status');
    print('🔍 ¿Conectado?: $connected');
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          connected 
            ? '✅ SignalR conectado - Estado: $status'
            : '❌ SignalR desconectado - Estado: $status'
        ),
        backgroundColor: connected ? Colors.green : Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }


  @override
  void dispose() {
    _locationTimer?.cancel();
    _routeUpdateTimer?.cancel(); // Limpiar timer del sistema híbrido
    _alertasRefreshTimer?.cancel(); // 🆕 Limpiar timer de refresh automático
    
    // ✅ NUEVO: Detener heartbeat cuando se cierra la pantalla
    UserService().stopHeartbeat();
    
    // Cerrar conexión SignalR correctamente usando el servicio
    _signalRService.dispose();
    
    super.dispose();
  }

  // ✅ NUEVO: Método para cerrar sesión limpiamente
  Future<void> _logout() async {
    try {
      // Mostrar confirmación
      bool confirm = await showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Cerrar Sesión'),
          content: const Text('¿Estás seguro que deseas cerrar sesión?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Cerrar Sesión'),
            ),
          ],
        ),
      ) ?? false;

      if (!confirm) return;

      // Detener servicios
      UserService().logout();
      _signalRService.dispose();
      _locationTimer?.cancel();
      _routeUpdateTimer?.cancel();
      _alertasRefreshTimer?.cancel(); // 🆕 Limpiar timer de refresh automático

      // Cerrar sesión en Firebase
      await FirebaseAuth.instance.signOut();

      if (mounted) {
        // Navegar de vuelta al login
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const WelcomeScreen()),
        );
      }
    } catch (e) {
      print('❌ Error durante logout: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    LatLng initialCenter = _posicionActual != null
        ? LatLng(_posicionActual!.latitude, _posicionActual!.longitude)
        : const LatLng(-18.0066, -70.2463);

    return Scaffold(
      appBar: AppBar(
        title: const Text('SISALERT - Patrulla'),
        backgroundColor: const Color(0xFF283EFA),
        foregroundColor: Colors.white,
        actions: [
          // Botón de conexión SignalR (clickeable para reconectar)
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: IconButton(
              onPressed: () {
                if (_isSignalRConnected) {
                  _checkSignalRConnection();
                } else {
                  _reconnectSignalR();
                }
              },
              icon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _isSignalRConnected ? Icons.wifi : Icons.wifi_off,
                    color: _isSignalRConnected ? Colors.green : Colors.red,
                    size: 20,
                  ),
                  if (!_isSignalRConnected) 
                    const Icon(Icons.refresh, color: Colors.orange, size: 16),
                ],
              ),
              tooltip: _isSignalRConnected ? 'Verificar conexión' : 'Reconectar SignalR',
            ),
          ),
          // Indicador de estado de ubicación
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: ubicacionEnviada
                ? const Icon(Icons.gps_fixed, color: Colors.green)
                : const Icon(Icons.gps_off, color: Colors.orange),
          ),
          // ✅ NUEVO: Botón de logout
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Cerrar sesión',
          ),
        ],
      ),
      body: Stack(
        children: [
          // Mapa principal
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: initialCenter,
              zoom: 16,
            ),
            onMapCreated: (controller) {
              _mapController = controller;
              _updateMarkers();
            },
            markers: markers,
            polylines: polylines,
            myLocationEnabled: false, // Usamos nuestro propio marcador
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
          ),

          // Panel de información superior
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildInfoChip(
                      icon: Icons.warning,
                      label: 'Alertas',
                      count: alertas.length,
                      color: Colors.red,
                      isActive: mostrarAlertas,
                    ),

                  ],
                ),
              ),
            ),
          ),

          // Botón para limpiar ruta (solo visible cuando hay ruta activa)
          if (mostrarRuta)
            Positioned(
              top: 100,
              right: 16,
              child: FloatingActionButton(
                mini: true,
                onPressed: () {
                  setState(() {
                    mostrarRuta = false;
                    polylines.clear();
                  });
                },
                backgroundColor: Colors.red,
                child: const Icon(Icons.close, color: Colors.white),
                tooltip: 'Ocultar ruta',
              ),
            ),

          // Botones de control en la parte inferior
          Positioned(
            bottom: 20,
            left: 20,
            right: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Botón de Mi Ubicación
                FloatingActionButton(
                  mini: true,
                  onPressed: () {
                    if (_posicionActual != null) {
                      _centrarEnUbicacion(_posicionActual!.latitude, _posicionActual!.longitude);
                    }
                  },
                  backgroundColor: Colors.blue,
                  child: const Icon(Icons.my_location, color: Colors.white),
                ),

                // Botón de Permisos Críticos
                FloatingActionButton(
                  mini: true,
                  onPressed: _requestCriticalPermissions,
                  backgroundColor: Colors.red,
                  child: const Icon(Icons.notifications_active, color: Colors.white),
                ),

                // Botón de Test Backend
                FloatingActionButton(
                  mini: true,
                  onPressed: _testBackendConnectivity,
                  backgroundColor: Colors.orange,
                  child: const Icon(Icons.network_check, color: Colors.white),
                ),

                // 🆕 Botón de refresh manual eliminado - ahora es automático cada 30s
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoChip({
    required IconData icon,
    required String label,
    required int count,
    required Color color,
    required bool isActive,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: isActive ? color : Colors.grey, size: 20),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: isActive ? Colors.black87 : Colors.grey,
          ),
        ),
        const SizedBox(width: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: isActive ? color : Colors.grey,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            count.toString(),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}