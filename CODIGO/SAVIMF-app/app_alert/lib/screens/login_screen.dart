import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:app_alert/screens/mapa_screen.dart';
import 'package:app_alert/services/user_service.dart';

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
          //Uri.parse('http://18.191.11.54:5000/api/auth/firebase'),
          Uri.parse('http://18.225.31.96:5000/api/auth/firebase'),
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
            // 3. ✅ NUEVO: Registrar FCM token y iniciar heartbeat
            final userService = UserService();
            
            // Registrar FCM token en el backend
            final fcmRegistered = await userService.registerFCMToken();
            if (fcmRegistered) {
              print('✅ FCM token registrado exitosamente');
            } else {
              print('⚠️ No se pudo registrar FCM token, pero continuando...');
            }
            
            // Iniciar heartbeat periódico
            userService.startHeartbeat();
            
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
}