<?php
/**
 * GLOBAL FOOTER - SUZI v7.0
 * Simple, Reliable, Mobile-First
 */
?>
    <footer class="global-footer" id="globalFooter">
        <style>
            .main-content { padding-bottom: 50px; }

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

            .footer-btn {
                pointer-events: all;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                position: relative;
            }

            .mic-btn {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                font-size: 26px;
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }

            .mic-btn:hover {
                transform: scale(1.1);
            }

            .mic-btn.active {
                background: linear-gradient(135deg, #43e97b, #38f9d7);
            }

            .mic-btn.listening {
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0%, 100% { box-shadow: 0 8px 25px rgba(102,126,234,0.4); }
                50% { box-shadow: 0 8px 40px rgba(102,126,234,0.8), 0 0 0 10px rgba(102,126,234,0.2); }
            }

            .footer-right {
                display: flex;
                align-items: flex-end;
                gap: 12px;
            }

            .tracking-btn, .help-btn-footer, .plus-btn {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                color: white;
                font-size: 22px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.2);
            }

            .tracking-btn { background: linear-gradient(135deg, #f093fb, #f5576c); }
            .help-btn-footer { background: linear-gradient(135deg, #ffecd2, #fcb69f); color: #333; }
            .plus-btn { background: linear-gradient(135deg, #43e97b, #38f9d7); font-size: 26px; }

            .plus-btn.active { transform: rotate(45deg); }

            .plus-wrapper { position: relative; }

            .plus-menu {
                position: absolute;
                bottom: 60px;
                right: 0;
                display: none;
                flex-direction: column;
                gap: 10px;
                pointer-events: all;
            }

            .plus-menu.active { display: flex; }

            .plus-menu-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 18px;
                background: white;
                border-radius: 30px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.15);
                text-decoration: none;
                color: #333;
                font-weight: 600;
                white-space: nowrap;
            }

            .plus-menu-item:hover { transform: translateX(-8px); }

            .menu-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.3);
                z-index: 998;
                display: none;
                pointer-events: all;
            }

            .menu-backdrop.active { display: block; }

            /* ===== SUZI MODAL ===== */
            .suzi-modal {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .suzi-modal.active { display: flex; }

            .suzi-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.9);
            }

            .suzi-content {
                position: relative;
                background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
                border-radius: 28px;
                padding: 40px 30px;
                max-width: 420px;
                width: 100%;
                box-shadow: 0 25px 60px rgba(0,0,0,0.5);
            }

            .suzi-close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255,255,255,0.15);
                border: none;
                color: white;
                font-size: 22px;
                cursor: pointer;
            }

            .suzi-close:hover { background: rgba(255,255,255,0.25); }

            /* Avatar */
            .suzi-avatar {
                width: 100px;
                height: 100px;
                margin: 0 auto 20px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 50px;
                transition: all 0.3s;
            }

            .suzi-avatar.listening {
                animation: avatarPulse 1.5s infinite;
                background: rgba(67,233,123,0.3);
            }

            .suzi-avatar.speaking {
                animation: avatarBounce 0.6s infinite;
            }

            .suzi-avatar.thinking {
                animation: avatarSpin 1s linear infinite;
            }

            .suzi-avatar.success { background: rgba(67,233,123,0.3); }
            .suzi-avatar.error { background: rgba(255,87,87,0.3); }

            @keyframes avatarPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(67,233,123,0.4); }
                50% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(67,233,123,0); }
            }

            @keyframes avatarBounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-6px); }
            }

            @keyframes avatarSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Status */
            .suzi-status {
                text-align: center;
                margin-bottom: 16px;
            }

            .suzi-status-text {
                font-size: 24px;
                font-weight: 700;
                color: white;
                margin-bottom: 4px;
            }

            .suzi-status-subtext {
                font-size: 14px;
                color: rgba(255,255,255,0.8);
            }

            /* Waveform */
            .suzi-waveform {
                display: flex;
                justify-content: center;
                gap: 4px;
                height: 30px;
                margin-bottom: 16px;
            }

            .suzi-waveform span {
                width: 4px;
                height: 10px;
                background: rgba(255,255,255,0.4);
                border-radius: 2px;
            }

            .suzi-waveform.active span {
                animation: wave 0.8s ease-in-out infinite;
                background: white;
            }

            .suzi-waveform.active span:nth-child(1) { animation-delay: 0s; }
            .suzi-waveform.active span:nth-child(2) { animation-delay: 0.1s; }
            .suzi-waveform.active span:nth-child(3) { animation-delay: 0.2s; }
            .suzi-waveform.active span:nth-child(4) { animation-delay: 0.3s; }
            .suzi-waveform.active span:nth-child(5) { animation-delay: 0.2s; }
            .suzi-waveform.active span:nth-child(6) { animation-delay: 0.1s; }
            .suzi-waveform.active span:nth-child(7) { animation-delay: 0s; }

            @keyframes wave {
                0%, 100% { height: 10px; }
                50% { height: 28px; }
            }

            /* Transcript */
            .suzi-transcript {
                background: rgba(255,255,255,0.1);
                border-radius: 14px;
                padding: 16px;
                min-height: 50px;
                color: white;
                font-size: 16px;
                font-weight: 500;
                text-align: center;
                margin-bottom: 16px;
            }

            .suzi-transcript.interim { color: rgba(255,255,255,0.6); font-style: italic; }

            /* Tap to Speak Button */
            .suzi-tap-btn {
                display: block;
                width: 100%;
                padding: 14px;
                background: rgba(255,255,255,0.15);
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 14px;
                color: white;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 16px;
                transition: all 0.3s;
            }

            .suzi-tap-btn:hover {
                background: rgba(255,255,255,0.25);
            }

            .suzi-tap-btn:active {
                transform: scale(0.98);
            }

            /* Suggestions */
            .suzi-suggestions {
                text-align: center;
            }

            .suzi-suggestions-title {
                color: rgba(255,255,255,0.7);
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 12px;
            }

            .suzi-suggestions-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .suzi-suggestion {
                background: rgba(255,255,255,0.1);
                border: none;
                border-radius: 12px;
                padding: 12px 16px;
                color: white;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
            }

            .suzi-suggestion:hover {
                background: rgba(255,255,255,0.2);
                transform: translateX(4px);
            }

            .suzi-hint {
                margin-top: 16px;
                text-align: center;
                color: rgba(255,255,255,0.5);
                font-size: 12px;
            }

            /* Mobile */
            @media (max-width: 480px) {
                .footer-container { padding: 0 12px 12px; }
                .mic-btn { width: 48px; height: 48px; font-size: 24px; }
                .tracking-btn, .help-btn-footer, .plus-btn { width: 42px; height: 42px; font-size: 20px; }
                .suzi-content { padding: 30px 20px; }
                .suzi-avatar { width: 80px; height: 80px; font-size: 40px; }
                .suzi-status-text { font-size: 20px; }
            }
        </style>

        <div class="menu-backdrop" id="menuBackdrop" onclick="closePlusMenu()"></div>

        <div class="footer-container">
            <button class="footer-btn mic-btn" id="micBtn">🎤</button>

            <div class="footer-right">
                <button class="footer-btn help-btn-footer" id="helpBtn">❓</button>
                <a href="/tracking/" class="footer-btn tracking-btn">📍</a>
                <div class="plus-wrapper">
                    <div class="plus-menu" id="plusMenu">
                        <a href="/shopping/" class="plus-menu-item"><span>🛒</span> Shopping</a>
                        <a href="/notes/" class="plus-menu-item"><span>📝</span> Note</a>
                        <a href="/schedule/" class="plus-menu-item"><span>⏰</span> Reminder</a>
                        <a href="/calendar/" class="plus-menu-item"><span>📅</span> Event</a>
                        <a href="/messages/" class="plus-menu-item"><span>💬</span> Message</a>
                    </div>
                    <button class="footer-btn plus-btn" id="plusBtn" onclick="togglePlusMenu()">➕</button>
                </div>
            </div>
        </div>
    </footer>

    <!-- SUZI MODAL -->
    <div class="suzi-modal" id="suziModal">
        <div class="suzi-overlay" id="suziOverlay"></div>
        <div class="suzi-content">
            <button class="suzi-close" id="suziCloseBtn">✕</button>

            <div class="suzi-avatar" id="suziAvatar">
                <span id="suziAvatarIcon">🎤</span>
            </div>

            <div class="suzi-status">
                <div class="suzi-status-text" id="suziStatusText">Hi!</div>
                <div class="suzi-status-subtext" id="suziStatusSubtext">I'm Suzi</div>
            </div>

            <div class="suzi-waveform" id="suziWaveform">
                <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>

            <div class="suzi-transcript" id="suziTranscript">Listening...</div>

            <button class="suzi-tap-btn" id="suziTapToSpeak">🎤 Tap to Speak</button>

            <div class="suzi-suggestions" id="suziSuggestions">
                <div class="suzi-suggestions-title">Try saying:</div>
                <div class="suzi-suggestions-list">
                    <button class="suzi-suggestion" onclick="Suzi.suggestion('Add milk to shopping')">🛒 "Add milk to shopping"</button>
                    <button class="suzi-suggestion" onclick="Suzi.suggestion('What is the weather today')">🌤️ "What's the weather?"</button>
                    <button class="suzi-suggestion" onclick="Suzi.suggestion('Create an event tomorrow at 3pm')">📅 "Create an event"</button>
                    <button class="suzi-suggestion" onclick="Suzi.suggestion('Take a note buy cake')">📝 "Take a note"</button>
                </div>
            </div>

            <div class="suzi-hint">Say <strong>"Stop"</strong> or <strong>"Bye"</strong> when done</div>
        </div>
    </div>

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
            plusMenuOpen = !plusMenuOpen;
            document.getElementById('plusMenu').classList.toggle('active', plusMenuOpen);
            document.getElementById('plusBtn').classList.toggle('active', plusMenuOpen);
            document.getElementById('menuBackdrop').classList.toggle('active', plusMenuOpen);
        }
        function closePlusMenu() {
            if (plusMenuOpen) togglePlusMenu();
        }
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closePlusMenu();
        });
    </script>
</body>
</html>
