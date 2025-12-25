/**
 * SUZI VOICE ASSISTANT v8.0
 * Matches Android VoiceAssistantBridge.kt callbacks exactly
 */

(function() {
    'use strict';

    console.log('🎤 Suzi v8.0 loading...');

    // ============ CONFIG ============
    const CONFIG = {
        stopWords: ['stop', 'bye', 'goodbye', 'cancel', 'close', 'exit', 'quit'],
        restartDelay: 800
    };

    // ============ STATE ============
    let state = {
        isOpen: false,
        isListening: false,
        isSpeaking: false,
        isProcessing: false
    };

    let conversation = [];
    let dom = {};
    let isNative = false;

    // ============ DOM ============
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
            tapBtn: document.getElementById('suziTapToSpeak')
        };
    }

    // ============ INIT ============
    function init() {
        console.log('🚀 Suzi v8.0 init');
        
        // Check for native Android bridge
        isNative = !!(window.AndroidVoice && typeof window.AndroidVoice.startListening === 'function');
        console.log('📱 Native mode:', isNative);
        
        cacheDom();
        setupEvents();
        
        console.log('✅ Suzi ready');
    }

    function setupEvents() {
        if (dom.micBtn) dom.micBtn.onclick = openModal;
        if (dom.closeBtn) dom.closeBtn.onclick = closeModal;
        if (dom.overlay) dom.overlay.onclick = closeModal;
        if (dom.tapBtn) dom.tapBtn.onclick = function() {
            if (!state.isListening && !state.isSpeaking && !state.isProcessing) {
                startListening();
            }
        };
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && state.isOpen) closeModal();
        });
    }

    // ============ MODAL ============
    function openModal() {
        if (state.isOpen) return;
        console.log('📱 Open modal');
        
        state.isOpen = true;
        state.isListening = false;
        state.isSpeaking = false;
        state.isProcessing = false;
        conversation = [];

        if (dom.modal) {
            dom.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        if (dom.micBtn) dom.micBtn.classList.add('active');

        showUI('greeting');
        updateTranscript('');
        showSuggestions(true);

        // Greet then listen
        var greetings = ["Hi! How can I help?", "Hey! What can I do?", "Hello!"];
        var g = greetings[Math.floor(Math.random() * greetings.length)];
        
        speak(g);
    }

    function closeModal() {
        if (!state.isOpen) return;
        console.log('📱 Close modal');

        stopListening();
        stopSpeaking();

        state.isOpen = false;
        state.isListening = false;
        state.isSpeaking = false;
        state.isProcessing = false;

        if (dom.modal) {
            dom.modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        if (dom.micBtn) dom.micBtn.classList.remove('active', 'listening');
    }

    // ============ LISTENING ============
    function startListening() {
        if (!state.isOpen || state.isListening || state.isSpeaking || state.isProcessing) {
            console.log('❌ Cannot start listening:', JSON.stringify(state));
            return;
        }

        console.log('🎤 Start listening');

        if (isNative) {
            try {
                window.AndroidVoice.startListening();
                console.log('📱 AndroidVoice.startListening() called');
            } catch (e) {
                console.error('📱 Error:', e);
                showUI('error', 'Mic error', 'Try again');
            }
        } else {
            // Web fallback
            startWebListening();
        }
    }

    function stopListening() {
        console.log('🛑 Stop listening');
        state.isListening = false;
        
        if (isNative) {
            try {
                if (window.AndroidVoice && window.AndroidVoice.stopListening) {
                    window.AndroidVoice.stopListening();
                }
            } catch (e) {}
        }
        
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function scheduleRestart() {
        if (!state.isOpen || state.isSpeaking || state.isProcessing || state.isListening) {
            return;
        }
        console.log('🔄 Schedule restart');
        setTimeout(function() {
            if (state.isOpen && !state.isSpeaking && !state.isProcessing && !state.isListening) {
                startListening();
            }
        }, CONFIG.restartDelay);
    }

    // ============ WEB SPEECH FALLBACK ============
    var webRecognition = null;

    function startWebListening() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            showUI('error', 'Not supported', 'Use Chrome');
            return;
        }

        try {
            if (webRecognition) {
                webRecognition.abort();
            }
            
            webRecognition = new SR();
            webRecognition.lang = 'en-US';
            webRecognition.continuous = false;
            webRecognition.interimResults = true;

            webRecognition.onstart = function() {
                console.log('🌐 Web listening started');
                state.isListening = true;
                showUI('listening');
            };

            webRecognition.onresult = function(e) {
                var final = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) {
                        final += e.results[i][0].transcript;
                    }
                }
                if (final) {
                    console.log('🌐 Web result:', final);
                    state.isListening = false;
                    handleTranscript(final.trim());
                }
            };

            webRecognition.onerror = function(e) {
                console.log('🌐 Web error:', e.error);
                state.isListening = false;
                if (e.error !== 'aborted' && e.error !== 'no-speech') {
                    scheduleRestart();
                } else if (e.error === 'no-speech') {
                    scheduleRestart();
                }
            };

            webRecognition.onend = function() {
                console.log('🌐 Web ended');
                state.isListening = false;
                if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
                    scheduleRestart();
                }
            };

            webRecognition.start();
            state.isListening = true;
            showUI('listening');
            
        } catch (e) {
            console.error('🌐 Web start error:', e);
            showUI('error', 'Mic error', 'Try again');
        }
    }

    // ============ NATIVE CALLBACKS (called by Android) ============
    
    function onNativeListeningStart() {
        console.log('📱 CB: ListeningStart');
        state.isListening = true;
        showUI('listening');
    }

    function onNativeListeningStop() {
        console.log('📱 CB: ListeningStop');
        state.isListening = false;
        if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
            scheduleRestart();
        }
    }

    function onNativeTranscript(text) {
        console.log('📱 CB: Transcript:', text);
        state.isListening = false;
        if (text && text.trim()) {
            handleTranscript(text.trim());
        } else {
            scheduleRestart();
        }
    }

    function onNativeError(code, message) {
        console.log('📱 CB: Error:', code, message);
        state.isListening = false;
        
        if (code === 'not-allowed') {
            showUI('error', 'Mic blocked', 'Check permissions');
        } else if (code === 'no-speech' || code === 'no-match') {
            scheduleRestart();
        } else {
            scheduleRestart();
        }
    }

    function onNativeSpeakStart() {
        console.log('📱 CB: SpeakStart');
        state.isSpeaking = true;
        showUI('speaking');
    }

    function onNativeSpeakDone() {
        console.log('📱 CB: SpeakDone');
        state.isSpeaking = false;
        
        // After speaking, start listening
        if (state.isOpen && !state.isProcessing) {
            setTimeout(function() {
                startListening();
            }, 300);
        }
    }

    // ============ TRANSCRIPT HANDLING ============
    function handleTranscript(text) {
        if (!text || !state.isOpen) return;
        
        console.log('💬 Handle:', text);
        updateTranscript(text);
        showSuggestions(false);

        // Check stop words
        var lower = text.toLowerCase();
        for (var i = 0; i < CONFIG.stopWords.length; i++) {
            if (lower.indexOf(CONFIG.stopWords[i]) >= 0) {
                sayGoodbye();
                return;
            }
        }

        processCommand(text);
    }

    function sayGoodbye() {
        var byes = ["Goodbye!", "Bye!", "See you!"];
        var b = byes[Math.floor(Math.random() * byes.length)];
        showUI('success', 'Goodbye!', b);
        speak(b, function() {
            setTimeout(closeModal, 500);
        });
    }

    // ============ TTS ============
    var ttsCallback = null;

    function speak(text, callback) {
        if (!text) {
            if (callback) callback();
            return;
        }

        console.log('🔊 Speak:', text);
        stopSpeaking();
        
        state.isSpeaking = true;
        ttsCallback = callback;
        showUI('speaking');

        if (isNative && window.AndroidVoice && window.AndroidVoice.speak) {
            try {
                window.AndroidVoice.speak(text);
                console.log('📱 AndroidVoice.speak() called');
                // Android will call onNativeSpeakDone when finished
            } catch (e) {
                console.error('📱 Speak error:', e);
                finishSpeaking();
            }
        } else {
            // Web TTS fallback
            webSpeak(text);
        }
    }

    function webSpeak(text) {
        var synth = window.speechSynthesis;
        if (!synth) {
            finishSpeaking();
            return;
        }

        try {
            synth.cancel();
            var utt = new SpeechSynthesisUtterance(text);
            utt.rate = 1.0;
            utt.onend = function() {
                console.log('🌐 Web TTS done');
                finishSpeaking();
            };
            utt.onerror = function() {
                console.log('🌐 Web TTS error');
                finishSpeaking();
            };
            synth.speak(utt);
        } catch (e) {
            finishSpeaking();
        }
    }

    function finishSpeaking() {
        console.log('🔊 Finish speaking');
        state.isSpeaking = false;
        
        var cb = ttsCallback;
        ttsCallback = null;
        
        if (cb) {
            setTimeout(cb, 200);
        } else if (state.isOpen && !state.isProcessing) {
            setTimeout(startListening, 300);
        }
    }

    function stopSpeaking() {
        state.isSpeaking = false;
        ttsCallback = null;
        
        if (isNative && window.AndroidVoice && window.AndroidVoice.stopSpeaking) {
            try { window.AndroidVoice.stopSpeaking(); } catch(e) {}
        }
        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch(e) {}
        }
    }

    // ============ COMMAND PROCESSING ============
    function processCommand(cmd) {
        console.log('⚙️ Process:', cmd);
        state.isProcessing = true;
        showUI('thinking');

        fetch('/api/voice-intent.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: cmd,
                page: window.location.pathname,
                conversation: conversation
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            console.log('🤖 Response:', data);
            
            if (!data || !data.intent) {
                throw new Error('Bad response');
            }

            conversation.push({ role: 'user', content: cmd });
            conversation.push({ role: 'assistant', content: data.response_text });
            if (conversation.length > 10) conversation = conversation.slice(-10);

            handleIntent(data);
        })
        .catch(function(err) {
            console.error('❌ Error:', err);
            showUI('error', 'Oops', 'Something went wrong');
            speak("Sorry, try again?", function() {
                state.isProcessing = false;
                scheduleRestart();
            });
        });
    }

    function handleIntent(data) {
        var intent = data.intent;
        var slots = data.slots || {};
        var response = data.response_text;

        console.log('🎯 Intent:', intent);
        showUI('success', 'Got it!', response);

        var navIntents = [
            'navigate', 'add_shopping_item', 'create_event', 'create_schedule',
            'create_note', 'view_shopping', 'show_calendar', 'show_schedule',
            'show_location', 'find_member', 'read_messages', 'check_notifications',
            'get_weather_today', 'get_weather_tomorrow', 'get_weather_week'
        ];
        
        var willNav = navIntents.indexOf(intent) >= 0;

        speak(response, function() {
            state.isProcessing = false;
            if (willNav) {
                doAction(intent, slots);
            } else {
                scheduleRestart();
            }
        });

        if (!willNav && intent !== 'smalltalk') {
            doAction(intent, slots);
        }
    }

    function doAction(intent, slots) {
        var paths = {
            home: '/home/', shopping: '/shopping/', notes: '/notes/',
            calendar: '/calendar/', schedule: '/schedule/', weather: '/weather/',
            messages: '/messages/', tracking: '/tracking/', notifications: '/notifications/'
        };

        switch (intent) {
            case 'navigate':
                goTo(paths[slots.destination] || '/home/');
                break;
            case 'add_shopping_item':
                addShopping(slots.item, slots.quantity, slots.category);
                break;
            case 'view_shopping':
                goTo('/shopping/');
                break;
            case 'create_note':
                var nUrl = '/notes/?new=1';
                if (slots.content) nUrl += '&content=' + encodeURIComponent(slots.content);
                goTo(nUrl);
                break;
            case 'create_event':
                var eUrl = '/calendar/?new=1';
                if (slots.title) eUrl += '&title=' + encodeURIComponent(slots.title);
                goTo(eUrl);
                break;
            case 'create_schedule':
                var sUrl = '/schedule/?new=1';
                if (slots.title) sUrl += '&title=' + encodeURIComponent(slots.title);
                goTo(sUrl);
                break;
            case 'show_calendar':
                goTo('/calendar/');
                break;
            case 'show_schedule':
                goTo('/schedule/');
                break;
            case 'get_weather_today':
            case 'get_weather_tomorrow':
            case 'get_weather_week':
                goTo('/weather/');
                break;
            case 'read_messages':
                goTo('/messages/');
                break;
            case 'show_location':
            case 'find_member':
                goTo('/tracking/');
                break;
            case 'check_notifications':
                goTo('/notifications/');
                break;
        }
    }

    function goTo(url) {
        setTimeout(function() {
            closeModal();
            window.location.href = url;
        }, 1500);
    }

    function addShopping(item, qty, cat) {
        if (!item) return;
        var fd = new FormData();
        fd.append('action', 'add');
        fd.append('name', item);
        fd.append('qty', qty || '');
        fd.append('category', cat || 'other');
        fetch('/shopping/api/items.php', { method: 'POST', body: fd })
            .then(function() { goTo('/shopping/'); })
            .catch(function() {});
    }

    // ============ UI ============
    function updateTranscript(t) {
        if (dom.transcript) {
            dom.transcript.textContent = t || 'Listening...';
        }
    }

    function showSuggestions(show) {
        if (dom.suggestions) dom.suggestions.style.display = show ? 'block' : 'none';
    }

    function showUI(mode, title, subtitle) {
        if (!dom.avatar) return;

        dom.avatar.className = 'suzi-avatar ' + mode;
        
        var icons = { greeting: '👋', listening: '🎤', speaking: '💬', thinking: '🤔', success: '✅', error: '❌' };
        var titles = { greeting: 'Hi!', listening: 'Listening...', speaking: 'Speaking...', thinking: 'Thinking...', success: 'Got it!', error: 'Error' };
        var subs = { greeting: "I'm Suzi", listening: 'Speak now', speaking: '', thinking: '', success: '', error: 'Try again' };

        if (dom.icon) dom.icon.textContent = icons[mode] || '🎤';
        if (dom.status) dom.status.textContent = title || titles[mode] || '';
        if (dom.substatus) dom.substatus.textContent = subtitle || subs[mode] || '';
        
        if (dom.waveform) {
            dom.waveform.classList.toggle('active', mode === 'listening' || mode === 'speaking' || mode === 'greeting');
        }
        
        if (dom.micBtn) {
            dom.micBtn.classList.toggle('listening', mode === 'listening');
        }
    }

    // ============ PUBLIC API ============
    
    // Main public API
    window.Suzi = {
        open: openModal,
        close: closeModal,
        suggestion: function(text) {
            if (state.isOpen && !state.isListening && !state.isSpeaking && !state.isProcessing) {
                updateTranscript(text);
                showSuggestions(false);
                processCommand(text);
            }
        }
    };

    // Android callback interface - THIS IS WHAT ANDROID CALLS
    window.AdvancedVoiceAssistant = {
        onNativeListeningStart: onNativeListeningStart,
        onNativeListeningStop: onNativeListeningStop,
        onNativeTranscript: onNativeTranscript,
        onNativeError: onNativeError,
        onNativeSpeakStart: onNativeSpeakStart,
        onNativeSpeakDone: onNativeSpeakDone
    };

    // Alias
    window.SuziVoiceAssistant = window.AdvancedVoiceAssistant;

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ Suzi v8.0 loaded');

})();
