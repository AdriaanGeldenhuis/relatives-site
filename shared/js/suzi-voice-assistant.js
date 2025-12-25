/**
 * SUZI VOICE ASSISTANT v7.2
 * Full Native Android Support
 */

(function() {
    'use strict';

    console.log('🎤 Suzi v7.2 loading...');

    // ============ CONFIG ============
    const CONFIG = {
        lang: 'en-US',
        listenTimeout: 10000,
        ttsWordsPerSec: 2.5,
        minTtsDuration: 1500,
        maxTtsDuration: 12000,
        restartDelay: 800,
        stopWords: ['stop', 'bye', 'goodbye', 'cancel', 'close', 'exit', 'quit']
    };

    // ============ STATE ============
    let isNativeApp = false;
    let state = {
        isOpen: false,
        isListening: false,
        isSpeaking: false,
        isProcessing: false
    };

    let recognition = null;
    let synthesis = window.speechSynthesis;
    let listenTimer = null;
    let ttsTimer = null;
    let conversation = [];
    let dom = {};

    // ============ NATIVE APP CHECK ============
    function checkNativeApp() {
        isNativeApp = !!(window.AndroidVoice && typeof window.AndroidVoice.startListening === 'function');
        console.log('🔍 Native app check:', isNativeApp);
        return isNativeApp;
    }

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
        console.log('📦 DOM cached');
    }

    // ============ INIT ============
    function init() {
        console.log('🚀 Suzi init starting...');
        
        checkNativeApp();
        cacheDom();
        
        if (!isNativeApp) {
            setupWebRecognition();
        }
        
        setupEvents();
        
        console.log('✅ Suzi v7.2 ready!');
        console.log('📱 isNativeApp:', isNativeApp);
    }

    function setupWebRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            console.warn('❌ No web speech recognition');
            return;
        }

        recognition = new SR();
        recognition.lang = CONFIG.lang;
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = function() {
            console.log('🌐 Web recognition started');
            state.isListening = true;
            showListening();
        };

        recognition.onresult = function(e) {
            let final = '', interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                    final += e.results[i][0].transcript;
                } else {
                    interim += e.results[i][0].transcript;
                }
            }
            if (interim) updateTranscript(interim, true);
            if (final) {
                console.log('🌐 Web final transcript:', final);
                clearTimeout(listenTimer);
                state.isListening = false;
                handleSpeech(final.trim());
            }
        };

        recognition.onerror = function(e) {
            console.log('🌐 Web error:', e.error);
            state.isListening = false;
            if (e.error === 'not-allowed') {
                showError('Mic blocked', 'Allow microphone');
            } else if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
                scheduleRestart();
            }
        };

        recognition.onend = function() {
            console.log('🌐 Web recognition ended');
            state.isListening = false;
            if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
                scheduleRestart();
            }
        };
        
        console.log('🌐 Web recognition setup done');
    }

    function setupEvents() {
        if (dom.micBtn) {
            dom.micBtn.onclick = openModal;
            console.log('🔘 Mic button bound');
        }
        if (dom.closeBtn) dom.closeBtn.onclick = closeModal;
        if (dom.overlay) dom.overlay.onclick = closeModal;
        if (dom.tapBtn) {
            dom.tapBtn.onclick = function() {
                console.log('👆 Tap to speak pressed');
                if (!state.isListening && !state.isSpeaking && !state.isProcessing) {
                    startListening();
                }
            };
        }
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && state.isOpen) closeModal();
        });
    }

    // ============ MODAL ============
    function openModal() {
        if (state.isOpen) return;
        console.log('📱 Opening modal...');
        
        state.isOpen = true;
        conversation = [];

        if (dom.modal) {
            dom.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        if (dom.micBtn) dom.micBtn.classList.add('active');

        showGreeting();
        updateTranscript('');
        showSuggestions(true);

        const greetings = ["Hi! How can I help?", "Hey! What can I do?", "Hello!"];
        const g = greetings[Math.floor(Math.random() * greetings.length)];

        speak(g, function() {
            console.log('🔊 Greeting done, starting listen...');
            startListening();
        });
    }

    function closeModal() {
        if (!state.isOpen) return;
        console.log('📱 Closing modal');

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
        if (dom.micBtn) dom.micBtn.classList.remove('active', 'listening');
    }

    // ============ LISTENING ============
    function startListening() {
        console.log('🎤 startListening called');
        console.log('   state:', JSON.stringify(state));
        
        if (!state.isOpen) {
            console.log('   ❌ Modal not open');
            return;
        }
        if (state.isListening) {
            console.log('   ❌ Already listening');
            return;
        }
        if (state.isSpeaking) {
            console.log('   ❌ Still speaking');
            return;
        }
        if (state.isProcessing) {
            console.log('   ❌ Still processing');
            return;
        }

        clearTimeout(listenTimer);
        showListening();

        if (isNativeApp) {
            console.log('📱 Calling AndroidVoice.startListening()...');
            try {
                window.AndroidVoice.startListening();
                state.isListening = true;
                console.log('📱 ✅ AndroidVoice.startListening() called');
            } catch (e) {
                console.error('📱 ❌ AndroidVoice error:', e);
                showError('Mic error', 'Try again');
            }
        } else {
            console.log('🌐 Starting web recognition...');
            if (!recognition) {
                showError('Not supported', 'Use Chrome');
                return;
            }
            try {
                recognition.start();
                console.log('🌐 ✅ recognition.start() called');
            } catch (e) {
                console.log('🌐 Start error:', e.name);
                if (e.name === 'InvalidStateError') {
                    try { recognition.stop(); } catch(e2) {}
                    setTimeout(startListening, 300);
                }
            }
        }

        // Safety timeout
        listenTimer = setTimeout(function() {
            console.log('⏰ Listen timeout fired');
            if (state.isListening) {
                stopListening();
                if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
                    scheduleRestart();
                }
            }
        }, CONFIG.listenTimeout);
    }

    function stopListening() {
        console.log('🛑 stopListening called');
        clearTimeout(listenTimer);

        if (isNativeApp) {
            try {
                if (window.AndroidVoice && window.AndroidVoice.stopListening) {
                    window.AndroidVoice.stopListening();
                }
            } catch (e) {}
        } else {
            if (recognition) {
                try { recognition.abort(); } catch (e) {}
            }
        }

        state.isListening = false;
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function scheduleRestart() {
        console.log('🔄 scheduleRestart called');
        clearTimeout(listenTimer);
        
        if (!state.isOpen || state.isSpeaking || state.isProcessing) {
            console.log('   ❌ Cannot restart:', { isOpen: state.isOpen, isSpeaking: state.isSpeaking, isProcessing: state.isProcessing });
            return;
        }

        listenTimer = setTimeout(function() {
            console.log('🔄 Restart timer fired');
            if (state.isOpen && !state.isSpeaking && !state.isProcessing && !state.isListening) {
                startListening();
            }
        }, CONFIG.restartDelay);
    }

    // ============ NATIVE CALLBACKS ============
    // Called by Android WebView
    
    function nativeListeningStart() {
        console.log('📱 NATIVE CALLBACK: ListeningStart');
        state.isListening = true;
        showListening();
    }

    function nativeListeningStop() {
        console.log('📱 NATIVE CALLBACK: ListeningStop');
        state.isListening = false;
        if (state.isOpen && !state.isSpeaking && !state.isProcessing) {
            scheduleRestart();
        }
    }

    function nativeTranscript(text) {
        console.log('📱 NATIVE CALLBACK: Transcript received:', text);
        clearTimeout(listenTimer);
        state.isListening = false;
        
        if (text && text.trim()) {
            handleSpeech(text.trim());
        } else {
            console.log('📱 Empty transcript, restarting...');
            scheduleRestart();
        }
    }

    function nativeError(code, message) {
        console.log('📱 NATIVE CALLBACK: Error:', code, message);
        state.isListening = false;

        if (code === 'not-allowed') {
            showError('Mic blocked', 'Check permissions');
        } else {
            scheduleRestart();
        }
    }

    // ============ SPEECH HANDLING ============
    function handleSpeech(text) {
        console.log('💬 handleSpeech:', text);
        
        if (!text) {
            console.log('   Empty text, restarting');
            scheduleRestart();
            return;
        }

        updateTranscript(text, false);
        showSuggestions(false);

        // Check stop words
        const lower = text.toLowerCase();
        for (let w of CONFIG.stopWords) {
            if (lower.includes(w)) {
                console.log('   Stop word detected:', w);
                sayGoodbye();
                return;
            }
        }

        processCommand(text);
    }

    function sayGoodbye() {
        const byes = ["Goodbye!", "Bye!", "See you!", "Take care!"];
        const b = byes[Math.floor(Math.random() * byes.length)];
        showSuccess('Goodbye!', b);
        speak(b, function() {
            setTimeout(closeModal, 300);
        });
    }

    // ============ COMMAND PROCESSING ============
    async function processCommand(cmd) {
        console.log('⚙️ processCommand:', cmd);
        state.isProcessing = true;
        showThinking();

        try {
            const resp = await fetch('/api/voice-intent.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: cmd,
                    page: window.location.pathname,
                    conversation: conversation
                })
            });

            const data = await resp.json();
            console.log('🤖 API response:', data);

            if (!data || !data.intent) throw new Error('Bad response');

            conversation.push({ role: 'user', content: cmd });
            conversation.push({ role: 'assistant', content: data.response_text });
            if (conversation.length > 10) conversation = conversation.slice(-10);

            await handleIntent(data);

        } catch (err) {
            console.error('❌ Process error:', err);
            showError('Oops', 'Something went wrong');
            speak("Sorry, try again?", function() {
                state.isProcessing = false;
                scheduleRestart();
            });
        }
    }

    async function handleIntent(data) {
        const { intent, slots = {}, response_text } = data;
        console.log('🎯 handleIntent:', intent, slots);
        
        showSuccess('Got it!', response_text);

        const navIntents = [
            'navigate', 'add_shopping_item', 'create_event', 'create_schedule',
            'create_note', 'view_shopping', 'show_calendar', 'show_schedule',
            'show_location', 'find_member', 'read_messages', 'check_notifications',
            'get_weather_today', 'get_weather_tomorrow', 'get_weather_week'
        ];
        const willNav = navIntents.includes(intent);

        speak(response_text, function() {
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
        console.log('🚀 doAction:', intent);
        
        const paths = {
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
                let nUrl = '/notes/?new=1';
                if (slots.content) nUrl += '&content=' + encodeURIComponent(slots.content);
                goTo(nUrl);
                break;
            case 'create_event':
                let eUrl = '/calendar/?new=1';
                if (slots.title) eUrl += '&title=' + encodeURIComponent(slots.title);
                if (slots.date) eUrl += '&date=' + fmtDate(slots.date);
                if (slots.time) eUrl += '&time=' + slots.time;
                goTo(eUrl);
                break;
            case 'create_schedule':
                let sUrl = '/schedule/?new=1';
                if (slots.title) sUrl += '&title=' + encodeURIComponent(slots.title);
                if (slots.date) sUrl += '&date=' + fmtDate(slots.date);
                if (slots.time) sUrl += '&time=' + slots.time;
                goTo(sUrl);
                break;
            case 'show_calendar':
                goTo('/calendar/?date=' + fmtDate(slots.date || 'today'));
                break;
            case 'show_schedule':
                goTo('/schedule/?date=' + fmtDate(slots.date || 'today'));
                break;
            case 'get_weather_today':
            case 'get_weather_tomorrow':
            case 'get_weather_week':
                goTo('/weather/');
                break;
            case 'send_message':
                sendMsg(slots.content);
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
        }
    }

    function goTo(url) {
        console.log('🧭 Navigating to:', url);
        setTimeout(function() {
            closeModal();
            window.location.href = url;
        }, 1500);
    }

    function fmtDate(s) {
        if (!s) return new Date().toISOString().split('T')[0];
        const d = new Date();
        const l = (s + '').toLowerCase();
        if (l === 'today') return d.toISOString().split('T')[0];
        if (l === 'tomorrow') {
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return new Date().toISOString().split('T')[0];
    }

    async function addShopping(item, qty, cat) {
        if (!item) return;
        try {
            const fd = new FormData();
            fd.append('action', 'add');
            fd.append('name', item);
            fd.append('qty', qty || '');
            fd.append('category', cat || 'other');
            await fetch('/shopping/api/items.php', { method: 'POST', body: fd });
            goTo('/shopping/');
        } catch (e) { console.error('addShopping error:', e); }
    }

    async function sendMsg(content) {
        if (!content) return;
        try {
            const fd = new FormData();
            fd.append('content', content);
            fd.append('to_family', '1');
            await fetch('/messages/api/send.php', { method: 'POST', body: fd });
        } catch (e) { console.error('sendMsg error:', e); }
    }

    // ============ TTS ============
    function speak(text, callback) {
        console.log('🔊 speak:', text);
        
        if (!text) {
            if (callback) callback();
            return;
        }

        stopSpeaking();
        stopListening();

        state.isSpeaking = true;
        showSpeaking();

        // Duration calc
        const words = text.split(/\s+/).length;
        const duration = Math.max(CONFIG.minTtsDuration, Math.min(words / CONFIG.ttsWordsPerSec * 1000, CONFIG.maxTtsDuration));
        console.log('🔊 Duration:', duration, 'ms');

        // Fallback timer
        ttsTimer = setTimeout(function() {
            console.log('🔊 TTS timer callback');
            finishSpeaking(callback);
        }, duration);

        // Native TTS
        if (isNativeApp && window.AndroidVoice && window.AndroidVoice.speak) {
            try {
                console.log('📱 Using native TTS');
                window.AndroidVoice.speak(text);
                return;
            } catch (e) {
                console.error('📱 Native TTS error:', e);
            }
        }

        // Web TTS
        if (synthesis) {
            try {
                console.log('🌐 Using web TTS');
                synthesis.cancel();
                const utt = new SpeechSynthesisUtterance(text);
                utt.rate = 1.0;
                utt.pitch = 1.0;
                
                const voices = synthesis.getVoices();
                const voice = voices.find(v => v.lang.startsWith('en'));
                if (voice) utt.voice = voice;

                utt.onend = function() {
                    console.log('🌐 TTS onend');
                    clearTimeout(ttsTimer);
                    finishSpeaking(callback);
                };

                synthesis.speak(utt);
            } catch (e) {
                console.log('🌐 TTS error:', e);
            }
        }
    }

    function finishSpeaking(callback) {
        console.log('🔊 finishSpeaking');
        if (!state.isSpeaking) {
            console.log('   Already finished');
            return;
        }
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
            try { synthesis.cancel(); } catch (e) {}
        }
    }

    // ============ UI ============
    function updateTranscript(t, interim) {
        if (dom.transcript) {
            dom.transcript.textContent = t || 'Listening...';
            dom.transcript.classList.toggle('interim', interim);
        }
    }

    function showSuggestions(show) {
        if (dom.suggestions) dom.suggestions.style.display = show ? 'block' : 'none';
    }

    function setAvatar(cls) {
        if (dom.avatar) dom.avatar.className = 'suzi-avatar ' + cls;
    }

    function setStatus(icon, text, sub) {
        if (dom.icon) dom.icon.textContent = icon;
        if (dom.status) dom.status.textContent = text;
        if (dom.substatus) dom.substatus.textContent = sub || '';
    }

    function setWave(on) {
        if (dom.waveform) dom.waveform.classList.toggle('active', on);
    }

    function showGreeting() {
        setAvatar('speaking');
        setStatus('👋', 'Hi!', "I'm Suzi");
        setWave(true);
    }

    function showListening() {
        setAvatar('listening');
        setStatus('🎤', 'Listening...', 'Speak now');
        setWave(true);
        if (dom.micBtn) dom.micBtn.classList.add('listening');
    }

    function showSpeaking() {
        setAvatar('speaking');
        setStatus('💬', 'Speaking...', '');
        setWave(true);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function showThinking() {
        setAvatar('thinking');
        setStatus('🤔', 'Thinking...', '');
        setWave(false);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function showSuccess(title, sub) {
        setAvatar('success');
        setStatus('✅', title, sub);
        setWave(false);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    function showError(title, sub) {
        setAvatar('error');
        setStatus('❌', title, sub);
        setWave(false);
        if (dom.micBtn) dom.micBtn.classList.remove('listening');
    }

    // ============ EXPOSE EVERYTHING GLOBALLY ============
    
    // Main API
    window.Suzi = {
        open: openModal,
        close: closeModal,
        speak: speak,
        handleSpeech: handleSpeech,
        suggestion: function(text) {
            console.log('💡 Suggestion clicked:', text);
            if (state.isOpen && !state.isListening && !state.isSpeaking && !state.isProcessing) {
                updateTranscript(text, false);
                showSuggestions(false);
                processCommand(text);
            }
        }
    };

    // For native callbacks - AdvancedVoiceAssistant (original name)
    window.AdvancedVoiceAssistant = {
        instance: null,
        getInstance: function() { 
            if (!this.instance) this.instance = this;
            return this; 
        },
        openModal: openModal,
        closeModal: closeModal,
        open: openModal,
        close: closeModal,
        // Static-style callbacks that Android calls
        onNativeListeningStart: nativeListeningStart,
        onNativeListeningStop: nativeListeningStop,
        onNativeTranscript: nativeTranscript,
        onNativeError: nativeError,
        // Instance method style
        handleTranscript: handleSpeech
    };

    // Also as SuziVoiceAssistant
    window.SuziVoiceAssistant = window.AdvancedVoiceAssistant;

    // Direct global functions (in case Android calls these directly)
    window.onNativeListeningStart = nativeListeningStart;
    window.onNativeListeningStop = nativeListeningStop;
    window.onNativeTranscript = nativeTranscript;
    window.onNativeError = nativeError;
    window.onVoiceResult = nativeTranscript; // Common alternative name
    window.onSpeechResult = nativeTranscript; // Another alternative

    // Debug helper
    window.SuziDebug = {
        state: function() { return state; },
        isNative: function() { return isNativeApp; },
        testTranscript: function(t) { 
            console.log('🧪 TEST: Simulating transcript:', t);
            nativeTranscript(t); 
        },
        testSpeech: function(t) {
            console.log('🧪 TEST: Simulating speech:', t);
            handleSpeech(t);
        }
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎤 Suzi v7.2 script loaded');

})();
