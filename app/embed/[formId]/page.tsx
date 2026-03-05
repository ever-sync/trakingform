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
          .form-desc { font-size: 14px; color: ${theme.textColor}; opacity: 0.8; margin-bottom: 24px; }
          .field-group { margin-bottom: 18px; }
          label { display: block; font-size: 14px; font-weight: 500; color: ${theme.textColor}; margin-bottom: 6px; }
          input:not([type='checkbox']):not([type='radio']), select, textarea { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: ${theme.borderRadius}px; font-size: 14px; color: ${theme.textColor}; outline: none; }
          input:not([type='checkbox']):not([type='radio']):focus, select:focus, textarea:focus { border-color: ${theme.primaryColor}; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
          .phone-field-row { display: flex; align-items: stretch; gap: 8px; }
          .phone-country { width: 132px; min-width: 132px; flex: 0 0 132px; padding-right: 8px; }
          .phone-input { flex: 1; min-width: 0; }
          .phone-field-row .error { width: 100%; }
          .choice-group { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 2px; }
          .choice-option { display: flex; align-items: flex-start; justify-content: flex-start; gap: 10px; margin: 0; font-weight: 400; text-align: left; cursor: pointer; }
          .choice-option input[type='checkbox'], .choice-option input[type='radio'] { width: 16px; min-width: 16px; max-width: 16px; height: 16px; margin: 2px 0 0; padding: 0; border: 1px solid #cbd5e1; flex: 0 0 16px; box-shadow: none; }
          .choice-option span { flex: 1; min-width: 0; line-height: 1.45; text-align: left; }
          @media (max-width: 520px) {
            .phone-country { width: 108px; min-width: 108px; flex-basis: 108px; }
          }
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
        {form.description && <p className="form-desc">{form.description}</p>}

        {isMultiStep && multiStepConfig.showProgressBar && (
          <div className="progress-bar-wrap">
            <div className="step-indicator" id="step-indicator" suppressHydrationWarning>
              {multiStepConfig.steps.map((s, i) => (
                <span key={i} className={i === 0 ? 'step-label current' : 'step-label'}>{s.title}</span>
              ))}
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                id="progress-bar"
                style={{ width: isMultiStep ? `${(1 / multiStepConfig.steps.length) * 100}%` : '0%' }}
                suppressHydrationWarning
              ></div>
            </div>
          </div>
        )}

        <div
          id="step-title"
          className="step-title"
          style={{ display: isMultiStep ? 'block' : 'none' }}
          suppressHydrationWarning
        >{isMultiStep ? multiStepConfig.steps[0]?.title : ''}</div>

        <form id="lead-form">
          <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
          <input type="hidden" name="_start_time" id="start-time" suppressHydrationWarning />
          <input type="hidden" name="_draft_id" id="draft-id" suppressHydrationWarning />
          {isProgressive && <input type="hidden" name="_progressive" value="1" />}
          {variantId && <input type="hidden" name="_variant_id" value={variantId} />}

          {fields.map((field) => {
            const stepIdx = isMultiStep
              ? multiStepConfig.steps.findIndex(s => s.fieldIds.includes(field.id))
              : 0
            const controlId = field.type === 'phone' ? `${field.name}__visible` : field.name
            const hasCustomPhonePlaceholder =
              field.type === 'phone' &&
              typeof field.placeholder === 'string' &&
              field.placeholder.trim().length > 0

            return (
              <div
                key={field.id}
                className={isMultiStep ? ['field-group', 'step-field', stepIdx === 0 ? 'active' : ''].filter(Boolean).join(' ') : 'field-group'}
                data-step={isMultiStep ? stepIdx : undefined}
              >
                {field.type !== 'hidden' && (
                  <label htmlFor={controlId}>
                    {field.label}
                    {field.required && <span className="required"> *</span>}
                  </label>
                )}

                {(field.type === 'text' || field.type === 'email') && (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    defaultValue={field.defaultValue ?? ''}
                  />
                )}

                {field.type === 'phone' && (
                  <div className="phone-field-row" data-phone-field={field.name}>
                    <select
                      className="phone-country"
                      data-phone-country={field.name}
                      defaultValue="BR"
                      aria-label={`${field.label} país`}
                    >
                      <option value="BR">🇧🇷 +55</option>
                      <option value="US">🇺🇸 +1</option>
                      <option value="PT">🇵🇹 +351</option>
                      <option value="AR">🇦🇷 +54</option>
                      <option value="MX">🇲🇽 +52</option>
                    </select>
                    <input
                      id={controlId}
                      className="phone-input"
                      type="tel"
                      suppressHydrationWarning
                      data-phone-visible={field.name}
                      data-has-custom-placeholder={hasCustomPhonePlaceholder ? '1' : '0'}
                      placeholder={hasCustomPhonePlaceholder ? field.placeholder : '(11) 91234-5678'}
                      required={field.required}
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={15}
                      defaultValue=""
                    />
                    <input
                      id={field.name}
                      name={field.name}
                      type="hidden"
                      data-phone-hidden={field.name}
                      defaultValue={field.defaultValue ?? ''}
                    />
                  </div>
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
                  <div className="choice-group">
                    {field.options?.map(opt => (
                      <label key={opt.value} className="choice-option">
                        <input type={field.type} name={field.name} value={opt.value} />
                        <span>{opt.label}</span>
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
              <button type="button" className="btn-prev" id="btn-prev" style={{ display: 'none' }} suppressHydrationWarning>Anterior</button>
              <button type="button" className="btn-next" id="btn-next" suppressHydrationWarning>Próximo</button>
            </div>
          ) : null}

          <button
            type="submit"
            className="submit-btn"
            id="submit-btn"
            style={{ display: isMultiStep ? 'none' : 'block' }}
            suppressHydrationWarning
          >
            Enviar
          </button>
        </form>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('DOMContentLoaded', function() {
            var startTimeEl = document.getElementById('start-time');
            if (startTimeEl) startTimeEl.value = Date.now();
          });

          var urlParams = new URLSearchParams(window.location.search);
          var utmData = {
            _utm_source: urlParams.get('utm_source') || '',
            _utm_medium: urlParams.get('utm_medium') || '',
            _utm_campaign: urlParams.get('utm_campaign') || '',
            _utm_term: urlParams.get('utm_term') || '',
            _utm_content: urlParams.get('utm_content') || '',
            _referrer: document.referrer || '',
          };
          var resumeDraftId = urlParams.get('resume') || '';
          var autosaveTimer = null;
          var draftIdInput = document.getElementById('draft-id');
          if (draftIdInput) draftIdInput.value = resumeDraftId;

          var isMultiStep = ${isMultiStep ? 'true' : 'false'};
          var steps = ${stepsJson};
          var currentStep = 0;
          var totalSteps = steps.length;
          var PHONE_COUNTRIES = {
            BR: { dial: '+55', min: 10, max: 11, placeholder: '(11) 91234-5678' },
            US: { dial: '+1', min: 10, max: 10, placeholder: '(201) 555-0123' },
            PT: { dial: '+351', min: 9, max: 9, placeholder: '912 345 678' },
            AR: { dial: '+54', min: 10, max: 10, placeholder: '11 2345-6789' },
            MX: { dial: '+52', min: 10, max: 10, placeholder: '55 1234 5678' },
          };

          function digitsOnly(value) {
            return String(value || '').replace(/\\D/g, '');
          }

          function formatPhoneLocal(countryCode, digits) {
            var d = digitsOnly(digits);
            if (!d) return '';

            if (countryCode === 'BR') {
              if (d.length > 11) d = d.slice(0, 11);
              if (d.length > 10) {
                return d.replace(/(\\d{2})(\\d{5})(\\d{0,4}).*/, '($1) $2-$3').trim();
              }
              return d.replace(/(\\d{2})(\\d{4})(\\d{0,4}).*/, '($1) $2-$3').trim();
            }

            if (countryCode === 'US') {
              if (d.length > 10) d = d.slice(0, 10);
              return d.replace(/(\\d{3})(\\d{3})(\\d{0,4}).*/, '($1) $2-$3').trim();
            }

            if (countryCode === 'PT') {
              if (d.length > 9) d = d.slice(0, 9);
              return d.replace(/(\\d{3})(\\d{3})(\\d{0,3}).*/, '$1 $2 $3').trim();
            }

            if (countryCode === 'AR') {
              if (d.length > 10) d = d.slice(0, 10);
              return d.replace(/(\\d{2})(\\d{4})(\\d{0,4}).*/, '$1 $2-$3').trim();
            }

            if (countryCode === 'MX') {
              if (d.length > 10) d = d.slice(0, 10);
              return d.replace(/(\\d{2})(\\d{4})(\\d{0,4}).*/, '$1 $2 $3').trim();
            }

            return d;
          }

          function getPhoneDisplayMaxLength(countryCode) {
            var cfg = PHONE_COUNTRIES[countryCode] || PHONE_COUNTRIES.BR;
            var sampleDigits = ''.padStart(cfg.max, '9');
            return formatPhoneLocal(countryCode, sampleDigits).length;
          }

          function updatePhonePlaceholder(inputEl, countryCode) {
            if (!inputEl) return;
            if (inputEl.getAttribute('data-has-custom-placeholder') === '1') return;
            var cfg = PHONE_COUNTRIES[countryCode] || PHONE_COUNTRIES.BR;
            inputEl.placeholder = cfg.placeholder;
          }

          function removeFieldError(container) {
            if (!container) return;
            var prevErr = container.querySelector('.error');
            if (prevErr) prevErr.remove();
          }

          function setFieldError(container, message) {
            if (!container) return;
            removeFieldError(container);
            var err = document.createElement('p');
            err.className = 'error';
            err.textContent = message;
            container.appendChild(err);
          }

          function findPhoneElements(fieldName) {
            var wrapper = document.querySelector('[data-phone-field="' + fieldName + '"]');
            if (!wrapper) return null;
            return {
              wrapper: wrapper,
              country: wrapper.querySelector('[data-phone-country="' + fieldName + '"]'),
              visible: wrapper.querySelector('[data-phone-visible="' + fieldName + '"]'),
              hidden: wrapper.querySelector('[data-phone-hidden="' + fieldName + '"]'),
            };
          }

          function applyPhoneHiddenValue(fieldName) {
            var elements = findPhoneElements(fieldName);
            if (!elements || !elements.country || !elements.visible || !elements.hidden) return;

            var cfg = PHONE_COUNTRIES[elements.country.value] || PHONE_COUNTRIES.BR;
            var digits = digitsOnly(elements.visible.value);
            elements.visible.value = formatPhoneLocal(elements.country.value, digits);
            elements.visible.maxLength = getPhoneDisplayMaxLength(elements.country.value);
            updatePhonePlaceholder(elements.visible, elements.country.value);
            elements.hidden.value = digits ? (cfg.dial + ' ' + digits) : '';
          }

          function hydratePhoneFromHidden(fieldName) {
            var elements = findPhoneElements(fieldName);
            if (!elements || !elements.country || !elements.visible || !elements.hidden) return;

            var storedValue = String(elements.hidden.value || '').trim();
            if (!storedValue) {
              applyPhoneHiddenValue(fieldName);
              return;
            }

            var matchedCountry = elements.country.value || 'BR';
            Object.keys(PHONE_COUNTRIES).forEach(function(code) {
              if (storedValue.indexOf(PHONE_COUNTRIES[code].dial) === 0) {
                matchedCountry = code;
              }
            });

            elements.country.value = matchedCountry;
            var localDigits = digitsOnly(storedValue);
            var dialDigits = digitsOnly(PHONE_COUNTRIES[matchedCountry].dial);
            if (localDigits.indexOf(dialDigits) === 0) {
              localDigits = localDigits.slice(dialDigits.length);
            }

            elements.visible.value = formatPhoneLocal(matchedCountry, localDigits);
            updatePhonePlaceholder(elements.visible, matchedCountry);
            applyPhoneHiddenValue(fieldName);
          }

          function validatePhoneField(fieldName, checkRequired) {
            var elements = findPhoneElements(fieldName);
            if (!elements || !elements.country || !elements.visible || !elements.hidden) return true;

            var cfg = PHONE_COUNTRIES[elements.country.value] || PHONE_COUNTRIES.BR;
            var digits = digitsOnly(elements.visible.value);
            var isRequired = !!elements.visible.required;

            removeFieldError(elements.wrapper);

            if (!digits) {
              if (checkRequired && isRequired) {
                setFieldError(elements.wrapper, 'Este campo é obrigatório');
                return false;
              }
              elements.hidden.value = '';
              return true;
            }

            if (digits.length < cfg.min || digits.length > cfg.max) {
              setFieldError(elements.wrapper, 'Telefone inválido para o país selecionado');
              return false;
            }

            if (/^(\\d)\\1+$/.test(digits)) {
              setFieldError(elements.wrapper, 'Telefone inválido');
              return false;
            }

            applyPhoneHiddenValue(fieldName);
            return true;
          }

          function initPhoneFields() {
            var wrappers = document.querySelectorAll('[data-phone-field]');
            wrappers.forEach(function(wrapper) {
              var fieldName = wrapper.getAttribute('data-phone-field');
              if (!fieldName) return;

              var elements = findPhoneElements(fieldName);
              if (!elements || !elements.country || !elements.visible || !elements.hidden) return;

              elements.country.addEventListener('change', function() {
                applyPhoneHiddenValue(fieldName);
                validatePhoneField(fieldName, false);
              });

              elements.visible.addEventListener('input', function() {
                applyPhoneHiddenValue(fieldName);
                removeFieldError(elements.wrapper);
              });

              elements.visible.addEventListener('keydown', function(event) {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                if (event.key && event.key.length === 1 && !/\\d/.test(event.key)) {
                  event.preventDefault();
                }
              });

              elements.visible.addEventListener('blur', function() {
                validatePhoneField(fieldName, true);
              });

              hydratePhoneFromHidden(fieldName);
            });
          }

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

          function getDraftFingerprint() {
            try {
              var key = 'leadform_fp_${formId}';
              var stored = localStorage.getItem(key);
              if (stored) return stored;
              var base = [navigator.userAgent || '', navigator.language || '', screen.width || 0, screen.height || 0].join('|');
              var fp = btoa(unescape(encodeURIComponent(base))).slice(0, 64);
              localStorage.setItem(key, fp);
              return fp;
            } catch (e) {
              return 'fp_' + Date.now();
            }
          }

          function collectDraftData() {
            var formEl = document.getElementById('lead-form');
            if (!formEl) return null;
            var formData = new FormData(formEl);
            var dataObj = Object.fromEntries(formData.entries());
            var email = '';
            var phone = '';
            Object.keys(dataObj).forEach(function(key) {
              if (!email && key.toLowerCase().indexOf('email') >= 0) email = String(dataObj[key] || '').trim();
              if (!phone && (key.toLowerCase().indexOf('phone') >= 0 || key.toLowerCase().indexOf('telefone') >= 0 || key.toLowerCase().indexOf('celular') >= 0)) {
                phone = String(dataObj[key] || '').trim();
              }
            });

            return {
              fingerprint: getDraftFingerprint(),
              email: email || undefined,
              phone: phone || undefined,
              progress_step: currentStep,
              data: dataObj,
            };
          }

          function scheduleDraftSave() {
            if (autosaveTimer) window.clearTimeout(autosaveTimer);
            autosaveTimer = window.setTimeout(function() {
              var payload = collectDraftData();
              if (!payload) return;
              fetch('/api/forms/${formId}/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              .then(function(r) { return r.json(); })
              .then(function(res) {
                if (res && res.draftId && draftIdInput) {
                  draftIdInput.value = String(res.draftId);
                }
              })
              .catch(function() {});
            }, 900);
          }

          function restoreDraft(draftPayload) {
            if (!draftPayload || !draftPayload.data || typeof draftPayload.data !== 'object') return;
            var entries = Object.entries(draftPayload.data);
            entries.forEach(function(entry) {
              var field = entry[0];
              var value = entry[1];
              var input = document.querySelector('[name=\"' + field + '\"]');
              if (!input) return;
              if (input.type === 'checkbox' || input.type === 'radio') return;
              input.value = String(value || '');
            });

            if (isMultiStep && Number.isFinite(draftPayload.progress_step)) {
              currentStep = Math.max(0, Math.min(totalSteps - 1, Number(draftPayload.progress_step)));
              updateStepUI();
            }
          }

          function validateCurrentStep() {
            var activeFields = document.querySelectorAll('.step-field.active input[required], .step-field.active select[required], .step-field.active textarea[required]');
            var valid = true;
            activeFields.forEach(function(field) {
              var phoneFieldName = field.getAttribute('data-phone-visible');
              if (phoneFieldName) {
                if (!validatePhoneField(phoneFieldName, true)) {
                  valid = false;
                }
                return;
              }

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

          window.addEventListener('load', function() {
            initPhoneFields();

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
          });

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

                    input.value = String(fieldValue || '');
                    var phoneVisible = document.querySelector('[data-phone-visible="' + fieldName + '"]');
                    if (phoneVisible) {
                      hydratePhoneFromHidden(fieldName);
                    }
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

          if (resumeDraftId) {
            fetch('/api/forms/${formId}/draft', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ draftId: resumeDraftId }),
            })
              .then(function(r) { return r.json(); })
              .then(function(payload) {
                if (payload && payload.draft) {
                  restoreDraft(payload.draft);
                }
              })
              .catch(function() {});
          }

          var formForAutosave = document.getElementById('lead-form');
          if (formForAutosave) {
            formForAutosave.addEventListener('input', scheduleDraftSave);
            formForAutosave.addEventListener('change', scheduleDraftSave);
          }

          document.getElementById('lead-form').addEventListener('submit', async function(e) {
            e.preventDefault();

            var phoneFieldsValid = true;
            document.querySelectorAll('[data-phone-field]').forEach(function(wrapper) {
              var fieldName = wrapper.getAttribute('data-phone-field');
              if (!fieldName) return;
              if (!validatePhoneField(fieldName, true)) {
                phoneFieldsValid = false;
              }
            });
            if (!phoneFieldsValid) return;

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
              var json = null;
              try {
                json = await res.json();
              } catch (e) {
                json = null;
              }

              if (!res.ok) {
                btn.disabled = false;
                btn.textContent = 'Enviar';
                var msg = (json && (json.error || json.message)) ? (json.error || json.message) : 'Erro ao enviar. Tente novamente.';
                alert(msg);
                return;
              }

              if (json && json.errors) {
                btn.disabled = false;
                btn.textContent = 'Enviar';
                Object.entries(json.errors).forEach(function(entry) {
                  var field = entry[0], msg = entry[1];
                  var input =
                    document.querySelector('[name="' + field + '"]') ||
                    document.querySelector('[data-phone-visible="' + field + '"]');
                  if (input) {
                    var err = input.parentNode.querySelector('.error');
                    if (!err) { err = document.createElement('p'); err.className = 'error'; input.parentNode.appendChild(err); }
                    err.textContent = msg;
                  }
                });
                return;
              }

              if (json && json.redirect_url) {
                window.top.location.href = json.redirect_url;
              } else {
                document.getElementById('form-container').innerHTML =
                  '<div class="success-msg"><h2>Enviado!</h2><p>' + ((json && json.message) || 'Obrigado!') + '</p></div>';
              }
            } catch(err) {
              btn.disabled = false;
              btn.textContent = 'Enviar';
              console.error('[TrackingForm] Submit error:', err);
              alert('Erro ao enviar: ' + (err && err.message ? err.message : String(err)));
            }
          });
        ` }} />
    </>
  )
}
