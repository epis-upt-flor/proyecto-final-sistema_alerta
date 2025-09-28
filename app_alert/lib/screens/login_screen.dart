import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

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
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );

      String? token = await FirebaseAuth.instance.currentUser?.getIdToken();

      if (token != null) {
        final response = await http.get(
          Uri.parse('https://46ebf95be03e.ngrok-free.app/alerta/cantidad'), // Cambia por tu URL real
          headers: {
            'Authorization': 'Bearer $token',
          },
        );

        if (!mounted) return; // <<--- Corrección importante
        if (response.statusCode == 200) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Login exitoso y token enviado al servidor')),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error al validar token en el servidor')),
          );
        }
      }
    } catch (e) {
      if (!mounted) return; // <<--- Corrección importante
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