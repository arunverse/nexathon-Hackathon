const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '../dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

if (!fs.existsSync(INDEX_HTML)) {
  console.error('[generate-route-html] Error: dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const template = fs.readFileSync(INDEX_HTML, 'utf8');

const routeData = require('../src/data/routeMeta.json');
const b2bContent = require('../src/data/b2bIntelligenceContent.json');
const businessSignalsContent = require('../src/data/businessSignalsContent.json');
const b2bIntentContent = require('../src/data/b2bIntentIntelligenceContent.json');
const companyContent = require('../src/data/companyIntelligenceContent.json');
const businessNetworkContent = require('../src/data/businessNetworkContent.json');
const careersContent = require('../src/data/careersContent.json');

const CANONICAL_DOMAIN = routeData.CANONICAL_DOMAIN;
const PUBLIC_ROUTES = routeData.PUBLIC_ROUTES;

// Derive static route entries for all public pages (excluding root/home which are index.html)
const ROUTE_DATA = Object.fromEntries(
  Object.entries(PUBLIC_ROUTES)
    .filter(([path]) => path !== '/' && path !== '/home')
    .map(([path, data]) => [
      path,
      {
        title: data.title,
        desc: data.desc,
        canonical: `${CANONICAL_DOMAIN}${data.canonicalPath}`,
      },
    ])
);

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeMeta(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/"/g, '&quot;');
}

function generateB2BIntelligenceBody(content) {
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Hero Section -->
        <header style="padding: 3rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 3rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <span style="color: #64748b;">B2B Business Intelligence</span>
          </nav>
          <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7; background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;">
            ${escapeHtml(content.badge)}
          </div>
          <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1.25rem;">
            ${escapeHtml(content.h1)}
          </h1>
          <p style="font-size: 1.1875rem; color: #475569; max-width: 820px; line-height: 1.6; margin: 0 0 1.75rem;">
            ${escapeHtml(content.subtitle)}
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <a href="/signup" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Opportunities</a>
            <a href="/about" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">About EBEXTA</a>
          </div>
        </header>

        <main style="display: flex; flex-direction: column; gap: 4rem;">

          <!-- Section 1: What Is B2B Business Intelligence? -->
          <section id="${content.section1.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section1.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section1.h2)}</h2>
            ${content.section1.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section1.pillars.map(pill => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(pill.num)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(pill.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(pill.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 2: Why Traditional B2B Data Isn't Enough -->
          <section id="${content.section2.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #d97706;">${escapeHtml(content.section2.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section2.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section2.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
              <div style="padding: 1.5rem; border: 1px solid #fecaca; border-radius: 1rem; background: #fef2f2;">
                <h3 style="font-size: 1rem; font-weight: 700; color: #dc2626; text-transform: uppercase; margin: 0 0 1rem;">Traditional Static Databases</h3>
                <ul style="padding-left: 1.25rem; margin: 0; color: #991b1b; font-size: 0.9375rem; display: flex; flex-direction: column; gap: 0.75rem;">
                  ${content.section2.traditionalFlaws.map(f => `<li><strong>${escapeHtml(f.title)}:</strong> ${escapeHtml(f.desc)}</li>`).join('\n                  ')}
                </ul>
              </div>
              <div style="padding: 1.5rem; border: 1px solid #a7f3d0; border-radius: 1rem; background: #ecfdf5;">
                <h3 style="font-size: 1rem; font-weight: 700; color: #059669; text-transform: uppercase; margin: 0 0 1rem;">EBEXTA Contextual Intelligence</h3>
                <ul style="padding-left: 1.25rem; margin: 0; color: #065f46; font-size: 0.9375rem; display: flex; flex-direction: column; gap: 0.75rem;">
                  ${content.section2.ebextaAdvantages.map(a => `<li><strong>${escapeHtml(a.title)}:</strong> ${escapeHtml(a.desc)}</li>`).join('\n                  ')}
                </ul>
              </div>
            </div>
          </section>

          <!-- Section 3: The Signals Behind Business Opportunities -->
          <section id="${content.section3.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section3.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section3.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section3.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section3.signals.map(s => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.6875rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(s.tag)}</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(s.title)}</h3>
                <p style="font-size: 0.875rem; color: #64748b; margin: 0;">${escapeHtml(s.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Dedicated Topic Guide</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Explore B2B Buying Signals &amp; Business Signals</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Learn how observable company activity differs from buying intent and how public data surfaces genuine opportunities.</p>
              </div>
              <a href="/business-signals" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Read Business Signals Guide &rarr;</a>
            </div>
          </section>

          <!-- Section 4: Business Intent and Company Intelligence -->
          <section id="${content.section4.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #059669;">${escapeHtml(content.section4.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section4.h2)}</h2>
            ${content.section4.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Intent Intelligence Guide</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Explore B2B Intent Data &amp; Buyer Intent Signals</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Discover how B2B intent intelligence connects observable business signals and company context to interpret potential buyer intent without invasive tracking.</p>
              </div>
              <a href="/b2b-intent-intelligence" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Read Intent Intelligence Guide &rarr;</a>
            </div>
            <div style="margin-top: 1rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Next in Series · Company Research &amp; Intelligence</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Explore B2B Company Intelligence &amp; Decision-Maker Research</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Learn how company intelligence combines organizational structures, business signals, and verified decision-maker context to discover enterprise opportunities.</p>
              </div>
              <a href="/company-intelligence" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Company Intelligence &rarr;</a>
            </div>
            <div style="margin-top: 1rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Network &amp; Engagement Layer</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Connect Through the EBEXTA B2B Business Network</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Discover how EBEXTA connects business intelligence and observable signals with a bilateral network of verified enterprises, sector leaders, and professionals.</p>
              </div>
              <a href="/b2b-business-network" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Business Network &rarr;</a>
            </div>
          </section>

          <!-- Section 5: From Discovery to Engagement -->
          <section id="${content.section5.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section5.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section5.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section5.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section5.stages.map(st => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(st.stage)} · ${escapeHtml(st.num)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(st.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(st.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 6: How EBEXTA Approaches B2B Business Intelligence -->
          <section id="${content.section6.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section6.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section6.h2)}</h2>
            <blockquote style="margin: 0 0 1.5rem; padding: 1.5rem; border-left: 4px solid #2563eb; background: #f8fafc; border-radius: 0 1rem 1rem 0; font-size: 1.125rem; font-weight: 600; color: #0f172a; font-style: italic;">
              "${escapeHtml(content.positioning)}"
            </blockquote>
            ${content.section6.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <p style="margin-top: 1rem;">
              <a href="${content.section6.aboutLink}" style="color: #2563eb; font-weight: 600; text-decoration: none;">${escapeHtml(content.section6.aboutLinkText)} →</a>
            </p>
          </section>

          <!-- Section 7: Who Is B2B Business Intelligence For? -->
          <section id="${content.section7.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section7.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section7.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section7.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section7.audiences.map(aud => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(aud.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(aud.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 8: Frequently Asked Questions -->
          <section id="${content.section8.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section8.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section8.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section8.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section8.faqs.map(faq => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(faq.q)}</h3>
                <p style="font-size: 0.9375rem; color: #475569; margin: 0; line-height: 1.6;">${escapeHtml(faq.a)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Call to Action -->
          <section style="padding: 3rem 2rem; background: #0f172a; border-radius: 1.5rem; color: #ffffff; text-align: center; border: 1px solid #1e293b;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; display: inline-block; margin-bottom: 0.75rem;">${escapeHtml(content.cta.badge)}</span>
            <h2 style="font-size: 2.25rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">${escapeHtml(content.cta.h2)}</h2>
            <p style="font-size: 1.125rem; color: #94a3b8; max-width: 680px; margin: 0 auto 2rem; line-height: 1.6;">${escapeHtml(content.cta.desc)}</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <a href="${content.cta.primary.href}" style="background: #2563eb; color: #ffffff; padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block;">${escapeHtml(content.cta.primary.text)}</a>
              <a href="${content.cta.secondary.href}" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">${escapeHtml(content.cta.secondary.text)}</a>
            </div>
          </section>

        </main>

        <!-- Footer with Crawlable Internal Links -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
            <a href="/b2b-business-intelligence" style="color: #2563eb; text-decoration: none; font-weight: 600;">Intelligence Guide</a>
            <a href="/business-signals" style="color: #475569; text-decoration: none;">Business Signals</a>
            <a href="/b2b-intent-intelligence" style="color: #475569; text-decoration: none;">Intent Intelligence</a>
            <a href="/company-intelligence" style="color: #475569; text-decoration: none;">Company Intelligence</a>
            <a href="/b2b-business-network" style="color: #475569; text-decoration: none;">Business Network</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">© 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

function generateBusinessSignalsBody(content) {
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Hero Section -->
        <header style="padding: 3rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 3rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <span style="color: #64748b;">Business Signals</span>
          </nav>
          <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7; background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;">
            ${escapeHtml(content.badge)}
          </div>
          <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1.25rem;">
            ${escapeHtml(content.h1)}
          </h1>
          <p style="font-size: 1.1875rem; color: #475569; max-width: 820px; line-height: 1.6; margin: 0 0 1.75rem;">
            ${escapeHtml(content.subtitle)}
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <a href="/signup" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Discover Business Signals</a>
            <a href="/b2b-business-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore B2B Intelligence</a>
          </div>
        </header>

        <main style="display: flex; flex-direction: column; gap: 4rem;">

          <!-- Section 1: What Are Business Signals? -->
          <section id="${content.section1.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section1.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section1.h2)}</h2>
            ${content.section1.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section1.traits.map(t => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(t.num)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(t.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(t.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 2: What Are B2B Buying Signals? -->
          <section id="${content.section2.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6366f1;">${escapeHtml(content.section2.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section2.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section2.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
              <div style="padding: 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(content.section2.distinction.businessSignal.title)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #1e3a8a; margin: 0 0 0.5rem;">${escapeHtml(content.section2.distinction.businessSignal.formula)}</h3>
                <p style="font-size: 0.9375rem; color: #1e40af; margin: 0;">${escapeHtml(content.section2.distinction.businessSignal.desc)}</p>
              </div>
              <div style="padding: 1.5rem; border: 1px solid #a7f3d0; border-radius: 1rem; background: #ecfdf5;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #059669; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(content.section2.distinction.buyingSignal.title)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #064e3b; margin: 0 0 0.5rem;">${escapeHtml(content.section2.distinction.buyingSignal.formula)}</h3>
                <p style="font-size: 0.9375rem; color: #065f46; margin: 0;">${escapeHtml(content.section2.distinction.buyingSignal.desc)}</p>
              </div>
            </div>
            ${content.section2.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
          </section>

          <!-- Section 3: Examples of Business Signals -->
          <section id="${content.section3.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #059669;">${escapeHtml(content.section3.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section3.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section3.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section3.examples.map(ex => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.6875rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(ex.tag)}</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(ex.title)}</h3>
                <p style="font-size: 0.875rem; color: #64748b; margin: 0;">${escapeHtml(ex.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 4: How Business Signals Help Discover Opportunities -->
          <section id="${content.section4.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section4.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section4.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section4.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section4.steps.map(st => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff; display: flex; gap: 1.25rem; align-items: flex-start;">
                <div style="font-size: 1rem; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 0.5rem 0.875rem; border-radius: 0.75rem; shrink-0;">${escapeHtml(st.num)}</div>
                <div>
                  <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.375rem;">${escapeHtml(st.title)}</h3>
                  <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(st.desc)}</p>
                </div>
              </div>`).join('\n              ')}
            </div>
            <p style="font-size: 0.9375rem; color: #64748b; font-style: italic; margin-top: 1rem;">${escapeHtml(content.section4.disclaimer)}</p>
          </section>

          <!-- Section 5: Business Signals vs Buying Intent -->
          <section id="${content.section5.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #d97706;">${escapeHtml(content.section5.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section5.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section5.intro)}</p>
            <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 1rem; margin-bottom: 1.5rem;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9375rem;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <th style="padding: 1rem; font-weight: 700; color: #0f172a;">Dimension</th>
                    <th style="padding: 1rem; font-weight: 700; color: #2563eb;">Business Signal</th>
                    <th style="padding: 1rem; font-weight: 700; color: #059669;">Buying Intent</th>
                  </tr>
                </thead>
                <tbody>
                  ${content.section5.comparison.map((c, idx) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 1rem; font-weight: 600; color: #0f172a; white-space: nowrap;">${escapeHtml(c.aspect)}</td>
                    <td style="padding: 1rem; color: #334155;">${escapeHtml(c.signal)}</td>
                    <td style="padding: 1rem; color: #334155;">${escapeHtml(c.intent)}</td>
                  </tr>`).join('\n                  ')}
                </tbody>
              </table>
            </div>
            <div style="padding: 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
              <p style="font-size: 0.9375rem; color: #1e40af; margin: 0; line-height: 1.6;">${escapeHtml(content.section5.summary)}</p>
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Next In Cluster</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Explore B2B Intent Intelligence &amp; Buyer Intent</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Learn how to interpret observable company movements, evaluate buyer intent signals, and discover verified B2B opportunities without behavioral surveillance.</p>
              </div>
              <a href="/b2b-intent-intelligence" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Read Intent Intelligence Guide &rarr;</a>
            </div>
            <div style="margin-top: 1rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Next In Cluster · Company Research</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Explore B2B Company Intelligence &amp; Research</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Discover how comprehensive company research connects operational models, observed business signals, and verified decision-maker context.</p>
              </div>
              <a href="/company-intelligence" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Read Company Intelligence Guide &rarr;</a>
            </div>
            <div style="margin-top: 1rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Network &amp; Engagement Layer</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Connect Through the EBEXTA B2B Business Network</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Discover how observable business signals translate into verified commercial relationships across the EBEXTA business network.</p>
              </div>
              <a href="/b2b-business-network" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Business Network &rarr;</a>
            </div>
          </section>

          <!-- Section 6: How EBEXTA Finds and Surfaces Business Signals -->
          <section id="${content.section6.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section6.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section6.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section6.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
              ${content.section6.capabilities.map(cap => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(cap.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(cap.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <div style="padding: 1.25rem 1.5rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: #f8fafc;">
              <p style="font-size: 0.875rem; color: #475569; margin: 0;">${escapeHtml(content.section6.groundingNote)}</p>
            </div>
          </section>

          <!-- Section 7: From Business Signals to Business Opportunities -->
          <section id="${content.section7.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section7.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section7.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section7.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
              ${content.section7.framework.map(fw => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">${escapeHtml(fw.stage)}</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: #2563eb; margin-bottom: 0.5rem;">${escapeHtml(fw.action)}</div>
                <h3 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(fw.title)}</h3>
                <p style="font-size: 0.875rem; color: #64748b; margin: 0;">${escapeHtml(fw.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <p style="margin: 0;">
              <a href="/b2b-business-intelligence" style="color: #2563eb; font-weight: 600; text-decoration: none;">Explore how the full EBEXTA intelligence lifecycle works in our B2B Business Intelligence Guide &rarr;</a>
            </p>
          </section>

          <!-- Section 8: Who Uses Business Signals? -->
          <section id="${content.section8.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section8.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section8.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section8.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section8.audiences.map(aud => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(aud.role)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(aud.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 9: Frequently Asked Questions -->
          <section id="${content.section9.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section9.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section9.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section9.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section9.faqs.map(faq => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(faq.q)}</h3>
                <p style="font-size: 0.9375rem; color: #475569; margin: 0; line-height: 1.6;">${escapeHtml(faq.a)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Call to Action -->
          <section style="padding: 3rem 2rem; background: #0f172a; border-radius: 1.5rem; color: #ffffff; text-align: center; border: 1px solid #1e293b;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; display: inline-block; margin-bottom: 0.75rem;">${escapeHtml(content.cta.badge)}</span>
            <h2 style="font-size: 2.25rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">${escapeHtml(content.cta.h2)}</h2>
            <p style="font-size: 1.125rem; color: #94a3b8; max-width: 680px; margin: 0 auto 2rem; line-height: 1.6;">${escapeHtml(content.cta.desc)}</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <a href="${content.cta.primary.href}" style="background: #2563eb; color: #ffffff; padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block;">${escapeHtml(content.cta.primary.text)}</a>
              <a href="${content.cta.secondary.href}" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">${escapeHtml(content.cta.secondary.text)}</a>
            </div>
          </section>

        </main>

        <!-- Footer with Crawlable Internal Links -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/b2b-business-intelligence" style="color: #475569; text-decoration: none;">Intelligence Guide</a>
            <a href="/business-signals" style="color: #2563eb; text-decoration: none; font-weight: 600;">Business Signals</a>
            <a href="/b2b-intent-intelligence" style="color: #475569; text-decoration: none;">Intent Intelligence</a>
            <a href="/company-intelligence" style="color: #475569; text-decoration: none;">Company Intelligence</a>
            <a href="/b2b-business-network" style="color: #475569; text-decoration: none;">Business Network</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">© 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

function generateB2BIntentIntelligenceBody(content) {
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Hero Section -->
        <header style="padding: 3rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 3rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <a href="/business-signals" style="color: #2563eb; text-decoration: none;">Business Signals</a> / <span style="color: #64748b;">B2B Intent Intelligence</span>
          </nav>
          <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7; background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;">
            ${escapeHtml(content.badge)}
          </div>
          <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1.25rem;">
            ${escapeHtml(content.h1)}
          </h1>
          <p style="font-size: 1.1875rem; color: #475569; max-width: 820px; line-height: 1.6; margin: 0 0 1.75rem;">
            ${escapeHtml(content.subtitle)}
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
            <a href="/signup" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Potential Opportunities</a>
            <a href="/business-signals" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Business Signals</a>
            <a href="/b2b-business-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">B2B Business Intelligence</a>
          </div>
          <div style="padding: 1rem 1.25rem; border: 1px solid #bfdbfe; border-radius: 0.75rem; background: #eff6ff; font-size: 0.875rem; color: #1e40af;">
            <strong>Ethical &amp; Transparent Intelligence: </strong>${escapeHtml(content.positioning)}
          </div>
        </header>

        <!-- Main Semantic Article -->
        <main style="display: flex; flex-direction: column; gap: 3.5rem;">
          
          <!-- Section 1: What Is B2B Intent Data? -->
          <section id="${content.section1.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section1.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section1.h2)}</h2>
            ${content.section1.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section1.principles.map(item => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(item.num)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(item.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(item.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 2: What Is Buyer Intent? -->
          <section id="${content.section2.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section2.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section2.h2)}</h2>
            ${content.section2.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section2.stages.map(stg => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(stg.stage)}</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(stg.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(stg.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <p style="font-size: 0.875rem; font-style: italic; color: #64748b; margin-top: 1rem;">${escapeHtml(content.section2.disclaimer)}</p>
          </section>

          <!-- Section 3: Business Signals vs B2B Intent -->
          <section id="${content.section3.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section3.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section3.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section3.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
              ${content.section3.comparison.map(item => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">Dimension</div>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 0.75rem;">${escapeHtml(item.concept)}</h3>
                <p style="font-size: 0.9375rem; color: #334155; margin-bottom: 0.75rem;"><strong>Definition:</strong> ${escapeHtml(item.definition)}</p>
                <p style="font-size: 0.9375rem; color: #475569; margin-bottom: 0.75rem;"><strong>Nature:</strong> ${escapeHtml(item.nature)}</p>
                <div style="padding: 0.75rem; border-radius: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 0.875rem; color: #0f172a;">
                  <strong>Example:</strong> ${escapeHtml(item.example)}
                </div>
              </div>`).join('\n              ')}
            </div>
            <div style="padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <p style="font-size: 0.9375rem; color: #1e40af; margin: 0;">
                ${escapeHtml(content.section3.crossLink.text)} <a href="${content.section3.crossLink.href}" style="color: #2563eb; font-weight: 700; text-decoration: underline;">${escapeHtml(content.section3.crossLink.linkText)}</a>.
              </p>
              <a href="${content.section3.crossLink.href}" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Signals &rarr;</a>
            </div>
          </section>

          <!-- Section 4: Examples of B2B Intent Signals -->
          <section id="${content.section4.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section4.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section4.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section4.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; margin-bottom: 1rem;">
              ${content.section4.examples.map(ex => `
              <div style="padding: 1.25rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.6875rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(ex.tag)}</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(ex.title)}</h3>
                <p style="font-size: 0.875rem; color: #64748b; margin: 0;">${escapeHtml(ex.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <p style="font-size: 0.875rem; font-style: italic; color: #64748b; margin-top: 1rem;">${escapeHtml(content.section4.note)}</p>
          </section>

          <!-- Section 5: How B2B Intent Intelligence Helps Discover Opportunities -->
          <section id="${content.section5.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section5.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section5.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section5.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section5.steps.map(step => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff; display: flex; align-items: center; gap: 1.25rem;">
                <div style="width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: monospace; font-size: 1.125rem; flex-shrink: 0;">
                  ${escapeHtml(step.num)}
                </div>
                <div>
                  <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.25rem;">${escapeHtml(step.title)}</h3>
                  <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(step.desc)}</p>
                </div>
              </div>`).join('\n              ')}
            </div>
            <p style="font-size: 0.875rem; font-style: italic; color: #64748b; margin-top: 1rem;">${escapeHtml(content.section5.disclaimer)}</p>
          </section>

          <!-- Section 6: How EBEXTA Approaches B2B Intent Intelligence -->
          <section id="${content.section6.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section6.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section6.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section6.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
              ${content.section6.framework.map(fw => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">${escapeHtml(fw.stage)}</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: #2563eb; margin-bottom: 0.5rem;">${escapeHtml(fw.action)}</div>
                <h3 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(fw.title)}</h3>
                <p style="font-size: 0.875rem; color: #64748b; margin: 0;">${escapeHtml(fw.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <div style="padding: 1rem 1.25rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: #f8fafc; font-size: 0.875rem; color: #475569;">
              <strong>Privacy &amp; Compliance Grounding: </strong>${escapeHtml(content.section6.grounding)}
            </div>
          </section>

          <!-- Section 7: Why Context Matters in B2B Intent -->
          <section id="${content.section7.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section7.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section7.h2)}</h2>
            ${content.section7.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-top: 1.5rem; margin-bottom: 1.5rem;">
              ${content.section7.dimensions.map(dim => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(dim.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(dim.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <p style="font-size: 0.9375rem; color: #1e40af; font-weight: 600; padding: 1rem 1.25rem; background: #eff6ff; border-radius: 0.75rem; border: 1px solid #bfdbfe;">
              ${escapeHtml(content.section7.takeaway)}
            </p>
          </section>

          <!-- Section 8: Who Uses B2B Intent Intelligence? -->
          <section id="${content.section8.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section8.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section8.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section8.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section8.audiences.map(aud => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(aud.role)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(aud.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Topical Authority Cluster</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Explore B2B Company Intelligence &amp; Decision-Maker Research</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Learn how company intelligence combines organizational structures, business signals, and verified decision-maker context to discover enterprise opportunities.</p>
              </div>
              <a href="/company-intelligence" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Read Company Intelligence Guide &rarr;</a>
            </div>
            <div style="margin-top: 1rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Network &amp; Engagement Layer</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0;">Connect Through the EBEXTA B2B Business Network</h3>
                <p style="font-size: 0.875rem; color: #475569; margin: 0;">Move from evaluating buyer intent to active, bilateral engagement across a verified network of companies, sector leaders, and professionals.</p>
              </div>
              <a href="/b2b-business-network" style="background: #2563eb; color: #ffffff; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore Business Network &rarr;</a>
            </div>
          </section>

          <!-- Section 9: Frequently Asked Questions -->
          <section id="${content.section9.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section9.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section9.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section9.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section9.faqs.map(faq => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(faq.q)}</h3>
                <p style="font-size: 0.9375rem; color: #475569; margin: 0; line-height: 1.6;">${escapeHtml(faq.a)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Call to Action -->
          <section style="padding: 3rem 2rem; background: #0f172a; border-radius: 1.5rem; color: #ffffff; text-align: center; border: 1px solid #1e293b;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; display: inline-block; margin-bottom: 0.75rem;">${escapeHtml(content.cta.badge)}</span>
            <h2 style="font-size: 2.25rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">${escapeHtml(content.cta.h2)}</h2>
            <p style="font-size: 1.125rem; color: #94a3b8; max-width: 680px; margin: 0 auto 2rem; line-height: 1.6;">${escapeHtml(content.cta.desc)}</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <a href="${content.cta.primary.href}" style="background: #2563eb; color: #ffffff; padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block;">${escapeHtml(content.cta.primary.text)}</a>
              <a href="${content.cta.secondary.href}" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">${escapeHtml(content.cta.secondary.text)}</a>
            </div>
          </section>

        </main>

        <!-- Footer with Crawlable Internal Links -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/b2b-business-intelligence" style="color: #475569; text-decoration: none;">Intelligence Guide</a>
            <a href="/business-signals" style="color: #475569; text-decoration: none;">Business Signals</a>
            <a href="/b2b-intent-intelligence" style="color: #2563eb; text-decoration: none; font-weight: 600;">Intent Intelligence</a>
            <a href="/company-intelligence" style="color: #475569; text-decoration: none;">Company Intelligence</a>
            <a href="/b2b-business-network" style="color: #475569; text-decoration: none;">Business Network</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">© 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

function generateCompanyIntelligenceBody(content) {
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Hero Section -->
        <header style="padding: 3rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 3rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <a href="/b2b-business-intelligence" style="color: #2563eb; text-decoration: none;">B2B Business Intelligence</a> / <a href="/business-signals" style="color: #2563eb; text-decoration: none;">Business Signals</a> / <a href="/b2b-intent-intelligence" style="color: #2563eb; text-decoration: none;">Intent Intelligence</a> / <span style="color: #64748b;">Company Intelligence</span>
          </nav>
          <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7; background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;">
            ${escapeHtml(content.badge)}
          </div>
          <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1.25rem;">
            ${escapeHtml(content.h1)}
          </h1>
          <p style="font-size: 1.1875rem; color: #475569; max-width: 820px; line-height: 1.6; margin: 0 0 1.75rem;">
            ${escapeHtml(content.subtitle)}
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
            <a href="/signup" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore EBEXTA Platform</a>
            <a href="/b2b-intent-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Intent Intelligence</a>
            <a href="/business-signals" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Business Signals</a>
            <a href="/b2b-business-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">B2B Business Intelligence</a>
          </div>
          <div style="padding: 1rem 1.25rem; border: 1px solid #bfdbfe; border-radius: 0.75rem; background: #eff6ff; font-size: 0.875rem; color: #1e40af;">
            <strong>Ethical &amp; Transparent Intelligence: </strong>${escapeHtml(content.positioning)}
          </div>
        </header>

        <!-- Main Semantic Article -->
        <main style="display: flex; flex-direction: column; gap: 3.5rem;">
          
          <!-- Section 1: What Is Company Intelligence? -->
          <section id="${content.section1.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section1.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section1.h2)}</h2>
            ${content.section1.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section1.pillars.map(pill => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(pill.num)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(pill.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(pill.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 2: What Is B2B Company Intelligence? -->
          <section id="${content.section2.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section2.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section2.h2)}</h2>
            ${content.section2.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section2.dimensions.map(dim => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(dim.label)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(dim.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 3: What Information Matters When Researching a Company? -->
          <section id="${content.section3.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section3.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section3.h2)}</h2>
            ${content.section3.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section3.layers.map(layer => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(layer.title)}</h3>
                <p style="font-size: 0.9375rem; color: #334155; margin-bottom: 0.5rem;"><strong>Focus:</strong> ${escapeHtml(layer.summary)}</p>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(layer.details)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 4: Company Intelligence vs Company Data -->
          <section id="${content.section4.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section4.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section4.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section4.intro)}</p>
            <div style="overflow-x: auto; margin-bottom: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.9375rem; text-align: left;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 1rem; font-weight: 700; color: #0f172a;">Dimension</th>
                    <th style="padding: 1rem; font-weight: 700; color: #dc2626;">Static Company Data</th>
                    <th style="padding: 1rem; font-weight: 700; color: #16a34a;">EBEXTA Company Intelligence</th>
                  </tr>
                </thead>
                <tbody>
                  ${content.section4.comparisonTable.map((row, idx) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 1rem; font-weight: 600; color: #0f172a; white-space: nowrap;">${escapeHtml(row.dimension)}</td>
                    <td style="padding: 1rem; color: #334155;">${escapeHtml(row.data)}</td>
                    <td style="padding: 1rem; color: #334155;">${escapeHtml(row.intelligence)}</td>
                  </tr>`).join('\n                  ')}
                </tbody>
              </table>
            </div>
            <div style="padding: 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
              <p style="font-size: 0.9375rem; color: #1e40af; margin: 0; line-height: 1.6;"><strong>Key Takeaway: </strong>${escapeHtml(content.section4.takeaway)}</p>
            </div>
          </section>

          <!-- Section 5: How Company Signals Improve Company Research -->
          <section id="${content.section5.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section5.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section5.h2)}</h2>
            ${content.section5.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section5.signalCategories.map(cat => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(cat.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(cat.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
              <p style="font-size: 0.875rem; color: #1e40af; margin: 0;">${escapeHtml(content.section5.contextRule)}</p>
            </div>
          </section>

          <!-- Section 6: Why Decision-Maker Context Matters -->
          <section id="${content.section6.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section6.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section6.h2)}</h2>
            ${content.section6.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section6.principles.map(item => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(item.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(item.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 7: How EBEXTA Approaches Company Intelligence -->
          <section id="${content.section7.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section7.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section7.h2)}</h2>
            ${content.section7.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section7.phases.map(ph => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">Phase ${escapeHtml(ph.phase)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(ph.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(ph.desc)}</p>
              </div>`).join('\n              ')}
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
              <h3 style="font-size: 1rem; font-weight: 700; color: #1e40af; margin: 0 0 0.5rem;">${escapeHtml(content.section7.dataPhilosophy.title)}</h3>
              <p style="font-size: 0.9375rem; color: #1e40af; margin: 0; line-height: 1.6;">${escapeHtml(content.section7.dataPhilosophy.text)}</p>
            </div>
          </section>

          <!-- Section 8: From Company Research to Opportunity Discovery -->
          <section id="${content.section8.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section8.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section8.h2)}</h2>
            ${content.section8.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section8.steps.map(step => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(step.step)}</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(step.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(step.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 9: Who Uses Company Intelligence? -->
          <section id="${content.section9.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section9.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section9.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section9.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section9.audiences.map(aud => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(aud.role)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(aud.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 10: Frequently Asked Questions -->
          <section id="${content.section10.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section10.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section10.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section10.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section10.faqs.map(faq => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(faq.q)}</h3>
                <p style="font-size: 0.9375rem; color: #475569; margin: 0; line-height: 1.6;">${escapeHtml(faq.a)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Cross-Cluster Topical Navigation -->
          <section style="padding: 1.75rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">Topical Authority Cluster</div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 0.75rem;">Explore EBEXTA's Complete B2B Intelligence Ecosystem</h3>
            <p style="font-size: 0.9375rem; color: #475569; margin-bottom: 1.25rem; line-height: 1.6;">Gain end-to-end commercial clarity by connecting high-level business intelligence, real-time observable business signals, evaluated buyer intent, and comprehensive company research:</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
              <a href="/b2b-business-intelligence" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Foundation</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">B2B Business Intelligence</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Comprehensive framework for discovering and evaluating opportunities.</div>
              </a>
              <a href="/business-signals" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Dynamic Activity</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">Business Signals</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Observable public corporate events, leadership moves, and hiring trends.</div>
              </a>
              <a href="/b2b-intent-intelligence" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Intent Interpretation</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">B2B Intent Intelligence</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Ethical, signal-driven interpretation of potential enterprise buyer interest.</div>
              </a>
              <a href="/b2b-business-network" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Engagement Layer</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">B2B Business Network</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Connecting verified companies, sector leaders, and professionals for direct commercial engagement.</div>
              </a>
            </div>
          </section>

          <!-- Section 11: Call to Action (Discover Companies with EBEXTA) -->
          <section id="${content.section11.id}" style="padding: 3rem 2rem; background: #0f172a; border-radius: 1.5rem; color: #ffffff; text-align: center; border: 1px solid #1e293b;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; display: inline-block; margin-bottom: 0.75rem;">${escapeHtml(content.section11.badge)}</span>
            <h2 style="font-size: 2.25rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">${escapeHtml(content.section11.h2)}</h2>
            <p style="font-size: 1.125rem; color: #94a3b8; max-width: 680px; margin: 0 auto 2rem; line-height: 1.6;">${escapeHtml(content.section11.intro)}</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <a href="${content.section11.ctaUrl}" style="background: #2563eb; color: #ffffff; padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block;">${escapeHtml(content.section11.ctaText)}</a>
              <a href="${content.section11.secondaryCtaUrl}" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">${escapeHtml(content.section11.secondaryCtaText)}</a>
            </div>
          </section>

        </main>

        <!-- Footer with Crawlable Internal Links -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/b2b-business-intelligence" style="color: #475569; text-decoration: none;">Intelligence Guide</a>
            <a href="/business-signals" style="color: #475569; text-decoration: none;">Business Signals</a>
            <a href="/b2b-intent-intelligence" style="color: #475569; text-decoration: none;">Intent Intelligence</a>
            <a href="/company-intelligence" style="color: #2563eb; text-decoration: none; font-weight: 600;">Company Intelligence</a>
            <a href="/b2b-business-network" style="color: #475569; text-decoration: none;">Business Network</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">© 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

function generateBusinessNetworkBody(content) {
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Hero Section -->
        <header style="padding: 3rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 3rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <a href="/b2b-business-intelligence" style="color: #2563eb; text-decoration: none;">B2B Business Intelligence</a> / <a href="/business-signals" style="color: #2563eb; text-decoration: none;">Business Signals</a> / <a href="/b2b-intent-intelligence" style="color: #2563eb; text-decoration: none;">Intent Intelligence</a> / <a href="/company-intelligence" style="color: #2563eb; text-decoration: none;">Company Intelligence</a> / <span style="color: #64748b;">B2B Business Network</span>
          </nav>
          <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7; background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;">
            ${escapeHtml(content.badge)}
          </div>
          <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1.25rem;">
            ${escapeHtml(content.h1)}
          </h1>
          <p style="font-size: 1.1875rem; color: #475569; max-width: 820px; line-height: 1.6; margin: 0 0 1.75rem;">
            ${escapeHtml(content.subtitle)}
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
            <a href="/signup" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Explore EBEXTA Platform</a>
            <a href="/company-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Company Intelligence</a>
            <a href="/b2b-intent-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Intent Intelligence</a>
            <a href="/business-signals" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Business Signals</a>
            <a href="/b2b-business-intelligence" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">B2B Business Intelligence</a>
          </div>
          <div style="padding: 1rem 1.25rem; border: 1px solid #bfdbfe; border-radius: 0.75rem; background: #eff6ff; font-size: 0.875rem; color: #1e40af;">
            <strong>Ethical &amp; Transparent B2B Networking: </strong>${escapeHtml(content.positioning)}
          </div>
        </header>

        <!-- Main Semantic Article -->
        <main style="display: flex; flex-direction: column; gap: 3.5rem;">
          
          <!-- Section 1: What Is a B2B Business Network? -->
          <section id="${content.section1.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section1.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section1.h2)}</h2>
            ${content.section1.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section1.pillars.map(pill => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(pill.num)}</div>
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(pill.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(pill.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 2: How Is a B2B Business Network Different from a General Social Network? -->
          <section id="${content.section2.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section2.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section2.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section2.intro)}</p>
            <div style="overflow-x: auto; margin-bottom: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.9375rem; text-align: left;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 1rem; font-weight: 700; color: #0f172a;">Dimension</th>
                    <th style="padding: 1rem; font-weight: 700; color: #dc2626;">General Social Network</th>
                    <th style="padding: 1rem; font-weight: 700; color: #16a34a;">EBEXTA B2B Business Network</th>
                  </tr>
                </thead>
                <tbody>
                  ${content.section2.comparisonTable.map((row, idx) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 1rem; font-weight: 600; color: #0f172a; white-space: nowrap;">${escapeHtml(row.dimension)}</td>
                    <td style="padding: 1rem; color: #334155;">${escapeHtml(row.social)}</td>
                    <td style="padding: 1rem; color: #334155;">${escapeHtml(row.b2b)}</td>
                  </tr>`).join('\n                  ')}
                </tbody>
              </table>
            </div>
            <div style="padding: 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
              <p style="font-size: 0.9375rem; color: #1e40af; margin: 0; line-height: 1.6;"><strong>Key Distinction: </strong>${escapeHtml(content.section2.takeaway)}</p>
            </div>
          </section>

          <!-- Section 3: What Can Businesses Discover Through a B2B Network? -->
          <section id="${content.section3.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section3.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section3.h2)}</h2>
            ${content.section3.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section3.categories.map(cat => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(cat.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(cat.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 4: Why Business Context Matters Before Making a Connection -->
          <section id="${content.section4.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section4.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section4.h2)}</h2>
            ${content.section4.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section4.contextCards.map(card => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(card.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(card.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 5: From Business Signals to Relevant Connections -->
          <section id="${content.section5.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section5.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section5.h2)}</h2>
            ${content.section5.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section5.signalWorkflows.map(item => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(item.signal)}</h3>
                <p style="font-size: 0.9375rem; color: #334155; margin-bottom: 0.75rem;"><strong>Operational Context: </strong>${escapeHtml(item.meaning)}</p>
                <div style="padding: 0.75rem 1rem; border-radius: 0.5rem; background: #eff6ff; border: 1px solid #bfdbfe; font-size: 0.875rem; color: #1e40af;">
                  <strong>Connection Action: </strong>${escapeHtml(item.action)}
                </div>
              </div>`).join('\n              ')}
            </div>
            <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
              <p style="font-size: 0.875rem; color: #1e40af; margin: 0;">${escapeHtml(content.section5.caution)}</p>
            </div>
          </section>

          <!-- Section 6: How EBEXTA Connects Intelligence With Business Networking -->
          <section id="${content.section6.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section6.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section6.h2)}</h2>
            ${content.section6.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section6.stages.map(st => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">${escapeHtml(st.step)}</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(st.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(st.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 7: Building Better B2B Business Relationships -->
          <section id="${content.section7.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section7.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section7.h2)}</h2>
            ${content.section7.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section7.principles.map(pr => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(pr.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(pr.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 8: Who Uses a B2B Business Network? -->
          <section id="${content.section8.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section8.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section8.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section8.intro)}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
              ${content.section8.audiences.map(aud => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(aud.role)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(aud.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 9: How EBEXTA's Business Network Works -->
          <section id="${content.section9.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section9.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section9.h2)}</h2>
            ${content.section9.paragraphs.map(p => `<p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('\n            ')}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
              ${content.section9.features.map(feat => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(feat.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(feat.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Section 10: Frequently Asked Questions -->
          <section id="${content.section10.id}">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">${escapeHtml(content.section10.badge)}</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">${escapeHtml(content.section10.h2)}</h2>
            <p style="font-size: 1.0625rem; color: #334155; margin-bottom: 1.5rem;">${escapeHtml(content.section10.intro)}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${content.section10.faqs.map(faq => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(faq.q)}</h3>
                <p style="font-size: 0.9375rem; color: #475569; margin: 0; line-height: 1.6;">${escapeHtml(faq.a)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>

          <!-- Cross-Cluster Topical Navigation (All 4 Core Pages) -->
          <section style="padding: 1.75rem; border: 1px solid #bfdbfe; border-radius: 1rem; background: #eff6ff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.5rem;">Topical Authority Cluster</div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 0.75rem;">Explore EBEXTA's Complete B2B Intelligence Ecosystem</h3>
            <p style="font-size: 0.9375rem; color: #475569; margin-bottom: 1.25rem; line-height: 1.6;">Gain end-to-end commercial clarity across the foundational intelligence and research pillars that empower modern business networking:</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
              <a href="/b2b-business-intelligence" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Part 1 · Foundation</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">B2B Business Intelligence</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Comprehensive framework for discovering and evaluating opportunities.</div>
              </a>
              <a href="/business-signals" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Part 2 · Activity</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">Business Signals</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Observable public corporate events, leadership moves, and hiring trends.</div>
              </a>
              <a href="/b2b-intent-intelligence" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Part 3 · Interpretation</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">B2B Intent Intelligence</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Ethical, signal-driven interpretation of potential enterprise buyer interest.</div>
              </a>
              <a href="/company-intelligence" style="display: block; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: #ffffff; text-decoration: none;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 0.25rem;">Part 4 · Research</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">Company Intelligence</div>
                <div style="font-size: 0.8125rem; color: #64748b;">Organizational structures, operational models, and verified decision-maker context.</div>
              </a>
            </div>
          </section>

          <!-- Section 11: Call to Action (Connect Through the EBEXTA Business Network) -->
          <section id="${content.section11.id}" style="padding: 3rem 2rem; background: #0f172a; border-radius: 1.5rem; color: #ffffff; text-align: center; border: 1px solid #1e293b;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; display: inline-block; margin-bottom: 0.75rem;">${escapeHtml(content.section11.badge)}</span>
            <h2 style="font-size: 2.25rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">${escapeHtml(content.section11.h2)}</h2>
            <p style="font-size: 1.125rem; color: #94a3b8; max-width: 680px; margin: 0 auto 2rem; line-height: 1.6;">${escapeHtml(content.section11.intro)}</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <a href="${content.section11.ctaUrl}" style="background: #2563eb; color: #ffffff; padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block;">${escapeHtml(content.section11.ctaText)}</a>
              <a href="${content.section11.secondaryCtaUrl}" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">${escapeHtml(content.section11.secondaryCtaText)}</a>
            </div>
          </section>

        </main>

        <!-- Footer with Crawlable Internal Links -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/b2b-business-intelligence" style="color: #475569; text-decoration: none;">Intelligence Guide</a>
            <a href="/business-signals" style="color: #475569; text-decoration: none;">Business Signals</a>
            <a href="/b2b-intent-intelligence" style="color: #475569; text-decoration: none;">Intent Intelligence</a>
            <a href="/company-intelligence" style="color: #475569; text-decoration: none;">Company Intelligence</a>
            <a href="/b2b-business-network" style="color: #2563eb; text-decoration: none; font-weight: 600;">Business Network</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">© 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

const careersWebPageStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://www.ebexta.com/careers#webpage',
      url: 'https://www.ebexta.com/careers',
      name: 'Careers at EBEXTA | Build the Future of B2B Intelligence',
      description:
        'Join EBEXTA and help build the B2B Business Intelligence and Business Network platform connecting companies, sector leaders, and professionals across high-growth markets.',
      isPartOf: {
        '@id': 'https://www.ebexta.com/#website'
      },
      about: {
        '@id': 'https://www.ebexta.com/#organization'
      },
      publisher: {
        '@id': 'https://www.ebexta.com/#organization'
      }
    }
  ]
};

function generateJobPostingStructuredData(job) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: `<h3>Role Overview</h3><p>${escapeHtml(job.overview)}</p><h3>Key Responsibilities</h3><ul>${job.responsibilities.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul><h3>Requirements &amp; Qualifications</h3><ul>${job.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul><h3>Nice to Have</h3><ul>${job.niceToHave.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul><h3>What You Will Learn &amp; Gain</h3><ul>${job.learnings.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`,
    datePosted: '2026-10-10',
    employmentType: ['FULL_TIME', 'INTERN'],
    hiringOrganization: {
      '@type': 'Organization',
      name: 'EBEXTA',
      sameAs: 'https://www.ebexta.com',
      logo: 'https://www.ebexta.com/logo-mark.svg'
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Bengaluru',
        addressRegion: 'Karnataka',
        addressCountry: 'IN'
      }
    },
    directApply: true,
    url: `https://www.ebexta.com/careers/${job.slug}`
  };
}

function generateCareersHubBody(content) {
  const roles = content.JOB_ROLES;
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Hero Section -->
        <header style="padding: 3rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 3rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <span style="color: #64748b;">Careers</span>
          </nav>
          <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7; background: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;">
            We Are Hiring Across Engineering, Growth &amp; Business
          </div>
          <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1.25rem;">
            Build What's Next at EBEXTA
          </h1>
          <p style="font-size: 1.1875rem; color: #475569; max-width: 820px; line-height: 1.6; margin: 0 0 1.75rem;">
            Join EBEXTA and work on technology, growth, and business opportunities that turn ideas into products and real-world impact.
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <a href="#roles" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">View Open Roles</a>
            <a href="/about" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">About EBEXTA</a>
          </div>
        </header>

        <main style="display: flex; flex-direction: column; gap: 3.5rem;">
          <!-- Section: Open Positions -->
          <section id="roles">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb;">Current Opportunities</span>
            <h2 style="font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 0.5rem;">Open Positions</h2>
            <p style="font-size: 1.0625rem; color: #475569; margin-bottom: 1.5rem;">Explore active roles at EBEXTA. Every role works directly on core technology, market development, and product growth.</p>
            
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              ${roles.map(job => `
              <article style="padding: 1.75rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff; display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #eff6ff; color: #2563eb; padding: 0.2rem 0.6rem; border-radius: 9999px;">${escapeHtml(job.department)}</span>
                  <span style="font-size: 0.6875rem; font-weight: 600; background: #f1f5f9; color: #475569; padding: 0.2rem 0.6rem; border-radius: 0.375rem;">Full-time</span>
                  <span style="font-size: 0.6875rem; font-weight: 600; background: #ecfdf5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 0.375rem;">Internship Available</span>
                  <span style="font-size: 0.6875rem; color: #64748b;">${escapeHtml(job.location)}</span>
                </div>
                <div>
                  <h3 style="font-size: 1.375rem; font-weight: 700; margin: 0 0 0.5rem;">
                    <a href="/careers/${job.slug}" style="color: #0f172a; text-decoration: none;">${escapeHtml(job.title)}</a>
                  </h3>
                  <p style="font-size: 0.9375rem; color: #475569; margin: 0; line-height: 1.6;">${escapeHtml(job.summary)}</p>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.375rem;">
                  ${job.skills.map(s => `<span style="font-size: 0.6875rem; font-weight: 500; background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; padding: 0.15rem 0.5rem; border-radius: 0.25rem;">${escapeHtml(s)}</span>`).join('')}
                </div>
                <div style="margin-top: 0.5rem;">
                  <a href="/careers/${job.slug}" style="font-size: 0.875rem; font-weight: 600; color: #2563eb; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
                    View Role &amp; Apply &rarr;
                  </a>
                </div>
              </article>`).join('\n              ')}
            </div>
          </section>

          <!-- Section: Why EBEXTA -->
          <section id="why-ebexta" style="border-top: 1px solid #e2e8f0; padding-top: 2.5rem;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0284c7;">Why Join Us</span>
            <h2 style="font-size: 1.75rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0 1rem;">Work on Problems That Matter</h2>
            <p style="font-size: 1.0625rem; color: #475569; margin-bottom: 1.5rem;">We are building serious bilateral intelligence technology that replaces cold, noisy outreach with high-confidence, verified business discovery.</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
              ${content.WHY_EBEXTA_POINTS.map(pt => `
              <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #ffffff;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">${escapeHtml(pt.title)}</h3>
                <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">${escapeHtml(pt.desc)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>
        </main>

        <!-- Footer -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/careers" style="color: #2563eb; text-decoration: none; font-weight: 600;">Careers</a>
            <a href="/b2b-business-intelligence" style="color: #475569; text-decoration: none;">B2B Intelligence</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">&copy; 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

function generateJobPostingBody(job, allRoles) {
  const otherRoles = allRoles.filter(r => r.slug !== job.slug);
  return `<div id="root">
      <div style="font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #0f172a; line-height: 1.6;">
        
        <!-- Header / Breadcrumbs & Role Title -->
        <header style="padding: 2.5rem 0 2rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 2.5rem;">
          <nav aria-label="Breadcrumb" style="font-size: 0.875rem; margin-bottom: 1.25rem;">
            <a href="/" style="color: #2563eb; text-decoration: none;">Home</a> / <a href="/careers" style="color: #2563eb; text-decoration: none;">Careers</a> / <span style="color: #64748b;">${escapeHtml(job.title)}</span>
          </nav>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #eff6ff; color: #2563eb; padding: 0.25rem 0.75rem; border-radius: 9999px;">${escapeHtml(job.department)}</span>
            <span style="font-size: 0.75rem; font-weight: 600; background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 0.375rem;">Full-time</span>
            <span style="font-size: 0.75rem; font-weight: 600; background: #ecfdf5; color: #059669; padding: 0.25rem 0.75rem; border-radius: 0.375rem;">Internship Available</span>
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">${escapeHtml(job.location)}</span>
          </div>
          <h1 style="font-size: 2.5rem; font-weight: 800; line-height: 1.2; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 1rem;">
            ${escapeHtml(job.title)}
          </h1>
          <p style="font-size: 1.125rem; color: #475569; max-width: 800px; line-height: 1.6; margin: 0 0 1.5rem;">
            ${escapeHtml(job.summary)}
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <a href="/careers/${job.slug}#apply" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">Apply for this Role</a>
            <a href="/careers" style="color: #0f172a; border: 1px solid #cbd5e1; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">&larr; View All Openings</a>
          </div>
        </header>

        <main style="display: flex; flex-direction: column; gap: 3rem;">
          <!-- Section 1: Overview -->
          <section>
            <h2 style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0 0 1rem; border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; display: inline-block;">Role Overview</h2>
            <p style="font-size: 1.0625rem; color: #334155; line-height: 1.7;">${escapeHtml(job.overview)}</p>
          </section>

          <!-- Section 2: Key Responsibilities -->
          <section>
            <h2 style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0 0 1rem; border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; display: inline-block;">Key Responsibilities</h2>
            <ul style="padding-left: 1.25rem; color: #334155; font-size: 1rem; line-height: 1.8; display: flex; flex-direction: column; gap: 0.5rem;">
              ${job.responsibilities.map(r => `<li>${escapeHtml(r)}</li>`).join('\n              ')}
            </ul>
          </section>

          <!-- Section 3: Requirements & Qualifications -->
          <section>
            <h2 style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0 0 1rem; border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; display: inline-block;">Requirements &amp; Qualifications</h2>
            <ul style="padding-left: 1.25rem; color: #334155; font-size: 1rem; line-height: 1.8; display: flex; flex-direction: column; gap: 0.5rem;">
              ${job.requirements.map(req => `<li>${escapeHtml(req)}</li>`).join('\n              ')}
            </ul>
          </section>

          <!-- Section 4: Nice to Have -->
          <section>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 0.75rem;">Nice to Have (Optional)</h2>
            <ul style="padding-left: 1.25rem; color: #475569; font-size: 0.9375rem; line-height: 1.7; display: flex; flex-direction: column; gap: 0.5rem;">
              ${job.niceToHave.map(nth => `<li>${escapeHtml(nth)}</li>`).join('\n              ')}
            </ul>
          </section>

          <!-- Section 5: What You Will Learn & Gain -->
          <section>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 0.75rem;">What You Will Learn &amp; Gain</h2>
            <ul style="padding-left: 1.25rem; color: #475569; font-size: 0.9375rem; line-height: 1.7; display: flex; flex-direction: column; gap: 0.5rem;">
              ${job.learnings.map(l => `<li>${escapeHtml(l)}</li>`).join('\n              ')}
            </ul>
          </section>

          <!-- Section 6: Work Arrangement & Tech Stack -->
          <section style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #f8fafc;">
            <h3 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">Work Arrangement</h3>
            <p style="font-size: 0.9375rem; color: #475569; margin: 0 0 1rem;">${escapeHtml(job.workArrangement)}</p>
            <h3 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">Relevant Skills &amp; Domain</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 0.375rem;">
              ${job.skills.map(s => `<span style="font-size: 0.75rem; font-weight: 600; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 0.25rem 0.6rem; border-radius: 0.375rem;">${escapeHtml(s)}</span>`).join('')}
            </div>
          </section>

          <!-- Section 7: How to Apply -->
          <section id="apply" style="padding: 2rem; border: 2px solid #2563eb; border-radius: 1rem; background: #eff6ff;">
            <h2 style="font-size: 1.375rem; font-weight: 800; color: #1e3a8a; margin: 0 0 0.75rem;">How to Apply for this Position</h2>
            <p style="font-size: 1rem; color: #1e40af; margin: 0 0 1.25rem; line-height: 1.6;">
              We welcome applications for both full-time positions and high-curiosity student or graduate internships. Applications are evaluated based on real problem-solving ability, code/portfolio quality, and domain passion.
            </p>
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
              <a href="/careers/${job.slug}" style="background: #2563eb; color: #ffffff; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; display: inline-block;">
                Launch Interactive Application Form
              </a>
              <a href="/careers" style="color: #2563eb; text-decoration: underline; font-size: 0.875rem;">
                Explore All Opportunities
              </a>
            </div>
          </section>

          <!-- Section 8: Other Open Opportunities at EBEXTA -->
          <section style="border-top: 1px solid #e2e8f0; padding-top: 2.5rem;">
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 1rem;">Other Open Opportunities at EBEXTA</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
              ${otherRoles.map(other => `
              <div style="padding: 1.25rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: #ffffff;">
                <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: #2563eb;">${escapeHtml(other.department)}</span>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin: 0.25rem 0 0.5rem;">
                  <a href="/careers/${other.slug}" style="color: #0f172a; text-decoration: none;">${escapeHtml(other.title)} &rarr;</a>
                </h3>
                <p style="font-size: 0.8125rem; color: #64748b; margin: 0;">${escapeHtml(other.summary)}</p>
              </div>`).join('\n              ')}
            </div>
          </section>
        </main>

        <!-- Footer -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <a href="/" style="color: #475569; text-decoration: none;">Home</a>
            <a href="/about" style="color: #475569; text-decoration: none;">About</a>
            <a href="/careers" style="color: #2563eb; text-decoration: none; font-weight: 600;">Careers</a>
            <a href="/b2b-business-intelligence" style="color: #475569; text-decoration: none;">B2B Intelligence</a>
            <a href="/terms" style="color: #475569; text-decoration: none;">Terms</a>
            <a href="/privacy" style="color: #475569; text-decoration: none;">Privacy</a>
            <a href="/dpdp" style="color: #475569; text-decoration: none;">DPDP</a>
          </div>
          <p style="color: #94a3b8; margin: 0;">&copy; 2026 EBEXTA. All rights reserved.</p>
        </footer>

      </div>
    </div>`;
}

function generateRouteHtml(src, data, route) {
  let html = src;

  // Replace <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${data.title}</title>`);

  // Replace meta name="description"
  html = html.replace(
    /<meta name="description" content="[\s\S]*?"\s*\/?>/,
    `<meta name="description" content="${escapeMeta(data.desc)}" />`
  );

  // Replace link rel="canonical"
  html = html.replace(
    /<link rel="canonical" href="[\s\S]*?"\s*\/?>/,
    `<link rel="canonical" href="${data.canonical}" />`
  );

  // Replace meta property="og:title"
  html = html.replace(
    /<meta property="og:title" content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:title" content="${escapeMeta(data.title)}" />`
  );

  // Replace meta property="og:description"
  html = html.replace(
    /<meta property="og:description" content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:description" content="${escapeMeta(data.desc)}" />`
  );

  // Replace meta property="og:url"
  html = html.replace(
    /<meta property="og:url" content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:url" content="${data.canonical}" />`
  );

  // Replace meta name="twitter:title"
  html = html.replace(
    /<meta name="twitter:title" content="[\s\S]*?"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeMeta(data.title)}" />`
  );

  // Replace meta name="twitter:description"
  html = html.replace(
    /<meta name="twitter:description" content="[\s\S]*?"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeMeta(data.desc)}" />`
  );

  // Special enhancement for /b2b-business-intelligence:
  // Inject complete semantic raw HTML and valid JSON-LD in head
  if (route === '/b2b-business-intelligence') {
    // 1. Inject JSON-LD into <head>
    const jsonLdTag = `  <script id="b2b-bi-jsonld" type="application/ld+json">\n${JSON.stringify(b2bContent.structuredData, null, 2)}\n    </script>\n  </head>`;
    html = html.replace('</head>', jsonLdTag);

    // 2. Replace #root with complete pre-rendered semantic HTML
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      const b2bBody = generateB2BIntelligenceBody(b2bContent);
      html = html.slice(0, rootStart) + b2bBody + '\n  ' + html.slice(bodyEnd);
    }
  }

  // Special enhancement for /business-signals:
  // Inject complete semantic raw HTML and valid JSON-LD in head
  if (route === '/business-signals') {
    // 1. Inject JSON-LD into <head>
    const jsonLdTag = `  <script id="business-signals-jsonld" type="application/ld+json">\n${JSON.stringify(businessSignalsContent.structuredData, null, 2)}\n    </script>\n  </head>`;
    html = html.replace('</head>', jsonLdTag);

    // 2. Replace #root with complete pre-rendered semantic HTML
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      const signalsBody = generateBusinessSignalsBody(businessSignalsContent);
      html = html.slice(0, rootStart) + signalsBody + '\n  ' + html.slice(bodyEnd);
    }
  }

  // Special enhancement for /b2b-intent-intelligence:
  // Inject complete semantic raw HTML and valid JSON-LD in head
  if (route === '/b2b-intent-intelligence') {
    // 1. Inject JSON-LD into <head>
    const jsonLdTag = `  <script id="b2b-intent-jsonld" type="application/ld+json">\n${JSON.stringify(b2bIntentContent.structuredData, null, 2)}\n    </script>\n  </head>`;
    html = html.replace('</head>', jsonLdTag);

    // 2. Replace #root with complete pre-rendered semantic HTML
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      const intentBody = generateB2BIntentIntelligenceBody(b2bIntentContent);
      html = html.slice(0, rootStart) + intentBody + '\n  ' + html.slice(bodyEnd);
    }
  }

  // Special enhancement for /company-intelligence:
  // Inject complete semantic raw HTML and valid JSON-LD in head
  if (route === '/company-intelligence') {
    // 1. Inject JSON-LD into <head>
    const jsonLdTag = `  <script id="company-intelligence-jsonld" type="application/ld+json">\n${JSON.stringify(companyContent.structuredData, null, 2)}\n    </script>\n  </head>`;
    html = html.replace('</head>', jsonLdTag);

    // 2. Replace #root with complete pre-rendered semantic HTML
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      const companyBody = generateCompanyIntelligenceBody(companyContent);
      html = html.slice(0, rootStart) + companyBody + '\n  ' + html.slice(bodyEnd);
    }
  }

  // Special enhancement for /b2b-business-network:
  // Inject complete semantic raw HTML and valid JSON-LD in head
  if (route === '/b2b-business-network') {
    // 1. Inject JSON-LD into <head>
    const jsonLdTag = `  <script id="b2b-network-jsonld" type="application/ld+json">\n${JSON.stringify(businessNetworkContent.structuredData, null, 2)}\n    </script>\n  </head>`;
    html = html.replace('</head>', jsonLdTag);

    // 2. Replace #root with complete pre-rendered semantic HTML
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      const networkBody = generateBusinessNetworkBody(businessNetworkContent);
      html = html.slice(0, rootStart) + networkBody + '\n  ' + html.slice(bodyEnd);
    }
  }

  // Special enhancement for /careers:
  // Inject complete semantic raw HTML and valid WebPage JSON-LD in head
  if (route === '/careers') {
    // 1. Inject JSON-LD into <head>
    const jsonLdTag = `  <script id="careers-jsonld" type="application/ld+json">\n${JSON.stringify(careersWebPageStructuredData, null, 2)}\n    </script>\n  </head>`;
    html = html.replace('</head>', jsonLdTag);

    // 2. Replace #root with complete pre-rendered semantic HTML
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      const careersBody = generateCareersHubBody(careersContent);
      html = html.slice(0, rootStart) + careersBody + '\n  ' + html.slice(bodyEnd);
    }
  }

  // Special enhancement for /careers/:roleSlug:
  // Inject complete semantic raw HTML and valid JobPosting JSON-LD in head
  if (route.startsWith('/careers/')) {
    const slug = route.replace('/careers/', '');
    const job = careersContent.JOB_ROLES.find(r => r.slug === slug);
    if (job) {
      // 1. Inject JobPosting JSON-LD into <head>
      const jobJsonLd = generateJobPostingStructuredData(job);
      const jsonLdTag = `  <script id="careers-jsonld" type="application/ld+json">\n${JSON.stringify(jobJsonLd, null, 2)}\n    </script>\n  </head>`;
      html = html.replace('</head>', jsonLdTag);

      // 2. Replace #root with complete pre-rendered semantic HTML
      const rootStart = html.indexOf('<div id="root">');
      const bodyEnd = html.indexOf('</body>', rootStart);
      if (rootStart !== -1 && bodyEnd !== -1) {
        const jobBody = generateJobPostingBody(job, careersContent.JOB_ROLES);
        html = html.slice(0, rootStart) + jobBody + '\n  ' + html.slice(bodyEnd);
      }
    }
  }

  return html;
}

console.log('[generate-route-html] Generating static route HTML files for public routes...');

for (const [route, data] of Object.entries(ROUTE_DATA)) {
  const routeName = route.replace(/^\//, '');
  const routeHtml = generateRouteHtml(template, data, route);

  // 1. Write dist/<route>/index.html
  const routeDir = path.join(DIST_DIR, routeName);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }
  const routeIndexFile = path.join(routeDir, 'index.html');
  fs.writeFileSync(routeIndexFile, routeHtml, 'utf8');

  // 2. Also write dist/<route>.html for clean-URL server compatibility
  const routeFlatFile = path.join(DIST_DIR, `${routeName}.html`);
  const flatDir = path.dirname(routeFlatFile);
  if (!fs.existsSync(flatDir)) {
    fs.mkdirSync(flatDir, { recursive: true });
  }
  fs.writeFileSync(routeFlatFile, routeHtml, 'utf8');

  console.log(`  ✓ ${route} -> dist/${routeName}/index.html & dist/${routeName}.html`);
}

console.log('[generate-route-html] All static route HTML files generated successfully.');
