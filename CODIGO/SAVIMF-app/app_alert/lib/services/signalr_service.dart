import 'dart:async';
import 'package:signalr_netcore/signalr_client.dart';
import 'package:http/http.dart' as http;

class SignalRService {
  static final SignalRService _instance = SignalRService._internal();
  factory SignalRService() => _instance;
  SignalRService._internal();

  HubConnection? _hubConnection;
  bool _isConnected = false;
  bool _isConnecting = false;
  Timer? _reconnectTimer;
  Timer? _healthCheckTimer;
  
  // Configuración
  static const String signalRUrl = 'http://18.225.31.96:5000/alertaHub'; // URL corregida con el hub
  static const int maxReconnectAttempts = 10;
  static const int baseReconnectDelay = 2000; // 2 segundos
  static const int healthCheckInterval = 30; // 30 segundos
  
  int _reconnectAttempts = 0;
  
  // Callbacks
  Function(Map<String, dynamic>)? onAlertaRecibida;
  Function(Map<String, dynamic>)? onAlertaTomada;
  Function(Map<String, dynamic>)? onAlertaEstadoCambiado;
  Function(bool)? onConnectionStateChanged;

  bool get isConnected => _isConnected;
  String get connectionStatus => _isConnected ? 'Conectado' : (_isConnecting ? 'Conectando...' : 'Desconectado');

  Future<bool> initialize() async {
    print('🔧 Inicializando SignalRService...');
    
    // Verificar conectividad primero
    if (!await _checkServerHealth()) {
      print('❌ Servidor no disponible, programando reconexión...');
      _scheduleReconnect();
      return false;
    }

    return await _connect();
  }

  Future<bool> _connect() async {
    if (_isConnecting || _isConnected) return _isConnected;
    
    _isConnecting = true;
    _updateConnectionState(false);
    
    try {
      // Cerrar conexión anterior si existe
      await _hubConnection?.stop();
      
      print('🔌 Conectando a SignalR: $signalRUrl');
      
      _hubConnection = HubConnectionBuilder()
          .withUrl(signalRUrl)
          .withAutomaticReconnect(retryDelays: [2000, 5000, 10000, 30000])
          .build();

      // Configurar event handlers
      _setupEventHandlers();
      
      // Configurar manejadores de estado de conexión
      _setupConnectionHandlers();

      // Intentar conectar
      await _hubConnection!.start();
      
      _isConnected = true;
      _isConnecting = false;
      _reconnectAttempts = 0;
      _updateConnectionState(true);
      
      // Iniciar health check
      _startHealthCheck();
      
      print('✅ SignalR conectado exitosamente');
      print('🔗 Connection ID: ${_hubConnection!.connectionId}');
      
      return true;
      
    } catch (e) {
      print('❌ Error conectando SignalR: $e');
      _isConnected = false;
      _isConnecting = false;
      _updateConnectionState(false);
      
      // Programar reconexión automática
      _scheduleReconnect();
      return false;
    }
  }

  void _setupEventHandlers() {
    if (_hubConnection == null) return;

    // Evento: Nueva alerta recibida
    _hubConnection!.on("RecibirAlerta", (arguments) {
      print('📨 Evento RecibirAlerta recibido');
      
      if (arguments != null && arguments.isNotEmpty) {
        try {
          final alertaData = arguments[0] as Map<String, dynamic>;
          print('📨 Datos de alerta: $alertaData');
          
          onAlertaRecibida?.call(alertaData);
          print('✅ Evento RecibirAlerta procesado correctamente');
          
        } catch (e) {
          print('❌ Error procesando RecibirAlerta: $e');
        }
      } else {
        print('⚠️ RecibirAlerta sin argumentos válidos');
      }
    });

    // Evento: Alerta tomada
    _hubConnection!.on("AlertaTomada", (arguments) {
      print('📨 Evento AlertaTomada recibido');
      
      if (arguments != null && arguments.isNotEmpty) {
        try {
          final data = arguments[0] as Map<String, dynamic>;
          onAlertaTomada?.call(data);
          print('✅ Evento AlertaTomada procesado');
          
        } catch (e) {
          print('❌ Error procesando AlertaTomada: $e');
        }
      }
    });

    // Evento: Estado de alerta cambiado
    _hubConnection!.on("AlertaEstadoCambiado", (arguments) {
      print('📨 Evento AlertaEstadoCambiado recibido');
      
      if (arguments != null && arguments.isNotEmpty) {
        try {
          final data = arguments[0] as Map<String, dynamic>;
          onAlertaEstadoCambiado?.call(data);
          print('✅ Evento AlertaEstadoCambiado procesado');
          
        } catch (e) {
          print('❌ Error procesando AlertaEstadoCambiado: $e');
        }
      }
    });
  }

  void _setupConnectionHandlers() {
    // Los manejadores de conexión serán simplificados debido a compatibilidad
    // La reconexión se manejará a través del timer y health check
    print('� Manejadores de conexión configurados (modo compatible)');
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= maxReconnectAttempts) {
      print('❌ Máximo de intentos de reconexión alcanzado ($maxReconnectAttempts)');
      return;
    }

    _reconnectTimer?.cancel();
    
    final delay = baseReconnectDelay * (_reconnectAttempts + 1);
    _reconnectAttempts++;
    
    print('🔄 Programando reconexión #$_reconnectAttempts en ${delay}ms...');
    
    _reconnectTimer = Timer(Duration(milliseconds: delay), () async {
      print('🔄 Intentando reconexión #$_reconnectAttempts...');
      await _connect();
    });
  }

  Future<bool> _checkServerHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$signalRUrl/health'), // Endpoint de health check
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      
      return response.statusCode == 200;
    } catch (e) {
      print('⚠️ Health check falló: $e');
      return false;
    }
  }

  void _startHealthCheck() {
    _healthCheckTimer?.cancel();
    _healthCheckTimer = Timer.periodic(Duration(seconds: healthCheckInterval), (_) async {
      if (!_isConnected) return;
      
      try {
        // Verificar conexión enviando ping
        await _hubConnection?.invoke('Ping');
        print('💓 Health check OK');
      } catch (e) {
        print('💔 Health check falló: $e');
        _isConnected = false;
        _updateConnectionState(false);
        _scheduleReconnect();
      }
    });
  }

  void _stopHealthCheck() {
    _healthCheckTimer?.cancel();
    _healthCheckTimer = null;
  }

  void _updateConnectionState(bool connected) {
    _isConnected = connected;
    onConnectionStateChanged?.call(connected);
  }

  // Método público para reconexión manual
  Future<bool> reconnect() async {
    print('🔄 Reconexión manual solicitada');
    _reconnectAttempts = 0;
    _reconnectTimer?.cancel();
    
    return await _connect();
  }

  // Verificar estado de conexión
  Future<bool> checkConnection() async {
    if (!_isConnected || _hubConnection == null) return false;
    
    try {
      // Intentar enviar ping al servidor
      await _hubConnection!.invoke('Ping');
      return true;
    } catch (e) {
      print('❌ Verificación de conexión falló: $e');
      _isConnected = false;
      _updateConnectionState(false);
      return false;
    }
  }

  // Configurar callbacks
  void setCallbacks({
    Function(Map<String, dynamic>)? onAlerta,
    Function(Map<String, dynamic>)? onTomada,
    Function(Map<String, dynamic>)? onEstadoCambiado,
    Function(bool)? onConnectionChanged,
  }) {
    onAlertaRecibida = onAlerta;
    onAlertaTomada = onTomada;
    onAlertaEstadoCambiado = onEstadoCambiado;
    onConnectionStateChanged = onConnectionChanged;
  }

  // Limpiar y cerrar conexión
  void dispose() {
    _reconnectTimer?.cancel();
    _healthCheckTimer?.cancel();
    
    _hubConnection?.stop().then((_) {
      print('🔌 SignalR desconectado correctamente');
    }).catchError((e) {
      print('⚠️ Error cerrando SignalR: $e');
    });
    
    _isConnected = false;
    _isConnecting = false;
  }
}