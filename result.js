// ── GLOBAL CHAT STATE (accessible from onclick in HTML) ───────────────────────
window._chatHistory = [];
window._chatContext  = '';

window.sendPill = function(btn) {
    document.getElementById('chat-input').value = btn.textContent;
    window.sendChat();
};

window.sendChat = async function() {
    const input  = document.getElementById('chat-input');
    const btn    = document.getElementById('chat-send');
    const text   = input.value.trim();
    if (!text) return;

    input.value  = '';
    btn.disabled = true;
    document.getElementById('chat-suggested').style.display = 'none';

    addBubble(text, 'user');
    window._chatHistory.push({ role: 'user', content: text });
    addTyping();

    try {
        const res  = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: window._chatContext,
                history: window._chatHistory
            })
        });
        const json = await res.json();
        document.getElementById('typing-bubble')?.remove();
        const reply = json.reply || 'Не удалось получить ответ.';
        addBubble(reply, 'ai');
        window._chatHistory.push({ role: 'assistant', content: reply });
    } catch (e) {
        document.getElementById('typing-bubble')?.remove();
        addBubble('Ошибка соединения с сервером.', 'ai');
    }

    btn.disabled = false;
    input.focus();
};

function addBubble(text, role) {
    const msgs    = document.getElementById('chat-messages');
    const initial = role === 'ai' ? 'NS' : (window._studentName?.[0] || 'Я');
    const div     = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.innerHTML = `
        <div class="bubble-avatar ${role}-av">${initial}</div>
        <div class="bubble-text">${text}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
    const msgs = document.getElementById('chat-messages');
    const div  = document.createElement('div');
    div.className = 'chat-bubble ai';
    div.id = 'typing-bubble';
    div.innerHTML = `
        <div class="bubble-avatar ai-av">NS</div>
        <div class="bubble-text">
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    const data = JSON.parse(sessionStorage.getItem('result'));
    if (!data) { window.location.href = '/'; return; }

    const g = data.gap_analysis;

    // Store student name globally for chat avatar
    window._studentName = data.student_name;

    // ── HERO ──────────────────────────────────────────────────────────
    document.getElementById('resName').textContent     = data.student_name;
    document.getElementById('resTarget').textContent   = data.dream_university;
    document.getElementById('chanceNow').textContent   = g.admission_chance_now;
    document.getElementById('chanceAfter').textContent = g.admission_chance_after_plan;
    document.getElementById('profileSummary').textContent   = g.current_profile_summary;
    document.getElementById('comparableCase').textContent   = g.comparable_case || '';
    document.getElementById('motivationalInsight').textContent = data.motivational_insight;

    // ── GAPS ──────────────────────────────────────────────────────────
    const gapMap = {
        critical: { cls: 'critical', label: 'Критично'   },
        important:{ cls: 'important',label: 'Важно'      },
        minor:    { cls: 'minor',    label: 'Желательно' }
    };
    const gapsEl = document.getElementById('gapsContainer');
    (g.top_3_gaps || []).forEach(gap => {
        const s   = gapMap[gap.severity] || { cls: 'minor', label: gap.severity };
        const div = document.createElement('div');
        div.className = `gap-item ${s.cls}`;
        div.innerHTML = `
            <span class="gap-badge">${s.label}</span>
            <div class="gap-body">
                <div class="gap-title">${gap.gap}</div>
                <div class="gap-desc">${gap.why_it_matters}</div>
            </div>`;
        gapsEl.appendChild(div);
    });

    // ── ROADMAP ───────────────────────────────────────────────────────
    const diffMap = {
        easy:  { cls: 'diff-easy',   label: 'Легко'  },
        medium:{ cls: 'diff-medium', label: 'Средне' },
        hard:  { cls: 'diff-hard',   label: 'Сложно' }
    };
    const stripColors = ['strip-1','strip-2','strip-3'];
    const dotColors   = ['dot-1',  'dot-2',  'dot-3' ];

    // Connector row
    const connector = document.getElementById('rmConnector');
    (data.roadmap || []).forEach((step, i) => {
        const item = document.createElement('div');
        item.className = 'rm-conn-item';
        item.innerHTML = `
            <div class="rm-conn-dot ${dotColors[i]||'dot-1'}">${step.month}</div>
            ${i < (data.roadmap.length-1) ? '<div class="rm-conn-line"></div>' : ''}
            <span class="rm-conn-text">${step.month_label||''}</span>`;
        connector.appendChild(item);
    });

    // Cards
    const timeline = document.getElementById('roadmapTimeline');
    (data.roadmap || []).forEach((step, i) => {
        const d   = diffMap[step.difficulty] || { cls:'diff-easy', label: step.difficulty };
        const url = (step.resource||'').startsWith('http') ? step.resource : '#';
        const card = document.createElement('div');
        card.className = 'rm-card';
        card.innerHTML = `
            <div class="rm-strip ${stripColors[i]||'strip-1'}"></div>
            <div class="rm-card-inner">
                <div class="rm-card-head">
                    <div class="rm-month-badge">
                        <span class="rm-month-num">Этап ${step.month}</span>
                        <span class="rm-month-label">${step.month_label||''}</span>
                    </div>
                    <span class="rm-diff ${d.cls}">${d.label}</span>
                </div>
                <div class="rm-card-title">${step.title}</div>
                <div class="rm-card-task">${step.main_task}</div>
                <div class="rm-card-why">${step.why_this_matters}</div>
                <div class="rm-card-footer">
                    <div class="rm-foot-row">
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                        </svg>
                        <strong>${step.time_required}</strong>
                    </div>
                    <div class="rm-foot-row">
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75"/>
                        </svg>
                        <strong>${step.deadline}</strong>
                    </div>
                    <div class="rm-foot-row">
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/>
                        </svg>
                        <a href="${url}" target="_blank" rel="noopener">${step.resource}</a>
                    </div>
                </div>
            </div>`;
        timeline.appendChild(card);
    });

    // ── CHAT CONTEXT ──────────────────────────────────────────────────
    window._chatContext = `Ты — Next Step AI, советник по поступлению в топ-вузы для узбекских студентов.
Отвечай кратко (2-4 предложения), конкретно, по-русски. Без эмодзи. Только факты и советы.

Профиль студента:
- Имя: ${data.student_name}
- Цель: ${data.dream_university}
- Шанс сейчас: ${g.admission_chance_now} → После плана: ${g.admission_chance_after_plan}
- Оценка: ${g.current_profile_summary}
- Пробелы: ${(g.top_3_gaps||[]).map(x=>x.gap).join(', ')}
- Роадмап: ${(data.roadmap||[]).map(x=>`М${x.month}: ${x.title}`).join(' → ')}`;

    // ── CHAT INPUT ENTER ──────────────────────────────────────────────
    document.getElementById('chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') window.sendChat();
    });
});