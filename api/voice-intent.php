<?php
/**
 * ============================================
 * ADVANCED VOICE INTENT PROCESSOR v5.0
 * Complete Integration with All App Areas
 * ============================================
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../core/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['transcript']) || empty(trim($input['transcript']))) {
    echo json_encode([
        'intent' => 'error',
        'slots' => [],
        'response_text' => 'No voice input detected'
    ]);
    exit;
}

$transcript = trim($input['transcript']);
$currentPage = $input['page'] ?? '/';
$conversation = $input['conversation'] ?? [];

// Get user context if available
session_start();
$userId = $_SESSION['user_id'] ?? null;
$userContext = '';

if ($userId) {
    try {
        $stmt = $db->prepare("SELECT full_name, family_id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if ($user) {
            $userContext = "User: {$user['full_name']}, Family ID: {$user['family_id']}";
        }
    } catch (Exception $e) {
        error_log('Voice user context error: ' . $e->getMessage());
    }
}

// OpenAI API Configuration
$apiKey = getenv('OPENAI_API_KEY');
$apiUrl = 'https://api.openai.com/v1/chat/completions';

// Enhanced system prompt with ALL app areas
$systemPrompt = <<<PROMPT
You are Suzi, the AI voice assistant for the Relatives family app. 
$userContext

Analyze voice commands and return ONLY valid JSON:

{
  "intent": "intent_name",
  "slots": { ... },
  "response_text": "Natural spoken response"
}

**AVAILABLE INTENTS & AREAS:**

🏠 **NAVIGATION**
- navigate: Go to any area
  Slots: {"destination": "home|shopping|notes|calendar|schedule|weather|messages|tracking|notifications"}
  Response: "Taking you to [area]"

🛒 **SHOPPING**
- add_shopping_item: Add item to shopping list
  Slots: {"item": "milk", "quantity": "2L", "category": "dairy|meat|produce|bakery|pantry|frozen|snacks|beverages|household|other"}
  Response: "Adding [item] to your shopping list"

- view_shopping: Show shopping list
  Response: "Opening your shopping list"

- clear_bought: Remove bought items
  Response: "Clearing all bought items"

📝 **NOTES**
- create_note: Make a new note
  Slots: {"title": "optional", "content": "note text", "type": "text|voice"}
  Response: "Creating note: [content]"

- search_notes: Find notes
  Slots: {"query": "search term"}
  Response: "Searching notes for [query]"

📅 **CALENDAR**
- create_event: Add calendar event
  Slots: {"title": "event name", "date": "YYYY-MM-DD", "time": "HH:MM", "duration": "1 hour"}
  Response: "Creating event: [title] on [date]"

- show_calendar: View calendar
  Slots: {"date": "today|tomorrow|YYYY-MM-DD"}
  Response: "Showing calendar for [date]"

- next_event: Show upcoming event
  Response: "Your next event is..."

⏰ **SCHEDULE**
- create_schedule: Add scheduled task
  Slots: {"title": "task", "date": "YYYY-MM-DD", "time": "HH:MM", "type": "study|work|todo"}
  Response: "Scheduling [title] for [date]"

- show_schedule: View schedule
  Slots: {"date": "today|tomorrow"}
  Response: "Here's your schedule"

🌤️ **WEATHER**
- get_weather_today: Current weather
  Response: "The weather today is..."

- get_weather_tomorrow: Tomorrow's forecast
  Response: "Tomorrow's weather will be..."

- get_weather_week: 7-day forecast
  Response: "Here's the week ahead..."

💬 **MESSAGES**
- send_message: Send family message
  Slots: {"content": "message text", "to_user": "optional"}
  Response: "Sending message to family"

- read_messages: View messages
  Slots: {"filter": "unread|all"}
  Response: "You have [count] messages"

📍 **TRACKING**
- show_location: Show family locations
  Response: "Showing family locations"

- find_member: Locate family member
  Slots: {"member_name": "name"}
  Response: "Locating [member]"

🔔 **NOTIFICATIONS**
- check_notifications: View notifications
  Response: "You have [count] notifications"

- mark_all_read: Clear notifications
  Response: "Marking all as read"

🤖 **SMART FEATURES**
- get_stats: Show app statistics
  Response: "Here are your family stats..."

- get_suggestions: AI recommendations
  Response: "Here are some suggestions..."

- smalltalk: General conversation
  Response: "Natural conversational response"

**PARSING RULES:**
1. Extract dates: "tomorrow", "next monday", "jan 15"
2. Extract times: "3pm", "15:00", "at noon"
3. Extract quantities: "2 liters", "500g", "3 items"
4. Extract names: proper nouns for family members
5. Infer category from item name (milk=dairy, bread=bakery)

**RESPONSE GUIDELINES:**
- Be conversational and friendly
- Confirm actions clearly
- Ask for clarification if needed
- Use emojis sparingly

**EXAMPLES:**

"add milk to shopping" → 
{
  "intent": "add_shopping_item",
  "slots": {"item": "milk", "category": "dairy"},
  "response_text": "Adding milk to your shopping list! 🛒"
}

"what's the weather tomorrow" →
{
  "intent": "get_weather_tomorrow",
  "slots": {},
  "response_text": "Let me check tomorrow's forecast for you..."
}

"create an event birthday party saturday at 3pm" →
{
  "intent": "create_event",
  "slots": {"title": "birthday party", "date": "next_saturday", "time": "15:00"},
  "response_text": "Creating event: Birthday Party on Saturday at 3 PM"
}

"show me the calendar" →
{
  "intent": "show_calendar",
  "slots": {"date": "today"},
  "response_text": "Opening your calendar"
}

"send a message hi everyone" →
{
  "intent": "send_message",
  "slots": {"content": "hi everyone"},
  "response_text": "Sending message to your family"
}

"take a note buy groceries" →
{
  "intent": "create_note",
  "slots": {"content": "buy groceries"},
  "response_text": "I've noted: buy groceries"
}

"where is mom" →
{
  "intent": "find_member",
  "slots": {"member_name": "mom"},
  "response_text": "Let me find mom's location..."
}

"go to shopping" →
{
  "intent": "navigate",
  "slots": {"destination": "shopping"},
  "response_text": "Taking you to shopping"
}

Return ONLY the JSON object. No markdown, no explanations.
PROMPT;

// Build messages for OpenAI
$messages = [
    ['role' => 'system', 'content' => $systemPrompt]
];

// Add conversation history (last 3 exchanges)
if (!empty($conversation)) {
    foreach (array_slice($conversation, -3) as $msg) {
        $messages[] = $msg;
    }
}

// Add current command
$messages[] = ['role' => 'user', 'content' => $transcript];

$data = [
    'model' => 'gpt-4o-mini',
    'messages' => $messages,
    'temperature' => 0.7,
    'max_tokens' => 400
];

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo json_encode([
        'intent' => 'error',
        'slots' => [],
        'response_text' => 'Sorry, I had trouble processing that. Please try again.'
    ]);
    exit;
}

$apiResponse = json_decode($response, true);

if (!isset($apiResponse['choices'][0]['message']['content'])) {
    echo json_encode([
        'intent' => 'error',
        'slots' => [],
        'response_text' => 'Something went wrong. Could you repeat that?'
    ]);
    exit;
}

$intentJson = trim($apiResponse['choices'][0]['message']['content']);

// Remove markdown code blocks
$intentJson = preg_replace('/```json\s*/', '', $intentJson);
$intentJson = preg_replace('/```\s*/', '', $intentJson);

$result = json_decode($intentJson, true);

if (!$result || !isset($result['intent'])) {
    echo json_encode([
        'intent' => 'smalltalk',
        'slots' => [],
        'response_text' => 'I didn\'t quite catch that. Could you rephrase?'
    ]);
    exit;
}

// Log voice command for analytics
if ($userId) {
    try {
        $stmt = $db->prepare("
            INSERT INTO voice_command_log 
            (user_id, transcript, intent, slots, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $userId,
            $transcript,
            $result['intent'],
            json_encode($result['slots'] ?? [])
        ]);
    } catch (Exception $e) {
        error_log('Voice log error: ' . $e->getMessage());
    }
}

echo json_encode($result);