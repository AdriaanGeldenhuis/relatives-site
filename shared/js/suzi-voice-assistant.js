/**
 * ============================================
 * SUZI VOICE ASSISTANT v6.0
 * Alexa-like Continuous Conversation Mode
 * ============================================
 * 
 * Features:
 * - Continuous listening after each response
 * - Only stops on "stop", "bye", "goodbye", "cancel"
 * - Smooth animations and visual feedback
 * - Works with native Android and web browser
 * - Full integration with all app areas
 */

class SuziVoiceAssistant {
    static instance = null;

    static getInstance() {
        if (!SuziVoiceAssistant.instance) {
            SuziVoiceAssistant.instance = new SuziVoiceAssistant();
        }
        return SuziVoiceAssistant.instance;
    }

    constructor() {
        if (SuziVoiceAssistant.instance) {
            return SuziVoiceAssistant.instance;
        }

        console.log('🎤 Suzi v6.0 - Initializing...');

        // Platform detection
        this.isNativeApp = !!(window.AndroidVoice && typeof window.AndroidVoice.startListening === 'function');

        // Speech APIs
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.preferredVoice = null;

        // State management
        this.state = {
            modalOpen: false,
            isListening: false,
            isSpeaking: false,
            isProcessing: false,
            isReady: false,
            permissionGranted: false,
            consecutiveErrors: 0,
            maxConsecutiveErrors: 3
        };

        // Conversation
        this.conversation = [];
        this.maxHistory = 6;

        // Duplicate prevention
        this.lastTranscript = '';
        this.lastProcessTime = 0;
        this.cooldown = 1500;

        // Stop words that end the conversation
        this.stopWords = ['stop', 'bye', 'goodbye', 'cancel', 'close', 'quit', 'exit', 'never mind', 'nevermind'];

        // DOM elements
        this.dom = {};

        // Timers
        this.restartTimer = null;
        this.silenceTimer = null;

        SuziVoiceAssistant.instance = this;
    }

    // ==================== INITIALIZATION ====================

    init() {
        this.cacheDOMElements();
        this.preloadVoices();
        
        if (this.isNativeApp) {
            console.log('📱 Native Android mode');
            this.state.isReady = true;
        } else {
            console.log('🌐 Web browser mode');
            this.setupRecognition();
        }

        this.attachEventListeners();
        console.log('✅ Suzi v6.0 Ready!');
    }

    cacheDOMElements() {
        this.dom = {
            modal: document.getElementById('suziModal'),
            overlay: document.getElementById('suziOverlay'),
            content: document.getElementById('suziContent'),
            avatar: document.getElementById('suziAvatar'),
            avatarIcon: document.getElementById('suziAvatarIcon'),
            statusText: document.getElementById('suziStatusText'),
            statusSubtext: document.getElementById('suziStatusSubtext'),
            transcript: document.getElementById('suziTranscript'),
            waveform: document.getElementById('suziWaveform'),
            suggestions: document.getElementById('suziSuggestions'),
            closeBtn: document.getElementById('suziCloseBtn'),
            micBtn: document.getElementById('micBtn')
        };
    }

    attachEventListeners() {
        // Mic button in footer
        if (this.dom.micBtn) {
            this.dom.micBtn.addEventListener('click', () => this.open());
        }

        // Close button
        if (this.dom.closeBtn) {
            this.dom.closeBtn.addEventListener('click', () => this.close());
        }

        // Overlay click to close
        if (this.dom.overlay) {
            this.dom.overlay.addEventListener('click', () => this.close());
        }

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.modalOpen) {
                this.close();
            }
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.modalOpen) {
                this.stopListening();
            }
        });
    }

    // ==================== SPEECH RECOGNITION SETUP ====================

    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('⚠️ Speech Recognition not supported');
            this.state.isReady = false;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-ZA';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            console.log('🎤 Recognition started');
            this.state.isListening = true;
            this.state.consecutiveErrors = 0;
            this.updateUI('listening');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Show interim results
            if (interimTranscript) {
                this.updateTranscript(interimTranscript, true);
            }

            // Process final results
            if (finalTranscript) {
                this.handleTranscript(finalTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.log('Recognition error:', event.error);
            this.state.isListening = false;

            switch (event.error) {
                case 'no-speech':
                    this.state.consecutiveErrors++;
                    if (this.state.consecutiveErrors >= this.state.maxConsecutiveErrors) {
                        this.speak("I haven't heard anything. Say something or say 'stop' to close.", () => {
                            this.state.consecutiveErrors = 0;
                            this.scheduleRestart(500);
                        });
                    } else {
                        this.scheduleRestart(300);
                    }
                    break;

                case 'not-allowed':
                case 'permission-denied':
                    this.state.permissionGranted = false;
                    this.updateUI('error', 'Microphone blocked', 'Enable in browser settings');
                    break;

                case 'aborted':
                    // User or system cancelled - don't restart automatically
                    break;

                case 'network':
                    this.updateUI('error', 'Network error', 'Check your connection');
                    this.scheduleRestart(2000);
                    break;

                default:
                    this.scheduleRestart(1000);
            }
        };

        this.recognition.onend = () => {
            console.log('🎤 Recognition ended');
            this.state.isListening = false;
            
            // Auto-restart if modal is open and not speaking/processing
            if (this.state.modalOpen && !this.state.isSpeaking && !this.state.isProcessing) {
                this.scheduleRestart(500);
            }
        };

        this.state.isReady = true;
    }

    preloadVoices() {
        if (!this.synthesis) return;

        const loadVoices = () => {
            const voices = this.synthesis.getVoices();
            // Prefer a female English voice
            this.preferredVoice = 
                voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
                voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('samantha')) ||
                voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('karen')) ||
                voices.find(v => v.lang.startsWith('en-GB')) ||
                voices.find(v => v.lang.startsWith('en'));
            
            if (this.preferredVoice) {
                console.log('🔊 Voice selected:', this.preferredVoice.name);
            }
        };

        loadVoices();
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = loadVoices;
        }
    }

    // ==================== MODAL CONTROL ====================

    open() {
        if (this.state.modalOpen) return;

        console.log('📱 Opening Suzi...');
        this.state.modalOpen = true;
        this.state.consecutiveErrors = 0;

        // Show modal with animation
        if (this.dom.modal) {
            this.dom.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        // Update mic button
        if (this.dom.micBtn) {
            this.dom.micBtn.classList.add('active');
        }

        // Initial UI state
        this.updateUI('greeting');
        this.updateTranscript('', false);
        this.showSuggestions(true);

        // Greet and start listening
        const greetings = [
            "Hi! I'm Suzi. How can I help?",
            "Hey there! What can I do for you?",
            "Hi! I'm listening.",
            "Hello! What would you like to do?"
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        this.speak(greeting, () => {
            this.startListening();
        });
    }

    close() {
        if (!this.state.modalOpen) return;

        console.log('📱 Closing Suzi...');
        
        // Clear timers
        this.clearTimers();

        // Stop everything
        this.stopListening();
        this.stopSpeaking();

        // Reset state
        this.state.modalOpen = false;
        this.state.isProcessing = false;
        this.conversation = [];
        this.lastTranscript = '';

        // Hide modal
        if (this.dom.modal) {
            this.dom.modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Update mic button
        if (this.dom.micBtn) {
            this.dom.micBtn.classList.remove('active', 'listening');
        }
    }

    // ==================== LISTENING CONTROL ====================

    startListening() {
        if (!this.state.modalOpen) return;
        if (this.state.isListening || this.state.isSpeaking || this.state.isProcessing) return;

        console.log('🎤 Starting to listen...');
        this.clearTimers();

        if (this.isNativeApp) {
            this.startNativeListening();
        } else {
            if (!this.recognition) {
                this.updateUI('error', 'Not supported', 'Use Chrome, Edge, or Safari');
                return;
            }

            try {
                this.recognition.start();
            } catch (e) {
                if (e.name === 'InvalidStateError') {
                    // Already started, wait and retry
                    setTimeout(() => this.startListening(), 200);
                } else {
                    console.error('Recognition start error:', e);
                }
            }
        }
    }

    stopListening() {
        console.log('🎤 Stopping listening...');
        this.clearTimers();

        if (this.isNativeApp) {
            this.stopNativeListening();
        } else {
            if (this.recognition) {
                try {
                    this.recognition.abort();
                } catch (e) {}
            }
        }

        this.state.isListening = false;
    }

    scheduleRestart(delay = 500) {
        this.clearTimers();

        if (!this.state.modalOpen || this.state.isSpeaking || this.state.isProcessing) {
            return;
        }

        this.restartTimer = setTimeout(() => {
            if (this.state.modalOpen && !this.state.isSpeaking && !this.state.isProcessing && !this.state.isListening) {
                this.startListening();
            }
        }, delay);
    }

    clearTimers() {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    // ==================== NATIVE APP BRIDGE ====================

    startNativeListening() {
        if (window.AndroidVoice && typeof window.AndroidVoice.startListening === 'function') {
            try {
                window.AndroidVoice.startListening();
                this.state.isListening = true;
                this.updateUI('listening');
            } catch (error) {
                console.error('Native startListening failed:', error);
            }
        }
    }

    stopNativeListening() {
        if (window.AndroidVoice && typeof window.AndroidVoice.stopListening === 'function') {
            try {
                window.AndroidVoice.stopListening();
            } catch (error) {}
        }
        this.state.isListening = false;
    }

    // Static methods for native callbacks
    static onNativeListeningStart() {
        const suzi = SuziVoiceAssistant.getInstance();
        suzi.state.isListening = true;
        suzi.updateUI('listening');
    }

    static onNativeListeningStop() {
        const suzi = SuziVoiceAssistant.getInstance();
        suzi.state.isListening = false;
        if (suzi.state.modalOpen && !suzi.state.isProcessing && !suzi.state.isSpeaking) {
            suzi.scheduleRestart(500);
        }
    }

    static onNativeTranscript(text) {
        const suzi = SuziVoiceAssistant.getInstance();
        suzi.handleTranscript((text || '').trim());
    }

    static onNativeError(code, message) {
        const suzi = SuziVoiceAssistant.getInstance();
        suzi.state.isListening = false;
        
        if (code === 'no-speech') {
            suzi.scheduleRestart(500);
        } else if (code !== 'not-allowed') {
            suzi.scheduleRestart(1000);
        } else {
            suzi.updateUI('error', 'Microphone blocked', 'Enable in settings');
        }
    }

    // ==================== TRANSCRIPT HANDLING ====================

    handleTranscript(transcript) {
        if (!transcript || !this.state.modalOpen) return;

        const now = Date.now();
        
        // Duplicate check
        if (transcript.toLowerCase() === this.lastTranscript.toLowerCase() && 
            now - this.lastProcessTime < this.cooldown) {
            return;
        }

        this.lastTranscript = transcript;
        this.lastProcessTime = now;

        // Update UI with what was heard
        this.updateTranscript(transcript, false);
        this.showSuggestions(false);

        // Check for stop words
        const lowerTranscript = transcript.toLowerCase();
        const shouldStop = this.stopWords.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(lowerTranscript);
        });

        if (shouldStop) {
            this.handleGoodbye();
            return;
        }

        // Process the command
        this.processCommand(transcript);
    }

    handleGoodbye() {
        const goodbyes = [
            "Goodbye! Have a great day!",
            "Bye! Let me know if you need anything!",
            "See you later!",
            "Take care!"
        ];
        const goodbye = goodbyes[Math.floor(Math.random() * goodbyes.length)];

        this.updateUI('success', 'Goodbye!', goodbye);
        this.speak(goodbye, () => {
            setTimeout(() => this.close(), 500);
        });
    }

    updateTranscript(text, isInterim = false) {
        if (this.dom.transcript) {
            this.dom.transcript.textContent = text || 'Listening...';
            this.dom.transcript.classList.toggle('interim', isInterim);
        }
    }

    // ==================== COMMAND PROCESSING ====================

    async processCommand(command) {
        if (this.state.isProcessing) return;

        this.state.isProcessing = true;
        this.stopListening();
        this.updateUI('thinking');

        try {
            const response = await fetch('/api/voice-intent.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: command,
                    page: window.location.pathname,
                    conversation: this.conversation
                })
            });

            const data = await response.json();

            if (!data || !data.intent) {
                throw new Error('Invalid response');
            }

            // Add to conversation history
            this.conversation.push({ role: 'user', content: command });
            this.conversation.push({ role: 'assistant', content: data.response_text });

            // Trim history
            if (this.conversation.length > this.maxHistory * 2) {
                this.conversation = this.conversation.slice(-this.maxHistory * 2);
            }

            // Execute the intent
            await this.executeIntent(data);

        } catch (error) {
            console.error('Process command error:', error);
            
            this.updateUI('error', 'Oops!', "I didn't catch that");
            this.speak("Sorry, I had trouble with that. Could you try again?", () => {
                this.state.isProcessing = false;
                this.scheduleRestart(500);
            });
        }
    }

    async executeIntent(intentData) {
        const { intent, slots = {}, response_text } = intentData;

        console.log('🎯 Intent:', intent, slots);

        // Update UI with success
        this.updateUI('success', 'Got it!', response_text);

        // Determine if this is a navigation intent (will leave the page)
        const navigationIntents = [
            'navigate', 'add_shopping_item', 'create_event', 'create_schedule',
            'create_note', 'view_shopping', 'show_calendar', 'show_schedule',
            'show_location', 'find_member', 'read_messages', 'check_notifications',
            'get_weather_today', 'get_weather_tomorrow', 'get_weather_week'
        ];
        
        const willNavigate = navigationIntents.includes(intent);

        // Speak the response
        this.speak(response_text, () => {
            this.state.isProcessing = false;

            if (willNavigate) {
                // Execute navigation after speaking
                this.performAction(intent, slots);
            } else {
                // Continue listening
                this.scheduleRestart(500);
            }
        });

        // For non-navigation intents, perform immediately
        if (!willNavigate) {
            await this.performAction(intent, slots);
        }
    }

    async performAction(intent, slots) {
        switch (intent) {
            // ========== SHOPPING ==========
            case 'add_shopping_item':
                await this.addToShopping(slots.item, slots.quantity, slots.category);
                break;

            case 'view_shopping':
                this.navigate('/shopping/');
                break;

            case 'clear_bought':
                await this.clearBoughtItems();
                break;

            // ========== NOTES ==========
            case 'create_note':
                this.navigateToCreateNote(slots);
                break;

            case 'search_notes':
                this.navigate('/notes/?search=' + encodeURIComponent(slots.query || ''));
                break;

            // ========== CALENDAR ==========
            case 'create_event':
                this.navigateToCreateEvent(slots);
                break;

            case 'show_calendar':
                const calDate = this.parseDate(slots.date || 'today');
                this.navigate('/calendar/?date=' + calDate);
                break;

            case 'next_event':
                this.navigate('/calendar/');
                break;

            // ========== SCHEDULE ==========
            case 'create_schedule':
                this.navigateToCreateSchedule(slots);
                break;

            case 'show_schedule':
                const schDate = this.parseDate(slots.date || 'today');
                this.navigate('/schedule/?date=' + schDate);
                break;

            // ========== WEATHER ==========
            case 'get_weather_today':
            case 'get_weather_tomorrow':
            case 'get_weather_week':
                setTimeout(() => {
                    if (!window.location.pathname.includes('/weather/')) {
                        this.navigate('/weather/');
                    }
                }, 1500);
                break;

            // ========== MESSAGES ==========
            case 'send_message':
                await this.sendMessage(slots.content);
                break;

            case 'read_messages':
                this.navigate('/messages/');
                break;

            // ========== TRACKING ==========
            case 'show_location':
                this.navigate('/tracking/');
                break;

            case 'find_member':
                this.navigate('/tracking/?search=' + encodeURIComponent(slots.member_name || ''));
                break;

            // ========== NOTIFICATIONS ==========
            case 'check_notifications':
                this.navigate('/notifications/');
                break;

            case 'mark_all_read':
                await this.markAllNotificationsRead();
                break;

            // ========== NAVIGATION ==========
            case 'navigate':
                this.navigate(this.getNavigationPath(slots.destination));
                break;

            // ========== SMALLTALK / OTHER ==========
            case 'smalltalk':
            case 'get_stats':
            case 'get_suggestions':
            default:
                // Just spoke the response, continue listening
                break;
        }
    }

    // ==================== ACTION IMPLEMENTATIONS ====================

    async addToShopping(item, quantity, category) {
        if (!item) return;

        try {
            const formData = new FormData();
            formData.append('action', 'add');
            formData.append('name', item);
            formData.append('qty', quantity || '');
            formData.append('category', category || 'other');

            await fetch('/shopping/api/items.php', {
                method: 'POST',
                body: formData
            });

            // Navigate to shopping after a delay
            setTimeout(() => {
                this.close();
                if (!window.location.pathname.includes('/shopping/')) {
                    window.location.href = '/shopping/';
                } else {
                    window.location.reload();
                }
            }, 2000);

        } catch (error) {
            console.error('Add to shopping failed:', error);
        }
    }

    async clearBoughtItems() {
        try {
            const formData = new FormData();
            formData.append('action', 'clear_bought');

            await fetch('/shopping/api/items.php', {
                method: 'POST',
                body: formData
            });

            if (window.location.pathname.includes('/shopping/')) {
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error) {
            console.error('Clear bought failed:', error);
        }
    }

    navigateToCreateNote(slots) {
        let url = '/notes/?new=1';
        if (slots.title) url += '&title=' + encodeURIComponent(slots.title);
        if (slots.content) url += '&content=' + encodeURIComponent(slots.content);

        setTimeout(() => {
            this.close();
            window.location.href = url;
        }, 2000);
    }

    navigateToCreateEvent(slots) {
        let url = '/calendar/?new=1';
        if (slots.title) url += '&title=' + encodeURIComponent(slots.title);
        if (slots.date) url += '&date=' + this.parseDate(slots.date);
        if (slots.time) url += '&time=' + slots.time;

        setTimeout(() => {
            this.close();
            window.location.href = url;
        }, 2000);
    }

    navigateToCreateSchedule(slots) {
        let url = '/schedule/?new=1';
        if (slots.title) url += '&title=' + encodeURIComponent(slots.title);
        if (slots.date) url += '&date=' + this.parseDate(slots.date);
        if (slots.time) url += '&time=' + slots.time;
        if (slots.type) url += '&type=' + slots.type;

        setTimeout(() => {
            this.close();
            window.location.href = url;
        }, 2000);
    }

    async sendMessage(content) {
        if (!content) return;

        try {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('to_family', '1');

            await fetch('/messages/api/send.php', {
                method: 'POST',
                body: formData
            });

            setTimeout(() => {
                if (window.location.pathname.includes('/messages/')) {
                    window.location.reload();
                }
            }, 1500);

        } catch (error) {
            console.error('Send message failed:', error);
        }
    }

    async markAllNotificationsRead() {
        try {
            const formData = new FormData();
            formData.append('action', 'mark_all_read');

            await fetch('/notifications/api/', {
                method: 'POST',
                body: formData
            });

            // Update header badge
            if (window.HeaderMenu && typeof window.HeaderMenu.updateNotificationBadge === 'function') {
                window.HeaderMenu.updateNotificationBadge(0);
            }

        } catch (error) {
            console.error('Mark all read failed:', error);
        }
    }

    navigate(url) {
        setTimeout(() => {
            this.close();
            window.location.href = url;
        }, 2000);
    }

    getNavigationPath(destination) {
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
        return paths[destination] || '/home/';
    }

    parseDate(dateString) {
        if (!dateString) return new Date().toISOString().split('T')[0];

        const today = new Date();
        const lower = dateString.toLowerCase();

        if (lower === 'today') {
            return today.toISOString().split('T')[0];
        }

        if (lower === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }

        // Day names
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = days.indexOf(lower);
        if (dayIndex !== -1) {
            const currentDay = today.getDay();
            let daysUntil = dayIndex - currentDay;
            if (daysUntil <= 0) daysUntil += 7;
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + daysUntil);
            return targetDate.toISOString().split('T')[0];
        }

        // Check for "next monday" pattern
        if (lower.startsWith('next ')) {
            const dayName = lower.replace('next ', '');
            const nextDayIndex = days.indexOf(dayName);
            if (nextDayIndex !== -1) {
                const currentDay = today.getDay();
                let daysUntil = nextDayIndex - currentDay + 7;
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysUntil);
                return targetDate.toISOString().split('T')[0];
            }
        }

        // ISO format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }

        return today.toISOString().split('T')[0];
    }

    // ==================== TEXT-TO-SPEECH ====================

    speak(text, onComplete = null) {
        if (!text) {
            if (onComplete) onComplete();
            return;
        }

        // Stop any current speech
        this.stopSpeaking();
        this.stopListening();

        this.state.isSpeaking = true;
        this.updateUI('speaking');

        // Native TTS
        if (this.isNativeApp && window.AndroidVoice && typeof window.AndroidVoice.speak === 'function') {
            try {
                window.AndroidVoice.speak(text);

                // Estimate duration
                const wordCount = text.split(/\s+/).length;
                const duration = Math.max(1500, Math.min(wordCount * 400, 10000));

                setTimeout(() => {
                    this.state.isSpeaking = false;
                    if (onComplete) onComplete();
                }, duration);

                return;
            } catch (error) {
                console.error('Native TTS failed:', error);
            }
        }

        // Web Speech API
        if (!this.synthesis) {
            this.state.isSpeaking = false;
            if (onComplete) onComplete();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);

        if (this.preferredVoice) {
            utterance.voice = this.preferredVoice;
        }

        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
            this.state.isSpeaking = true;
        };

        utterance.onend = () => {
            this.state.isSpeaking = false;
            if (onComplete) {
                setTimeout(onComplete, 200);
            }
        };

        utterance.onerror = (event) => {
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
                console.error('TTS error:', event.error);
            }
            this.state.isSpeaking = false;
            if (onComplete) {
                setTimeout(onComplete, 200);
            }
        };

        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
        this.state.isSpeaking = false;
    }

    // ==================== UI UPDATES ====================

    updateUI(state, title = null, subtitle = null) {
        if (!this.dom.avatar) return;

        // Remove all state classes
        this.dom.avatar.classList.remove('listening', 'speaking', 'thinking', 'success', 'error');

        // Add appropriate class and update content
        switch (state) {
            case 'greeting':
                this.dom.avatar.classList.add('speaking');
                this.setStatus('🎤', 'Hi!', "I'm Suzi, your assistant");
                this.startWaveform();
                break;

            case 'listening':
                this.dom.avatar.classList.add('listening');
                this.setStatus('🎤', 'Listening...', 'Speak now');
                this.startWaveform();
                break;

            case 'speaking':
                this.dom.avatar.classList.add('speaking');
                this.setStatus('💬', 'Speaking...', '');
                this.startWaveform();
                break;

            case 'thinking':
                this.dom.avatar.classList.add('thinking');
                this.setStatus('🤔', 'Thinking...', 'Processing your request');
                this.stopWaveform();
                break;

            case 'success':
                this.dom.avatar.classList.add('success');
                this.setStatus('✅', title || 'Got it!', subtitle || '');
                this.stopWaveform();
                break;

            case 'error':
                this.dom.avatar.classList.add('error');
                this.setStatus('❌', title || 'Error', subtitle || 'Please try again');
                this.stopWaveform();
                break;
        }

        // Update mic button
        if (this.dom.micBtn) {
            this.dom.micBtn.classList.toggle('listening', state === 'listening');
        }
    }

    setStatus(icon, text, subtext) {
        if (this.dom.avatarIcon) {
            this.dom.avatarIcon.textContent = icon;
        }
        if (this.dom.statusText) {
            this.dom.statusText.textContent = text;
        }
        if (this.dom.statusSubtext) {
            this.dom.statusSubtext.textContent = subtext;
        }
    }

    showSuggestions(show) {
        if (this.dom.suggestions) {
            this.dom.suggestions.style.display = show ? 'block' : 'none';
        }
    }

    startWaveform() {
        if (this.dom.waveform) {
            this.dom.waveform.classList.add('active');
        }
    }

    stopWaveform() {
        if (this.dom.waveform) {
            this.dom.waveform.classList.remove('active');
        }
    }

    // Execute suggestion button
    executeSuggestion(text) {
        this.updateTranscript(text, false);
        this.showSuggestions(false);
        this.processCommand(text);
    }

    // ==================== STATIC MODAL OPEN ====================

    static open() {
        SuziVoiceAssistant.getInstance().open();
    }

    static close() {
        SuziVoiceAssistant.getInstance().close();
    }
}

// ==================== AUTO-INITIALIZE ====================

document.addEventListener('DOMContentLoaded', () => {
    const suzi = SuziVoiceAssistant.getInstance();
    suzi.init();
});

// Global access
window.SuziVoiceAssistant = SuziVoiceAssistant;
window.Suzi = SuziVoiceAssistant; // Shorthand
