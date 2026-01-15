package za.co.relatives.app.utils

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import za.co.relatives.app.MainActivity
import za.co.relatives.app.services.TrackingLocationService
import za.co.relatives.app.R

object NotificationHelper {
    const val CHANNEL_ID = "tracking_channel"
    const val CHANNEL_ALERTS = "relatives_alerts"
    const val NOTIFICATION_ID = 1001
    private const val AUTH_ERROR_NOTIFICATION_ID = 1002

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. Tracking Channel (Low importance, silent)
            val trackingName = "Tracking Service"
            val trackingDesc = "Notifications for location tracking service"
            val trackingImportance = NotificationManager.IMPORTANCE_LOW
            val trackingChannel = NotificationChannel(CHANNEL_ID, trackingName, trackingImportance).apply {
                description = trackingDesc
            }
            notificationManager.createNotificationChannel(trackingChannel)

            // 2. Alerts Channel (High importance, sound)
            val alertsName = "Relatives Alerts"
            val alertsDesc = "Notifications for messages and alerts"
            val alertsImportance = NotificationManager.IMPORTANCE_HIGH
            val alertsChannel = NotificationChannel(CHANNEL_ALERTS, alertsName, alertsImportance).apply {
                description = alertsDesc
                enableVibration(true)
                enableLights(true)
            }
            notificationManager.createNotificationChannel(alertsChannel)
        }
    }

    /**
     * Build tracking notification with optional status text.
     *
     * @param context Application context
     * @param isPaused Whether tracking is paused (deprecated, kept for compatibility)
     * @param statusText Optional status text (e.g., "LIVE", "Moving", "OFFLINE - Enable location")
     */
    fun buildTrackingNotification(
        context: Context,
        isPaused: Boolean,
        statusText: String? = null
    ): Notification {
        // 1. Content Intent: Open App on Click
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Determine content text
        val contentText = statusText ?: "Your location is being shared with your family."

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Relatives")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true) // Prevents swiping away
            .setContentIntent(contentPendingIntent)

        // Stop action
        val stopIntent = Intent(context, TrackingLocationService::class.java).apply {
            action = TrackingLocationService.ACTION_STOP_TRACKING
        }
        val stopPendingIntent = PendingIntent.getService(
            context,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Stop",
            stopPendingIntent
        )

        return builder.build()
    }

    fun showAuthErrorNotification(context: Context) {
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            3,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Authentication Error")
            .setContentText("Please log in to resume location tracking.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(AUTH_ERROR_NOTIFICATION_ID, notification)
    }

    fun showGenericNotification(context: Context, title: String, message: String, intent: Intent) {
        val pendingIntent: PendingIntent = PendingIntent.getActivity(
            context,
            4, // Use a different request code
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
