import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';

class MapaScreen extends StatefulWidget {
  const MapaScreen({super.key});

  @override
  State<MapaScreen> createState() => _MapaScreenState();
}

class _MapaScreenState extends State<MapaScreen> {
  Timer? _timer;
  bool _sending = false;
  String status = "Esperando...";
  String ubicacionActual = "Sin datos";
  String respuestaBackend = "Sin datos";

  @override
  void initState() {
    super.initState();
    _pedirPermisoYEnviar();
  }

  Future<void> _pedirPermisoYEnviar() async {
    LocationPermission permiso = await Geolocator.requestPermission();
    if (permiso == LocationPermission.denied || permiso == LocationPermission.deniedForever) {
      setState(() {
        status = "Permiso de ubicación denegado";
      });
      return;
    }
    _startSendingLocation();
  }

  Future<void> _getAndSendLocation() async {
    try {
      status = "Obteniendo ubicación...";
      setState(() {});
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      ubicacionActual = "Lat: ${position.latitude}, Lon: ${position.longitude}";
      print('Ubicación actual: $ubicacionActual');

      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) {
        status = "Enviando ubicación al backend...";
        setState(() {});
        final response = await http.post(
          Uri.parse('https://8af58d3e7cde.ngrok-free.app/patrulla/ubicacion'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: '{"lat": ${position.latitude}, "lon": ${position.longitude}}',
        );
        respuestaBackend = "Status: ${response.statusCode}, Body: ${response.body}";
        print('Respuesta del backend: $respuestaBackend');
        status = "Ubicación enviada correctamente";
        setState(() {});
      }
    } catch (e) {
      status = "Error: $e";
      ubicacionActual = "Error al obtener ubicación";
      print('Error al obtener/enviar ubicación: $e');
      setState(() {});
    }
  }

  void _startSendingLocation() {
    _timer = Timer.periodic(const Duration(seconds: 6), (timer) {
      _getAndSendLocation();
      _sending = true;
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Patrulla - Mapa')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.map, size: 80, color: Colors.blueAccent),
            const SizedBox(height: 16),
            const Text(
              "Aquí va el mapa",
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            Text(
              status,
              style: const TextStyle(fontSize: 18, color: Colors.black),
            ),
            const SizedBox(height: 12),
            Text(
              ubicacionActual,
              style: const TextStyle(fontSize: 16, color: Colors.blueGrey),
            ),
            const SizedBox(height: 12),
            Text(
              respuestaBackend,
              style: const TextStyle(fontSize: 14, color: Colors.green),
            ),
          ],
        ),
      ),
    );
  }
}