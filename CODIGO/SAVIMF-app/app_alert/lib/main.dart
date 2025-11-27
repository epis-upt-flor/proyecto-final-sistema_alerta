import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'screens/welcome_screen.dart';
import 'services/notification_service.dart';
import 'services/fcm_service.dart';

// Handler CRÍTICO para notificaciones en background (app cerrada/minimizada)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // IMPORTANTE: Inicializar Firebase en background isolate
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  
  print('🎯 ====== NOTIFICACIÓN BACKGROUND RECIBIDA ======');
  print('📨 Message ID: ${message.messageId}');
  print('🏷️ Título: ${message.notification?.title}');
  print('📝 Cuerpo: ${message.notification?.body}');
  print('📊 Datos: ${message.data}');
  print('⏰ Timestamp: ${DateTime.now()}');
  print('🚨 TIPO: ${message.data['type']}');
  
  // Procesar alerta de emergencia cuando app está cerrada
  if (message.data['type'] == 'emergency_alert') {
    print('🚨🚨🚨 ALERTA DE EMERGENCIA - APP CERRADA 🚨🚨🚨');
    print('👤 Víctima: ${message.data['nombre']} ${message.data['apellido']}');
    print('📍 Ubicación: ${message.data['lat']}, ${message.data['lon']}');
    print('🔋 Batería: ${message.data['bateria']}%');
    print('📱 Device: ${message.data['device_id']}');
    
  }
  
  print('🎯 ============================================');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    print('🚀 Inicializando SISALERT App...');
    
    // 1. Inicializar Firebase PRIMERO
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    print('✅ Firebase inicializado');
    
    // 2. Configurar handler para notificaciones en background (CRÍTICO)
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    print('✅ Background handler configurado');
    
    // 3. Inicializar servicio de notificaciones (permisos, overlay, etc.)
    await NotificationService().initialize();
    print('✅ NotificationService inicializado');
    
    // 4. Inicializar FCM service (token, handlers específicos)
    await FCMService().initialize();
    print('✅ FCMService inicializado');
    
    print('🎉 SISALERT App inicializado correctamente');
    
  } catch (e, stackTrace) {
    print('❌ Error inicializando app: $e');
    print('📜 Stack trace: $stackTrace');
    // Continuar con la app aunque haya errores en FCM
  }
  
  runApp(const SisAlertApp());
}

class SisAlertApp extends StatelessWidget {
  const SisAlertApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SISALERT - Patrullero',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const WelcomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}