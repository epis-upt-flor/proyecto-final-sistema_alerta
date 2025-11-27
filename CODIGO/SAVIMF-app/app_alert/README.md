# app_alert

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.


lib/
    screens/
        login_screen.dart
        mapa_screen.dart
        patrol_map_screen.dart
        welcome_screen.dat
    widgets/
        social_buttons.dart
    firebase_options.dart
    main.dart


SABES QUE PASEMOS AL APP MOVIL tengo esta estructura lib/
    screens/
        login_screen.dart
        mapa_screen.dart
        patrol_map_screen.dart
        welcome_screen.dat
    widgets/
        social_buttons.dart
    firebase_options.dart
    main.dart
  con este contenido en cada archivo  login_screen.dart: import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:app_alert/screens/mapa_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool rememberMe = false;
  String? errorMessage;

  Future<void> _signIn() async {
    setState(() => errorMessage = null);
    try {
      // 1. Login con Firebase
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );

      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();

      if (token != null) {
        // 2. Validar en el backend y obtener el rol
        final response = await http.post(
          Uri.parse('http://18.191.11.54:5000/api/auth/firebase'),
          headers: {
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'token': token}),
        );

        if (!mounted) return;
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          final user = data['user'];
          final role = user != null ? user['role'] : null;

          if (role == 'patrullero') {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const MapaScreen()),
            );
          } else if (role != null) {
            setState(() {
              errorMessage = 'Solo los patrulleros pueden ingresar a la app. Tu rol es "$role".';
            });
          } else {
            setState(() {
              errorMessage = 'No se pudo obtener el rol del usuario.';
            });
          }
        } else {
          setState(() {
            errorMessage = 'Error al validar usuario en el servidor.';
          });
        }
      } else {
        setState(() {
          errorMessage = 'No se pudo obtener el token de Firebase.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        errorMessage = 'Credenciales incorrectas o error de conexión';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 48.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Welcome back',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Color(0xFF283EFA),
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _emailController,
              decoration: InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.email),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Password',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.lock),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Checkbox(
                  value: rememberMe,
                  onChanged: (value) => setState(() => rememberMe = value!),
                ),
                const Text('Remember me'),
                Spacer(),
                TextButton(
                  onPressed: () {}, // Implementar recuperación de contraseña
                  child: const Text('Forgot password?'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFF283EFA),
                minimumSize: Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: _signIn,
              child: const Text('Sign in', style: TextStyle(color: Colors.white)),
            ),
            if (errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(errorMessage!, style: TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(icon: Icon(Icons.facebook), onPressed: () {}),
                IconButton(icon: Icon(Icons.alternate_email), onPressed: () {}),
                IconButton(icon: Icon(Icons.g_translate), onPressed: () {}),
                IconButton(icon: Icon(Icons.apple), onPressed: () {}),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {}, // Navega a registro
              child: const Text("Don't have an account? Sign up"),
            ),
          ],
        ),
      ),
    );
  }
}                          mapa_screen.dart: import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class MapaScreen extends StatefulWidget {
  const MapaScreen({super.key});

  @override
  State<MapaScreen> createState() => _MapaScreenState();
}

class _MapaScreenState extends State<MapaScreen> {
  Timer? _timer;
  Position? _posicionActual;
  GoogleMapController? _mapController;
  bool ubicacionEnviada = false;

  @override
  void initState() {
    super.initState();
    _pedirPermisoYEnviar();
  }

  Future<void> _pedirPermisoYEnviar() async {
    LocationPermission permiso = await Geolocator.requestPermission();
    if (permiso == LocationPermission.denied || permiso == LocationPermission.deniedForever) {
      // Puedes mostrar un dialog o un icono de error si quieres
      return;
    }
    _startSendingLocation();
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
          Uri.parse('https://79751eefcb53.ngrok-free.app/api/patrulla/ubicacion'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: '{"lat": ${position.latitude}, "lon": ${position.longitude}}',
        );
        setState(() {
          ubicacionEnviada = response.statusCode == 200;
        });
      }
      if (_mapController != null) {
        _mapController!.animateCamera(
          CameraUpdate.newLatLng(
            LatLng(position.latitude, position.longitude),
          ),
        );
      }
    } catch (e) {
      setState(() {
        ubicacionEnviada = false;
      });
    }
  }

  void _startSendingLocation() {
    _timer = Timer.periodic(const Duration(seconds: 6), (timer) {
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
    LatLng initialCenter = _posicionActual != null
        ? LatLng(_posicionActual!.latitude, _posicionActual!.longitude)
        : const LatLng(-18.0066, -70.2463);

    return Scaffold(
      appBar: AppBar(title: const Text('Patrulla - Mapa')),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: initialCenter,
              zoom: 16,
            ),
            onMapCreated: (controller) {
              _mapController = controller;
            },
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            markers: _posicionActual != null
                ? {
                    Marker(
                      markerId: const MarkerId('yo'),
                      position: LatLng(_posicionActual!.latitude, _posicionActual!.longitude),
                      infoWindow: const InfoWindow(title: "Mi posición"),
                    )
                  }
                : {},
          ),
          // Icono de estado en la esquina superior derecha
          Positioned(
            top: 24,
            right: 24,
            child: ubicacionEnviada
                ? const CircleAvatar(
                    backgroundColor: Colors.green,
                    radius: 20,
                    child: Icon(Icons.check, color: Colors.white),
                  )
                : const CircleAvatar(
                    backgroundColor: Colors.orange,
                    radius: 20,
                    child: Icon(Icons.gps_fixed, color: Colors.white),
                  ),
          ),
        ],
      ),
    );
  }
}               patrol_map_screen.dart: import 'dart:async';
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
          Uri.parse('http://18.191.11.54:5000/api/patrulla/ubicacion'),
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
}                 welcome_screen.dart:  import 'package:flutter/material.dart';
import 'login_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF283EFA), Color(0xFFB7C6F9)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          children: [
            // Puedes agregar Positioned widgets para los círculos decorativos
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Welcome Back!',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Enter personal details to your\nemployee account',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 60),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      TextButton(
                        onPressed: () {}, // Puedes navegar a otra pantalla si lo deseas
                        child: const Text('Sign in', style: TextStyle(color: Colors.white)),
                      ),
                      SizedBox(width: 8),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const LoginScreen()),
                          );
                        },
                        child: const Text('Sign up', style: TextStyle(color: Color(0xFF283EFA))),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}               social_buttons.dart:  este aun esta vacio          main.dart: import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'screens/welcome_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const SisAlertApp());
}

class SisAlertApp extends StatelessWidget {
  const SisAlertApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SISALERT',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const WelcomeScreen(),
    );
  }
} 