#!/bin/bash

# 🧪 Script de Testing para Notificaciones Push FCM - SAVIMF
# Este script simula un webhook de The Things Stack (TTS) para probar notificaciones

echo "🚀 === TESTING FCM NOTIFICATIONS - SAVIMF ==="
echo ""

# Configuración
BACKEND_URL="https://6d79f2a4d956.ngrok-free.app"
WEBHOOK_ENDPOINT="$BACKEND_URL/api/Alerta/lorawan-webhook"

# Datos de prueba - simulando dispositivo IoT
DEVICE_ID="savimf-test-001"
BATTERY_LEVEL=85
LATITUDE=-12.0464
LONGITUDE=-77.0428
RSSI=-45
SNR=12.5

echo "🎯 Configuración de Prueba:"
echo "   Backend URL: $BACKEND_URL"
echo "   Endpoint: $WEBHOOK_ENDPOINT"
echo "   Device ID: $DEVICE_ID"
echo "   Ubicación: $LATITUDE, $LONGITUDE"
echo "   Batería: $BATTERY_LEVEL%"
echo ""

# JSON payload que simula webhook de TTS
read -r -d '' PAYLOAD << EOF
{
  "end_device_ids": {
    "device_id": "$DEVICE_ID",
    "application_ids": {
      "application_id": "savimf-iot-app"
    }
  },
  "correlation_ids": [
    "gs:uplink:01HXYZ123456789"
  ],
  "received_at": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "uplink_message": {
    "session_key_id": "ABCD1234567890",
    "f_port": 1,
    "f_cnt": 42,
    "frm_payload": "AQ==",
    "decoded_payload": {
      "button_pressed": true,
      "battery_level": $BATTERY_LEVEL,
      "emergency_type": "panic_button",
      "device_status": "active"
    },
    "rx_metadata": [
      {
        "gateway_ids": {
          "gateway_id": "savimf-gateway-001",
          "eui": "AA555A0000000000"
        },
        "timestamp": $(date +%s)000000,
        "rssi": $RSSI,
        "channel_rssi": $RSSI,
        "snr": $SNR,
        "location": {
          "latitude": $LATITUDE,
          "longitude": $LONGITUDE,
          "altitude": 150,
          "source": "SOURCE_GPS"
        },
        "uplink_token": "ChkKFwoLc2F2aW1mLWd3LTAwMRIIqVVagAAAAAA="
      }
    ],
    "settings": {
      "data_rate": {
        "lora": {
          "bandwidth": 125000,
          "spreading_factor": 7
        }
      },
      "frequency": "915200000",
      "timestamp": $(date +%s)000000
    },
    "consumed_airtime": "0.061696s",
    "network_ids": {
      "net_id": "000013",
      "tenant_id": "ttn",
      "cluster_id": "nam1"
    }
  }
}
EOF

echo "📦 Payload JSON:"
echo "$PAYLOAD" | jq .
echo ""

# Función para realizar la prueba
test_fcm() {
    local test_name="$1"
    echo "🧪 === $test_name ==="
    echo "🕐 Timestamp: $(date)"
    echo ""
    
    echo "📤 Enviando webhook al backend..."
    
    # Realizar petición HTTP
    RESPONSE=$(curl -s -w "\n%{http_code}\n" -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$PAYLOAD" \
        "$WEBHOOK_ENDPOINT")
    
    # Separar response body y status code
    HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    
    echo "📊 Status Code: $HTTP_CODE"
    echo "📄 Response Body:"
    if [ -n "$HTTP_BODY" ]; then
        echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"
    else
        echo "(empty)"
    fi
    echo ""
    
    # Validar resultado
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
        echo "✅ ¡ÉXITO! Webhook procesado correctamente"
        echo "🔔 Las notificaciones FCM deberían haberse enviado a los patrulleros"
    elif [ "$HTTP_CODE" -eq 404 ]; then
        echo "❌ ERROR 404: Endpoint no encontrado - verificar URL del backend"
    elif [ "$HTTP_CODE" -eq 500 ]; then
        echo "❌ ERROR 500: Error interno del servidor - verificar logs del backend"
    else
        echo "❌ ERROR: HTTP $HTTP_CODE - verificar configuración"
    fi
    
    echo ""
    echo "🔍 VERIFICACIONES A REALIZAR:"
    echo "   1. ¿Aparecen notificaciones en dispositivos móviles de patrulleros?"
    echo "   2. ¿Se ejecuta el background handler si la app está cerrada?"
    echo "   3. ¿Los logs del backend muestran 'FCM notification sent successfully'?"
    echo "   4. ¿Los tokens FCM de los patrulleros están actualizados?"
    echo ""
}

# Función de ayuda
show_help() {
    echo "📚 === AYUDA - Testing FCM ==="
    echo ""
    echo "🎯 PROPÓSITO:"
    echo "   Este script simula un dispositivo IoT que envía una alerta de emergencia"
    echo "   a través de LoRaWAN → TTS → Backend → FCM → App Flutter"
    echo ""
    echo "🔧 PREREQUISITOS:"
    echo "   1. Backend ASP.NET Core ejecutándose en la URL configurada"
    echo "   2. Al menos un usuario con rol 'patrullero' logueado en la app Flutter"
    echo "   3. Token FCM registrado para ese patrullero en Firestore"
    echo "   4. Permisos de notificación habilitados en el dispositivo móvil"
    echo ""
    echo "📱 ESCENARIOS DE TESTING:"
    echo "   - App en foreground: Debería mostrar notificación dentro de la app"
    echo "   - App en background: Debería mostrar notificación en bandeja del sistema"
    echo "   - App cerrada: Debería mostrar notificación y ejecutar background handler"
    echo ""
    echo "🐛 DEBUGGING:"
    echo "   - Backend: Verificar logs 'FCM notification sent successfully'"
    echo "   - Flutter: Buscar '🎯 NOTIFICACIÓN BACKGROUND' en logs"
    echo "   - Android: adb logcat | grep -E '(FCM|Firebase)'"
    echo ""
}

# Función para prueba rápida
quick_test() {
    echo "⚡ === PRUEBA RÁPIDA ==="
    echo "Enviando alerta de emergencia simulada..."
    test_fcm "Prueba Rápida FCM"
}

# Función para prueba completa
full_test() {
    echo "🔬 === TESTING COMPLETO FCM ==="
    echo ""
    
    echo "📋 INSTRUCCIONES:"
    echo "   1. Asegúrate de tener al menos un patrullero logueado en la app"
    echo "   2. Para probar app CERRADA: cierra completamente la app Flutter"
    echo "   3. Para probar app BACKGROUND: minimiza la app"
    echo "   4. Para probar app FOREGROUND: mantén la app abierta"
    echo ""
    
    read -p "¿La app está en el estado deseado? (y/n): " ready
    if [ "$ready" != "y" ] && [ "$ready" != "Y" ]; then
        echo "❌ Prepara la app y ejecuta de nuevo"
        exit 0
    fi
    
    test_fcm "Testing Completo FCM"
    
    echo "🎯 === SIGUIENTES PASOS ==="
    echo "   1. Verificar que aparezca la notificación en el dispositivo"
    echo "   2. Tocar la notificación para abrir la app"
    echo "   3. Verificar logs del backend y app Flutter"
    echo "   4. Si falló, revisar:"
    echo "      - ¿Está el backend ejecutándose?"
    echo "      - ¿Hay patrulleros con tokens FCM válidos?"
    echo "      - ¿Están habilitados los permisos de notificación?"
    echo ""
}

# Función principal
main() {
    case "${1:-quick}" in
        "help"|"-h"|"--help")
            show_help
            ;;
        "quick"|"q")
            quick_test
            ;;
        "full"|"f")
            full_test
            ;;
        *)
            echo "❓ Uso: $0 [quick|full|help]"
            echo ""
            echo "   quick (default): Prueba rápida"
            echo "   full:            Testing completo con instrucciones"
            echo "   help:            Mostrar ayuda detallada"
            echo ""
            exit 1
            ;;
    esac
}

# Verificar dependencias
if ! command -v curl &> /dev/null; then
    echo "❌ ERROR: curl no está instalado"
    echo "   Instalar con: sudo apt-get install curl"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "⚠️  WARNING: jq no está instalado (opcional, para formatear JSON)"
    echo "   Instalar con: sudo apt-get install jq"
fi

# Ejecutar
main "$@"