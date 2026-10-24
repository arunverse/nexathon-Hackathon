# EBEXTA Sector Signals Research (`SECTOR_SIGNALS_RESEARCH.md`)

This document details the researched loopholes, verification sources, and compliance flags for all mapped B2B sectors.

---

## The Four-Part Verification Test

All signals must meet the following criteria before being categorized as **VERIFIED**:
1. **PUBLIC:** Accessible without login, paywall, or bypassing bot protections.
2. **VERIFIABLE:** A human can independently fetch the same source and confirm.
3. **UNFAKEABLE:** Cannot be easily falsified by the target company.
4. **CAUSALLY SPECIFIC:** Proves a direct requirement for the target service category.

If a signal fails any part, it is classified as **INFERRED**.

---

## 1. Web Development & App Agencies

### A. Web Development
* **The Loophole:** Outdated Copyright Year (footer) + Lack of viewport meta tag + Failed SSL handshake.
* **Why it passes the test:**
  * *Public:* Yes, fetched directly from the site source.
  * *Verifiable:* Yes, anyone can check page source or view SSL details.
  * *Unfakeable:* Yes, a company would not intentionally keep a broken viewport or stale copyright to mislead.
  * *Causally Specific:* Yes, directly proves they need a developer to rebuild or update their portal.
* **Exact Public Source:** Target website HTML source & SSL Certificate Issuer details.
* **Registry-Backed:** No.

### B. App Development
* **The Loophole:** Missing App Store / Google Play links on a high-traffic D2C or consumer retail website.
* **Why it passes the test:**
  * *Public:* Yes, website HTML scan.
  * *Verifiable:* Yes, verified by searching the app stores.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, a consumer retail shop with high traffic but no app is actively losing conversion compared to peers.
* **Exact Public Source:** Target website DOM inspection + iTunes Search API (App Store).
* **Registry-Backed:** No.

---

## 2. Marketing & Growth

### A. SEO & Organic Growth
* **The Loophole:** Active ad scripts (Google Conversion Linker, Meta Pixel) + Page 2/3 ranking for category terms.
* **Why it passes the test:**
  * *Public:* Yes, detected in page source and organic search scrapes.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes, ranking positions are dictated by search engines, not the target.
  * *Causally Specific:* Yes, shows budget exists (ads) but organic traffic is missing.
* **Exact Public Source:** Google Search API & website DOM tags.
* **Registry-Backed:** No.

### B. Paid Ads (Performance Marketing)
* **The Loophole:** Active ad campaigns in Meta Ad Library / Google Ad Transparency Report vs. missing tracking pixel.
* **Why it passes the test:**
  * *Public:* Yes, both ad libraries are free and open.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes, ad campaigns are verified by platforms.
  * *Causally Specific:* Yes, running campaigns without tracking pixels means they are wasting budget, proving they need marketing analytics.
* **Exact Public Source:** Meta Ad Library API & Google Ad Transparency Portal.
* **Registry-Backed:** No.

---

## 3. People & Workforce

### A. Professional Recruitment
* **The Loophole:** Open Job postings on career pages or job portals active for > 90 days.
* **Why it passes the test:**
  * *Public:* Yes, jobs boards and careers pages are public.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes, keeping a posting open for 3 months represents real, unsolved operational need.
  * *Causally Specific:* Yes, directly proves they cannot fill the role internally.
* **Exact Public Source:** `/careers` page scrape & Google Jobs indexing.
* **Registry-Backed:** No.

### B. HR Compliance & Payroll
* **The Loophole:** Growing headcount above 20 employees vs. lack of external payroll tracking tools.
* **Why it passes the test:**
  * *Public:* Yes.
  * *Verifiable:* Yes, verified via public directories.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, passing 20 employees in India triggers mandatory PF/ESI registration.
* **Exact Public Source:** LinkedIn public employee count ranges & website page scripts.
* **Registry-Backed:** Yes (EPFO / ESIC employer databases).

---

## 4. Finance, Legal & Compliance

### A. GST & Tax Compliance
* **The Loophole:** Active business operations + No GSTIN found in footer OR GSTIN check returns inactive status.
* **Why it passes the test:**
  * *Public:* Yes.
  * *Verifiable:* Yes, verified via GSTIN check.
  * *Unfakeable:* Yes, GST registration statuses are verified by the government.
  * *Causally Specific:* Yes, proves they are operating without compliance or need tax accounting.
* **Exact Public Source:** search.gst.gov.in (format check via regex + verify via API).
* **Registry-Backed:** Yes (GST portal).

---

## 5. Industrial & Manufacturing

### A. Automation & Machinery
* **The Loophole:** Government e-Marketplace (GeM) / state tender wins for machinery or industrial tooling.
* **Why it passes the test:**
  * *Public:* Yes, government tender results are public information.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, winning a tender proves they have the exact contract and budget to execute.
* **Exact Public Source:** gem.gov.in & state tender archives.
* **Registry-Backed:** Yes (GeM Portal).

---

## 6. Real Estate & Construction

### A. Real Estate Services
* **The Loophole:** Active project marketing on website with no RERA registration number displayed in footer.
* **Why it passes the test:**
  * *Public:* Yes, RERA numbers must be publicly declared.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes, RERA databases are public and managed by state authorities.
  * *Causally Specific:* Yes, operating without RERA is illegal, proving they need legal compliance/marketing audit.
* **Exact Public Source:** State RERA portals (e.g. maharera.maharashtra.gov.in).
* **Registry-Backed:** Yes (RERA registry).

---

## 7. Hospitality & Food Service

### A. Restaurant Tech & POS
* **The Loophole:** Valid FSSAI license number in footer (`\b[1-2]\d{13}\b`) vs. absence on online food delivery aggregates (Swiggy/Zomato).
* **Why it passes the test:**
  * *Public:* Yes.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, shows they have food licensing but lack digital delivery infrastructure.
* **Exact Public Source:** FSSAI FoSCoS portal & delivery partner APIs.
* **Registry-Backed:** Yes (FSSAI).

---

## 8. Healthcare & Life Sciences

### A. Healthcare Services
* **The Loophole:** Active clinical page listing vs. absence on the National Accreditation Board for Hospitals (NABH) registry.
* **Why it passes the test:**
  * *Public:* Yes, NABH registry is open.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, indicates they need accreditation consulting/quality checks.
* **Exact Public Source:** nabh.co (accredited list).
* **Registry-Backed:** Yes (NABH).

---

## 9. Education & Academics

### A. University / College CRM
* **The Loophole:** Active admissions cycle announced on website with no student portal integration (e.g. missing ERP/LMS cookies or subdomains).
* **Why it passes the test:**
  * *Public:* Yes.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, shows they are recruiting students manually, proving they need AI admissions CRM.
* **Exact Public Source:** UGC/AICTE directories and website subdomains.
* **Registry-Backed:** Yes (UGC/AICTE).

---

## 10. Energy & Sustainability

### A. Commercial Solar / ESG
* **The Loophole:** Satellite imagery showing > 500 sq meters flat roof area vs. no solar panels in photos or active grid connections.
* **Why it passes the test:**
  * *Public:* Yes, satellite maps are public.
  * *Verifiable:* Yes.
  * *Unfakeable:* Yes.
  * *Causally Specific:* Yes, shows solar cost-saving potential.
* **Exact Public Source:** Google Maps / satellite indexes.
* **Registry-Backed:** No.

---

## Note on Weak Signal Categories
For sectors like **Branding** or **Creative Media**, no single government registry exists. In these cases, EBEXTA relies on **moderate-strength signals** (e.g., visual discrepancy across channels, lack of updates on social handles, stock photo usage check). These are marked as **INFERRED** in the database to maintain 100% integrity.
