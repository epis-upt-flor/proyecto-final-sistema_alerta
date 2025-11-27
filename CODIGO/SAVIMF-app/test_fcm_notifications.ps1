# 🧪 Script de Testing para Notificaciones Push FCM - SAVIMF (PowerShell)
# Este script simula un webhook de The Things Stack (TTS) para probar notificaciones

param(
    [string]$Mode = "quick"  # quick, full, help
)

$ErrorActionPreference = "Stop"

# Configuración
$BACKEND_URL = "https://6d79f2a4d956.ngrok-free.app"
$WEBHOOK_ENDPOINT = "$BACKEND_URL/api/Alerta/lorawan-webhook"

# Datos de prueba
$DEVICE_ID = "savimf-test-001"
$BATTERY_LEVEL = 85
$LATITUDE = -12.0464
$LONGITUDE = -77.0428
$RSSI = -45
$SNR = 12.5

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "🚀 === $Title ===" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "🔍 $Message" -ForegroundColor Blue
}

function Show-Configuration {
    Write-Host "🎯 Configuración de Prueba:" -ForegroundColor Yellow
    Write-Host "   Backend URL: $BACKEND_URL"
    Write-Host "   Endpoint: $WEBHOOK_ENDPOINT"
    Write-Host "   Device ID: $DEVICE_ID"
    Write-Host "   Ubicación: $LATITUDE, $LONGITUDE"
    Write-Host "   Batería: $BATTERY_LEVEL%"
    Write-Host ""
}

function Get-TestPayload {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $epochTime = [int][double]::Parse((Get-Date -UFormat %s))
    
    $payload = @{
        end_device_ids = @{
            device_id = $DEVICE_ID
            application_ids = @{
                application_id = "savimf-iot-app"
            }
        }
        correlation_ids = @("gs:uplink:01HXYZ123456789")
        received_at = $timestamp
        uplink_message = @{
            session_key_id = "ABCD1234567890"
            f_port = 1
            f_cnt = 42
            frm_payload = "AQ=="
            decoded_payload = @{
                button_pressed = $true
                battery_level = $BATTERY_LEVEL
                emergency_type = "panic_button"
                device_status = "active"
            }
            rx_metadata = @(
                @{
                    gateway_ids = @{
                        gateway_id = "savimf-gateway-001"
                        eui = "AA555A0000000000"
                    }
                    timestamp = $epochTime * 1000000
                    rssi = $RSSI
                    channel_rssi = $RSSI
                    snr = $SNR
                    location = @{
                        latitude = $LATITUDE
                        longitude = $LONGITUDE
                        altitude = 150
                        source = "SOURCE_GPS"
                    }
                    uplink_token = "ChkKFwoLc2F2aW1mLWd3LTAwMRIIqVVagAAAAAA="
                }
            )
            settings = @{
                data_rate = @{
                    lora = @{
                        bandwidth = 125000
                        spreading_factor = 7
                    }
                }
                frequency = "915200000"
                timestamp = $epochTime * 1000000
            }
            consumed_airtime = "0.061696s"
            network_ids = @{
                net_id = "000013"
                tenant_id = "ttn"
                cluster_id = "nam1"
            }
        }
    }
    
    return $payload | ConvertTo-Json -Depth 10
}

function Test-FCMNotification {
    param([string]$TestName)
    
    Write-Header $TestName
    Write-Host "🕐 Timestamp: $(Get-Date)"
    Write-Host ""
    
    $payload = Get-TestPayload
    
    Write-Host "📦 Payload JSON:"
    Write-Host $payload
    Write-Host ""
    
    Write-Host "📤 Enviando webhook al backend..."
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri $WEBHOOK_ENDPOINT -Method Post -Body $payload -Headers $headers -StatusCodeVariable statusCode
        
        Write-Host "📊 Status Code: $statusCode"
        Write-Host "📄 Response Body:"
        if ($response) {
            Write-Host ($response | ConvertTo-Json -Depth 5)
        } else {
            Write-Host "(empty)"
        }
        Write-Host ""
        
        if ($statusCode -eq 200 -or $statusCode -eq 201) {
            Write-Success "¡ÉXITO! Webhook procesado correctamente"
            Write-Host "🔔 Las notificaciones FCM deberían haberse enviado a los patrulleros" -ForegroundColor Green
        } else {
            Write-Warning "Status code inesperado: $statusCode"
        }
        
    } catch {
        $errorDetails = $_.Exception.Response
        if ($errorDetails) {
            $statusCode = [int]$errorDetails.StatusCode
            Write-Host "📊 Status Code: $statusCode"
            
            switch ($statusCode) {
                404 { Write-Error "ERROR 404: Endpoint no encontrado - verificar URL del backend" }
                500 { Write-Error "ERROR 500: Error interno del servidor - verificar logs del backend" }
                default { Write-Error "ERROR: HTTP $statusCode - verificar configuración" }
            }
        } else {
            Write-Error "Error de conexión: $($_.Exception.Message)"
        }
    }
    
    Write-Host ""
    Write-Info "VERIFICACIONES A REALIZAR:"
    Write-Host "   1. ¿Aparecen notificaciones en dispositivos móviles de patrulleros?"
    Write-Host "   2. ¿Se ejecuta el background handler si la app está cerrada?"
    Write-Host "   3. ¿Los logs del backend muestran 'FCM notification sent successfully'?"
    Write-Host "   4. ¿Los tokens FCM de los patrulleros están actualizados?"
    Write-Host ""
}

function Show-Help {
    Write-Header "AYUDA - Testing FCM"
    
    Write-Host "🎯 PROPÓSITO:" -ForegroundColor Yellow
    Write-Host "   Este script simula un dispositivo IoT que envía una alerta de emergencia"
    Write-Host "   a través de LoRaWAN → TTS → Backend → FCM → App Flutter"
    Write-Host ""
    
    Write-Host "🔧 PREREQUISITOS:" -ForegroundColor Yellow
    Write-Host "   1. Backend ASP.NET Core ejecutándose en la URL configurada"
    Write-Host "   2. Al menos un usuario con rol 'patrullero' logueado en la app Flutter"
    Write-Host "   3. Token FCM registrado para ese patrullero en Firestore"
    Write-Host "   4. Permisos de notificación habilitados en el dispositivo móvil"
    Write-Host ""
    
    Write-Host "📱 ESCENARIOS DE TESTING:" -ForegroundColor Yellow
    Write-Host "   - App en foreground: Debería mostrar notificación dentro de la app"
    Write-Host "   - App en background: Debería mostrar notificación en bandeja del sistema"
    Write-Host "   - App cerrada: Debería mostrar notificación y ejecutar background handler"
    Write-Host ""
    
    Write-Host "🐛 DEBUGGING:" -ForegroundColor Yellow
    Write-Host "   - Backend: Verificar logs 'FCM notification sent successfully'"
    Write-Host "   - Flutter: Buscar '🎯 NOTIFICACIÓN BACKGROUND' en logs"
    Write-Host "   - Android: adb logcat | findstr FCM"
    Write-Host ""
    
    Write-Host "💻 USO:" -ForegroundColor Yellow
    Write-Host "   .\test_fcm_notifications.ps1 -Mode quick    # Prueba rápida"
    Write-Host "   .\test_fcm_notifications.ps1 -Mode full     # Testing completo"
    Write-Host "   .\test_fcm_notifications.ps1 -Mode help     # Esta ayuda"
    Write-Host ""
}

function Quick-Test {
    Write-Header "PRUEBA RÁPIDA FCM"
    Show-Configuration
    Test-FCMNotification "Prueba Rápida FCM"
}

function Full-Test {
    Write-Header "TESTING COMPLETO FCM"
    
    Write-Host "📋 INSTRUCCIONES:" -ForegroundColor Yellow
    Write-Host "   1. Asegúrate de tener al menos un patrullero logueado en la app"
    Write-Host "   2. Para probar app CERRADA: cierra completamente la app Flutter"
    Write-Host "   3. Para probar app BACKGROUND: minimiza la app"
    Write-Host "   4. Para probar app FOREGROUND: mantén la app abierta"
    Write-Host ""
    
    $ready = Read-Host "¿La app está en el estado deseado? (y/n)"
    if ($ready -ne "y" -and $ready -ne "Y") {
        Write-Error "Prepara la app y ejecuta de nuevo"
        exit 0
    }
    
    Show-Configuration
    Test-FCMNotification "Testing Completo FCM"
    
    Write-Header "SIGUIENTES PASOS"
    Write-Host "   1. Verificar que aparezca la notificación en el dispositivo"
    Write-Host "   2. Tocar la notificación para abrir la app"
    Write-Host "   3. Verificar logs del backend y app Flutter"
    Write-Host "   4. Si falló, revisar:"
    Write-Host "      - ¿Está el backend ejecutándose?"
    Write-Host "      - ¿Hay patrulleros con tokens FCM válidos?"
    Write-Host "      - ¿Están habilitados los permisos de notificación?"
    Write-Host ""
}

# Ejecutar función según el modo
switch ($Mode.ToLower()) {
    "help" { Show-Help }
    "quick" { Quick-Test }
    "full" { Full-Test }
    default { 
        Write-Error "Modo inválido: $Mode"
        Write-Host "Uso: .\test_fcm_notifications.ps1 -Mode [quick|full|help]"
        exit 1
    }
}