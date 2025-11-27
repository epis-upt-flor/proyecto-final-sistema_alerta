import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/foundation.dart';

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final String baseUrl = "http://18.225.31.96:5000"; 

  /// Inicializa FCM y configura los listeners
  Future<void> initialize() async {
    print('🔧 FCMService: Inicializando...');

    // Solicitar permisos
    await _requestPermissions();

    // Configurar handlers
    _setupMessageHandlers();

    // Registrar token con backend
    await registerToken();

    print('✅ FCMService: Inicializado correctamente');
  }

  /// Solicitar permisos de notificación
  Future<void> _requestPermissions() async {
    final messaging = FirebaseMessaging.instance;
    
    NotificationSettings settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: true,
      provisional: false,
      sound: true,
    );

    print('📱 FCM Permisos - Status: ${settings.authorizationStatus}');
    print('🔔 Alert: ${settings.alert}, Sound: ${settings.sound}, Badge: ${settings.badge}');
  }

  /// Configurar handlers de mensajes
  void _setupMessageHandlers() {
    // Mensaje recibido cuando app está en foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('🎯 ===== NOTIFICACIÓN FOREGROUND =====');
      print('🏷️ Título: ${message.notification?.title}');
      print('📝 Cuerpo: ${message.notification?.body}');
      print('📊 Datos: ${message.data}');
      print('🎯 =================================');
      
      _handleAlertMessage(message);
    });

    // Mensaje tocado cuando app estaba en background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('🎯 ===== USUARIO TOCÓ NOTIFICACIÓN =====');
      print('🏷️ Título: ${message.notification?.title}');
      print('📝 Cuerpo: ${message.notification?.body}');
      print('📊 Datos: ${message.data}');
      print('🎯 ===================================');
      
      _handleAlertMessage(message);
    });
  }

  /// Maneja los mensajes de alerta
  void _handleAlertMessage(RemoteMessage message) {
    try {
      final data = message.data;
      
      if (data['type'] == 'emergency_alert') {
        print('🚨 Procesando alerta de emergencia...');
        
        // Extraer datos de la alerta
        final alertData = {
          'nombre': data['nombre'] ?? 'Sin asignar',
          'apellido': data['apellido'] ?? '',
          'dni': data['dni'] ?? '',
          'lat': double.tryParse(data['lat'] ?? '0') ?? 0.0,
          'lon': double.tryParse(data['lon'] ?? '0') ?? 0.0,
          'device_id': data['device_id'] ?? '',
          'timestamp': data['timestamp'] ?? '',
          'bateria': double.tryParse(data['bateria'] ?? '0') ?? 0.0,
        };

        // TODO: Notificar a la UI que hay una nueva alerta
        // Esto se puede hacer a través de streams, callbacks o estado global
        print('📋 Alerta procesada: ${alertData['nombre']} ${alertData['apellido']}');
        print('📍 Ubicación: ${alertData['lat']}, ${alertData['lon']}');
      }
    } catch (e) {
      print('❌ Error procesando mensaje FCM: $e');
    }
  }

  /// Registra el token FCM con el backend
  Future<bool> registerToken() async {
    try {
      // Obtener usuario Firebase actual
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        print('⚠️ No hay usuario autenticado, no se puede registrar token FCM');
        return false;
      }

      // Obtener token FCM
      final fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken == null || fcmToken.isEmpty) {
        print('❌ No se pudo obtener token FCM');
        return false;
      }

      print('📱 FCM Token obtenido: ${fcmToken.substring(0, 30)}...');

      // Obtener token de Firebase Auth
      final idToken = await user.getIdToken();

      // Enviar al backend
      final url = Uri.parse('$baseUrl/api/User/fcm-token');
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: json.encode({
          'fcmToken': fcmToken,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ Token FCM registrado exitosamente en backend');
        
        // Configurar listener para token refresh
        FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
          print('🔄 Token FCM actualizado: ${newToken.substring(0, 30)}...');
          _updateTokenOnBackend(newToken);
        });
        
        return true;
      } else {
        print('❌ Error registrando token FCM: ${response.statusCode}');
        print('📝 Response: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Error en registerToken: $e');
      return false;
    }
  }

  /// Actualiza el token en backend (cuando se refreshe automáticamente)
  Future<void> _updateTokenOnBackend(String newToken) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      final idToken = await user.getIdToken();
      final url = Uri.parse('$baseUrl/api/User/fcm-token');
      
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: json.encode({
          'fcmToken': newToken,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ Token FCM actualizado en backend');
      } else {
        print('❌ Error actualizando token FCM: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error actualizando token: $e');
    }
  }

  /// Método para obtener el token actual
  Future<String?> getCurrentToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      print('❌ Error obteniendo token actual: $e');
      return null;
    }
  }

  /// Verificar estado de permisos
  Future<bool> hasPermissions() async {
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }
}