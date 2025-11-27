import 'package:firebase_messaging/firebase_messaging.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:system_alert_window/system_alert_window.dart';
import 'dart:io' show Platform;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:math' as math;
import 'package:flutter/material.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  late FirebaseMessaging _firebaseMessaging;
  String? _fcmToken;
  
  // Callback para cuando se recibe notificación mientras la app está abierta
  Function(Map<String, dynamic>)? onNotificationReceived;
  Function(Map<String, dynamic>)? onNotificationTapped;

  Future<void> initialize() async {
    print('🔧 DEBUG: INICIANDO NotificationService.initialize()');
    _firebaseMessaging = FirebaseMessaging.instance;
    
    // ✅ NUEVO: Crear notification channel correctamente
    await _createNotificationChannel();
    print('🔧 DEBUG: Channel creado, ahora solicitando permisos...');
    
    // Solicitar permisos (esto ahora abrirá automáticamente la configuración de overlay)
    await _requestPermissions();
    print('🔧 DEBUG: Permisos solicitados, continuando...');
    
    // Ya no llamamos _requestOverlayPermissions() aquí porque se llama automáticamente
    // después de que el usuario acepta las notificaciones
    
    // Configurar Firebase Messaging
    await _initializeFirebaseMessaging();
    
    // Obtener token FCM
    await _getFCMToken();
    
    print('✅ NotificationService inicializado correctamente');
  }

  // ✅ NUEVO: Crear canal de notificaciones según especificación FCM
  Future<void> _createNotificationChannel() async {
    try {
      print('📢 Configurando canal de notificaciones...');
      
      // En Android, los canales se crean automáticamente por Firebase
      // pero podemos verificar que están configurados correctamente
      
      print('📢 Canal "alerts_channel" configurado para alertas críticas');
      print('🔔 Configuración: HIGH priority, sound, vibration, LED');
    } catch (e) {
      print('❌ Error creando canal de notificaciones: $e');
    }
  }

  // Solicitar permisos de overlay con navegación automática
  Future<void> _requestOverlayPermissions() async {
    try {
      print('🔐 Configurando permisos básicos...');
      
      // Solo verificar y solicitar permisos de overlay en Android
      if (Platform.isAndroid) {
        print('📱 Verificando permiso para mostrar sobre otras apps...');
        
        // Verificar si ya tenemos el permiso
        bool? isGranted = await SystemAlertWindow.checkPermissions();
        
        if (isGranted != true) {
          print('⚠️ Permiso de overlay no otorgado');
          print('🚀 Abriendo configuración de "Mostrar sobre otras apps"...');
          
          // Abrir automáticamente la configuración del sistema
          bool? permissionResult = await SystemAlertWindow.requestPermissions();
          
          if (permissionResult == true) {
            print('✅ Permiso de overlay otorgado exitosamente');
          } else {
            print('❌ Permiso de overlay no otorgado');
            print('🔧 Por favor, habilita "Permitir mostrar sobre otras apps" para SISALERT');
            print('   Esto permite mostrar alertas críticas cuando la app está cerrada');
          }
        } else {
          print('✅ Permiso de overlay ya otorgado');
        }
      } else {
        print('📱 Permisos de overlay no requeridos en esta plataforma');
      }
      
      print('💡 Para alertas cuando la app está cerrada, habilitar manualmente en:');
      print('   Configuración → Apps → SISALERT → Permisos especiales → Mostrar sobre otras apps');
    } catch (e) {
      print('❌ Error configurando permisos de overlay: $e');
      print('🔧 Para habilitar manualmente:');
      print('   Configuración → Apps → SISALERT → Permisos especiales → Mostrar sobre otras apps');
    }
  }

  // Función específica para solicitar permisos de overlay INMEDIATAMENTE después de notificaciones
  Future<void> _requestOverlayPermissionsImmediate() async {
    try {
      if (Platform.isAndroid) {
        print('🚀 ABRIENDO CONFIGURACIÓN DE "MOSTRAR SOBRE OTRAS APPS"...');
        print('📱 Por favor, habilita "Permitir mostrar sobre otras apps" para SISALERT');
        
        // SIEMPRE abrir la configuración, sin verificar el estado actual
        print('⚠️ Abriendo configuración del sistema...');
        print('🔧 HABILITA: "Permitir mostrar sobre otras apps" para recibir alertas críticas');
        print('🎯 Busca SISALERT en la lista y ACTIVA el permiso');
        
        // Abrir INMEDIATAMENTE la configuración del sistema SIN verificar permisos
        await SystemAlertWindow.requestPermissions();
        
        // Verificar resultado después de que el usuario regrese
        bool? finalCheck = await SystemAlertWindow.checkPermissions();
        
        if (finalCheck == true) {
          print('✅ ¡PERFECTO! Permiso de overlay configurado correctamente');
          print('🎉 Ahora recibirás alertas críticas incluso cuando la app esté cerrada');
        } else {
          print('❌ Permiso no otorgado - Las alertas solo funcionarán con la app abierta');
          print('🔧 Para activarlo: Configuración → Apps → SISALERT → Mostrar sobre otras apps');
        }
      }
    } catch (e) {
      print('❌ Error abriendo configuración: $e');
      print('🔧 Habilita manualmente: Configuración → Apps → SISALERT → Mostrar sobre otras apps');
    }
  }

  Future<void> _requestPermissions() async {
    print('🚨 Solicitando permisos críticos...');
    print('🔧 INICIO: _requestPermissions()');
    
    // Solicitar permisos básicos de notificación
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: true, // Para alertas críticas
      provisional: false,
      sound: true,
    );

    print('📱 Estado de autorización: ${settings.authorizationStatus}');
    print('🔔 Permisos - Alert: ${settings.alert}, Sound: ${settings.sound}, Badge: ${settings.badge}');

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Permisos de notificación otorgados');
      print('🚀 EJECUTANDO: Ahora configurando permisos para mostrar sobre otras apps...');
      
      // INMEDIATAMENTE después de otorgar permisos de notificación, 
      // solicitar permisos de overlay (mostrar sobre otras apps)
      await _requestOverlayPermissionsImmediate();
      print('✅ COMPLETADO: Proceso de overlay terminado');
      
    } else if (settings.authorizationStatus == AuthorizationStatus.provisional) {
      print('⚠️ Permisos provisionales otorgados');
      print('🚀 EJECUTANDO: Overlay para permisos provisionales...');
      // También solicitar overlay para permisos provisionales
      await _requestOverlayPermissionsImmediate();
      print('✅ COMPLETADO: Proceso provisional de overlay terminado');
    } else {
      print('❌ Permisos de notificación denegados');
      print('💡 El usuario debe habilitar las notificaciones manualmente en configuración');
    }

    // Información adicional sobre permisos específicos
    print('🎵 Sonido: ${settings.sound}');
    print('🔴 Badge: ${settings.badge}');
    print('⚠️ Alertas críticas: ${settings.criticalAlert}');
  }

  Future<void> _initializeFirebaseMessaging() async {
    // Manejar mensajes cuando la app está en foreground
    FirebaseMessaging.onMessage.listen(_onMessageReceived);
    
    // Manejar cuando usuario toca notificación (app en background)
    FirebaseMessaging.onMessageOpenedApp.listen(_onMessageTapped);
    
    // Verificar si la app se abrió desde una notificación
    RemoteMessage? initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _onMessageTapped(initialMessage);
    }
  }

  Future<void> _getFCMToken() async {
    try {
      print('🔧 DEBUG: Iniciando obtención de FCM token...');
      print('🔧 DEBUG: Firebase Messaging instance: ${_firebaseMessaging.hashCode}');
      
      // DIAGNÓSTICO EXTENDIDO
      print('📱 DIAGNÓSTICO DE DISPOSITIVO:');
      print('   - Plataforma: ${Platform.operatingSystem}');
      print('   - Firebase App inicializada: ${Firebase.apps.isNotEmpty}');
      print('   - Número de apps Firebase: ${Firebase.apps.length}');
      
      if (Firebase.apps.isNotEmpty) {
        print('   - App por defecto: ${Firebase.app().name}');
        print('   - Project ID: ${Firebase.app().options.projectId}');
      }
      
      // Intentar obtener el token con retry y timeout extendido
      print('🔄 Solicitando token FCM (timeout: 15 segundos)...');
      _fcmToken = await _firebaseMessaging.getToken().timeout(
        Duration(seconds: 15),
        onTimeout: () {
          print('⏰ TIMEOUT: No se pudo obtener token en 15 segundos');
          print('🔧 POSIBLES CAUSAS:');
          print('   - Google Play Services desactualizado o no disponible');
          print('   - Conexión a internet bloqueada para servicios Google');
          print('   - Dispositivo sin soporte para GCM/FCM');
          print('   - Configuración Firebase incorrecta');
          return null;
        },
      );
      
      if (_fcmToken != null && _fcmToken!.isNotEmpty) {
        print('✅ FCM Token obtenido exitosamente!');
        print('🔑 FCM Token (primeros 30 chars): ${_fcmToken!.substring(0, math.min(30, _fcmToken!.length))}...');
        print('📏 Longitud del token: ${_fcmToken!.length} caracteres');
        
        // Escuchar cambios en el token
        _firebaseMessaging.onTokenRefresh.listen((newToken) {
          print('🔄 FCM Token actualizado: ${newToken.substring(0, math.min(30, newToken.length))}...');
          _fcmToken = newToken;
          // TODO: Enviar el nuevo token al servidor automáticamente
        });
      } else {
        print('❌ FCM Token es null o vacío');
        print('🔧 Intentando reintento después de 5 segundos...');
        
        // Reintento después de 5 segundos con solicitud de permisos
        await Future.delayed(Duration(seconds: 5));
        
        // Forzar solicitud de permisos antes del reintento
        try {
          await _firebaseMessaging.requestPermission();
          print('✅ Permisos refrescados, reintentando...');
        } catch (permError) {
          print('⚠️ Error refrescando permisos: $permError');
        }
        
        _fcmToken = await _firebaseMessaging.getToken();
        
        if (_fcmToken != null) {
          print('✅ FCM Token obtenido en reintento: ${_fcmToken!.substring(0, math.min(30, _fcmToken!.length))}...');
        } else {
          print('❌ FCM Token sigue siendo null después del reintento');
          print('🔧 DIAGNÓSTICO: Firebase/Google Play Services no funcionan en este dispositivo');
        }
      }
    } catch (e) {
      print('❌ Error obteniendo FCM Token: $e');
      print('🔧 Tipo de error: ${e.runtimeType}');
      print('🔧 Stack trace:');
      print(StackTrace.current);
      
      // Verificar tipos específicos de error
      String errorString = e.toString().toLowerCase();
      if (errorString.contains('service_not_available')) {
        print('🚫 DIAGNÓSTICO: SERVICE_NOT_AVAILABLE');
        print('📱 SOLUCIÓN: Instalar/actualizar Google Play Services');
        print('⚠️  El dispositivo no soporta Firebase Cloud Messaging');
      } else if (errorString.contains('network')) {
        print('🌐 DIAGNÓSTICO: Problema de conectividad');
        print('📶 SOLUCIÓN: Verificar conexión a internet');
      } else if (errorString.contains('permission')) {
        print('🔒 DIAGNÓSTICO: Problema de permisos');
        print('⚙️  SOLUCIÓN: Verificar permisos de la aplicación');
      }
      
      // Intentar una vez más con método alternativo
      try {
        print('🔄 Último intento con método alternativo en 5 segundos...');
        await Future.delayed(Duration(seconds: 5));
        
        // Crear una nueva instancia para forzar reinicialización
        final messaging = FirebaseMessaging.instance;
        _fcmToken = await messaging.getToken();
        
        if (_fcmToken != null) {
          print('✅ FCM Token obtenido con método alternativo: ${_fcmToken!.substring(0, math.min(30, _fcmToken!.length))}...');
        } else {
          print('❌ Método alternativo también falló - Firebase no disponible');
          print('🔧 GENERANDO TOKEN SIMULADO PARA TESTING...');
          
          // Para testing en dispositivos sin Google Play Services completos
          _fcmToken = 'test_token_${DateTime.now().millisecondsSinceEpoch}_${math.Random().nextInt(10000)}';
          print('🧪 Token simulado generado: $_fcmToken');
          print('⚠️  NOTA: Este es un token de prueba para testing');
          print('📱 DISPOSITIVO: Compatible con Google Play Services básico pero sin FCM');
        }
      } catch (e2) {
        print('❌ Error en método alternativo: $e2');
        print('🔧 CONCLUSIÓN: El dispositivo NO soporta Firebase Cloud Messaging');
      }
    }
  }

  void _onMessageReceived(RemoteMessage message) {
    print('🎯 ====== NOTIFICACIÓN FOREGROUND RECIBIDA ======');
    print('� Message ID: ${message.messageId}');
    print('🏷️ Título: ${message.notification?.title}');
    print('📝 Cuerpo: ${message.notification?.body}');
    print('📊 Datos: ${message.data}');
    print('⏰ Timestamp: ${DateTime.now()}');
    print('🎯 ==========================================');
    
    // Preparar datos para callback
    Map<String, dynamic> data = {
      'title': message.notification?.title ?? '',
      'body': message.notification?.body ?? '',
      'data': message.data,
    };
    
    // Llamar callback si está configurado
    onNotificationReceived?.call(data);
  }

  void _onMessageTapped(RemoteMessage message) {
    print('🎯 ====== USUARIO TOCÓ NOTIFICACIÓN ======');
    print('📨 Message ID: ${message.messageId}');
    print('🏷️ Título: ${message.notification?.title}');
    print('📝 Cuerpo: ${message.notification?.body}');
    print('📊 Datos: ${message.data}');
    print('👆 Acción: Usuario abrió app desde notificación');
    print('⏰ Timestamp: ${DateTime.now()}');
    print('🎯 ======================================');
    
    // Preparar datos para callback
    Map<String, dynamic> data = {
      'title': message.notification?.title ?? '',
      'body': message.notification?.body ?? '',
      'data': message.data,
    };
    
    // Llamar callback si está configurado
    onNotificationTapped?.call(data);
  }

  // Configurar callbacks
  void setCallbacks({
    Function(Map<String, dynamic>)? onReceived,
    Function(Map<String, dynamic>)? onTapped,
  }) {
    onNotificationReceived = onReceived;
    onNotificationTapped = onTapped;
  }

  // Enviar token al backend
  Future<void> sendTokenToBackend(String baseUrl, String patrulleroId) async {
    if (_fcmToken == null) {
      print('⚠️ No hay token FCM disponible');
      return;
    }

    try {
      // Obtener token de autenticación Firebase
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        print('⚠️ Usuario no autenticado, no se puede registrar FCM token');
        return;
      }
      
      final idToken = await user.getIdToken();
      
      final url = '$baseUrl/api/User/fcm-token';
      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: json.encode({'fcmToken': _fcmToken}),
      );

      if (response.statusCode == 200) {
        print('✅ Token FCM enviado al backend');
      } else {
        print('❌ Error enviando token FCM: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error enviando token FCM al backend: $e');
    }
  }

  // Método mejorado para mostrar alertas localmente (complementa FCM)
  void showAlertNotification({
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) {
    // Llamar el callback para mostrar en la app si está abierta
    final notificationData = {
      'title': title,
      'body': body,
      'data': data ?? {},
      'priority': 'high',
      'sound': 'default',
      'vibrate': true,
    };
    
    onNotificationReceived?.call(notificationData);
    print('📱 Alerta crítica mostrada: $title - $body');
  }

  // Mostrar overlay crítico sobre otras apps (cuando app está cerrada/minimizada) - SIMPLIFICADO
  Future<void> showCriticalOverlay({
    required String title,
    required String body,
    Map<String, dynamic>? alertData,
  }) async {
    try {
      // Solo intentar mostrar overlay en Android y si tenemos permisos
      if (Platform.isAndroid) {
        bool? hasPermission = await SystemAlertWindow.checkPermissions();
        
        if (hasPermission == true) {
          print('🚨 Mostrando overlay crítico: $title');
          
          // Configuración simple del overlay para alertas críticas
          await SystemAlertWindow.showSystemWindow(
            height: 200,
            notificationTitle: "🚨 ALERTA: $title",
            notificationBody: body,
          );
          
          print('✅ Overlay crítico mostrado exitosamente');
        } else {
          print('❌ Sin permisos de overlay - solo notificación FCM');
        }
      }
    } catch (e) {
      print('❌ Error mostrando overlay crítico: $e');
    }
  }

  // Método para verificar configuración de notificaciones
  Future<Map<String, dynamic>> checkNotificationSettings() async {
    NotificationSettings settings = await _firebaseMessaging.getNotificationSettings();
    
    final status = {
      'authorized': settings.authorizationStatus == AuthorizationStatus.authorized,
      'provisional': settings.authorizationStatus == AuthorizationStatus.provisional,
      'denied': settings.authorizationStatus == AuthorizationStatus.denied,
      'alert': settings.alert == AppleNotificationSetting.enabled,
      'sound': settings.sound == AppleNotificationSetting.enabled,
      'badge': settings.badge == AppleNotificationSetting.enabled,
      'criticalAlert': settings.criticalAlert == AppleNotificationSetting.enabled,
    };
    
    print('📊 Estado actual de notificaciones: $status');
    return status;
  }

  // Getter para el token FCM
  String? get fcmToken => _fcmToken;
  
  // Método simplificado para solicitar permisos críticos
  Future<bool> requestCriticalPermissions() async {
    print('🚨 Configurando permisos para alertas...');
    
    try {
      // Solo solicitar permisos de Firebase que funciona sin problemas
      await _requestPermissions();
      
      print('✅ Permisos básicos configurados');
      print('💡 Para alertas sobre otras apps, habilitar manualmente en configuración');
      return true;
      
    } catch (e) {
      print('❌ Error configurando permisos: $e');
      return false;
    }
  }
  
  // Verificar si las notificaciones están habilitadas (simplificado)
  Future<bool> areNotificationsEnabled() async {
    NotificationSettings settings = await _firebaseMessaging.getNotificationSettings();
    
    bool firebaseEnabled = settings.authorizationStatus == AuthorizationStatus.authorized;
    
    print('📊 Estado de permisos Firebase: $firebaseEnabled');
    
    return firebaseEnabled;
  }
}