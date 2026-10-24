// Reveal Material Symbols icons only once the icon font is actually ready, so
// their raw ligature text never flashes / overlaps headings on reload.
// External file (not inline) so the Content-Security-Policy can use a strict
// script-src 'self' with no 'unsafe-inline'.
(function () {
  var done = false;
  function ready() { if (done) return; done = true; document.documentElement.classList.add('icons-ready'); }
  try {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('24px "Material Symbols Outlined"').then(ready).catch(ready);
      document.fonts.ready.then(ready);
    }
  } catch (e) { /* ignore */ }
  window.setTimeout(ready, 2500); // hard fallback so icons never stay hidden
})();
