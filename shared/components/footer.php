<?php
/**
 * GLOBAL FOOTER - SUZI VOICE ASSISTANT v6.0
 * Alexa-like continuous conversation experience
 */
?>
    <!-- Global Footer -->
    <footer class="global-footer" id="globalFooter">
        <style>
            /* ==================== FOOTER BASE ==================== */
            .main-content {
                padding-bottom: 50px;
            }

            .global-footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 999;
                pointer-events: none;
            }

            .footer-container {
                max-width: 1800px;
                margin: 0 auto;
                padding: 0 20px 20px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
            }

            /* ==================== FOOTER BUTTONS ==================== */
            .footer-btn {
                pointer-events: all;
                border: none;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                position: relative;
                flex-shrink: 0;
            }

            .mic-btn {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-size: 26px;
                box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
            }

            .mic-btn:hover {
                transform: scale(1.1) translateY(-3px);
                box-shadow: 0 12px 40px rgba(102, 126, 234, 0.5);
            }

            .mic-btn:active {
                transform: scale(0.95);
            }

            .mic-btn.active {
                background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
                box-shadow: 0 8px 32px rgba(67, 233, 123, 0.4);
            }

            .mic-btn.listening {
                animation: micPulse 1.5s ease-in-out infinite;
            }

            @keyframes micPulse {
                0%, 100% {
                    box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
                    transform: scale(1);
                }
                50% {
                    box-shadow: 0 8px 50px rgba(102, 126, 234, 0.8), 0 0 0 12px rgba(102, 126, 234, 0.2);
                    transform: scale(1.05);
                }
            }

            .footer-right {
                display: flex;
                align-items: flex-end;
                gap: 15px;
            }

            .tracking-btn {
                width: 47px;
                height: 47px;
                border-radius: 50%;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                font-size: 24px;
                box-shadow: 0 8px 32px rgba(240, 147, 251, 0.4);
            }

            .tracking-btn:hover {
                transform: scale(1.1) translateY(-3px);
            }

            .help-btn-footer {
                width: 47px;
                height: 47px;
                border-radius: 50%;
                background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
                color: #333;
                font-size: 22px;
                box-shadow: 0 8px 32px rgba(252, 182, 159, 0.4);
            }

            .help-btn-footer:hover {
                transform: scale(1.1) translateY(-3px);
            }

            /* ==================== PLUS MENU ==================== */
            .plus-wrapper {
                position: relative;
            }

            .plus-btn {
                width: 47px;
                height: 47px;
                border-radius: 50%;
                background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
                color: white;
                font-size: 28px;
                box-shadow: 0 8px 32px rgba(67, 233, 123, 0.4);
            }

            .plus-btn:hover {
                transform: scale(1.1) translateY(-3px);
            }

            .plus-btn.active {
                transform: rotate(45deg);
            }

            .plus-menu {
                position: absolute;
                bottom: 65px;
                right: 0;
                display: none;
                flex-direction: column;
                gap: 12px;
                pointer-events: all;
                z-index: 1000;
            }

            .plus-menu.active {
                display: flex;
                animation: plusMenuIn 0.3s ease;
            }

            @keyframes plusMenuIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .plus-menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 20px;
                background: white;
                border-radius: 50px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                cursor: pointer;
                text-decoration: none;
                color: #333;
                font-weight: 600;
                white-space: nowrap;
                transition: all 0.3s;
            }

            .plus-menu-item:hover {
                transform: translateX(-10px);
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
            }

            .plus-menu-icon {
                font-size: 24px;
                width: 35px;
                text-align: center;
            }

            .menu-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(4px);
                z-index: 998;
                display: none;
                pointer-events: all;
            }

            .menu-backdrop.active {
                display: block;
            }

            /* ==================== SUZI MODAL ==================== */
            .suzi-modal {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .suzi-modal.active {
                display: flex;
            }

            .suzi-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(20px);
                animation: suziOverlayIn 0.4s ease;
            }

            @keyframes suziOverlayIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .suzi-content {
                position: relative;
                background: linear-gradient(180deg, 
                    rgba(102, 126, 234, 0.95) 0%, 
                    rgba(118, 75, 162, 0.95) 50%,
                    rgba(102, 126, 234, 0.95) 100%);
                border-radius: 32px;
                padding: 50px 40px;
                max-width: 500px;
                width: 100%;
                box-shadow: 
                    0 30px 80px rgba(0, 0, 0, 0.5),
                    0 0 100px rgba(102, 126, 234, 0.3);
                animation: suziContentIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            @keyframes suziContentIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            /* ==================== CLOSE BUTTON ==================== */
            .suzi-close {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
            }

            .suzi-close:hover {
                background: rgba(255, 255, 255, 0.25);
                transform: scale(1.1);
            }

            /* ==================== AVATAR ==================== */
            .suzi-avatar {
                width: 120px;
                height: 120px;
                margin: 0 auto 24px;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: all 0.4s ease;
            }

            .suzi-avatar::before {
                content: '';
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea, #764ba2, #667eea);
                z-index: -1;
                opacity: 0.5;
            }

            .suzi-avatar-icon {
                font-size: 56px;
                transition: all 0.3s;
            }

            /* Avatar states */
            .suzi-avatar.listening {
                animation: avatarPulse 2s ease-in-out infinite;
            }

            .suzi-avatar.listening::before {
                animation: avatarRing 2s ease-in-out infinite;
            }

            .suzi-avatar.speaking {
                animation: avatarBounce 0.6s ease-in-out infinite;
            }

            .suzi-avatar.thinking {
                animation: avatarSpin 1.5s linear infinite;
            }

            .suzi-avatar.success::before {
                background: linear-gradient(135deg, #43e97b, #38f9d7);
            }

            .suzi-avatar.error::before {
                background: linear-gradient(135deg, #ff416c, #ff4b2b);
            }

            @keyframes avatarPulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4);
                }
                50% {
                    transform: scale(1.05);
                    box-shadow: 0 0 0 20px rgba(102, 126, 234, 0);
                }
            }

            @keyframes avatarRing {
                0%, 100% {
                    transform: scale(1);
                    opacity: 0.5;
                }
                50% {
                    transform: scale(1.1);
                    opacity: 0.8;
                }
            }

            @keyframes avatarBounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
            }

            @keyframes avatarSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* ==================== STATUS TEXT ==================== */
            .suzi-status {
                text-align: center;
                margin-bottom: 24px;
            }

            .suzi-status-text {
                font-size: 28px;
                font-weight: 700;
                color: white;
                margin-bottom: 8px;
            }

            .suzi-status-subtext {
                font-size: 16px;
                color: rgba(255, 255, 255, 0.8);
                font-weight: 500;
            }

            /* ==================== WAVEFORM ==================== */
            .suzi-waveform {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                height: 40px;
                margin-bottom: 20px;
            }

            .suzi-waveform-bar {
                width: 4px;
                height: 8px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 4px;
                transition: height 0.1s ease;
            }

            .suzi-waveform.active .suzi-waveform-bar {
                animation: waveformBounce 0.8s ease-in-out infinite;
                background: white;
            }

            .suzi-waveform.active .suzi-waveform-bar:nth-child(1) { animation-delay: 0s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(2) { animation-delay: 0.1s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(3) { animation-delay: 0.2s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(4) { animation-delay: 0.3s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(5) { animation-delay: 0.4s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(6) { animation-delay: 0.3s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(7) { animation-delay: 0.2s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(8) { animation-delay: 0.1s; }
            .suzi-waveform.active .suzi-waveform-bar:nth-child(9) { animation-delay: 0s; }

            @keyframes waveformBounce {
                0%, 100% { height: 8px; }
                50% { height: 32px; }
            }

            /* ==================== TRANSCRIPT ==================== */
            .suzi-transcript {
                background: rgba(255, 255, 255, 0.12);
                border-radius: 16px;
                padding: 20px 24px;
                margin-bottom: 24px;
                min-height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
                font-weight: 600;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.1);
                transition: all 0.3s;
            }

            .suzi-transcript.interim {
                color: rgba(255, 255, 255, 0.6);
                font-style: italic;
            }

            /* ==================== SUGGESTIONS ==================== */
            .suzi-suggestions {
                text-align: center;
            }

            .suzi-suggestions-title {
                color: rgba(255, 255, 255, 0.9);
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 16px;
            }

            .suzi-suggestions-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .suzi-suggestion {
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-radius: 14px;
                padding: 14px 20px;
                color: white;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                text-align: left;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .suzi-suggestion:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.4);
                transform: translateX(5px);
            }

            .suzi-suggestion-icon {
                font-size: 20px;
            }

            /* ==================== STOP HINT ==================== */
            .suzi-stop-hint {
                margin-top: 20px;
                text-align: center;
                color: rgba(255, 255, 255, 0.6);
                font-size: 13px;
            }

            .suzi-stop-hint strong {
                color: rgba(255, 255, 255, 0.9);
            }

            /* ==================== MOBILE RESPONSIVE ==================== */
            @media (max-width: 768px) {
                .footer-container {
                    padding: 0 15px 15px;
                }

                .mic-btn {
                    width: 48px;
                    height: 48px;
                    font-size: 24px;
                }

                .tracking-btn, .plus-btn, .help-btn-footer {
                    width: 44px;
                    height: 44px;
                    font-size: 22px;
                }

                .plus-btn {
                    font-size: 26px;
                }

                .suzi-content {
                    padding: 40px 24px;
                    border-radius: 24px;
                    margin: 10px;
                }

                .suzi-avatar {
                    width: 100px;
                    height: 100px;
                }

                .suzi-avatar-icon {
                    font-size: 48px;
                }

                .suzi-status-text {
                    font-size: 24px;
                }

                .suzi-transcript {
                    font-size: 16px;
                    padding: 16px 20px;
                }

                .suzi-suggestion {
                    padding: 12px 16px;
                    font-size: 14px;
                }
            }

            @media (max-width: 380px) {
                .footer-right {
                    gap: 10px;
                }

                .mic-btn {
                    width: 44px;
                    height: 44px;
                }

                .tracking-btn, .plus-btn, .help-btn-footer {
                    width: 40px;
                    height: 40px;
                    font-size: 20px;
                }
            }
        </style>

        <div class="menu-backdrop" id="menuBackdrop" onclick="closePlusMenu()"></div>

        <div class="footer-container">
            <!-- Mic Button (Left) -->
            <button class="footer-btn mic-btn" id="micBtn" aria-label="Open Suzi Voice Assistant">
                🎤
            </button>

            <!-- Right Side Buttons -->
            <div class="footer-right">
                <button class="footer-btn help-btn-footer" id="helpBtn" title="Help" aria-label="Help">
                    ❓
                </button>

                <a href="/tracking/index.php" class="footer-btn tracking-btn" aria-label="Location Tracking">
                    📍
                </a>

                <div class="plus-wrapper">
                    <div class="plus-menu" id="plusMenu">
                        <a href="/shopping/" class="plus-menu-item">
                            <span class="plus-menu-icon">🛒</span>
                            <span>Shopping</span>
                        </a>
                        <a href="/notes/" class="plus-menu-item">
                            <span class="plus-menu-icon">📝</span>
                            <span>Note</span>
                        </a>
                        <a href="/schedule/" class="plus-menu-item">
                            <span class="plus-menu-icon">⏰</span>
                            <span>Reminder</span>
                        </a>
                        <a href="/calendar/" class="plus-menu-item">
                            <span class="plus-menu-icon">📅</span>
                            <span>Event</span>
                        </a>
                        <a href="/messages/" class="plus-menu-item">
                            <span class="plus-menu-icon">💬</span>
                            <span>Message</span>
                        </a>
                    </div>

                    <button class="footer-btn plus-btn" id="plusBtn" onclick="togglePlusMenu()" aria-label="Quick Actions">
                        ➕
                    </button>
                </div>
            </div>
        </div>
    </footer>

    <!-- ==================== SUZI VOICE MODAL ==================== -->
    <div class="suzi-modal" id="suziModal">
        <div class="suzi-overlay" id="suziOverlay"></div>
        
        <div class="suzi-content" id="suziContent">
            <button class="suzi-close" id="suziCloseBtn" aria-label="Close">✕</button>

            <!-- Avatar -->
            <div class="suzi-avatar" id="suziAvatar">
                <span class="suzi-avatar-icon" id="suziAvatarIcon">🎤</span>
            </div>

            <!-- Status -->
            <div class="suzi-status">
                <div class="suzi-status-text" id="suziStatusText">Hi!</div>
                <div class="suzi-status-subtext" id="suziStatusSubtext">I'm Suzi, your assistant</div>
            </div>

            <!-- Waveform Visualizer -->
            <div class="suzi-waveform" id="suziWaveform">
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
                <div class="suzi-waveform-bar"></div>
            </div>

            <!-- Transcript -->
            <div class="suzi-transcript" id="suziTranscript">
                Listening...
            </div>

            <!-- Suggestions -->
            <div class="suzi-suggestions" id="suziSuggestions">
                <div class="suzi-suggestions-title">Try saying:</div>
                <div class="suzi-suggestions-list">
                    <button onclick="SuziVoiceAssistant.getInstance().executeSuggestion('Add milk to shopping')" class="suzi-suggestion">
                        <span class="suzi-suggestion-icon">🛒</span>
                        <span>"Add milk to shopping"</span>
                    </button>
                    <button onclick="SuziVoiceAssistant.getInstance().executeSuggestion('What is the weather today')" class="suzi-suggestion">
                        <span class="suzi-suggestion-icon">🌤️</span>
                        <span>"What's the weather today?"</span>
                    </button>
                    <button onclick="SuziVoiceAssistant.getInstance().executeSuggestion('Create an event tomorrow at 3pm')" class="suzi-suggestion">
                        <span class="suzi-suggestion-icon">📅</span>
                        <span>"Create an event tomorrow at 3pm"</span>
                    </button>
                    <button onclick="SuziVoiceAssistant.getInstance().executeSuggestion('Take a note buy birthday cake')" class="suzi-suggestion">
                        <span class="suzi-suggestion-icon">📝</span>
                        <span>"Take a note: buy birthday cake"</span>
                    </button>
                </div>
            </div>

            <!-- Stop Hint -->
            <div class="suzi-stop-hint">
                Say <strong>"Stop"</strong> or <strong>"Bye"</strong> when you're done
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="/shared/js/suzi-voice-assistant.js"></script>
    <script src="/shared/js/app.js"></script>

    <?php if (isset($pageJS)): ?>
        <?php foreach ((array)$pageJS as $js): ?>
            <script src="<?php echo $js; ?>"></script>
        <?php endforeach; ?>
    <?php endif; ?>

    <script>
        let plusMenuOpen = false;

        function togglePlusMenu() {
            const menu = document.getElementById('plusMenu');
            const btn = document.getElementById('plusBtn');
            const backdrop = document.getElementById('menuBackdrop');

            plusMenuOpen = !plusMenuOpen;

            if (plusMenuOpen) {
                menu.classList.add('active');
                btn.classList.add('active');
                backdrop.classList.add('active');
            } else {
                menu.classList.remove('active');
                btn.classList.remove('active');
                backdrop.classList.remove('active');
            }
        }

        function closePlusMenu() {
            if (plusMenuOpen) togglePlusMenu();
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closePlusMenu();
                // Suzi handles its own escape key
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('loaded');
            
            const loader = document.getElementById('appLoader');
            if (loader) {
                setTimeout(() => {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.display = 'none', 300);
                }, 500);
            }
        });
    </script>
</body>
</html>
