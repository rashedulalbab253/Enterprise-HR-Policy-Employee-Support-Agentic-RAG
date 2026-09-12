// Enterprise HR Copilot - Controller
const chat = document.getElementById('chat');
const form = document.getElementById('chatForm');
const question = document.getElementById('question');
const trace = document.getElementById('trace');
const traceCount = document.getElementById('traceCount');
const sourceUsed = document.getElementById('sourceUsed');
const sendBtn = document.getElementById('sendBtn');
const toggleTraceBtn = document.getElementById('toggleTraceBtn');
const traceDrawer = document.getElementById('traceDrawer');
const themeToggle = document.getElementById('themeToggle');

const ASSISTANT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><rect x="3" y="10" width="18" height="12" rx="4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>`;
const USER_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// Theme Toggle
if (themeToggle) {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
}

// Trace Drawer Toggle
if (toggleTraceBtn && traceDrawer) {
  toggleTraceBtn.addEventListener('click', () => {
    traceDrawer.classList.toggle('hidden');
  });
}

function escapeHtml(s = '') {
  return s.replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function formatText(s = '') {
  if (typeof marked !== 'undefined' && marked.parse) {
    try {
      return marked.parse(s, { breaks: true, gfm: true });
    } catch (e) {
      console.error('Markdown parse error:', e);
    }
  }
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function getSourceBadge(source = '') {
  if (!source) return '';
  const clean = source.toLowerCase();
  let label = source;

  if (clean.includes('private') || clean.includes('kb')) {
    label = 'Verified Company KB';
  } else if (clean.includes('web') || clean.includes('tavily')) {
    label = 'External Web Search';
  } else if (clean.includes('direct')) {
    label = 'Direct Response';
  }

  return `<div class="answer-source">Source: ${escapeHtml(label)}</div>`;
}

function addMessage(role, text, source = '', citations = []) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const icon = role === 'user' ? USER_ICON : ASSISTANT_ICON;

  let citeHtml = '';
  if (citations && citations.length > 0) {
    const items = citations.map(c => {
      if (typeof c === 'string') {
        return `<div>📄 ${escapeHtml(c)}</div>`;
      }
      if (c.url) {
        return `<div>🔗 <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.title || c.url)}</a></div>`;
      }
      return `<div>📄 ${escapeHtml(c.title || 'Document')}</div>`;
    }).join('');
    citeHtml = `<div class="citations"><strong>Grounding Sources:</strong>${items}</div>`;
  }

  wrap.innerHTML = `
    <div class="avatar ${role}">${icon}</div>
    <div class="bubble">
      ${formatText(text)}
      ${getSourceBadge(source)}
      ${citeHtml}
    </div>
  `;

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

let typingNode = null;
function showTyping() {
  if (typingNode) return;
  typingNode = document.createElement('div');
  typingNode.className = 'message assistant';
  typingNode.innerHTML = `
    <div class="avatar assistant">${ASSISTANT_ICON}</div>
    <div class="bubble">
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  chat.appendChild(typingNode);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  if (typingNode && typingNode.parentNode) {
    typingNode.parentNode.removeChild(typingNode);
  }
  typingNode = null;
}

function renderTrace(items = []) {
  if (traceCount) {
    traceCount.textContent = items.length;
  }

  if (!items || items.length === 0) {
    trace.innerHTML = '<div class="empty-trace">No reasoning steps recorded yet.</div>';
    return;
  }

  trace.innerHTML = items.map(x => `<div class="trace-step-item">${escapeHtml(x)}</div>`).join('');
}

async function askAgent(q) {
  if (!q.trim()) return;

  addMessage('user', q);
  question.value = '';

  // Scroll smoothly to copilot
  const copilotSection = document.getElementById('copilotSection');
  if (copilotSection) {
    copilotSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  renderTrace(['1. Routing question via LangGraph...', '2. Evaluating private KB evidence...']);
  if (sourceUsed) sourceUsed.textContent = 'Source: Processing...';

  if (sendBtn) sendBtn.disabled = true;
  showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');

    hideTyping();
    addMessage('assistant', data.answer, data.source_used, data.citations || []);
    renderTrace(data.trace || []);

    if (sourceUsed) {
      const src = data.source_used || 'Complete';
      sourceUsed.textContent = `Source: ${src.replace('_', ' ').toUpperCase()}`;
    }
  } catch (e) {
    hideTyping();
    addMessage('assistant', `**Error:** ${e.message}`);
    renderTrace(['Workflow error: ' + e.message]);
    if (sourceUsed) sourceUsed.textContent = 'Source: ERROR';
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Enter to submit, Shift+Enter for new line
question.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const q = question.value.trim();
    if (q) askAgent(q);
  }
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const q = question.value.trim();
  if (q) askAgent(q);
});

// Service Cards click handlers (Quick prompt)
document.querySelectorAll('.service-card').forEach(card => {
  card.addEventListener('click', () => {
    const query = card.getAttribute('data-query');
    if (query) {
      askAgent(query);
    }
  });
});

// Document Ingestion Modal Controls
const modal = document.getElementById('uploadModal');
const backdrop = document.querySelector('.modal-backdrop');
const openUpload = document.getElementById('openUpload');
const closeUpload = document.getElementById('closeUpload');
const uploadBtn = document.getElementById('uploadBtn');

if (openUpload) {
  openUpload.onclick = () => modal.classList.remove('hidden');
}
if (closeUpload) {
  closeUpload.onclick = () => modal.classList.add('hidden');
}
if (backdrop) {
  backdrop.onclick = () => modal.classList.add('hidden');
}

if (uploadBtn) {
  uploadBtn.onclick = async () => {
    const file = document.getElementById('fileInput').files[0];
    const key = document.getElementById('adminKey').value;
    const status = document.getElementById('uploadStatus');

    if (!file) {
      status.textContent = 'Please select a document first.';
      status.style.color = '#d97706';
      return;
    }

    status.textContent = 'Indexing document into Pinecone...';
    status.style.color = '#2563eb';
    uploadBtn.disabled = true;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const r = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'X-Admin-Key': key },
        body: fd
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Upload failed');

      status.textContent = `✓ Indexed ${d.file}: ${d.chunks} chunks created.`;
      status.style.color = '#059669';
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      status.style.color = '#dc2626';
    } finally {
      uploadBtn.disabled = false;
    }
  };
}
