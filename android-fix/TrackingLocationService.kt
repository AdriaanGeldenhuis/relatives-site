package za.co.relatives.app.services

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.webkit.CookieManager
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import za.co.relatives.app.network.NetworkClient
import za.co.relatives.app.utils.NotificationHelper
import za.co.relatives.app.utils.PreferencesManager
import java.io.IOException

/**
 * Battery-optimized location tracking service with three modes:
 * - LIVE: High accuracy, 10s interval (viewer watching)
 * - MOVING: User-configured interval (default 60s)
 * - IDLE: Low power, 10-minute heartbeat
 *
 * Key behaviors:
 * - NO permanent wakelocks (only time-limited in LIVE mode)
 * - Stops completely when user requests stop (no zombie restarts)
 * - Exponential backoff on network failures
 * - Auth failure blocks uploads for 30 minutes
 */
class TrackingLocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var isTracking = false

    // Wake Lock - ONLY for LIVE mode, time-limited
    private var wakeLock: PowerManager.WakeLock? = null

    // Background Thread
    private var serviceLooper: Looper? = null
    private var serviceHandler: Handler? = null
    private var mainHandler: Handler? = null

    // Heartbeat timer for IDLE mode
    private var heartbeatRunnable: Runnable? = null

    // Wakelock renewal timer for LIVE mode
    private var wakelockRenewalRunnable: Runnable? = null

    // Tracking State
    private enum class Mode { IDLE, MOVING, LIVE }
    private var currentMode = Mode.IDLE
    private var lastLocation: Location? = null
    private var lastMoveTimestamp: Long = 0
    private var lastUploadTimestamp: Long = 0

    // Backoff state
    private var consecutiveFailures = 0
    private var lastFailureTime: Long = 0
    private var authBlockedUntil: Long = 0

    // Activity Recognition
    private var activityRecognitionClient: ActivityRecognitionClient? = null
    private var activityPendingIntent: android.app.PendingIntent? = null

    companion object {
        const val ACTION_START_TRACKING = "ACTION_START_TRACKING"
        const val ACTION_STOP_TRACKING = "ACTION_STOP_TRACKING"
        const val ACTION_MODE_UPDATE = "ACTION_MODE_UPDATE"
        const val ACTION_RECONFIGURE = "ACTION_RECONFIGURE"
        // Deprecated actions, kept for compatibility
        const val ACTION_PAUSE_TRACKING = "ACTION_PAUSE_TRACKING"
        const val ACTION_RESUME_TRACKING = "ACTION_RESUME_TRACKING"
        const val ACTION_UPDATE_INTERVAL = "ACTION_UPDATE_INTERVAL"

        private const val TAG = "TrackingService"
        private const val API_URL = "https://www.relatives.co.za/tracking/api/update_location.php"
        private const val BASE_URL = "https://www.relatives.co.za"

        // Mode thresholds
        private const val MIN_SPEED_MPS = 1.0f // ~3.6 km/h, walking speed
        private const val MIN_DISTANCE_METERS = 50f
        private const val MOVEMENT_TIME_THRESHOLD_MS = 3 * 60 * 1000L // 3 minutes

        // FIXED: 10-minute heartbeat instead of 30 minutes
        private const val IDLE_HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000L // 10 minutes

        // Wakelock settings
        private const val WAKELOCK_TIMEOUT_MS = 120_000L // 2 minutes max
        private const val WAKELOCK_RENEWAL_INTERVAL_MS = 90_000L // Renew every 90 seconds

        // Backoff settings
        private const val AUTH_BLOCK_DURATION_MS = 30 * 60 * 1000L // 30 minutes
        private val BACKOFF_DELAYS_MS = longArrayOf(10_000, 30_000, 60_000, 120_000, 300_000) // 10s, 30s, 1m, 2m, 5m
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        mainHandler = Handler(Looper.getMainLooper())

        val handlerThread = HandlerThread(TAG)
        handlerThread.start()
        serviceLooper = handlerThread.looper
        serviceHandler = Handler(serviceLooper!!)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { handleNewLocation(it) }
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "Service onDestroy")
        cleanupResources()
        super.onDestroy()
        // NOTE: Do NOT schedule restart here - that causes zombie restarts
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "onTaskRemoved: trackingEnabled=${PreferencesManager.isTrackingEnabled()}, userRequestedStop=${PreferencesManager.getUserRequestedStop()}")

        // FIXED: Only restart if tracking is enabled AND user didn't explicitly stop
        if (PreferencesManager.isTrackingEnabled() && !PreferencesManager.getUserRequestedStop()) {
            Log.d(TAG, "Task removed but tracking enabled - service will restart via START_STICKY")
        } else {
            Log.d(TAG, "Task removed and tracking disabled or user stopped - NOT restarting")
        }

        super.onTaskRemoved(rootIntent)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START_TRACKING

        Log.d(TAG, "onStartCommand: action=$action")

        serviceHandler?.post {
            when (action) {
                ACTION_START_TRACKING -> startTracking()
                ACTION_STOP_TRACKING -> stopTracking()
                ACTION_MODE_UPDATE -> updateMode(forceRequest = true)
                ACTION_RECONFIGURE -> reconfigureTracking()
                "ACTION_ACTIVITY_TRANSITION" -> intent?.let { handleActivityTransition(it) }
                ACTION_PAUSE_TRACKING, ACTION_RESUME_TRACKING, ACTION_UPDATE_INTERVAL -> {
                    Log.d(TAG, "Received deprecated action: $action. Triggering mode update.")
                    updateMode(forceRequest = true)
                }
            }
        }

        // FIXED: Only restart if tracking is enabled AND user didn't stop
        return if (PreferencesManager.isTrackingEnabled() && !PreferencesManager.getUserRequestedStop()) {
            START_STICKY
        } else {
            START_NOT_STICKY
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ============ WAKELOCK MANAGEMENT (LIMITED) ============

    /**
     * Acquire a time-limited wakelock for LIVE mode only.
     * The wakelock will auto-release after WAKELOCK_TIMEOUT_MS.
     */
    private fun acquireTimeLimitedWakeLock() {
        releaseWakeLock() // Release any existing wakelock first

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "$TAG:WakeLock"
        ).apply {
            // CRITICAL: Time-limited acquire - will auto-release
            acquire(WAKELOCK_TIMEOUT_MS)
        }
        Log.d(TAG, "Acquired time-limited wakelock for ${WAKELOCK_TIMEOUT_MS}ms")
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d(TAG, "WakeLock released")
            }
        }
        wakeLock = null
    }

    /**
     * Start wakelock renewal timer for LIVE mode.
     * Renews the wakelock every 90 seconds while in LIVE mode.
     */
    private fun startWakelockRenewal() {
        stopWakelockRenewal()

        wakelockRenewalRunnable = object : Runnable {
            override fun run() {
                if (currentMode == Mode.LIVE && isTracking) {
                    Log.d(TAG, "Renewing wakelock for LIVE mode")
                    acquireTimeLimitedWakeLock()
                    mainHandler?.postDelayed(this, WAKELOCK_RENEWAL_INTERVAL_MS)
                }
            }
        }
        mainHandler?.postDelayed(wakelockRenewalRunnable!!, WAKELOCK_RENEWAL_INTERVAL_MS)
        Log.d(TAG, "Wakelock renewal timer started")
    }

    private fun stopWakelockRenewal() {
        wakelockRenewalRunnable?.let { mainHandler?.removeCallbacks(it) }
        wakelockRenewalRunnable = null
    }

    // ============ HEARTBEAT TIMER (IDLE MODE) ============

    /**
     * Start heartbeat timer for IDLE mode.
     * Actively requests location and uploads every 10 minutes.
     */
    private fun startHeartbeatTimer() {
        stopHeartbeatTimer()

        heartbeatRunnable = object : Runnable {
            override fun run() {
                if (currentMode == Mode.IDLE && isTracking) {
                    Log.d(TAG, "Heartbeat timer fired - requesting location")
                    requestHeartbeatLocation()
                    mainHandler?.postDelayed(this, IDLE_HEARTBEAT_INTERVAL_MS)
                }
            }
        }
        // First heartbeat after 10 minutes
        mainHandler?.postDelayed(heartbeatRunnable!!, IDLE_HEARTBEAT_INTERVAL_MS)
        Log.d(TAG, "Heartbeat timer started (${IDLE_HEARTBEAT_INTERVAL_MS}ms interval)")
    }

    private fun stopHeartbeatTimer() {
        heartbeatRunnable?.let { mainHandler?.removeCallbacks(it) }
        heartbeatRunnable = null
    }

    @SuppressLint("MissingPermission")
    private fun requestHeartbeatLocation() {
        if (!isLocationServicesEnabled()) {
            Log.w(TAG, "Cannot request heartbeat - location services disabled")
            return
        }

        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnSuccessListener { location ->
                    location?.let {
                        Log.d(TAG, "Heartbeat location received: lat=${it.latitude}, lng=${it.longitude}")
                        uploadHeartbeat(it)
                    } ?: Log.w(TAG, "Heartbeat location request returned null")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Heartbeat location request failed", e)
                }
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception requesting heartbeat location", e)
        }
    }

    private fun uploadHeartbeat(location: Location) {
        if (isAuthBlocked()) {
            Log.d(TAG, "Auth blocked, skipping heartbeat upload")
            return
        }
        if (isInBackoff()) {
            Log.d(TAG, "In backoff, skipping heartbeat upload")
            return
        }

        sendLocationToServer(location, isHeartbeat = true)
    }

    // ============ TRACKING CONTROL ============

    private fun startTracking() {
        if (isTracking) return
        isTracking = true

        // Clear user stop flag and enable tracking
        PreferencesManager.setTrackingEnabled(true)
        PreferencesManager.setUserRequestedStop(false)

        // Check location services
        if (!isLocationServicesEnabled()) {
            Log.w(TAG, "Location services disabled")
            val notification = NotificationHelper.buildTrackingNotification(this, isPaused = false, statusText = "OFFLINE - Enable location")
            startForegroundWithNotification(notification)
            return
        }

        val notification = NotificationHelper.buildTrackingNotification(this, isPaused = false)
        startForegroundWithNotification(notification)

        // Start Activity Recognition for faster movement detection
        startActivityRecognition()

        // Initialize movement time
        lastMoveTimestamp = System.currentTimeMillis()

        updateMode(forceRequest = true)
    }

    private fun startForegroundWithNotification(notification: android.app.Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NotificationHelper.NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NotificationHelper.NOTIFICATION_ID, notification)
        }
    }

    private fun stopTracking() {
        Log.d(TAG, "stopTracking - USER REQUESTED STOP")

        isTracking = false

        // CRITICAL: Mark as user-requested stop to prevent zombie restarts
        PreferencesManager.setTrackingEnabled(false)
        PreferencesManager.setUserRequestedStop(true)

        cleanupResources()

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun cleanupResources() {
        // Stop heartbeat timer
        stopHeartbeatTimer()

        // Stop wakelock renewal timer
        stopWakelockRenewal()

        // Remove location updates
        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (e: Exception) {
            Log.w(TAG, "Error removing location updates", e)
        }

        // Stop activity recognition
        stopActivityRecognition()

        // Release wakelock
        releaseWakeLock()
    }

    // ============ MODE MANAGEMENT ============

    private fun switchMode(newMode: Mode) {
        Log.d(TAG, "switchMode: $currentMode -> $newMode")

        val oldMode = currentMode
        currentMode = newMode

        // Handle wakelock and renewal timer
        if (newMode == Mode.LIVE) {
            acquireTimeLimitedWakeLock()
            startWakelockRenewal()
        } else if (oldMode == Mode.LIVE) {
            stopWakelockRenewal()
            releaseWakeLock()
        }

        // Handle heartbeat timer for IDLE mode
        if (newMode == Mode.IDLE) {
            startHeartbeatTimer()
        } else if (oldMode == Mode.IDLE) {
            stopHeartbeatTimer()
        }

        // Update location request
        requestLocationUpdates()

        // Update notification
        updateNotification()
    }

    private fun updateMode(forceRequest: Boolean) {
        val newMode = determineCurrentMode()
        if (newMode != currentMode || forceRequest) {
            Log.d(TAG, "Mode changing from $currentMode to $newMode (forced=$forceRequest)")

            // Remove existing location updates before switching
            try {
                fusedLocationClient.removeLocationUpdates(locationCallback)
            } catch (e: Exception) {
                Log.w(TAG, "Error removing location updates", e)
            }

            switchMode(newMode)
        }
    }

    private fun determineCurrentMode(): Mode {
        val now = System.currentTimeMillis()

        // 1. Live mode has highest priority
        if (now < PreferencesManager.getLiveViewUntil()) {
            return Mode.LIVE
        }

        // 2. Check for recent movement
        val timeSinceLastMove = now - lastMoveTimestamp
        if (timeSinceLastMove < MOVEMENT_TIME_THRESHOLD_MS) {
            return Mode.MOVING
        }

        // 3. Default to idle
        return Mode.IDLE
    }

    private fun reconfigureTracking() {
        if (isTracking) {
            updateMode(forceRequest = true)
        }
    }

    // ============ LOCATION HANDLING ============

    private fun handleNewLocation(location: Location) {
        if (!isTracking) return

        val now = System.currentTimeMillis()

        // Update last known location
        val previousLocation = lastLocation
        lastLocation = location

        // Determine if we should update mode
        var hasMoved = false
        if (previousLocation != null) {
            val distance = location.distanceTo(previousLocation)
            val speed = location.speed
            if (speed >= MIN_SPEED_MPS || distance >= MIN_DISTANCE_METERS) {
                hasMoved = true
                lastMoveTimestamp = now
            }
        }

        // Check if auth is blocked
        if (isAuthBlocked()) {
            Log.d(TAG, "Auth blocked, skipping upload")
            return
        }

        // Check backoff
        if (isInBackoff()) {
            Log.d(TAG, "In backoff, skipping upload")
            return
        }

        // Determine if we should upload
        val shouldUpload = when (currentMode) {
            Mode.LIVE -> true // Always upload in live mode
            Mode.MOVING -> true // Always upload in moving mode (interval is controlled by request)
            Mode.IDLE -> {
                // In idle mode, only upload if moved significantly or for a heartbeat
                val timeSinceLastUpload = now - lastUploadTimestamp
                hasMoved || timeSinceLastUpload > IDLE_HEARTBEAT_INTERVAL_MS
            }
        }

        if (shouldUpload) {
            sendLocationToServer(location, isHeartbeat = false)
            lastUploadTimestamp = now
        }

        // Check if mode needs to be updated after processing the location
        updateMode(forceRequest = false)
    }

    @SuppressLint("MissingPermission")
    private fun requestLocationUpdates() {
        if (!isLocationServicesEnabled()) {
            Log.w(TAG, "Location services disabled, cannot request updates")
            return
        }

        val locationRequest = when (currentMode) {
            Mode.LIVE -> LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L).apply {
                setMinUpdateIntervalMillis(5000L)
                setMinUpdateDistanceMeters(10f)
            }.build()
            Mode.MOVING -> {
                val interval = PreferencesManager.getMovingIntervalSeconds() * 1000L
                val priority = if (PreferencesManager.isHighAccuracyEnabled()) {
                    Priority.PRIORITY_HIGH_ACCURACY
                } else {
                    Priority.PRIORITY_BALANCED_POWER_ACCURACY
                }
                LocationRequest.Builder(priority, interval).apply {
                    setMinUpdateIntervalMillis(interval / 2)
                    setMinUpdateDistanceMeters(25f)
                }.build()
            }
            Mode.IDLE -> LocationRequest.Builder(Priority.PRIORITY_LOW_POWER, 5 * 60 * 1000L).apply {
                setMinUpdateDistanceMeters(100f)
            }.build()
        }

        Log.d(TAG, "Requesting location updates for mode: $currentMode with interval ${locationRequest.intervalMillis}ms")

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                serviceLooper!!
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission lost", e)
            stopTracking()
        }
    }

    // ============ NETWORK & BACKOFF ============

    private fun sendLocationToServer(location: Location, isHeartbeat: Boolean = false) {
        val deviceUuid = PreferencesManager.getDeviceUuid()
        val batteryLevel = getBatteryLevel()
        val speedKmh = (location.speed * 3.6)

        val json = JSONObject().apply {
            put("device_uuid", deviceUuid)
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("accuracy_m", location.accuracy.toInt())
            put("speed_kmh", speedKmh)
            put("heading_deg", location.bearing)
            put("is_moving", if (currentMode == Mode.MOVING || currentMode == Mode.LIVE) 1 else 0)
            put("battery_level", batteryLevel)
            put("source", "android_native")
        }

        val mediaType = "application/json; charset=utf-8".toMediaType()
        val body = json.toString().toRequestBody(mediaType)

        var cookie = CookieManager.getInstance().getCookie(API_URL)
        if (cookie.isNullOrEmpty()) {
            cookie = CookieManager.getInstance().getCookie(BASE_URL)
        }

        val requestBuilder = Request.Builder().url(API_URL).post(body)
        if (!cookie.isNullOrEmpty()) {
            requestBuilder.addHeader("Cookie", cookie)
        }
        val request = requestBuilder.build()

        NetworkClient.client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Network error sending location", e)
                handleTransientFailure()
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val code = it.code
                    val responseBody = it.body?.string()

                    when {
                        code in 200..299 -> {
                            Log.d(TAG, if (isHeartbeat) "Heartbeat sent successfully" else "Location sent successfully")
                            handleSuccess()
                        }
                        code == 401 || code == 403 -> {
                            Log.w(TAG, "Auth failure: $code")
                            handleAuthFailure()
                        }
                        code == 402 -> {
                            Log.w(TAG, "Subscription locked: $code")
                            handleAuthFailure()
                        }
                        code == 429 -> {
                            Log.w(TAG, "Rate limited: $code")
                            handleTransientFailure()
                        }
                        code in 500..599 -> {
                            Log.w(TAG, "Server error: $code")
                            handleTransientFailure()
                        }
                        else -> {
                            Log.w(TAG, "Unexpected response: $code - $responseBody")
                            handleTransientFailure()
                        }
                    }
                }
            }
        })
    }

    private fun handleSuccess() {
        consecutiveFailures = 0
        lastFailureTime = 0
    }

    private fun handleAuthFailure() {
        authBlockedUntil = System.currentTimeMillis() + AUTH_BLOCK_DURATION_MS
        Log.w(TAG, "Auth blocked for 30 minutes")

        // Show notification to user
        NotificationHelper.showAuthErrorNotification(this)

        // Update notification to show login required
        updateNotification("Login required")
    }

    private fun handleTransientFailure() {
        consecutiveFailures++
        lastFailureTime = System.currentTimeMillis()
        Log.w(TAG, "Transient failure, consecutive count: $consecutiveFailures")

        // If too many failures in LIVE mode, drop to MOVING to save battery
        if (consecutiveFailures >= 3 && currentMode == Mode.LIVE) {
            Log.d(TAG, "Too many failures in LIVE mode, dropping to MOVING")
            switchMode(Mode.MOVING)
        }
    }

    private fun isAuthBlocked(): Boolean {
        return System.currentTimeMillis() < authBlockedUntil
    }

    private fun isInBackoff(): Boolean {
        if (consecutiveFailures == 0) return false

        val backoffIndex = minOf(consecutiveFailures - 1, BACKOFF_DELAYS_MS.size - 1)
        val backoffDelay = BACKOFF_DELAYS_MS[backoffIndex]
        val timeSinceFailure = System.currentTimeMillis() - lastFailureTime

        return timeSinceFailure < backoffDelay
    }

    // ============ ACTIVITY RECOGNITION ============

    @SuppressLint("MissingPermission")
    private fun startActivityRecognition() {
        try {
            activityRecognitionClient = ActivityRecognition.getClient(this)

            val intent = Intent(this, TrackingLocationService::class.java).apply {
                action = "ACTION_ACTIVITY_TRANSITION"
            }
            activityPendingIntent = android.app.PendingIntent.getService(
                this, 100, intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
            )

            val transitions = listOf(
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.STILL)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build(),
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.WALKING)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build(),
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.RUNNING)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build(),
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.IN_VEHICLE)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            )

            val request = ActivityTransitionRequest(transitions)
            activityRecognitionClient?.requestActivityTransitionUpdates(request, activityPendingIntent!!)
            Log.d(TAG, "Activity Recognition started")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Activity Recognition", e)
        }
    }

    private fun stopActivityRecognition() {
        activityPendingIntent?.let { pending ->
            activityRecognitionClient?.removeActivityTransitionUpdates(pending)
        }
        activityPendingIntent = null
    }

    private fun handleActivityTransition(intent: Intent) {
        if (ActivityTransitionResult.hasResult(intent)) {
            val result = ActivityTransitionResult.extractResult(intent)
            result?.transitionEvents?.forEach { event ->
                Log.d(TAG, "Activity detected: ${event.activityType}")

                when (event.activityType) {
                    DetectedActivity.WALKING,
                    DetectedActivity.RUNNING,
                    DetectedActivity.IN_VEHICLE -> {
                        // User started moving - update timestamp and switch to MOVING mode
                        lastMoveTimestamp = System.currentTimeMillis()
                        if (currentMode == Mode.IDLE) {
                            updateMode(forceRequest = true)
                        }
                    }
                }
            }
        }
    }

    // ============ UTILITIES ============

    private fun isLocationServicesEnabled(): Boolean {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return try {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        } catch (e: Exception) {
            Log.w(TAG, "Error checking location services", e)
            false
        }
    }

    private fun getBatteryLevel(): Int {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    private fun updateNotification(extraText: String? = null) {
        if (!isTracking) return

        val modeText = when (currentMode) {
            Mode.LIVE -> "LIVE"
            Mode.MOVING -> "Moving"
            Mode.IDLE -> "Idle"
        }

        val notification = NotificationHelper.buildTrackingNotification(
            this,
            isPaused = false,
            statusText = extraText ?: "Tracking: $modeText"
        )

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(NotificationHelper.NOTIFICATION_ID, notification)
    }
}
