import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

/// Pantalla para registrar Atestado Policial después de resolver una alerta
/// Pattern: StatefulWidget con form validation
class AtestadoPolicialScreen extends StatefulWidget {
  final String alertaId;
  final double latitud;
  final double longitud;
  final String distrito;
  final String? nombreVictima; // 🆕 Datos de la víctima desde la alerta
  final String? dniVictima;     // 🆕

  const AtestadoPolicialScreen({
    super.key,
    required this.alertaId,
    required this.latitud,
    required this.longitud,
    required this.distrito,
    this.nombreVictima, // Opcional
    this.dniVictima,    // Opcional
  });

  @override
  State<AtestadoPolicialScreen> createState() => _AtestadoPolicialScreenState();
}

class _AtestadoPolicialScreenState extends State<AtestadoPolicialScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  // Controllers
  final _nombreVictimaController = TextEditingController();
  final _dniVictimaController = TextEditingController();
  final _edadController = TextEditingController();
  final _direccionController = TextEditingController();
  final _descripcionController = TextEditingController();
  final _accionesController = TextEditingController();
  final _observacionesController = TextEditingController();

  // Valores seleccionados
  String _tipoViolencia = 'fisica';
  String _nivelRiesgo = 'medio';
  bool _alertaVeridica = true;
  bool _requirioAmbulancia = false;
  bool _requirioRefuerzo = false;
  bool _victimaTrasladadaComisaria = false;

  static const String baseUrl = 'http://18.225.31.96:5000';

  @override
  void initState() {
    super.initState();
    // 🆕 Pre-llenar datos de la víctima si están disponibles
    if (widget.nombreVictima != null && widget.nombreVictima!.isNotEmpty) {
      _nombreVictimaController.text = widget.nombreVictima!;
    }
    if (widget.dniVictima != null && widget.dniVictima!.isNotEmpty) {
      _dniVictimaController.text = widget.dniVictima!;
    }
  }

  @override
  void dispose() {
    _nombreVictimaController.dispose();
    _dniVictimaController.dispose();
    _edadController.dispose();
    _direccionController.dispose();
    _descripcionController.dispose();
    _accionesController.dispose();
    _observacionesController.dispose();
    super.dispose();
  }

  Future<void> _registrarAtestado() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      // Obtener token de Firebase
      final token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token == null) {
        throw Exception('Usuario no autenticado');
      }

      // Preparar datos
      final data = {
        'alertaId': widget.alertaId,
        'fechaIncidente': DateTime.now().toUtc().toIso8601String(),
        'latitud': widget.latitud,
        'longitud': widget.longitud,
        'distrito': widget.distrito,
        'direccionReferencial': _direccionController.text.trim(),
        'tipoViolencia': _tipoViolencia,
        'nivelRiesgo': _nivelRiesgo,
        'alertaVeridica': _alertaVeridica,
        'descripcionHechos': _descripcionController.text.trim(),
        'nombreVictima': _nombreVictimaController.text.trim(),
        'dniVictima': _dniVictimaController.text.trim(),
        'edadAproximada': int.tryParse(_edadController.text.trim()) ?? 0,
        'requirioAmbulancia': _requirioAmbulancia,
        'requirioRefuerzo': _requirioRefuerzo,
        'victimaTrasladadaComisaria': _victimaTrasladadaComisaria,
        'accionesRealizadas': _accionesController.text.trim(),
        'observaciones': _observacionesController.text.trim(),
      };

      // Log para debug
      print('📤 Enviando atestado a: $baseUrl/api/atestadopolicial');
      print('📋 Datos: ${json.encode(data)}');

      // Enviar al backend
      final response = await http.post(
        Uri.parse('$baseUrl/api/atestadopolicial'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(data),
      );

      print('📥 Response status: ${response.statusCode}');
      print('📥 Response body: ${response.body}');

      if (response.statusCode == 200) {
        // Intentar parsear la respuesta
        if (response.body.isNotEmpty) {
          try {
            json.decode(response.body);
          } catch (e) {
            print('⚠️ No se pudo parsear JSON, pero status es 200');
          }
        }
        
        if (mounted) {
          // Mostrar éxito y cerrar
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Atestado policial registrado correctamente'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 3),
            ),
          );
          Navigator.of(context).pop(true); // Retornar true para indicar éxito
        }
      } else {
        // Manejar error
        String errorMsg = 'Error al registrar atestado (${response.statusCode})';
        if (response.body.isNotEmpty) {
          try {
            final error = json.decode(response.body);
            errorMsg = error['mensaje'] ?? errorMsg;
          } catch (e) {
            errorMsg = response.body;
          }
        }
        throw Exception(errorMsg);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('📝 Atestado Policial'),
        backgroundColor: Colors.blue[800],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Info de la alerta
                    Card(
                      color: Colors.blue[50],
                      child: Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Alerta: ${widget.alertaId}',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text('Distrito: ${widget.distrito}'),
                            Text('Coordenadas: ${widget.latitud.toStringAsFixed(4)}, ${widget.longitud.toStringAsFixed(4)}'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Verificación de alerta
                    _buildSectionTitle('🔍 Verificación'),
                    SwitchListTile(
                      title: const Text('¿La alerta fue verídica?'),
                      subtitle: Text(_alertaVeridica ? 'Sí, es una alerta real' : 'No, fue una falsa alarma'),
                      value: _alertaVeridica,
                      onChanged: (value) => setState(() => _alertaVeridica = value),
                    ),
                    const Divider(),

                    // Tipo de violencia
                    _buildSectionTitle('📊 Clasificación del Incidente'),
                    DropdownButtonFormField<String>(
                      value: _tipoViolencia,
                      decoration: const InputDecoration(
                        labelText: 'Tipo de Violencia',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'fisica', child: Text('Física')),
                        DropdownMenuItem(value: 'psicologica', child: Text('Psicológica')),
                        DropdownMenuItem(value: 'sexual', child: Text('Sexual')),
                        DropdownMenuItem(value: 'economica', child: Text('Económica')),
                      ],
                      onChanged: (value) => setState(() => _tipoViolencia = value!),
                    ),
                    const SizedBox(height: 16),

                    // Nivel de riesgo
                    DropdownButtonFormField<String>(
                      value: _nivelRiesgo,
                      decoration: const InputDecoration(
                        labelText: 'Nivel de Riesgo',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'bajo', child: Text('🟢 Bajo')),
                        DropdownMenuItem(value: 'medio', child: Text('🟡 Medio')),
                        DropdownMenuItem(value: 'alto', child: Text('🟠 Alto')),
                        DropdownMenuItem(value: 'critico', child: Text('🔴 Crítico')),
                      ],
                      onChanged: (value) => setState(() => _nivelRiesgo = value!),
                    ),
                    const SizedBox(height: 20),

                    // Datos de la víctima
                    _buildSectionTitle('👤 Datos de la Víctima'),
                    TextFormField(
                      controller: _nombreVictimaController,
                      decoration: const InputDecoration(
                        labelText: 'Nombre Completo *',
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Ingrese el nombre de la víctima';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dniVictimaController,
                      decoration: const InputDecoration(
                        labelText: 'DNI *',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      maxLength: 8,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Ingrese el DNI';
                        }
                        if (value.trim().length != 8) {
                          return 'El DNI debe tener 8 dígitos';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _edadController,
                      decoration: const InputDecoration(
                        labelText: 'Edad Aproximada *',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Ingrese la edad';
                        }
                        final edad = int.tryParse(value);
                        if (edad == null || edad < 0 || edad > 120) {
                          return 'Ingrese una edad válida';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),

                    // Ubicación
                    _buildSectionTitle('📍 Ubicación del Incidente'),
                    TextFormField(
                      controller: _direccionController,
                      decoration: const InputDecoration(
                        labelText: 'Dirección Referencial (opcional)',
                        border: OutlineInputBorder(),
                        hintText: 'Ej: Calle Los Álamos 234',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 20),

                    // Descripción del incidente
                    _buildSectionTitle('📝 Descripción del Incidente'),
                    TextFormField(
                      controller: _descripcionController,
                      decoration: const InputDecoration(
                        labelText: 'Descripción de los Hechos *',
                        border: OutlineInputBorder(),
                        hintText: 'Describa brevemente lo sucedido...',
                      ),
                      maxLines: 4,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Describa los hechos del incidente';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),

                    // Recursos movilizados
                    _buildSectionTitle('🚨 Recursos Movilizados'),
                    CheckboxListTile(
                      title: const Text('Ambulancia'),
                      subtitle: const Text('¿Se solicitó ambulancia?'),
                      value: _requirioAmbulancia,
                      onChanged: (value) => setState(() => _requirioAmbulancia = value!),
                    ),
                    CheckboxListTile(
                      title: const Text('Refuerzo Policial'),
                      subtitle: const Text('¿Se solicitó refuerzo?'),
                      value: _requirioRefuerzo,
                      onChanged: (value) => setState(() => _requirioRefuerzo = value!),
                    ),
                    CheckboxListTile(
                      title: const Text('Víctima Trasladada a Comisaría'),
                      value: _victimaTrasladadaComisaria,
                      onChanged: (value) => setState(() => _victimaTrasladadaComisaria = value!),
                    ),
                    const SizedBox(height: 20),

                    // Acciones realizadas
                    _buildSectionTitle('⚡ Acciones Realizadas'),
                    TextFormField(
                      controller: _accionesController,
                      decoration: const InputDecoration(
                        labelText: 'Acciones Realizadas (opcional)',
                        border: OutlineInputBorder(),
                        hintText: 'Ej: Se brindó primeros auxilios, se contactó a familiares...',
                      ),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 16),

                    // Observaciones
                    TextFormField(
                      controller: _observacionesController,
                      decoration: const InputDecoration(
                        labelText: 'Observaciones Adicionales (opcional)',
                        border: OutlineInputBorder(),
                        hintText: 'Cualquier información adicional relevante...',
                      ),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 30),

                    // Botón de envío
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _registrarAtestado,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue[800],
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Text(
                          '✅ REGISTRAR ATESTADO POLICIAL',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Colors.blue[800],
        ),
      ),
    );
  }
}
