/**
 * SUZI VOICE ASSISTANT v7.0
 * Complete rewrite - Simple, Reliable, Mobile-First
 */

(function() {
    'use strict';

    // ============ CONFIGURATION ============
    const CONFIG = {
        lang: 'en-US',
        ttsRate: 1.0,
        ttsPitch: 1.0,
        listenTimeout: 8000,      // Max time to listen before auto-retry
        ttsWordsPerSecond: 2.5,   // For estimating speech duration
        minTtsDuration: 1500,     // Minimum TTS wait time
        maxTtsDuration: 10000,    // Maximum TTS wait time
        restartDelay: 600,        // Delay before restarting listener
        stopWords: ['stop', 'bye', 'goodbye', 'cancel', 'close', 'exit', 'quit']
    };

    // ============ STATE ============
    let state = {
        isOpen: false,
        isListening: false,
        isSpeaking: false,
        isProcessing: false
    };

    let recognition = null;
    let synthesis = window.speechSynthesis;
    let currentUtterance = null;
    let listenTimer = null;
    let ttsTimer = null;
    let conversation = [];

    // ============ DOM ELEMENTS ============
    let dom = {};

    function cacheDom() {
        dom = {
            modal: document.getElementById('suziModal'),
            overlay: document.getElementById('suziOverlay'),
            avatar: document.getElementById('suziAvatar'),
            icon: document.getElementById('suziAvatarIcon'),
            status: document.getElementById('suziStatusText'),
            substatus: document.getElementById('suziStatusSubtext'),
            transcript: document.getElementById('suziTranscript'),
            waveform: document.getElementById('suziWaveform'),
            suggestions: document.getElementById('suziSuggestions'),
            closeBtn: document.getElementById('suziCloseBtn'),
            micBtn: document.getElementById('micBtn'),
            tapToSpeak: document.getElementById('suziTapToSpeak')
        };
    }

    // ============ INITIALIZATION ============
    function init() {
        console.log('🎤 Suzi v7.0 initializing...');
        
        cacheDom();
        setupRecognition();
        setupEventListeners();
        
        console.log('✅ Suzi ready');
    }

    function setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = CONFIG.lang;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = function() {
            console.log('🎤 Listening started');
            state.isListening = true;
            showListening();
        };

        recognition.onresult = function(event) {
            let final = '';
            let interim = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }

            if (interim) {
                updateTranscript(interim, true);
            }

            if (final) {
                clearTimeout(listenTimer);
                state.isListening = false;
                handleUserSpeech(final.trim());
            }
        };

        recognition.onerror = function(event) {
            console.log('🎤 Error:', event.error);
            state.isListening = false;
            
            if (event.error === 'not-allowed') {
                showError('Microphone blocked', 'Allow microphone access');
            } else if (event.error === 'no-speech') {
                // Just restart
                if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
                    scheduleRestart();
                }
            } else {
                scheduleRestart();
            }
        };

        recognition.onend = function() {
            console.log('🎤 Listening ended');
            state.isListening = false;
            
            if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
                scheduleRestart();
            }
        };
    }

    function setupEventListeners() {
        // Mic button opens Suzi
        if (dom.micBtn) {
            dom.micBtn.addEventListener('click', open);
        }

        // Close button
        if (dom.closeBtn) {
            dom.closeBtn.addEventListener('click', close);
        }

        // Overlay click closes
        if (dom.overlay) {
            dom.overlay.addEventListener('click', close);
        }

        // Tap to speak button
        if (dom.tapToSpeak) {
            dom.tapToSpeak.addEventListener('click', function() {
                if (!state.isListening && !state.isSpeaking && !state.isProcessing) {
                    startListening();
                }
            });
        }

        // Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && state.isOpen) {
                close();
            }
        });
    }

    // ============ MODAL CONTROL ============
    function open() {
        if (state.isOpen) return;
        
        console.log('📱 Opening Suzi');
        state.isOpen = true;
        conversation = [];

        if (dom.modal) {
            dom.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        if (dom.micBtn) {
            dom.micBtn.classList.add('active');
        }

        // Show greeting
        showGreeting();
        updateTranscript('');
        showSuggestions(true);

        // Say hello then listen
        const greetings = [
            "Hi! How can I help?",
            "Hey! What can I do for you?",
            "Hello! I'm listening."
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        speak(greeting, function() {
            startListening();
        });
    }

    function close() {
        if (!state.isOpen) return;
        
        console.log('📱 Closing Suzi');
        
        stopListening();
        stopSpeaking();
        clearTimeout(listenTimer);
        clearTimeout(ttsTimer);

        state.isOpen = false;
        state.isListening = false;
        state.isSpeaking = false;
        state.isProcessing = false;

        if (dom.modal) {
            dom.modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (dom.micBtn) {
            dom.micBtn.classList.remove('active', 'listening');
        }
    }

    // ============ LISTENING ============
    function startListening() {
        if (!state.isOpen || state.isListening || state.isSpeaking || state.isProcessing) {
            return;
        }

        if (!recognition) {
            showError('Not supported', 'Speech recognition unavailable');
            return;
        }

        console.log('🎤 Starting listener...');
        
        try {
            recognition.start();
            
            // Safety timeout - if nothing happens, restart
            listenTimer = setTimeout(function() {
                if (state.isListening) {
                    console.log('⏰ Listen timeout');
                    stopListening();
                    scheduleRestart();
                }
            }, CONFIG.listenTimeout);
            
        } catch (e) {
            console.log('Start error:', e.message);
            // Already running, try stopping first
            try { recognition.stop(); } catch(e2) {}
            setTimeout(startListening, 300);
        }
    }

    function stopListening() {
        clearTimeout(listenTimer);
        
        if (recognition) {
            try { recognition.abort(); } catch(e) {}
        }
        
        state.isListening = false;
    }

    function scheduleRestart() {
        clearTimeout(listenTimer);
        
        if (!state.isOpen || state.isSpeaking || state.isProcessing) {
            return;
        }

        listenTimer = setTimeout(function() {
            if (state.isOpen && !state.isSpeaking && !state.isProcessing && !state.isListening) {
                startListening();
            }
        }, CONFIG.restartDelay);
    }

    // ============ SPEECH HANDLING ============
    function handleUserSpeech(text) {
        if (!text) {
            scheduleRestart();
            return;
        }

        console.log('👤 User said:', text);
        updateTranscript(text, false);
        showSuggestions(false);

        // Check for stop words
        const lower = text.toLowerCase();
        for (let word of CONFIG.stopWords) {
            if (lower.includes(word)) {
                sayGoodbye();
                return;
            }
        }

        // Process command
        processCommand(text);
    }

    function sayGoodbye() {
        const goodbyes = ["Goodbye!", "Bye!", "See you later!", "Take care!"];
        const bye = goodbyes[Math.floor(Math.random() * goodbyes.length)];
        
        showSuccess('Goodbye!', bye);
        speak(bye, function() {
            setTimeout(close, 300);
        });
    }

    // ============ COMMAND PROCESSING ============
    async function processCommand(command) {
        state.isProcessing = true;
        showThinking();

        try {
            const response = await fetch('/api/voice-intent.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: command,
                    page: window.location.pathname,
                    conversation: conversation
                })
            });

            const data = await response.json();
            console.log('🤖 Response:', data);

            if (!data || !data.intent) {
                throw new Error('Bad response');
            }

            // Save to conversation
            conversation.push({ role: 'user', content: command });
            conversation.push({ role: 'assistant', content: data.response_text });
            if (conversation.length > 10) {
                conversation = conversation.slice(-10);
            }

            // Handle response
            await handleIntent(data);

        } catch (err) {
            console.error('Process error:', err);
            showError('Oops', 'Something went wrong');
            speak("Sorry, something went wrong. Try again?", function() {
                state.isProcessing = false;
                scheduleRestart();
            });
        }
    }

    async function handleIntent(data) {
        const { intent, slots = {}, response_text } = data;
        
        showSuccess('Got it!', response_text);

        // Intents that navigate away
        const navIntents = [
            'navigate', 'add_shopping_item', 'create_event', 'create_schedule',
            'create_note', 'view_shopping', 'show_calendar', 'show_schedule',
            'show_location', 'find_member', 'read_messages', 'check_notifications',
            'get_weather_today', 'get_weather_tomorrow', 'get_weather_week'
        ];

        const willNavigate = navIntents.includes(intent);

        // Speak response
        speak(response_text, function() {
            state.isProcessing = false;

            if (willNavigate) {
                executeAction(intent, slots);
            } else {
                scheduleRestart();
            }
        });

        // Do action immediately if not navigating
        if (!willNavigate && intent !== 'smalltalk') {
            executeAction(intent, slots);
        }
    }

    function executeAction(intent, slots) {
        switch (intent) {
            case 'navigate':
                goTo(getPath(slots.destination));
                break;

            case 'add_shopping_item':
                addToShopping(slots.item, slots.quantity, slots.category);
                break;

            case 'view_shopping':
                goTo('/shopping/');
                break;

            case 'create_note':
                let noteUrl = '/notes/?new=1';
                if (slots.content) noteUrl += '&content=' + encodeURIComponent(slots.content);
                goTo(noteUrl);
                break;

            case 'create_event':
                let eventUrl = '/calendar/?new=1';
                if (slots.title) eventUrl += '&title=' + encodeURIComponent(slots.title);
                if (slots.date) eventUrl += '&date=' + formatDate(slots.date);
                if (slots.time) eventUrl += '&time=' + slots.time;
                goTo(eventUrl);
                break;

            case 'create_schedule':
                let schedUrl = '/schedule/?new=1';
                if (slots.title) schedUrl += '&title=' + encodeURIComponent(slots.title);
                if (slots.date) schedUrl += '&date=' + formatDate(slots.date);
                if (slots.time) schedUrl += '&time=' + slots.time;
                goTo(schedUrl);
                break;

            case 'show_calendar':
                goTo('/calendar/?date=' + formatDate(slots.date || 'today'));
                break;

            case 'show_schedule':
                goTo('/schedule/?date=' + formatDate(slots.date || 'today'));
                break;

            case 'get_weather_today':
            case 'get_weather_tomorrow':
            case 'get_weather_week':
                goTo('/weather/');
                break;

            case 'send_message':
                sendMessage(slots.content);
                break;

            case 'read_messages':
                goTo('/messages/');
                break;

            case 'show_location':
                goTo('/tracking/');
                break;

            case 'find_member':
                goTo('/tracking/?search=' + encodeURIComponent(slots.member_name || ''));
                break;

            case 'check_notifications':
                goTo('/notifications/');
                break;

            case 'clear_bought':
                clearBought();
                break;

            case 'mark_all_read':
                markNotificationsRead();
                break;
        }
    }

    // ============ ACTIONS ============
    function goTo(url) {
        setTimeout(function() {
            close();
            window.location.href = url;
        }, 1500);
    }

    function getPath(dest) {
        const paths = {
            home: '/home/',
            shopping: '/shopping/',
            notes: '/notes/',
            calendar: '/calendar/',
            schedule: '/schedule/',
            weather: '/weather/',
            messages: '/messages/',
            tracking: '/tracking/',
            notifications: '/notifications/',
            help: '/help/'
        };
        return paths[dest] || '/home/';
    }

    function formatDate(str) {
        if (!str) return new Date().toISOString().split('T')[0];
        
        const s = str.toLowerCase();
        const today = new Date();

        if (s === 'today') {
            return today.toISOString().split('T')[0];
        }
        if (s === 'tomorrow') {
            today.setDate(today.getDate() + 1);
            return today.toISOString().split('T')[0];
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
        }

        return new Date().toISOString().split('T')[0];
    }

    async function addToShopping(item, qty, category) {
        if (!item) return;
        
        try {
            const fd = new FormData();
            fd.append('action', 'add');
            fd.append('name', item);
            fd.append('qty', qty || '');
            fd.append('category', category || 'other');
            
            await fetch('/shopping/api/items.php', { method: 'POST', body: fd });
            
            goTo('/shopping/');
        } catch (e) {
            console.error('Add shopping error:', e);
        }
    }

    async function sendMessage(content) {
        if (!content) return;
        
        try {
            const fd = new FormData();
            fd.append('content', content);
            fd.append('to_family', '1');
            
            await fetch('/messages/api/send.php', { method: 'POST', body: fd });
        } catch (e) {
            console.error('Send message error:', e);
        }
    }

    async function clearBought() {
        try {
            const fd = new FormData();
            fd.append('action', 'clear_bought');
            await fetch('/shopping/api/items.php', { method: 'POST', body: fd });
        } catch (e) {}
    }

    async function markNotificationsRead() {
        try {
            const fd = new FormData();
            fd.append('action', 'mark_all_read');
            await fetch('/notifications/api/', { method: 'POST', body: fd });
        } catch (e) {}
    }

    // ============ TEXT TO SPEECH ============
    function speak(text, callback) {
        if (!text) {
            if (callback) callback();
            return;
        }

        stopSpeaking();
        stopListening();

        state.isSpeaking = true;
        showSpeaking();

        console.log('🔊 Speaking:', text);

        // Calculate how long this should take
        const words = text.split(/\s+/).length;
        const duration = Math.max(
            CONFIG.minTtsDuration,
            Math.min(words / CONFIG.ttsWordsPerSecond * 1000, CONFIG.maxTtsDuration)
        );

        // Always use timeout as backup
        ttsTimer = setTimeout(function() {
            console.log('🔊 TTS timer done');
            finishSpeaking(callback);
        }, duration);

        // Try Web Speech API
        if (synthesis) {
            try {
                synthesis.cancel(); // Clear queue
                
                currentUtterance = new SpeechSynthesisUtterance(text);
                currentUtterance.rate = CONFIG.ttsRate;
                currentUtterance.pitch = CONFIG.ttsPitch;
                
                // Try to find English voice
                const voices = synthesis.getVoices();
                const englishVoice = voices.find(v => v.lang.startsWith('en'));
                if (englishVoice) {
                    currentUtterance.voice = englishVoice;
                }

                currentUtterance.onend = function() {
                    console.log('🔊 TTS onend fired');
                    clearTimeout(ttsTimer);
                    finishSpeaking(callback);
                };

                currentUtterance.onerror = function(e) {
                    console.log('🔊 TTS error:', e.error);
                    // Timer will handle it
                };

                synthesis.speak(currentUtterance);
                
            } catch (e) {
                console.log('TTS error:', e);
                // Timer will handle it
            }
        }
    }

    function finishSpeaking(callback) {
        if (!state.isSpeaking) return; // Already finished
        
        state.isSpeaking = false;
        clearTimeout(ttsTimer);
        
        if (callback) {
            setTimeout(callback, 200);
        }
    }

    function stopSpeaking() {
        clearTimeout(ttsTimer);
        state.isSpeaking = false;
        
        if (synthesis) {
            try { synthesis.cancel(); } catch(e) {}
        }
        currentUtterance = null;
    }

    // ============ UI UPDATES ============
    function updateTranscript(text, interim) {
        if (dom.transcript) {
            dom.transcript.textContent = text || 'Listening...';
            dom.transcript.classList.toggle('interim', interim);
        }
    }

    function showSuggestions(show) {
        if (dom.suggestions) {
            dom.suggestions.style.display = show ? 'block' : 'none';
        }
    }

    function setAvatar(className) {
        if (dom.avatar) {
            dom.avatar.className = 'suzi-avatar ' + className;
        }
    }

    function setStatus(icon, text, subtext) {
        if (dom.icon) dom.icon.textContent = icon;
        if (dom.status) dom.status.textContent = text;
        if (dom.substatus) dom.substatus.textContent = subtext || '';
    }

    function setWaveform(active) {
        if (dom.waveform) {
            dom.waveform.classList.toggle('active', active);
        }
    }

    function showGreeting() {
        setAvatar('speaking');
        setStatus('👋', 'Hi!', "I'm Suzi");
        setWaveform(true);
    }

    function showListening() {
        setAvatar('listening');
        setStatus('🎤', 'Listening...', 'Speak now');
        setWaveform(true);
        if (dom.micBtn) dom.micBtn.classList.add('listening');
    }

    function showSpeaking() {
        setAvatar('speaking');
        setStatus('💬', 'Speaking...', '');
        setWaveform(true);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function showThinking() {
        setAvatar('thinking');
        setStatus('🤔', 'Thinking...', '');
        setWaveform(false);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function showSuccess(title, subtitle) {
        setAvatar('success');
        setStatus('✅', title, subtitle);
        setWaveform(false);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function showError(title, subtitle) {
        setAvatar('error');
        setStatus('❌', title, subtitle);
        setWaveform(false);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    // ============ PUBLIC API ============
    window.Suzi = {
        open: open,
        close: close,
        speak: speak,
        suggestion: function(text) {
            if (state.isOpen && !state.isListening && !state.isSpeaking && !state.isProcessing) {
                updateTranscript(text, false);
                showSuggestions(false);
                processCommand(text);
            }
        }
    };

    // Alias
    window.SuziVoiceAssistant = {
        getInstance: function() { return window.Suzi; },
        open: open,
        close: close
    };

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
