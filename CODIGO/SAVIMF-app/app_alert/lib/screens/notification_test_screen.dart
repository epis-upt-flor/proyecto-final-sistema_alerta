import 'package:flutter/material.dart';
import '../services/fcm_service.dart';
import '../services/user_service.dart';
import 'package:firebase_auth/firebase_auth.dart';

class NotificationTestScreen extends StatefulWidget {
  const NotificationTestScreen({super.key});

  @override
  State<NotificationTestScreen> createState() => _NotificationTestScreenState();
}

class _NotificationTestScreenState extends State<NotificationTestScreen> {
  final FCMService _fcmService = FCMService();
  final UserService _userService = UserService();
  
  Map<String, dynamic>? _fcmStatus;
  String? _currentToken;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _checkFCMStatus();
  }

  Future<void> _checkFCMStatus() async {
    setState(() => _isLoading = true);
    
    try {
      final status = await _userService.checkFCMStatus();
      final token = await _fcmService.getCurrentToken();
      
      setState(() {
        _fcmStatus = status;
        _currentToken = token;
      });
    } catch (e) {
      print('❌ Error verificando estado FCM: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _registerToken() async {
    setState(() => _isLoading = true);
    
    try {
      final success = await _fcmService.registerToken();
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success 
            ? '✅ Token FCM registrado correctamente' 
            : '❌ Error registrando token FCM'),
          backgroundColor: success ? Colors.green : Colors.red,
        ),
      );
      
      if (success) {
        await _checkFCMStatus();
      }
    } catch (e) {
      print('❌ Error registrando token: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('❌ Error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🔔 Test Notificaciones'),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Estado del usuario
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '👤 Estado del Usuario',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text('Usuario: ${FirebaseAuth.instance.currentUser?.email ?? "No logueado"}'),
                        Text('UID: ${FirebaseAuth.instance.currentUser?.uid ?? "N/A"}'),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Estado FCM
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '📱 Estado FCM',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (_fcmStatus != null) ...[
                          _buildStatusRow('Firebase Token', _fcmStatus!['hasFirebaseToken'] == true),
                          _buildStatusRow('FCM Token', _fcmStatus!['hasFCMToken'] == true),
                          _buildStatusRow('Heartbeat Activo', _fcmStatus!['heartbeatActive'] == true),
                          if (_fcmStatus!['fcmTokenPreview'] != null)
                            Text('Token Preview: ${_fcmStatus!['fcmTokenPreview']}'),
                        ] else
                          const Text('❌ No se pudo obtener estado FCM'),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Token actual
                if (_currentToken != null) 
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '🎯 Token FCM Actual',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          SelectableText(_currentToken!),
                        ],
                      ),
                    ),
                  ),
                
                const SizedBox(height: 24),
                
                // Botones de acción
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _registerToken,
                    icon: const Icon(Icons.refresh),
                    label: const Text('🔄 Registrar Token FCM'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue[700],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _checkFCMStatus,
                    icon: const Icon(Icons.info),
                    label: const Text('📊 Verificar Estado'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green[700],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ),
              ],
            ),
          ),
    );
  }

  Widget _buildStatusRow(String label, bool status) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        children: [
          Icon(
            status ? Icons.check_circle : Icons.cancel,
            color: status ? Colors.green : Colors.red,
            size: 20,
          ),
          const SizedBox(width: 8),
          Text('$label: ${status ? "✅" : "❌"}'),
        ],
      ),
    );
  }
}