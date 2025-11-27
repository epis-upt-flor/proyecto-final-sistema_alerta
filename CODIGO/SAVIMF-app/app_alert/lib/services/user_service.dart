import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'fcm_service.dart';

class UserService {
  static final UserService _instance = UserService._internal();
  factory UserService() => _instance;
  UserService._internal();

  static const String baseUrl = 'http://18.225.31.96:5000';
  Timer? _heartbeatTimer;
  bool _isActive = false;

  // ✅ Registrar FCM token después del login - MEJORADO con FCMService  
  Future<bool> registerFCMToken() async {
    try {
      print('🔄 Iniciando registro de FCM token...');
      
      // Usar el nuevo FCMService
      final fcmService = FCMService();
      return await fcmService.registerToken();
      
    } catch (e) {
      print('❌ Error registrando FCM token: $e');
      return false;
    }
  }

  // ✅ Iniciar heartbeat periódico
  void startHeartbeat({Duration interval = const Duration(minutes: 5)}) {
    if (_heartbeatTimer != null) {
      _heartbeatTimer!.cancel();
    }

    _isActive = true;
    print('💓 Iniciando heartbeat cada ${interval.inMinutes} minutos');

    _heartbeatTimer = Timer.periodic(interval, (timer) async {
      if (_isActive) {
        await _sendHeartbeat();
      }
    });

    // Enviar primer heartbeat inmediatamente
    _sendHeartbeat();
  }

  // ✅ Detener heartbeat
  void stopHeartbeat() {
    _isActive = false;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    print('💓 Heartbeat detenido');
  }

  // Enviar heartbeat al backend
  Future<void> _sendHeartbeat() async {
    try {
      final firebaseToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      
      if (firebaseToken == null) {
        print('⚠️ No hay token de Firebase para heartbeat');
        return;
      }

      print('💓 Enviando heartbeat...');
      final response = await http.post(
        Uri.parse('$baseUrl/api/User/heartbeat'),
        headers: {
          'Authorization': 'Bearer $firebaseToken',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        print('💓 Heartbeat enviado exitosamente');
      } else {
        print('⚠️ Error en heartbeat: ${response.statusCode}');
        print('📄 Respuesta: ${response.body}');
      }
    } catch (e) {
      print('❌ Error enviando heartbeat: $e');
    }
  }

  // ✅ Método para cuando el usuario cierra sesión
  void logout() {
    stopHeartbeat();
    print('👋 Usuario desconectado, heartbeat detenido');
  }

  // ✅ Método para verificar estado de FCM
  Future<Map<String, dynamic>> checkFCMStatus() async {
    try {
      final firebaseToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      final fcmService = FCMService();
      final fcmToken = await fcmService.getCurrentToken();
      
      return {
        'hasFirebaseToken': firebaseToken != null,
        'hasFCMToken': fcmToken != null,
        'fcmTokenPreview': fcmToken != null ? '${fcmToken.substring(0, 20)}...' : null,
        'heartbeatActive': _isActive,
      };
    } catch (e) {
      return {
        'error': e.toString(),
        'hasFirebaseToken': false,
        'hasFCMToken': false,
        'heartbeatActive': false,
      };
    }
  }

  // ✅ Obtener información del usuario actual
  Future<Map<String, dynamic>?> getCurrentUserInfo() async {
    try {
      final firebaseToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      
      if (firebaseToken == null) {
        return null;
      }

      final response = await http.get(
        Uri.parse('$baseUrl/api/User/profile'),
        headers: {
          'Authorization': 'Bearer $firebaseToken',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('❌ Error obteniendo perfil: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      print('❌ Error obteniendo información del usuario: $e');
      return null;
    }
  }

  // Getters para estado
  bool get isHeartbeatActive => _isActive;
  Timer? get heartbeatTimer => _heartbeatTimer;
}