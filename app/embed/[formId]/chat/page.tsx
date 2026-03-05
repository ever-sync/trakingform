import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { FormField, FormTheme } from '@/types'

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getActiveFields(fields: unknown, settings: unknown): FormField[] {
  const draftFields = Array.isArray(fields) ? (fields as FormField[]) : []
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return draftFields
  const builder = (settings as { builder?: unknown }).builder
  if (!builder || typeof builder !== 'object' || Array.isArray(builder)) return draftFields
  const publishedFields = (builder as { published_fields?: unknown }).published_fields
  if (Array.isArray(publishedFields)) return publishedFields as FormField[]
  return draftFields
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function parseTheme(theme: unknown): Pick<FormTheme, 'primaryColor' | 'backgroundColor' | 'textColor' | 'borderRadius'> {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    return { primaryColor: '#4f46e5', backgroundColor: '#ffffff', textColor: '#111827', borderRadius: 10 }
  }
  const t = theme as Partial<FormTheme>
  return {
    primaryColor: sanitizeHexColor(t.primaryColor, '#4f46e5'),
    backgroundColor: sanitizeHexColor(t.backgroundColor, '#ffffff'),
    textColor: sanitizeHexColor(t.textColor, '#111827'),
    borderRadius: typeof t.borderRadius === 'number' ? t.borderRadius : 10,
  }
}

export default async function ChatEmbedPage({
  params,
}: {
  params: Promise<{ formId?: string }> | { formId?: string }
}) {
  const resolvedParams = await params
  const formId = resolvedParams?.formId?.trim()

  if (!formId || !UUID_V4_REGEX.test(formId)) notFound()

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  })

  if (!form || !form.is_active) notFound()

  const fields = getActiveFields(form.fields, form.settings).filter(f => f.type !== 'hidden')
  const theme = parseTheme(form.theme)
  const fieldsJson = JSON.stringify(fields.map(f => ({
    name: f.name,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder,
    options: f.options,
  })))

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${theme.backgroundColor}; color: ${theme.textColor}; height: 100vh; }
        .chat-container { max-width: 500px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; padding: 16px; }
        .chat-header { padding: 16px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 16px; }
        .chat-header p { font-size: 13px; opacity: 0.7; margin-top: 4px; }
        .messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px; }
        .msg { max-width: 85%; padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; animation: fadeIn 0.3s ease; }
        .msg-bot { background: #f3f4f6; color: ${theme.textColor}; align-self: flex-start; border-bottom-left-radius: 4px; }
        .msg-user { background: ${theme.primaryColor}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .input-area { padding: 12px 0; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; }
        .input-area input, .input-area select, .input-area textarea { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 24px; font-size: 14px; outline: none; }
        .input-area input:focus, .input-area select:focus, .input-area textarea:focus { border-color: ${theme.primaryColor}; }
        .input-area select { border-radius: 12px; }
        .send-btn { width: 44px; height: 44px; border-radius: 50%; background: ${theme.primaryColor}; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .send-btn:hover { opacity: 0.9; }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .typing { display: flex; gap: 4px; padding: 12px 16px; align-self: flex-start; }
        .typing span { width: 8px; height: 8px; background: #9ca3af; border-radius: 50%; animation: bounce 1.4s infinite; }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        .options-grid { display: flex; flex-wrap: wrap; gap: 8px; align-self: flex-start; }
        .option-btn { padding: 8px 16px; border: 1px solid ${theme.primaryColor}; border-radius: 20px; background: transparent; color: ${theme.primaryColor}; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .option-btn:hover { background: ${theme.primaryColor}; color: white; }
        .success-msg { text-align: center; padding: 32px; }
        .success-msg h2 { font-size: 20px; color: #16a34a; margin-bottom: 8px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>

      <div className="chat-container" id="chat-container" suppressHydrationWarning>
        {form.description ? (
          <div className="chat-header">
            <p>{form.description}</p>
          </div>
        ) : null}
        <div className="messages" id="messages" suppressHydrationWarning></div>
        <div className="input-area" id="input-area" suppressHydrationWarning></div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        var fields = ${fieldsJson};
        var currentField = 0;
        var answers = {};
        var startTime = Date.now();
        var messagesEl = document.getElementById('messages');
        var inputArea = document.getElementById('input-area');

        function scrollToBottom() {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function addMessage(text, type) {
          var msg = document.createElement('div');
          msg.className = 'msg msg-' + type;
          msg.textContent = text;
          messagesEl.appendChild(msg);
          scrollToBottom();
        }

        function showTyping() {
          var typing = document.createElement('div');
          typing.className = 'typing';
          typing.id = 'typing';
          typing.innerHTML = '<span></span><span></span><span></span>';
          messagesEl.appendChild(typing);
          scrollToBottom();
        }

        function hideTyping() {
          var typing = document.getElementById('typing');
          if (typing) typing.remove();
        }

        function askQuestion(fieldIndex) {
          if (fieldIndex >= fields.length) {
            submitForm();
            return;
          }

          var field = fields[fieldIndex];
          currentField = fieldIndex;

          showTyping();
          setTimeout(function() {
            hideTyping();
            addMessage(field.label + (field.required ? ' *' : ''), 'bot');

            inputArea.innerHTML = '';

            if (field.type === 'select' || field.type === 'radio') {
              // Show option buttons
              var grid = document.createElement('div');
              grid.className = 'options-grid';
              (field.options || []).forEach(function(opt) {
                var btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = opt.label;
                btn.addEventListener('click', function() {
                  handleAnswer(opt.value, opt.label);
                });
                grid.appendChild(btn);
              });
              messagesEl.appendChild(grid);
              scrollToBottom();
            } else if (field.type === 'checkbox') {
              var grid = document.createElement('div');
              grid.className = 'options-grid';
              grid.id = 'checkbox-grid';
              (field.options || []).forEach(function(opt) {
                var btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.dataset.value = opt.value;
                btn.dataset.selected = 'false';
                btn.addEventListener('click', function() {
                  var sel = btn.dataset.selected === 'true';
                  btn.dataset.selected = sel ? 'false' : 'true';
                  btn.style.background = sel ? 'transparent' : '${theme.primaryColor}';
                  btn.style.color = sel ? '${theme.primaryColor}' : 'white';
                });
                btn.textContent = opt.label;
                grid.appendChild(btn);
              });
              messagesEl.appendChild(grid);

              var sendBtn = document.createElement('button');
              sendBtn.className = 'send-btn';
              sendBtn.innerHTML = '&#8594;';
              sendBtn.addEventListener('click', function() {
                var selected = [];
                document.querySelectorAll('#checkbox-grid .option-btn').forEach(function(b) {
                  if (b.dataset.selected === 'true') selected.push(b.dataset.value);
                });
                handleAnswer(selected.join(', '), selected.join(', '));
              });
              inputArea.appendChild(sendBtn);
              scrollToBottom();
            } else {
              var input = document.createElement('input');
              input.type = field.type === 'phone' ? 'tel' : (field.type === 'textarea' ? 'text' : field.type);
              input.placeholder = field.placeholder || 'Digite sua resposta...';
              input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && input.value.trim()) {
                  handleAnswer(input.value.trim(), input.value.trim());
                }
              });
              inputArea.appendChild(input);

              var sendBtn = document.createElement('button');
              sendBtn.className = 'send-btn';
              sendBtn.innerHTML = '&#8594;';
              sendBtn.addEventListener('click', function() {
                if (input.value.trim()) handleAnswer(input.value.trim(), input.value.trim());
              });
              inputArea.appendChild(sendBtn);
              input.focus();
            }
          }, 600 + Math.random() * 400);
        }

        function handleAnswer(value, display) {
          var field = fields[currentField];
          answers[field.name] = value;

          addMessage(display, 'user');

          // Remove option buttons if any
          var grids = messagesEl.querySelectorAll('.options-grid');
          grids.forEach(function(g) { g.remove(); });

          inputArea.innerHTML = '';

          setTimeout(function() {
            askQuestion(currentField + 1);
          }, 300);
        }

        async function submitForm() {
          showTyping();

          var urlParams = new URLSearchParams(window.location.search);
          answers._start_time = startTime;
          answers._utm_source = urlParams.get('utm_source') || '';
          answers._utm_medium = urlParams.get('utm_medium') || '';
          answers._utm_campaign = urlParams.get('utm_campaign') || '';
          answers._referrer = document.referrer || '';

          try {
            var res = await fetch('/api/forms/${formId}/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(answers),
            });
            var raw = '';
            var json = null;
            try {
              raw = await res.text();
              json = raw ? JSON.parse(raw) : null;
            } catch (e) {
              json = null;
            }
            hideTyping();

            if (json && json.errors) {
              addMessage('Algumas respostas estao invalidas. Por favor, tente novamente.', 'bot');
              return;
            }

            if (!res.ok) {
              var msg = (json && (json.error || json.message))
                ? (json.error || json.message)
                : (raw && raw.trim().length > 0 ? raw : 'Erro ao enviar. Tente novamente.');
              addMessage(msg, 'bot');
              return;
            }

            if (json && json.redirect_url) {
              window.top.location.href = json.redirect_url;
            } else {
              addMessage((json && json.message) || 'Obrigado! Recebemos suas informacoes.', 'bot');
              inputArea.innerHTML = '<p style="text-align:center;color:#9ca3af;font-size:13px;width:100%;">Conversa finalizada</p>';
            }
          } catch(err) {
            hideTyping();
            addMessage('Ops! Houve um erro. Tente novamente.', 'bot');
          }
        }

        // Start the conversation
        setTimeout(function() {
          addMessage('Ola! Vou te fazer algumas perguntas rapidas.', 'bot');
          setTimeout(function() {
            askQuestion(0);
          }, 800);
        }, 500);
      ` }} />
    </>
  )
}
