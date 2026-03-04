export function generateEmbedCode(formId: string, appUrl: string) {
  const iframeCode = `<iframe
  src="${appUrl}/embed/${formId}"
  width="100%"
  height="600"
  frameborder="0"
  style="border:none;border-radius:8px;"
  allow="geolocation"
></iframe>`

  const jsCode = `<!-- LeadForm Embed -->
<div id="leadform-${formId}"></div>
<script>
  (function(w,d,s,f){
    var j=d.createElement(s);
    j.async=true;
    j.src='${appUrl}/embed.js';
    j.setAttribute('data-form',f);
    j.setAttribute('data-container','leadform-'+f);
    d.head.appendChild(j);
  })(window,document,'script','${formId}');
</script>`

  return { iframeCode, jsCode }
}
