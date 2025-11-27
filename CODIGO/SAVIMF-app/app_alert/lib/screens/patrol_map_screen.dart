import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';

class PatrolMapScreen extends StatefulWidget {
  const PatrolMapScreen({super.key});

  @override
  State<PatrolMapScreen> createState() => _PatrolMapScreenState();
}

class _PatrolMapScreenState extends State<PatrolMapScreen> {
  Timer? _timer;
  Position? _currentPosition;

  @override
  void initState() {
    super.initState();
    _startSendingLocation();
  }

  Future<void> _getAndSendLocation() async {
    try {
      _currentPosition = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();

      if (token != null && _currentPosition != null) {
        await http.post(
          Uri.parse('http://18.225.31.96:5000/api/patrulla/ubicacion'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: '{"lat": ${_currentPosition!.latitude}, "lon": ${_currentPosition!.longitude}}',
        );
      }
    } catch (e) {
      // Manejo de errores (ej: sin permisos)
    }
  }

  void _startSendingLocation() {
    _timer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _getAndSendLocation();
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
      body: Center(child: Text('Enviando ubicación cada 5 segundos...')),
    );
  }
}