package com.example.app_alert

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import android.os.Bundle

class MainActivity : FlutterActivity() {
    private val ALERT_CHANNEL_ID = "alert_channel"
    private val ALERT_CHANNEL_NAME = "Alertas de Emergencia"
    private val ALERT_CHANNEL_DESCRIPTION = "Notificaciones críticas del sistema SAVIMF"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Crear canal de notificaciones para Android 8.0+
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(ALERT_CHANNEL_ID, ALERT_CHANNEL_NAME, importance).apply {
                description = ALERT_CHANNEL_DESCRIPTION
                enableVibration(true)
                enableLights(true)
                setSound(null, null) // Usar sonido por defecto
            }

            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
