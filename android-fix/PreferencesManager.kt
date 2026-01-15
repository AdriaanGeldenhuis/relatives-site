package za.co.relatives.app.utils

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

object PreferencesManager {
    private const val PREF_NAME = "relatives_prefs"
    private const val KEY_DEVICE_UUID = "device_uuid"
    private const val KEY_TRACKING_ENABLED = "tracking_enabled"
    private const val KEY_USER_REQUESTED_STOP = "user_requested_stop" // NEW: Prevents zombie restarts
    private const val KEY_UPDATE_INTERVAL = "update_interval" // Deprecated
    private const val KEY_PENDING_FCM_TOKEN = "pending_fcm_token"
    private const val KEY_MOVING_INTERVAL_SECONDS = "moving_interval_seconds"
    private const val KEY_HIGH_ACCURACY_ENABLED = "high_accuracy_enabled"
    private const val KEY_LIVE_VIEW_UNTIL_MS = "live_view_until_ms"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        // Ensure UUID exists
        if (!prefs.contains(KEY_DEVICE_UUID)) {
            val newUuid = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_UUID, newUuid).apply()
        }
    }

    fun getDeviceUuid(): String {
        return prefs.getString(KEY_DEVICE_UUID, "") ?: ""
    }

    fun setTrackingEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, enabled).apply()
    }

    fun isTrackingEnabled(): Boolean {
        // Default to TRUE so tracking works out of the box once permissions are granted
        return prefs.getBoolean(KEY_TRACKING_ENABLED, true)
    }

    /**
     * NEW: Track whether user explicitly stopped tracking.
     * This prevents the service from auto-restarting after user clicks "Stop".
     */
    fun setUserRequestedStop(stopped: Boolean) {
        prefs.edit().putBoolean(KEY_USER_REQUESTED_STOP, stopped).apply()
    }

    /**
     * NEW: Check if user explicitly stopped tracking.
     * If true, service should NOT auto-restart.
     */
    fun getUserRequestedStop(): Boolean {
        return prefs.getBoolean(KEY_USER_REQUESTED_STOP, false)
    }

    /**
     * Helper to enable tracking (sets enabled=true, stop=false)
     */
    fun enableTracking() {
        prefs.edit()
            .putBoolean(KEY_TRACKING_ENABLED, true)
            .putBoolean(KEY_USER_REQUESTED_STOP, false)
            .apply()
    }

    /**
     * Helper to disable tracking (sets enabled=false, stop=true)
     */
    fun disableTracking() {
        prefs.edit()
            .putBoolean(KEY_TRACKING_ENABLED, false)
            .putBoolean(KEY_USER_REQUESTED_STOP, true)
            .apply()
    }

    @Deprecated("Use getMovingIntervalSeconds")
    fun getUpdateInterval(): Int {
        // Default to 30 seconds
        return prefs.getInt(KEY_UPDATE_INTERVAL, 30)
    }

    fun setPendingFcmToken(token: String?) {
        prefs.edit().putString(KEY_PENDING_FCM_TOKEN, token).apply()
    }

    fun getPendingFcmToken(): String? {
        return prefs.getString(KEY_PENDING_FCM_TOKEN, null)
    }

    fun setMovingIntervalSeconds(seconds: Int) {
        prefs.edit().putInt(KEY_MOVING_INTERVAL_SECONDS, seconds).apply()
    }

    fun getMovingIntervalSeconds(): Int {
        // Default to 60 seconds as per requirements
        return prefs.getInt(KEY_MOVING_INTERVAL_SECONDS, 60)
    }

    fun setHighAccuracyEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_HIGH_ACCURACY_ENABLED, enabled).apply()
    }

    fun isHighAccuracyEnabled(): Boolean {
        // Default to TRUE for better accuracy
        return prefs.getBoolean(KEY_HIGH_ACCURACY_ENABLED, true)
    }

    fun setLiveViewUntil(timestampMs: Long) {
        prefs.edit().putLong(KEY_LIVE_VIEW_UNTIL_MS, timestampMs).apply()
    }

    fun getLiveViewUntil(): Long {
        return prefs.getLong(KEY_LIVE_VIEW_UNTIL_MS, 0L)
    }
}
