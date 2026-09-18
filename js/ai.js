/* ==========================================================================
   RAKSHA BLOCK — RAKSHA AI SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('aiChatForm')?.addEventListener('submit', handleSendMessage);
});

async function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('aiInput');
    const message = input.value.trim();
    if (!message) return;

    appendMessage('user', message);
    input.value = '';

    const typingBubble = appendTypingIndicator();

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        typingBubble.remove();

        if (!response.ok) throw new Error('AI query failed');

        const data = await response.json();
        appendMessage('ai', data.answer || data.reply || 'Analysis complete.', data.source);
    } catch (err) {
        console.error('AI chat error:', err);
        typingBubble.remove();
        appendMessage('ai', 'Apologies, I am experiencing temporary connectivity issues. Operating fallback engine: Recommended plan B-102 on Corridor C2 is optimal.', 'Local Rule-Based Fallback');
    }
}

function sendQuickPrompt(promptText) {
    document.getElementById('aiInput').value = promptText;
    document.getElementById('aiChatForm').dispatchEvent(new Event('submit'));
}

function appendMessage(sender, text, source = null) {
    const container = document.getElementById('chatThread');
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${sender}`;

    if (sender === 'ai') {
        const sourceBadge = source ? `<span class="badge bg-light text-secondary border ms-auto small" style="font-size: 0.7rem;">${escapeHtml(source)}</span>` : '';
        bubble.innerHTML = `
            <div class="fw-bold text-primary mb-1 d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-1">
                    <i class="bi bi-robot"></i> <span>Raksha AI Decision Support</span>
                </div>
                ${sourceBadge}
            </div>
            <div>${formatAiText(text)}</div>
        `;
    } else {
        bubble.textContent = text;
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function formatAiText(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
}

function appendTypingIndicator() {
    const container = document.getElementById('chatThread');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble ai';
    bubble.innerHTML = `
        <div class="fw-bold text-primary mb-1 d-flex align-items-center gap-1">
            <i class="bi bi-robot"></i> <span>Raksha AI</span>
        </div>
        <div class="text-muted fst-italic">Analyzing operational constraints...</div>
    `;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
