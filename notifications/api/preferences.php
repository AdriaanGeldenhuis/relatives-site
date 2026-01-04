<?php
/**
 * NOTIFICATION PREFERENCES API
 * Complete CRUD for notification settings
 */

session_start();
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../../core/bootstrap.php';

$userId = (int)$_SESSION['user_id'];
$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get':
            // Get all preferences
            $stmt = $db->prepare("
                SELECT * FROM notification_preferences 
                WHERE user_id = ?
                ORDER BY category
            ");
            $stmt->execute([$userId]);
            $prefs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get weather schedule
            $stmt = $db->prepare("
                SELECT * FROM weather_notification_schedule 
                WHERE user_id = ?
            ");
            $stmt->execute([$userId]);
            $weatherSchedule = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Create default preferences if none exist
            if (empty($prefs)) {
                $categories = ['message', 'shopping', 'calendar', 'schedule', 'tracking', 'weather', 'note', 'system'];
                foreach ($categories as $cat) {
                    $stmt = $db->prepare("
                        INSERT IGNORE INTO notification_preferences 
                        (user_id, category, enabled, push_enabled, sound_enabled, vibrate_enabled)
                        VALUES (?, ?, 1, 1, 1, 1)
                    ");
                    $stmt->execute([$userId, $cat]);
                }
                
                // Re-fetch
                $stmt = $db->prepare("SELECT * FROM notification_preferences WHERE user_id = ?");
                $stmt->execute([$userId]);
                $prefs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            
            echo json_encode([
                'success' => true,
                'preferences' => $prefs,
                'weather_schedule' => $weatherSchedule
            ]);
            break;
            
        case 'update':
            $category = $_POST['category'] ?? '';
            $settingsJson = $_POST['settings'] ?? '{}';
            $settings = json_decode($settingsJson, true);
            
            if (empty($category)) {
                throw new Exception('Category required');
            }
            
            // Check if exists
            $stmt = $db->prepare("
                SELECT id FROM notification_preferences 
                WHERE user_id = ? AND category = ?
            ");
            $stmt->execute([$userId, $category]);
            $exists = $stmt->fetch();
            
            if ($exists) {
                // Update
                $fields = [];
                $values = [];
                
                foreach ($settings as $key => $value) {
                    if (in_array($key, ['enabled', 'push_enabled', 'sound_enabled', 'vibrate_enabled'])) {
                        $fields[] = "$key = ?";
                        $values[] = (int)$value;
                    }
                }
                
                if (!empty($fields)) {
                    $values[] = $userId;
                    $values[] = $category;
                    
                    $sql = "UPDATE notification_preferences SET " . 
                           implode(', ', $fields) . 
                           " WHERE user_id = ? AND category = ?";
                    
                    $stmt = $db->prepare($sql);
                    $stmt->execute($values);
                }
            } else {
                // Insert with defaults
                $enabled = isset($settings['enabled']) ? (int)$settings['enabled'] : 1;
                $pushEnabled = isset($settings['push_enabled']) ? (int)$settings['push_enabled'] : 1;
                $soundEnabled = isset($settings['sound_enabled']) ? (int)$settings['sound_enabled'] : 1;
                $vibrateEnabled = isset($settings['vibrate_enabled']) ? (int)$settings['vibrate_enabled'] : 1;
                
                $stmt = $db->prepare("
                    INSERT INTO notification_preferences 
                    (user_id, category, enabled, push_enabled, sound_enabled, vibrate_enabled)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$userId, $category, $enabled, $pushEnabled, $soundEnabled, $vibrateEnabled]);
            }
            
            echo json_encode(['success' => true]);
            break;
            
        case 'update_weather_schedule':
            $enabled = isset($_POST['enabled']) ? (int)$_POST['enabled'] : 1;
            $time = $_POST['time'] ?? '07:00:00';
            $voiceEnabled = isset($_POST['voice_enabled']) ? (int)$_POST['voice_enabled'] : 1;
            $includeForecast = isset($_POST['include_forecast']) ? (int)$_POST['include_forecast'] : 1;

            // Validate time format (accept both HH:MM and HH:MM:SS)
            if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $time)) {
                throw new Exception('Invalid time format');
            }
            // Ensure time has seconds
            if (strlen($time) === 5) {
                $time .= ':00';
            }

            // Check if exists
            $stmt = $db->prepare("SELECT id, notification_time FROM weather_notification_schedule WHERE user_id = ?");
            $stmt->execute([$userId]);
            $exists = $stmt->fetch();

            if ($exists) {
                // Reset last_sent if time changed so notification can send today
                $resetLastSent = ($exists['notification_time'] !== $time) ? ', last_sent = NULL' : '';

                $stmt = $db->prepare("
                    UPDATE weather_notification_schedule
                    SET enabled = ?,
                        notification_time = ?,
                        voice_enabled = ?,
                        include_forecast = ?,
                        updated_at = NOW()
                        $resetLastSent
                    WHERE user_id = ?
                ");
                $stmt->execute([$enabled, $time, $voiceEnabled, $includeForecast, $userId]);
            } else {
                $stmt = $db->prepare("
                    INSERT INTO weather_notification_schedule
                    (user_id, enabled, notification_time, voice_enabled, include_forecast)
                    VALUES (?, ?, ?, ?, ?)
                ");
                $stmt->execute([$userId, $enabled, $time, $voiceEnabled, $includeForecast]);
            }

            echo json_encode(['success' => true]);
            break;

        case 'test_weather':
            // Send immediate weather notification for testing
            require_once __DIR__ . '/../../core/NotificationManager.php';

            // Get user's weather schedule settings
            $stmt = $db->prepare("SELECT * FROM weather_notification_schedule WHERE user_id = ?");
            $stmt->execute([$userId]);
            $schedule = $stmt->fetch(PDO::FETCH_ASSOC);

            // Get user's location
            $stmt = $db->prepare("
                SELECT latitude, longitude
                FROM tracking_locations
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            ");
            $stmt->execute([$userId]);
            $location = $stmt->fetch(PDO::FETCH_ASSOC);

            // Default to Johannesburg if no location
            $lat = $location['latitude'] ?? -26.2041;
            $lon = $location['longitude'] ?? 28.0473;

            // Fetch weather data
            $apiKey = '563504b6b46d0e6bcf9a49e1cb6bc4f3';
            $weatherUrl = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&appid={$apiKey}&units=metric";

            $weatherResponse = @file_get_contents($weatherUrl);
            if ($weatherResponse === false) {
                throw new Exception('Failed to fetch weather data');
            }

            $weatherData = json_decode($weatherResponse, true);
            if (!isset($weatherData['main'])) {
                throw new Exception('Invalid weather response');
            }

            // Prepare notification
            $temp = round($weatherData['main']['temp']);
            $feelsLike = round($weatherData['main']['feels_like']);
            $description = ucfirst($weatherData['weather'][0]['description'] ?? 'clear sky');
            $locationName = $weatherData['name'] ?? 'Your location';
            $humidity = $weatherData['main']['humidity'] ?? 0;
            $windSpeed = round(($weatherData['wind']['speed'] ?? 0) * 3.6);

            $message = "Test Weather Update\n\n";
            $message .= "📍 $locationName\n";
            $message .= "🌡️ $temp°C (feels like $feelsLike°C)\n";
            $message .= "☁️ $description\n";
            $message .= "💧 Humidity: $humidity%\n";
            $message .= "💨 Wind: $windSpeed km/h";

            $notifManager = NotificationManager::getInstance($db);
            $notifId = $notifManager->create([
                'user_id' => $userId,
                'type' => NotificationManager::TYPE_WEATHER,
                'title' => "Weather Test - $locationName",
                'message' => $message,
                'action_url' => '/notifications/',
                'priority' => NotificationManager::PRIORITY_NORMAL,
                'icon' => '🌤️',
                'vibrate' => 1,
                'data' => [
                    'test' => true,
                    'temperature' => $temp,
                    'condition' => $weatherData['weather'][0]['main'] ?? 'Clear'
                ]
            ]);

            echo json_encode([
                'success' => $notifId ? true : false,
                'notification_id' => $notifId,
                'message' => $notifId ? 'Weather notification sent!' : 'Failed to send notification'
            ]);
            break;

        case 'test':
            // Send test notification with push via NotificationManager
            require_once __DIR__ . '/../../core/NotificationManager.php';

            $notifManager = NotificationManager::getInstance($db);

            $notifId = $notifManager->create([
                'user_id' => $userId,
                'type' => NotificationManager::TYPE_SYSTEM,
                'title' => 'Test Notification',
                'message' => 'This is a test notification sent at ' . date('g:i A') . '. If you received this on your device, push notifications are working!',
                'action_url' => '/notifications/',
                'priority' => NotificationManager::PRIORITY_NORMAL,
                'icon' => '🔔',
                'vibrate' => 1,
                'data' => [
                    'test' => true,
                    'timestamp' => time()
                ]
            ]);

            echo json_encode([
                'success' => $notifId ? true : false,
                'notification_id' => $notifId,
                'message' => $notifId
                    ? 'Test notification sent successfully (with push)'
                    : 'Failed to send test notification'
            ]);
            break;

        case 'register_fcm_token':
            // Register FCM token from native app
            $token = trim($_POST['token'] ?? '');
            $deviceType = $_POST['device_type'] ?? 'unknown';

            if (empty($token)) {
                throw new Exception('FCM token required');
            }

            // Remove any existing token for other users (device switched users)
            $stmt = $db->prepare("DELETE FROM fcm_tokens WHERE token = ? AND user_id != ?");
            $stmt->execute([$token, $userId]);

            // Check if this token already exists for this user
            $stmt = $db->prepare("SELECT id FROM fcm_tokens WHERE user_id = ? AND token = ?");
            $stmt->execute([$userId, $token]);
            $existing = $stmt->fetch();

            if ($existing) {
                // Update
                $stmt = $db->prepare("UPDATE fcm_tokens SET device_type = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$deviceType, $existing['id']]);
            } else {
                // Insert
                $stmt = $db->prepare("
                    INSERT INTO fcm_tokens (user_id, token, device_type, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([$userId, $token, $deviceType]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'FCM token registered'
            ]);
            break;

        case 'unregister_fcm_token':
            // Remove FCM token (on logout)
            $token = trim($_POST['token'] ?? '');

            if (!empty($token)) {
                $stmt = $db->prepare("DELETE FROM fcm_tokens WHERE user_id = ? AND token = ?");
                $stmt->execute([$userId, $token]);
            }

            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
    
} catch (Exception $e) {
    error_log('Preferences API error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}