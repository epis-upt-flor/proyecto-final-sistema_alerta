import 'package:http/http.dart' as http;
import 'dart:convert';

class BackendTester {
  static const String baseUrl = 'http://18.225.31.96:5000';

  // Probar diferentes endpoints posibles
  static Future<void> testEndpoints() async {
    print('🔍 Probando endpoints del backend...\n');
    
    final endpoints = [
      '$baseUrl/',
      '$baseUrl/api',
      '$baseUrl/api/health',
      '$baseUrl/alertaHub',
      '$baseUrl/alertaHub/negotiate',
      '$baseUrl/hub',
      '$baseUrl/signalr/alertaHub/negotiate',
      '$baseUrl/hubs/alertaHub/negotiate',
    ];

    for (String endpoint in endpoints) {
      await _testEndpoint(endpoint);
    }
  }

  static Future<void> _testEndpoint(String url) async {
    try {
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 5));

      print('✅ $url: ${response.statusCode} - ${response.reasonPhrase}');
      
      if (response.statusCode == 200) {
        print('   📄 Respuesta: ${response.body.substring(0, 100)}...');
      }
    } catch (e) {
      print('❌ $url: Error - $e');
    }
  }

  // Probar conectividad básica
  static Future<bool> testBasicConnectivity() async {
    try {
      final response = await http.get(
        Uri.parse(baseUrl),
        headers: {'Accept': 'text/html,application/json'},
      ).timeout(const Duration(seconds: 10));
      
      print('🌐 Conectividad básica: ${response.statusCode}');
      return response.statusCode == 200 || response.statusCode == 404;
    } catch (e) {
      print('🚫 Sin conectividad: $e');
      return false;
    }
  }
}