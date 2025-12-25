/**
 * ============================================
 * SUZI VOICE ASSISTANT v5.0 - COMPLETE SYSTEM
 * Full integration with all app areas
 * ============================================
 */

class AdvancedVoiceAssistant {
    static instance = null;

    static getInstance() {
        if (!AdvancedVoiceAssistant.instance) {
            AdvancedVoiceAssistant.instance = new AdvancedVoiceAssistant();
        }
        return AdvancedVoiceAssistant.instance;
    }

    constructor() {
        if (AdvancedVoiceAssistant.instance) {
            return AdvancedVoiceAssistant.instance;
        }

        console.log('🎤 Suzi Voice Assistant v5.0 Initializing...');

        // Detect native vs web
        this.isNativeApp = !!(window.AndroidVoice && typeof window.AndroidVoice.startListening === 'function');

        // Core state
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.recognitionActive = false;
        this.processingCommand = false;
        this.modalOpen = false;

        // Anti-duplicate
        this.lastTranscript = '';
        this.lastTranscriptTime = 0;
        this.commandCooldown = 2000;

        // Conversation history
        this.conversation = [];
        this.maxConversationHistory = 5;

        // DOM cache
        this.dom = {};

        AdvancedVoiceAssistant.instance = this;
    }

    init() {
        this.cacheDOMElements();
        
        if (this.isNativeApp) {
            console.log('📱 NATIVE APP MODE');
        } else {
            console.log('🌐 WEB BROWSER MODE');
            this.setupRecognition();
            this.setupSpeechEndListener();
        }
        
        this.preloadVoices();
        this.attachEventListeners();
        
        console.log('✅ Suzi Voice Assistant v5.0 READY!');
    }

    cacheDOMElements() {
        this.dom.voiceModal = document.getElementById('voiceModal');
        this.dom.statusIcon = document.getElementById('statusIcon');
        this.dom.statusText = document.getElementById('statusText');
        this.dom.statusSubtext = document.getElementById('statusSubtext');
        this.dom.voiceTranscript = document.getElementById('voiceTranscript');
        this.dom.micBtn = document.getElementById('micBtn');
        this.dom.voiceStatus = document.getElementById('voiceStatus');
    }

    attachEventListeners() {
        if (this.dom.micBtn) {
            this.dom.micBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalOpen) {
                this.closeModal();
            }
        });
    }

    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('⚠️ Speech Recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-ZA';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.recognitionActive = true;
            this.isListening = true;
        };

        this.recognition.onresult = (event) => {
            if (!event.results[0].isFinal) return;
            const transcript = event.results[0][0].transcript.trim();
            this.handleTranscript(transcript);
        };

        this.recognition.onerror = (event) => {
            this.recognitionActive = false;
            this.isListening = false;

            if (event.error === 'no-speech') {
                this.scheduleRestart(1000);
            } else if (event.error === 'not-allowed') {
                this.updateStatus('🚫', 'Microphone Blocked', 'Enable in browser settings');
                this.stopListening();
            } else {
                this.scheduleRestart(1000);
            }
        };

        this.recognition.onend = () => {
            this.recognitionActive = false;
            this.isListening = false;

            if (this.modalOpen && !this.isSpeaking && !this.processingCommand) {
                this.scheduleRestart(1000);
            }
        };
    }

    preloadVoices() {
        if (this.synthesis) {
            this.synthesis.getVoices();
        }
    }

    setupSpeechEndListener() {
        setInterval(() => {
            if (
                !this.isNativeApp &&
                this.modalOpen &&
                !this.isSpeaking &&
                !this.isListening &&
                !this.processingCommand &&
                !this.recognitionActive
            ) {
                this.restartListening();
            }
        }, 1500);
    }

    // ==================== NATIVE BRIDGE ====================
    
    static onNativeListeningStart() {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.isListening = true;
        instance.recognitionActive = true;
        if (instance.dom.micBtn) instance.dom.micBtn.classList.add('listening');
        if (instance.dom.voiceStatus) instance.dom.voiceStatus.classList.add('listening');
        instance.updateStatus('🎤', 'Listening...', 'Speak now');
        instance.updateTranscript('Listening...');
    }

    static onNativeListeningStop() {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.isListening = false;
        instance.recognitionActive = false;
        if (instance.dom.micBtn) instance.dom.micBtn.classList.remove('listening');
        if (instance.dom.voiceStatus) instance.dom.voiceStatus.classList.remove('listening');
        if (instance.modalOpen && !instance.processingCommand && !instance.isSpeaking) {
            instance.updateStatus('🎤', 'Ready', 'Tap to speak');
        }
    }

    static onNativeTranscript(text) {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.handleTranscript((text || '').trim());
    }

    static onNativeError(code, message) {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.isListening = false;
        instance.recognitionActive = false;
        if (instance.dom.micBtn) instance.dom.micBtn.classList.remove('listening');
        if (instance.dom.voiceStatus) instance.dom.voiceStatus.classList.remove('listening');
        
        let userMessage = 'Something went wrong';
        let subtext = 'Please try again';
        
        switch (code) {
            case 'no-speech':
                userMessage = 'No speech detected';
                subtext = 'Try speaking again';
                break;
            case 'network':
                userMessage = 'Network error';
                subtext = 'Check your connection';
                break;
            case 'not-allowed':
                userMessage = 'Microphone blocked';
                subtext = 'Enable in settings';
                break;
            default:
                userMessage = 'Recognition error';
                subtext = message || 'Try again';
        }
        
        instance.updateStatus('❌', userMessage, subtext);
        
        if (code !== 'not-allowed') {
            setTimeout(() => {
                if (instance.modalOpen && !instance.processingCommand) {
                    instance.startNativeListening();
                }
            }, 2000);
        }
    }


    static onNativeSpeakStart() {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.isSpeaking = true;
        instance.updateStatus('💬', 'Speaking...', '');
        console.log('📱 Native TTS started');
    }

    static onNativeSpeakDone() {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.isSpeaking = false;
        console.log('📱 Native TTS finished');
        
        // After speaking, start listening again if modal is open
        if (instance.modalOpen && !instance.processingCommand) {
            setTimeout(() => {
                if (instance.modalOpen && !instance.processingCommand && !instance.isSpeaking) {
                    instance.startListening();
                }
            }, 500);
        }
    }

    // ==================== LISTENING ====================
    
    startNativeListening() {
        if (window.AndroidVoice && typeof window.AndroidVoice.startListening === 'function') {
            try {
                window.AndroidVoice.startListening();
            } catch (error) {
                console.error('❌ Native startListening failed', error);
            }
        }
    }

    stopNativeListening() {
        if (window.AndroidVoice && typeof window.AndroidVoice.stopListening === 'function') {
            try {
                window.AndroidVoice.stopListening();
            } catch (error) {}
        }
        this.isListening = false;
        this.recognitionActive = false;
        if (this.dom.micBtn) this.dom.micBtn.classList.remove('listening');
        if (this.dom.voiceStatus) this.dom.voiceStatus.classList.remove('listening');
    }

    startListening() {
        if (this.isNativeApp) {
            this.startNativeListening();
            return;
        }

        if (!this.recognition) {
            this.updateStatus('❌', 'Not supported', 'Use Chrome/Edge/Safari');
            return;
        }

        if (this.recognitionActive || this.isListening) return;

        if (this.dom.micBtn) this.dom.micBtn.classList.add('listening');
        if (this.dom.voiceStatus) this.dom.voiceStatus.classList.add('listening');

        this.updateStatus('🎤', 'Listening...', 'Ask me anything');
        this.updateTranscript('Listening...');

        try {
            this.recognition.start();
        } catch (error) {
            if (error.name !== 'InvalidStateError') {
                console.error('Start failed:', error);
            }
        }
    }

    stopListening() {
        if (this.isNativeApp) {
            this.stopNativeListening();
            return;
        }

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }

        this.isListening = false;
        this.recognitionActive = false;

        if (this.dom.micBtn) this.dom.micBtn.classList.remove('listening');
        if (this.dom.voiceStatus) this.dom.voiceStatus.classList.remove('listening');
    }

    restartListening() {
        if (this.isNativeApp) return;

        if (
            this.recognitionActive ||
            this.isListening ||
            this.isSpeaking ||
            this.processingCommand
        ) return;

        try {
            this.recognition.start();
            this.updateStatus('🎤', 'Listening...', "I'm all ears");
            this.updateTranscript('Listening...');
        } catch (e) {
            if (e.name !== 'InvalidStateError') {
                console.error('Restart error:', e);
            }
        }
    }

    scheduleRestart(delay = 1000) {
        if (this.isNativeApp) return;

        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
        }

        this.restartTimeout = setTimeout(() => {
            if (
                this.modalOpen &&
                !this.isSpeaking &&
                !this.processingCommand &&
                !this.recognitionActive
            ) {
                this.restartListening();
            }
        }, delay);
    }

    // ==================== MODAL ====================
    
    static openModal() {
        const instance = AdvancedVoiceAssistant.getInstance();
        instance.openModal();
    }

    openModal() {
        if (!this.dom.voiceModal) return;

        this.modalOpen = true;
        this.dom.voiceModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        this.speak('Hi! How can I help you?', () => {
            setTimeout(() => {
                this.startListening();
            }, 500);
        });
    }

    closeModal() {
        if (this.dom.voiceModal) {
            this.dom.voiceModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        this.modalOpen = false;
        this.stopListening();
        this.stopSpeaking();

        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
        }

        this.processingCommand = false;
        this.recognitionActive = false;
        this.lastTranscript = '';
    }

    // ==================== TRANSCRIPT HANDLING ====================
    
    handleTranscript(transcript) {
        if (!transcript) return;

        this.updateTranscript(transcript);

        const now = Date.now();
        const timeSinceLastCommand = now - this.lastTranscriptTime;

        if (
            transcript === this.lastTranscript &&
            timeSinceLastCommand < this.commandCooldown
        ) {
            return;
        }

        if (this.processingCommand) return;

        if (transcript.length > 0) {
            this.lastTranscript = transcript;
            this.lastTranscriptTime = now;
            this.processVoiceCommand(transcript);
        }
    }

    // ==================== COMMAND PROCESSING ====================
    
    async processVoiceCommand(command) {
        if (this.processingCommand || !command || command.trim().length === 0) return;

        this.processingCommand = true;
        this.stopListening();

        this.updateStatus('⚙️', 'Thinking...', 'Processing your request');

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
            this.conversation.push({role: 'user', content: command});
            this.conversation.push({role: 'assistant', content: data.response_text});
            
            // Keep only last N exchanges
            if (this.conversation.length > this.maxConversationHistory * 2) {
                this.conversation = this.conversation.slice(-this.maxConversationHistory * 2);
            }

            await this.executeIntent(data);
        } catch (error) {
            const fallback = 'Sorry, I had trouble with that. Try again?';
            this.updateStatus('❓', 'Oops', fallback);

            this.speak(fallback, () => {
                this.processingCommand = false;
                this.scheduleRestart(1500);
            });
        }
    }

    async executeIntent(intentData) {
        const { intent, slots, response_text } = intentData;

        this.updateStatus('✅', 'Got it!', response_text);

        this.speak(response_text, () => {
            this.processingCommand = false;

            // Don't restart if navigating away
            const navigationIntents = [
                'navigate', 
                'add_shopping_item', 
                'create_event', 
                'create_schedule', 
                'create_note',
                'send_message'
            ];
            
            if (!navigationIntents.includes(intent)) {
                this.scheduleRestart(1500);
            }
        });

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
                const calendarDate = this.parseDate(slots.date || 'today');
                this.navigate('/calendar/?date=' + calendarDate);
                break;
            
            case 'next_event':
                await this.showNextEvent();
                break;

            // ========== SCHEDULE ==========
            case 'create_schedule':
                this.navigateToCreateSchedule(slots);
                break;
            
            case 'show_schedule':
                const scheduleDate = this.parseDate(slots.date || 'today');
                this.navigate('/schedule/?date=' + scheduleDate);
                break;

            // ========== WEATHER ==========
            case 'get_weather_today':
            case 'get_weather_tomorrow':
            case 'get_weather_week':
                await this.getWeather(intent);
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

            // ========== SMART FEATURES ==========
            case 'get_stats':
                this.navigate('/home/#stats');
                break;
            
            case 'get_suggestions':
                await this.getAISuggestions();
                break;

            // ========== SMALLTALK ==========
            case 'smalltalk':
                // Just speak the response, no action
                break;

            default:
                console.warn('Unknown intent:', intent);
        }
    }

    // ==================== INTENT ACTIONS ==========

    async addToShopping(item, quantity, category = 'other') {
        try {
            const listId = window.currentListId || await this.getDefaultShoppingList();
            
            if (!listId) {
                throw new Error('No shopping list found');
            }

            const formData = new FormData();
            formData.append('action', 'add');
            formData.append('list_id', listId);
            formData.append('name', item);
            if (quantity) formData.append('qty', quantity);
            formData.append('category', category);

            const response = await fetch('/shopping/api/items.php', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to add item');

            setTimeout(() => {
                this.closeModal();
                if (window.location.pathname.includes('/shopping/')) {
                    location.reload();
                } else {
                    window.location.href = '/shopping/';
                }
            }, 1500);
        } catch (error) {
            this.updateStatus('❌', 'Failed', error.message || 'Could not add item');
            setTimeout(() => {
                this.processingCommand = false;
                this.scheduleRestart(1500);
            }, 2000);
        }
    }

    async getDefaultShoppingList() {
        try {
            const response = await fetch('/shopping/api/lists.php?action=get_all');
            const data = await response.json();
            return data.lists && data.lists[0] ? data.lists[0].id : null;
        } catch (error) {
            console.error('Failed to get shopping lists:', error);
            return null;
        }
    }

    async clearBoughtItems() {
        try {
            const listId = window.currentListId || await this.getDefaultShoppingList();
            
            const formData = new FormData();
            formData.append('action', 'clear_bought');
            formData.append('list_id', listId);

            await fetch('/shopping/api/items.php', {
                method: 'POST',
                body: formData
            });

            setTimeout(() => {
                if (window.location.pathname.includes('/shopping/')) {
                    location.reload();
                }
            }, 1500);
        } catch (error) {
            console.error('Clear bought failed:', error);
        }
    }

    navigateToCreateNote(slots) {
        let url = '/notes/?new=1';
        if (slots.content) url += '&content=' + encodeURIComponent(slots.content);
        if (slots.title) url += '&title=' + encodeURIComponent(slots.title);
        setTimeout(() => {
            this.closeModal();
            window.location.href = url;
        }, 1500);
    }

    navigateToCreateEvent(slots) {
        let url = '/calendar/?new=1';
        if (slots.title) url += '&content=' + encodeURIComponent(slots.title);
        if (slots.date) url += '&date=' + this.parseDate(slots.date);
        if (slots.time) url += '&time=' + slots.time;
        setTimeout(() => {
            this.closeModal();
            window.location.href = url;
        }, 1500);
    }

    navigateToCreateSchedule(slots) {
        let url = '/schedule/?new=1';
        if (slots.title) url += '&content=' + encodeURIComponent(slots.title);
        if (slots.date) url += '&date=' + this.parseDate(slots.date);
        if (slots.time) url += '&time=' + slots.time;
        if (slots.type) url += '&type=' + slots.type;
        setTimeout(() => {
            this.closeModal();
            window.location.href = url;
        }, 1500);
    }

    async getWeather(intent) {
        // Weather details are handled by the API response_text
        // Just navigate to weather page after speaking
        setTimeout(() => {
            if (!window.location.pathname.includes('/weather/')) {
                this.navigate('/weather/');
            }
        }, 3000);
    }

    async sendMessage(content) {
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
                    location.reload();
                }
            }, 1500);
        } catch (error) {
            console.error('Send message failed:', error);
        }
    }

    async showNextEvent() {
        // Implementation would fetch next event from calendar API
        setTimeout(() => {
            this.navigate('/calendar/');
        }, 2000);
    }

    async markAllNotificationsRead() {
        try {
            const formData = new FormData();
            formData.append('action', 'mark_all_read');

            await fetch('/notifications/api/', {
                method: 'POST',
                body: formData
            });

            setTimeout(() => {
                if (window.location.pathname.includes('/notifications/')) {
                    location.reload();
                } else {
                    // Update badge
                    if (window.HeaderMenu && typeof window.HeaderMenu.updateNotificationBadge === 'function') {
                        window.HeaderMenu.updateNotificationBadge(0);
                    }
                }
            }, 1500);
        } catch (error) {
            console.error('Mark all read failed:', error);
        }
    }

    async getAISuggestions() {
        // Show suggestions in modal or navigate to home
        setTimeout(() => {
            this.navigate('/home/#suggestions');
        }, 2000);
    }

    navigate(url) {
        this.updateStatus('🧭', 'Navigating...', 'One moment');
        setTimeout(() => {
            this.closeModal();
            window.location.href = url;
        }, 1000);
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
            notifications: '/notifications/'
        };
        return paths[destination] || '/home/';
    }

    parseDate(dateString) {
        const today = new Date();
        
        if (dateString === 'today') {
            return today.toISOString().split('T')[0];
        }
        
        if (dateString === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }
        
        // Try parsing as ISO date
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }
        
        return today.toISOString().split('T')[0];
    }

    // ==================== TEXT-TO-SPEECH ====================
    
    speak(text, onEndCallback = null, rate = 1.1, pitch = 1.0) {
        if (window.AndroidVoice && typeof window.AndroidVoice.speak === 'function') {
            try {
                window.AndroidVoice.speak(text);
                
                if (onEndCallback) {
                    const wordCount = text.split(' ').length;
                    const estimatedDuration = (wordCount / 150) * 60 * 1000;
                    const safeDuration = Math.max(1000, Math.min(estimatedDuration, 10000));
                    
                    setTimeout(() => {
                        onEndCallback();
                    }, safeDuration);
                }
                return;
            } catch (error) {
                console.error('❌ Native speak failed', error);
            }
        }

        if (!this.synthesis) {
            if (onEndCallback) onEndCallback();
            return;
        }

        this.stopSpeaking();
        if (!this.isNativeApp) this.stopListening();

        const utterance = new SpeechSynthesisUtterance(text);

        const voices = this.synthesis.getVoices();
        const preferredVoice =
            voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
            voices.find((v) => v.lang.startsWith('en'));

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = 1.0;

        utterance.onstart = () => {
            this.isSpeaking = true;
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            if (onEndCallback) {
                setTimeout(() => {
                    onEndCallback();
                }, 300);
            }
        };

        utterance.onerror = (event) => {
            if (event.error !== 'interrupted') {
                console.error('Speech error:', event.error);
            }
            this.isSpeaking = false;
            if (onEndCallback) {
                setTimeout(() => {
                    onEndCallback();
                }, 300);
            }
        };

        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
        }
    }

    // ==================== UI UPDATES ====================
    
    updateStatus(icon, text, subtext) {
        if (this.dom.statusIcon) this.dom.statusIcon.textContent = icon;
        if (this.dom.statusText) this.dom.statusText.textContent = text;
        if (this.dom.statusSubtext) this.dom.statusSubtext.textContent = subtext;
    }

    updateTranscript(text) {
        if (this.dom.voiceTranscript) {
            this.dom.voiceTranscript.textContent = text;
        }
    }

    executeSuggestion(command) {
        this.updateTranscript(command);
        this.processVoiceCommand(command);
    }
}

// ==================== AUTO-INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => {
    const instance = AdvancedVoiceAssistant.getInstance();
    instance.init();
});

window.AdvancedVoiceAssistant = AdvancedVoiceAssistant;