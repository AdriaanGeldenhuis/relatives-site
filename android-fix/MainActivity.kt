package za.co.relatives.app

import android.Manifest
import android.app.Activity
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import za.co.relatives.app.network.ApiClient
import za.co.relatives.app.services.RelativesFirebaseMessagingService
import za.co.relatives.app.services.TrackingLocationService
import za.co.relatives.app.ui.SubscriptionActivity
import za.co.relatives.app.ui.TrackingJsInterface
import za.co.relatives.app.ui.VoiceAssistantBridge
import za.co.relatives.app.ui.theme.RelativesTheme
import za.co.relatives.app.utils.PreferencesManager

class MainActivity : ComponentActivity() {

    private val requiredPermissions = mutableListOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.RECORD_AUDIO
    ).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
    }.toTypedArray()

    private var permissionsGranted by mutableStateOf(false)
    private var showBackgroundRationale by mutableStateOf(false)

    private var showTrialBanner by mutableStateOf(false)
    private var trialEndDate by mutableStateOf("")
    private var isLocked by mutableStateOf(false)

    private val webView = mutableStateOf<WebView?>(null)

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if (result.values.all { it }) {
            checkBackgroundPermission()
        } else {
            // Handle permission denial gracefully if needed
            permissionsGranted = true // Allow app to proceed even with some permissions denied
        }
    }

    private val backgroundPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        permissionsGranted = true
        // Service will be started after permissions are fully granted
        startTrackingServiceIfNeeded()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        hideSystemBars()

        if (hasRequiredPermissions()) {
            permissionsGranted = true
            startTrackingServiceIfNeeded()
        } else {
            permissionsLauncher.launch(requiredPermissions)
        }

        setContent {
            RelativesTheme {
                MainScreen()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        webView.value?.onResume()
        webView.value?.resumeTimers()
        checkSubscription()
    }

    override fun onPause() {
        super.onPause()
        webView.value?.onPause()
        webView.value?.pauseTimers()
    }

    @Composable
    private fun MainScreen() {
        val context = LocalContext.current
        var initialUrl = "https://www.relatives.co.za"
        intent.getStringExtra("open_url")?.let { initialUrl = it }

        BackHandler(enabled = webView.value?.canGoBack() == true) {
            webView.value?.goBack()
        }

        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (permissionsGranted) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        AnimatedVisibility(visible = showTrialBanner) {
                            TrialBanner(endDate = trialEndDate) {
                                startActivity(Intent(context, SubscriptionActivity::class.java))
                            }
                        }
                        WebViewScreen(
                            initialUrl = initialUrl,
                            onWebViewReady = { webView.value = it }
                        )
                    }
                } else if (showBackgroundRationale) {
                    BackgroundPermissionRationale {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            backgroundPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                        } else {
                            permissionsGranted = true
                            startTrackingServiceIfNeeded()
                        }
                        showBackgroundRationale = false
                    }
                } else {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        CircularProgressIndicator()
                    }
                }

                if (isLocked) {
                    LockedOverlay {
                        startActivity(Intent(context, SubscriptionActivity::class.java))
                    }
                }
            }
        }
    }

    private fun checkSubscription() {
        val familyId = PreferencesManager.getDeviceUuid()
        if (familyId.isBlank()) return

        ApiClient.getSubscriptionStatus(familyId) { status ->
            runOnUiThread {
                if (status != null) {
                    applySubscriptionStatus(status)
                }
            }
        }
    }

    private fun applySubscriptionStatus(status: ApiClient.SubscriptionStatus) {
        when (status.status) {
            "active" -> {
                isLocked = false
                showTrialBanner = false
                injectJsLock(false)
            }
            "trial" -> {
                isLocked = false
                showTrialBanner = true
                trialEndDate = status.trial_ends_at ?: "soon"
                injectJsLock(false)
            }
            "locked", "expired", "cancelled" -> {
                isLocked = true
                showTrialBanner = false
                injectJsLock(true)
            }
        }
    }

    private fun injectJsLock(locked: Boolean) {
        webView.value?.evaluateJavascript("window.RELATIVES_SUBSCRIPTION_LOCKED = $locked;") {}
    }

    private fun hasRequiredPermissions(): Boolean {
        return requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun checkBackgroundPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            showBackgroundRationale = true
        } else {
            permissionsGranted = true
            startTrackingServiceIfNeeded()
        }
    }

    private fun startTrackingServiceIfNeeded() {
        if (PreferencesManager.isTrackingEnabled()) {
            val intent = Intent(this, TrackingLocationService::class.java).apply {
                action = TrackingLocationService.ACTION_START_TRACKING
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        }
    }

    internal fun retryPendingFcmTokenRegistration() {
        val pendingToken = PreferencesManager.getPendingFcmToken()
        if (pendingToken != null) {
            val cookie = CookieManager.getInstance().getCookie("https://www.relatives.co.za")
            if (!cookie.isNullOrEmpty()) {
                RelativesFirebaseMessagingService.registerDeviceToken(pendingToken) { success ->
                    if (success) {
                        PreferencesManager.setPendingFcmToken(null) // Clear token on success
                    }
                }
            }
        }
    }

    private fun hideSystemBars() {
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
    }
}

@Composable
fun LockedOverlay(onManageSubscription: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.8f))
            .clickable(enabled = false, onClick = {}), // Block clicks
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "Locked",
                tint = Color.White,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Your trial has ended",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White
            )
            Text(
                text = "You are in view-only mode.",
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.8f),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onManageSubscription) {
                Text("Manage Subscription")
            }
        }
    }
}

@Composable
fun TrialBanner(endDate: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("Free Trial Active", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onTertiaryContainer)
            Text("Ends: $endDate. Tap to upgrade.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
        }
        Icon(Icons.Default.ArrowForward, "Upgrade", tint = MaterialTheme.colorScheme.onTertiaryContainer)
    }
}

@Composable
fun BackgroundPermissionRationale(onContinue: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Always-On Location Needed", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(16.dp))
        Text("To keep your family updated even when the app is closed, please select 'Allow all the time' in the next screen.")
        Spacer(Modifier.height(24.dp))
        Button(onClick = onContinue) { Text("Understand") }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
    initialUrl: String,
    onWebViewReady: (WebView) -> Unit
) {
    val context = LocalContext.current as MainActivity
    var uploadMessageCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    val webView = remember {
        WebView(context).also(onWebViewReady)
    }

    val voiceAssistantBridge = remember(context, webView) {
        VoiceAssistantBridge(context, webView)
    }

    val trackingJsInterface = remember(context) {
        TrackingJsInterface(context.applicationContext)
    }

    DisposableEffect(voiceAssistantBridge) {
        onDispose { voiceAssistantBridge.cleanup() }
    }

    val fileChooserLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        uploadMessageCallback?.onReceiveValue(uris)
        uploadMessageCallback = null
    }

    AndroidView(factory = {
        webView.apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                userAgentString += " RelativesAndroidApp"
                allowFileAccess = true
                allowContentAccess = true
            }

            addJavascriptInterface(trackingJsInterface, "TrackingBridge")
            addJavascriptInterface(trackingJsInterface, "Android")
            addJavascriptInterface(trackingJsInterface, "AndroidInterface")
            addJavascriptInterface(voiceAssistantBridge, "AndroidVoice")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url ?: return false
                    if (url.scheme == "relatives" && url.host == "subscription") {
                        context.startActivity(Intent(context, SubscriptionActivity::class.java))
                        return true
                    }
                    return false
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)

                    // CRITICAL FIX: Hide the app loader after page loads
                    // This ensures the loader is hidden even if the page's JS fails
                    view?.evaluateJavascript("""
                        (function() {
                            var loader = document.getElementById('appLoader');
                            if (loader && !loader.classList.contains('hidden')) {
                                console.log('Native: hiding loader from Android onPageFinished');
                                loader.classList.add('hidden');
                            }
                            window.dispatchEvent(new Event('appReady'));
                        })();
                    """.trimIndent(), null)

                    context.retryPendingFcmTokenRegistration()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(wv: WebView?, cb: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                    uploadMessageCallback?.onReceiveValue(null)
                    uploadMessageCallback = cb
                    params?.createIntent()?.let {
                        fileChooserLauncher.launch(it)
                    }
                    return true
                }
            }

            clearCache(true)
            // Delay loading to ensure session/cookies are ready
            postDelayed({
                loadUrl(initialUrl)
            }, 500)
        }
    })
}
