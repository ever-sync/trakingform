import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { FormField, FormTheme } from '@/types'
import { selectVariant, recordVariantView } from '@/lib/services/ab-test'

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface StepConfig {
  title: string
  fieldIds: string[]
}

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
  const borderRadius =
    typeof t.borderRadius === 'number' && t.borderRadius >= 0 && t.borderRadius <= 24
      ? t.borderRadius
      : 10

  return {
    primaryColor: sanitizeHexColor(t.primaryColor, '#4f46e5'),
    backgroundColor: sanitizeHexColor(t.backgroundColor, '#ffffff'),
    textColor: sanitizeHexColor(t.textColor, '#111827'),
    borderRadius,
  }
}

function parseMultiStepSettings(settings: unknown): { multiStep: boolean; steps: StepConfig[]; showProgressBar: boolean } {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { multiStep: false, steps: [], showProgressBar: true }
  }
  const s = settings as Record<string, unknown>
  return {
    multiStep: !!s.multiStep,
    steps: Array.isArray(s.stepConfig) ? (s.stepConfig as StepConfig[]) : [],
    showProgressBar: s.showProgressBar !== false,
  }
}

export default async function EmbedFormPage({
  params,
}: {
  params: Promise<{ formId?: string }> | { formId?: string }
}) {
  const resolvedParams = await params
  const formId = resolvedParams?.formId?.trim()

  if (!formId || !UUID_V4_REGEX.test(formId)) {
    notFound()
  }

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  })

  if (!form || !form.is_active) notFound()

  // Check for conversational mode
  const settingsObj = (form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings))
    ? form.settings as Record<string, unknown>
    : {}
  if (settingsObj.conversational) {
    redirect(`/embed/${formId}/chat`)
  }

  // A/B Testing: check for active variants
  const variant = await selectVariant(formId)
  let variantId: string | null = null

  let fields: FormField[]
  let theme: ReturnType<typeof parseTheme>

  if (variant) {
    fields = variant.fields
    theme = parseTheme(variant.theme)
    variantId = variant.variantId
    recordVariantView(variant.variantId).catch(console.error)
  } else {
    fields = getActiveFields(form.fields, form.settings)
    theme = parseTheme(form.theme)
  }
  const multiStepConfig = parseMultiStepSettings(form.settings)

  const isMultiStep = multiStepConfig.multiStep && multiStepConfig.steps.length > 1
  const stepsJson = JSON.stringify(multiStepConfig.steps)

  // Progressive profiling
  const formSettings = (form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings))
    ? form.settings as Record<string, unknown>
    : {}
  const isProgressive = !!formSettings.progressiveProfiling

  return (
    <>
      <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: transparent; color: ${theme.textColor}; }
          .form-wrap { max-width: 600px; margin: 0 auto; padding: 24px; background: ${theme.backgroundColor}; border-radius: ${theme.borderRadius}px; color: ${theme.textColor}; }
          .form-title { font-size: 22px; font-weight: 700; color: ${theme.textColor}; margin-bottom: 8px; }
          .form-desc { font-size: 14px; color: ${theme.textColor}; opacity: 0.8; margin-bottom: 24px; }
          .field-group { margin-bottom: 18px; }
          label { display: block; font-size: 14px; font-weight: 500; color: ${theme.textColor}; margin-bottom: 6px; }
          input, select, textarea { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: ${theme.borderRadius}px; font-size: 14px; color: ${theme.textColor}; outline: none; }
          input:focus, select:focus, textarea:focus { border-color: ${theme.primaryColor}; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
          .required { color: #ef4444; }
          .submit-btn { width: 100%; padding: 12px; background: ${theme.primaryColor}; color: white; border: none; border-radius: ${theme.borderRadius}px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
          .submit-btn:hover { opacity: 0.92; }
          .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .error { color: #ef4444; font-size: 12px; margin-top: 4px; }
          .success-msg { text-align: center; padding: 32px; }
          .success-msg h2 { font-size: 20px; color: #16a34a; margin-bottom: 8px; }
          .step-field { display: none; }
          .step-field.active { display: block; }
          .progress-bar-wrap { margin-bottom: 20px; }
          .progress-bar-bg { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
          .progress-bar-fill { height: 100%; background: ${theme.primaryColor}; border-radius: 3px; transition: width 0.3s ease; }
          .step-indicator { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .step-label { font-size: 12px; color: ${theme.textColor}; opacity: 0.6; }
          .step-label.current { opacity: 1; font-weight: 600; color: ${theme.primaryColor}; }
          .step-nav { display: flex; gap: 8px; margin-top: 12px; }
          .step-nav .btn-prev { flex: 1; padding: 10px; background: transparent; border: 1px solid #ddd; border-radius: ${theme.borderRadius}px; font-size: 14px; font-weight: 500; cursor: pointer; color: ${theme.textColor}; }
          .step-nav .btn-prev:hover { background: #f3f4f6; }
          .step-nav .btn-next { flex: 1; padding: 10px; background: ${theme.primaryColor}; color: white; border: none; border-radius: ${theme.borderRadius}px; font-size: 14px; font-weight: 600; cursor: pointer; }
          .step-nav .btn-next:hover { opacity: 0.92; }
          .step-title { font-size: 16px; font-weight: 600; color: ${theme.textColor}; margin-bottom: 16px; }
        `}</style>
      <div className="form-wrap" id="form-container">
        <h1 className="form-title">{form.name}</h1>
        {form.description && <p className="form-desc">{form.description}</p>}

        {isMultiStep && multiStepConfig.showProgressBar && (
          <div className="progress-bar-wrap">
            <div className="step-indicator" id="step-indicator"></div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" id="progress-bar" style={{ width: '0%' }}></div>
            </div>
          </div>
        )}

        <div id="step-title" className="step-title" style={{ display: isMultiStep ? 'block' : 'none' }}></div>

        <form id="lead-form">
          <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
          <input type="hidden" name="_start_time" id="start-time" />
          {isProgressive && <input type="hidden" name="_progressive" value="1" />}
          {variantId && <input type="hidden" name="_variant_id" value={variantId} />}

          {fields.map((field) => {
            const stepIdx = isMultiStep
              ? multiStepConfig.steps.findIndex(s => s.fieldIds.includes(field.id))
              : 0

            return (
              <div
                key={field.id}
                className={isMultiStep ? 'field-group step-field' : 'field-group'}
                data-step={isMultiStep ? stepIdx : undefined}
              >
                {field.type !== 'hidden' && (
                  <label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="required"> *</span>}
                  </label>
                )}

                {(field.type === 'text' || field.type === 'email' || field.type === 'phone') && (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type === 'phone' ? 'tel' : field.type}
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    defaultValue={field.defaultValue ?? ''}
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    rows={4}
                    defaultValue={field.defaultValue ?? ''}
                  />
                )}

                {field.type === 'select' && (
                  <select id={field.name} name={field.name} required={field.required}>
                    <option value="">Selecione...</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {field.type === 'date' && (
                  <input
                    id={field.name}
                    name={field.name}
                    type="date"
                    required={field.required}
                    defaultValue={field.defaultValue ?? ''}
                  />
                )}

                {(field.type === 'checkbox' || field.type === 'radio') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                    {field.options?.map(opt => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal' }}>
                        <input type={field.type} name={field.name} value={opt.value} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                )}

                {field.type === 'hidden' && (
                  <input type="hidden" name={field.name} value={field.defaultValue ?? ''} />
                )}
              </div>
            )
          })}

          {isMultiStep ? (
            <div className="step-nav" id="step-nav">
              <button type="button" className="btn-prev" id="btn-prev" style={{ display: 'none' }}>Anterior</button>
              <button type="button" className="btn-next" id="btn-next">Próximo</button>
            </div>
          ) : null}

          <button
            type="submit"
            className="submit-btn"
            id="submit-btn"
            style={{ display: isMultiStep ? 'none' : 'block' }}
          >
            Enviar
          </button>
        </form>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('start-time').value = Date.now();

          var urlParams = new URLSearchParams(window.location.search);
          var utmData = {
            _utm_source: urlParams.get('utm_source') || '',
            _utm_medium: urlParams.get('utm_medium') || '',
            _utm_campaign: urlParams.get('utm_campaign') || '',
            _utm_term: urlParams.get('utm_term') || '',
            _utm_content: urlParams.get('utm_content') || '',
            _referrer: document.referrer || '',
          };

          var isMultiStep = ${isMultiStep ? 'true' : 'false'};
          var steps = ${stepsJson};
          var currentStep = 0;
          var totalSteps = steps.length;

          function updateStepUI() {
            if (!isMultiStep) return;

            // Show/hide fields
            var allStepFields = document.querySelectorAll('.step-field');
            allStepFields.forEach(function(el) {
              var step = parseInt(el.getAttribute('data-step'));
              if (step === currentStep) {
                el.classList.add('active');
              } else {
                el.classList.remove('active');
              }
            });

            // Update step title
            var titleEl = document.getElementById('step-title');
            if (titleEl && steps[currentStep]) {
              titleEl.textContent = steps[currentStep].title;
            }

            // Update progress bar
            var progressBar = document.getElementById('progress-bar');
            if (progressBar) {
              var pct = ((currentStep + 1) / totalSteps) * 100;
              progressBar.style.width = pct + '%';
            }

            // Update step indicator
            var indicator = document.getElementById('step-indicator');
            if (indicator) {
              indicator.innerHTML = steps.map(function(s, i) {
                var cls = i === currentStep ? 'step-label current' : 'step-label';
                return '<span class="' + cls + '">' + s.title + '</span>';
              }).join('');
            }

            // Show/hide nav buttons
            var btnPrev = document.getElementById('btn-prev');
            var btnNext = document.getElementById('btn-next');
            var btnSubmit = document.getElementById('submit-btn');

            if (btnPrev) btnPrev.style.display = currentStep > 0 ? 'block' : 'none';

            if (currentStep === totalSteps - 1) {
              if (btnNext) btnNext.style.display = 'none';
              if (btnSubmit) btnSubmit.style.display = 'block';
            } else {
              if (btnNext) btnNext.style.display = 'block';
              if (btnSubmit) btnSubmit.style.display = 'none';
            }
          }

          function validateCurrentStep() {
            var activeFields = document.querySelectorAll('.step-field.active input[required], .step-field.active select[required], .step-field.active textarea[required]');
            var valid = true;
            activeFields.forEach(function(field) {
              // Clear previous errors
              var prevErr = field.parentNode.querySelector('.error');
              if (prevErr) prevErr.remove();

              if (!field.value || !field.value.trim()) {
                valid = false;
                var err = document.createElement('p');
                err.className = 'error';
                err.textContent = 'Este campo é obrigatório';
                field.parentNode.appendChild(err);
              }
            });
            return valid;
          }

          if (isMultiStep) {
            updateStepUI();

            var btnNext = document.getElementById('btn-next');
            var btnPrev = document.getElementById('btn-prev');

            if (btnNext) {
              btnNext.addEventListener('click', function() {
                if (!validateCurrentStep()) return;
                if (currentStep < totalSteps - 1) {
                  currentStep++;
                  updateStepUI();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              });
            }

            if (btnPrev) {
              btnPrev.addEventListener('click', function() {
                if (currentStep > 0) {
                  currentStep--;
                  updateStepUI();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              });
            }
          }

          var isProgressive = ${isProgressive ? 'true' : 'false'};

          if (isProgressive) {
            var emailInput = document.querySelector('input[type="email"], input[name="email"]');
            if (emailInput) {
              emailInput.addEventListener('blur', function() {
                var email = emailInput.value.trim();
                if (!email || email.indexOf('@') === -1) return;

                fetch('/api/forms/${formId}/profile', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: email }),
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (!data.known_fields || Object.keys(data.known_fields).length === 0) return;

                  Object.entries(data.known_fields).forEach(function(entry) {
                    var fieldName = entry[0];
                    var fieldValue = entry[1];
                    var input = document.querySelector('[name="' + fieldName + '"]');
                    if (!input || input.value.trim()) return;

                    input.value = fieldValue;
                    var fieldGroup = input.closest('.field-group');
                    if (fieldGroup && fieldName !== 'email') {
                      fieldGroup.style.opacity = '0.6';
                      fieldGroup.title = 'Preenchido automaticamente';
                    }
                  });
                })
                .catch(function() {});
              });
            }
          }

          document.getElementById('lead-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            var btn = document.getElementById('submit-btn');
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            var formData = new FormData(e.target);
            var data = Object.fromEntries(formData.entries());
            Object.assign(data, utmData);

            try {
              var res = await fetch('/api/forms/${formId}/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });
              var json = await res.json();

              if (json.errors) {
                btn.disabled = false;
                btn.textContent = 'Enviar';
                Object.entries(json.errors).forEach(function(entry) {
                  var field = entry[0], msg = entry[1];
                  var input = document.querySelector('[name="' + field + '"]');
                  if (input) {
                    var err = input.parentNode.querySelector('.error');
                    if (!err) { err = document.createElement('p'); err.className = 'error'; input.parentNode.appendChild(err); }
                    err.textContent = msg;
                  }
                });
                return;
              }

              if (json.redirect_url) {
                window.top.location.href = json.redirect_url;
              } else {
                document.getElementById('form-container').innerHTML =
                  '<div class="success-msg"><h2>Enviado!</h2><p>' + (json.message || 'Obrigado!') + '</p></div>';
              }
            } catch(err) {
              btn.disabled = false;
              btn.textContent = 'Enviar';
              alert('Erro ao enviar. Tente novamente.');
            }
          });
        ` }} />
    </>
  )
}
