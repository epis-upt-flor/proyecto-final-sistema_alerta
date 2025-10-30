import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:signalr_netcore/signalr_client.dart';
import '../models/alert.dart';


class MapaScreen extends StatefulWidget {
  const MapaScreen({super.key});

  @override
  State<MapaScreen> createState() => _MapaScreenState();
}

class _MapaScreenState extends State<MapaScreen> {
  // Timers
  Timer? _locationTimer;

  // SignalR Connection
  HubConnection? _hubConnection;
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

  static const String baseUrl = 'https://f704b00c52f8.ngrok-free.app';
  static const String signalRUrl = 'https://f704b00c52f8.ngrok-free.app/alertaHub';

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    await _obtenerPatrulleroId();
    await _pedirPermisoYEnviar();
    await _initializeSignalR();
    await _loadAlertasIniciales(); // Cargar alertas existentes una vez
  }

  // Obtener ID del patrullero actual desde Firebase
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

  // Inicializar SignalR para alertas en tiempo real
  Future<void> _initializeSignalR() async {
    try {

      
      _hubConnection = HubConnectionBuilder()
          .withUrl(signalRUrl)
          .withAutomaticReconnect()
          .build();

      // Nota: callbacks de reconexión varían según versión de signalr_netcore
      // Por ahora enfocamos en limpiar alertas al inicializar

      // Escuchar alertas nuevas en tiempo real
      _hubConnection!.on("RecibirAlerta", (arguments) {
        if (arguments != null && arguments.isNotEmpty) {
          final alertaData = arguments[0] as Map<String, dynamic>;
          final nuevaAlerta = Alert.fromJson(alertaData);
          
          // Evitar duplicados por deviceId y timestamp
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
            
            // Mostrar notificación
            _showAlertNotification(nuevaAlerta);
            
            print('Nueva alerta recibida: ${nuevaAlerta.nombreCompleto}');
          } else {
            print('Alerta duplicada ignorada: ${nuevaAlerta.deviceId}');
          }
        }
      });

      // Escuchar cuando alguien toma una alerta
      _hubConnection!.on("AlertaTomada", (arguments) {
        if (arguments != null && arguments.isNotEmpty) {
          final data = arguments[0] as Map<String, dynamic>;
          final alertaId = data['alertaId']?.toString();
          final patrulleroId = data['patrulleroId']?.toString();
          
          if (alertaId != null && patrulleroId != null) {
            _actualizarAlertaLocal(alertaId, AlertaEstado.tomada, patrulleroId);
            
            // Si no soy yo quien tomó la alerta, mostrar notificación
            if (patrulleroId != _patrulleroId) {
              final alerta = alertas.firstWhere((a) => a.id == alertaId, 
                orElse: () => alertas.first);
              
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Alerta tomada por otro patrullero: ${alerta.nombreCompleto}'),
                  backgroundColor: Colors.orange,
                  duration: const Duration(seconds: 3),
                ),
              );
            }
          }
        }
      });

      // Escuchar cambios de estado de alertas
      _hubConnection!.on("AlertaEstadoCambiado", (arguments) {
        if (arguments != null && arguments.isNotEmpty) {
          final data = arguments[0] as Map<String, dynamic>;
          final alertaId = data['alertaId']?.toString();
          final patrulleroId = data['patrulleroId']?.toString();
          final nuevoEstado = data['nuevoEstado']?.toString();
          
          if (alertaId != null && patrulleroId != null && nuevoEstado != null) {
            final estadoEnum = Alert.parseEstado(nuevoEstado);
            _actualizarAlertaLocal(alertaId, estadoEnum, patrulleroId);
            
            // Mostrar notificación del cambio de estado
            final alerta = alertas.firstWhere((a) => a.id == alertaId, 
              orElse: () => alertas.first);
            
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
          }
        }
      });

      await _hubConnection!.start();
      setState(() {
        _isSignalRConnected = true;
      });
      print('SignalR conectado correctamente');
      
    } catch (e) {
      print('Error conectando SignalR: $e');
      setState(() {
        _isSignalRConnected = false;
      });
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

  // Cargar alertas existentes al iniciar
  Future<void> _loadAlertasIniciales() async {
    try {
      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) {
        // Endpoint correcto según tu backend
        final response = await http.get(
          Uri.parse('$baseUrl/api/alerta/listar'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        );

        if (response.statusCode == 200) {
          final List<dynamic> data = jsonDecode(response.body);
          setState(() {
            alertas = data.map((json) => Alert.fromJson(json)).toList();
          });
          _updateMarkers();
          print('Alertas cargadas: ${alertas.length}');
        } else {
          print('Error cargando alertas - Status: ${response.statusCode}');
          print('Response body: ${response.body}');
        }
      }
    } catch (e) {
      print('Error cargando alertas: $e');
    }
  }

  // Método para refrescar alertas manualmente
  Future<void> _refreshAlertas() async {
    await _loadAlertasIniciales();
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
          Navigator.pop(context); // Cerrar modal
          
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
      for (int i = 0; i < alertas.length; i++) {
        final alerta = alertas[i];
        
        // Lógica de visibilidad de alertas
        bool mostrarMarcador = false;
        double hue = BitmapDescriptor.hueRed;
        String emoji = "🚨";
        
        if (alerta.estaDisponible) {
          // Alertas disponibles: visibles para todos (rojo)
          mostrarMarcador = true;
          hue = BitmapDescriptor.hueRed;
          emoji = "🚨";
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
              hue = BitmapDescriptor.hueGreen;
              emoji = "✅";
              // Ocultar alertas resueltas después de 5 minutos
              if (alerta.fechaResuelto != null) {
                try {
                  final fechaResuelto = DateTime.parse(alerta.fechaResuelto!);
                  final ahora = DateTime.now();
                  if (ahora.difference(fechaResuelto).inMinutes > 5) {
                    mostrarMarcador = false;
                  }
                } catch (e) {
                  // Si hay error parseando fecha, mostrar por defecto
                }
              }
              break;
            default:
              break;
          }
        }
        // Alertas de otros patrulleros: NO mostrar (quedan ocultas)
        
        if (mostrarMarcador) {
          newMarkers.add(
            Marker(
              markerId: MarkerId('alerta_${alerta.id}'),
              position: LatLng(alerta.lat, alerta.lon),
              icon: BitmapDescriptor.defaultMarkerWithHue(hue),
              infoWindow: InfoWindow(
                title: "$emoji ${alerta.nombreCompleto}",
                snippet: "${alerta.estadoTexto} | ${alerta.bateriaDisplay}",
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
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning, color: Colors.red, size: 28),
                const SizedBox(width: 12),
                Text(
                  'ALERTA ACTIVA',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.red[700],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildDetailRow('Estado', alerta.estadoTexto),
            _buildDetailRow('Nombre', alerta.nombreCompleto),
            _buildDetailRow('DNI', alerta.dni ?? 'No disponible'),
            _buildDetailRow('Batería', alerta.bateriaDisplay),
            _buildDetailRow('Ubicación', '${alerta.lat.toStringAsFixed(4)}, ${alerta.lon.toStringAsFixed(4)}'),
            _buildDetailRow('Timestamp', alerta.timestamp),
            _buildDetailRow('Device ID', alerta.deviceId ?? 'No disponible'),
            const SizedBox(height: 20),
            // Botones de acción según el estado de la alerta
            ..._buildBotonesAccion(alerta),
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
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                    label: const Text('Cerrar'),
                  ),
                ),
              ],
            ),
          ],
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



  @override
  void dispose() {
    _locationTimer?.cancel();
    _hubConnection?.stop();
    super.dispose();
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

          // Indicador de conexión SignalR
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _isSignalRConnected ? Icons.wifi : Icons.wifi_off,
                  color: _isSignalRConnected ? Colors.green : Colors.red,
                  size: 20,
                ),
                const SizedBox(width: 8),
              ],
            ),
          ),
          // Indicador de estado de ubicación
          Container(
            margin: const EdgeInsets.only(right: 16),
            child: ubicacionEnviada
                ? const Icon(Icons.gps_fixed, color: Colors.green)
                : const Icon(Icons.gps_off, color: Colors.orange),
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

                // Botón de Refresh
                FloatingActionButton(
                  mini: true,
                  onPressed: () {
                    _refreshAlertas();
                  },
                  backgroundColor: const Color(0xFF283EFA),
                  child: const Icon(Icons.refresh, color: Colors.white),
                ),
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