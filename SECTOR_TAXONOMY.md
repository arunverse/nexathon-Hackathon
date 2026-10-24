# EBEXTA B2B Sector Taxonomy (`SECTOR_TAXONOMY.md`)

This document maps the complete taxonomy of B2B service categories in the Indian market, serving as the core schema definitions for EBEXTA's dynamic sector routing and matching logic.

---

## Taxonomy Structure

```
Branch (Top-Level Function)
   └── Sub-Category (Vertical or Domain)
          ├── Seeker Profile (Who needs it)
          └── Provider Services (What is sold)
```

---

## 1. Technology & Digital

### A. Web Development
* **Seeker Profile:** Offline-first businesses, manufacturing plants, local retail chains, and companies with outdated websites.
* **Provider Services:** Web design, frontend/UI, custom WordPress/Shopify setups, responsive designs, page-speed optimization.
* **Registry/Public Hook:** Google PageSpeed Insights, `<meta name="viewport">` check, SSL status, Copyright Year scan.

### B. App Development
* **Seeker Profile:** Consumer-facing brands (D2C, retail, clinics, local services) that lack an active mobile application interface.
* **Provider Services:** iOS/Android app development, cross-platform apps (React Native/Flutter), mobile product strategy.
* **Registry/Public Hook:** Apple App Store & Google Play Store developer listing checks, lack of app badges on website.

### C. Cloud Infrastructure & DevOps
* **Seeker Profile:** Growing tech startups, SaaS vendors, e-commerce platforms facing performance or reliability issues.
* **Provider Services:** AWS/Azure/GCP management, Kubernetes orchestration, database scaling, CI/CD pipelines, uptime monitoring.
* **Registry/Public Hook:** CDN headers check (e.g. lack of Cloudflare/Cloudfront), status page incident history, job postings for DevOps/SRE.

### D. Cybersecurity
* **Seeker Profile:** Regulated firms (FinTech, healthcare, legal) handling client private keys, PII, or financial transactions.
* **Provider Services:** Pentesting, SOC 2/ISO 27001 readiness audits, compliance hardening, threat detection.
* **Registry/Public Hook:** SSL/TLS cipher suite audit, missing Privacy Policy pages, lack of security trust badges in footer.

### E. E-commerce Enablement
* **Seeker Profile:** Direct-to-Consumer (D2C) brands, distributors, and physical product businesses.
* **Provider Services:** Shopify customization, catalog management, payment gateway integration.
* **Registry/Public Hook:** Shopify/WooCommerce theme signatures in page source, missing shopping cart tags.

---

## 2. Marketing & Growth

### A. SEO & Organic Growth
* **Seeker Profile:** Lead-dependent businesses (agencies, consultancies, B2B services) with poor search presence.
* **Provider Services:** Keyword ranking, link building, technical SEO, content strategy.
* **Registry/Public Hook:** **[The Loophole]** Active paid search (ads) run on Google/Meta while ranking on Page 2+ organic for target keywords.

### B. Paid Ads & Performance Marketing
* **Seeker Profile:** B2C/B2B firms with high budget capacity but low customer acquisition efficiency.
* **Provider Services:** Meta/Google Ads management, conversion rate optimization (CRO), analytics setups.
* **Registry/Public Hook:** Meta Ad Library active ads count vs. missing conversion tracking pixels (Pixel/GTM) on site.

### C. Branding & UI/UX Design
* **Seeker Profile:** Rebranding companies, product businesses with dated visual collateral.
* **Provider Services:** Logo design, style guides, UX/UI audits.
* **Registry/Public Hook:** Visual inconsistencies between website and official social channels, IP India trademark registration search for new class listings.

### D. Creative Content & PR
* **Seeker Profile:** Mid-market firms, professional services needing authority positioning.
* **Provider Services:** Blog writing, PR distribution, press-release copywriting.
* **Registry/Public Hook:** Inactive blogs (>12 months since last post), generic stock photography usage.

---

## 3. Sales Enablement

### A. CRM & Sales Automation
* **Seeker Profile:** B2B businesses with manual sales processes, high lead volume, or lack of pipeline tracking.
* **Provider Services:** HubSpot/Salesforce integration, lead routing setup, email outreach automation.
* **Registry/Public Hook:** Absence of CRM tracking scripts (HubSpot, Zoho, Salesforce pixels) combined with manual form conversion checks.

### B. Sales Training & Consulting
* **Seeker Profile:** Companies expanding their sales divisions or experiencing falling close rates.
* **Provider Services:** Sales script writing, commission structuring, negotiation training.
* **Registry/Public Hook:** Active job listings for "Business Development Associate" or "Sales Representative" scaling up without matching sales automation tooling.

---

## 4. People & Workforce

### A. Professional Recruitment
* **Seeker Profile:** Fast-growing businesses, tech companies with specialized hiring needs.
* **Provider Services:** Permanent placement, executive search, contract staffing.
* **Registry/Public Hook:** **[The Loophole]** Careers page job postings open for > 90 days (indicates "cannot fill internally").

### B. HR Compliance & Payroll
* **Seeker Profile:** Businesses growing past threshold compliance points (e.g., 20+ employees for PF/ESI in India).
* **Provider Services:** Payroll outsourcing, Provident Fund (PF) registration, Employee State Insurance (ESI) filings.
* **Registry/Public Hook:** Headcount size transition threshold vs. lack of external payroll portal integrations (e.g. RazorpayX, Keka).

---

## 5. Finance, Legal & Compliance

### A. Legal & Incorporation
* **Seeker Profile:** Early-stage startups, expanding enterprises needing corporate structural support.
* **Provider Services:** Incorporation, director registry changes, shareholders agreements.
* **Registry/Public Hook:** Ministry of Corporate Affairs (MCA) registry filings check (director changes, share allotments).

### B. GST & Tax Compliance
* **Seeker Profile:** E-commerce stores, B2B vendors, contractors.
* **Provider Services:** GST filing, tax auditing, bookkeeping.
* **Registry/Public Hook:** **[The Loophole]** GSTIN format verification (`\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}\b`) and verification status check via public database checks.

---

## 6. Operations & Facilities

### A. Facility Housekeeping & Security
* **Seeker Profile:** Commercial offices, IT parks, retail showrooms, factories.
* **Provider Services:** Housekeeping, security guard deployment, pantry management.
* **Registry/Public Hook:** Commercial lease registrations, Google Maps "new location opened" triggers, multi-facility addresses.

### B. HVAC & Office Fit-Out
* **Seeker Profile:** Tech firms moving offices, manufacturing facilities upgrading ventilation.
* **Provider Services:** HVAC installation, AMC services, workplace interior execution.
* **Registry/Public Hook:** Office lease filings, commercial real estate announcements.

---

## 7. Manufacturing & Industrial

### A. Industrial Automation & CNC Tooling
* **Seeker Profile:** Machining shops, automotive components manufacturers, steel plants.
* **Provider Services:** CNC retrofitting, factory automation software, PLC programming.
* **Registry/Public Hook:** Public tender bids won on Government e-Marketplace (GeM) or state-level tender portals.

### B. Quality Certification (ISO/BIS)
* **Seeker Profile:** Export-oriented manufacturing units, electronics makers.
* **Provider Services:** ISO 9001/14001, BIS certification audits, compliance consulting.
* **Registry/Public Hook:** National BIS registry or ISO certified directories showing lack of valid registration for target categories.

---

## 8. Supply Chain & Logistics

### A. Freight & Warehousing
* **Seeker Profile:** Manufacturers, distributors, large D2C brands.
* **Provider Services:** Third-party logistics (3PL), custom clearance, warehouse management.
* **Registry/Public Hook:** Import/export custom shipping manifests (partially public via trade data indices).

---

## 9. Trade & Procurement

### A. Raw Material Sourcing
* **Seeker Profile:** Metal fabrication units, plastics manufacturers, chemical factories.
* **Provider Services:** Bulk sourcing, supply chain financing.
* **Registry/Public Hook:** Industrial directory listings, import manifests.

---

## 10. Healthcare & Life Sciences

### A. Hospital Software & Equipment AMC
* **Seeker Profile:** Diagnostic labs, nursing homes, hospitals.
* **Provider Services:** Hospital management systems, medical gear AMC.
* **Registry/Public Hook:** NABH registry status, insurer panel empanelments.

---

## 11. Education & EdTech
* **Seeker Profile:** Private universities, coaching institutes, schools.
* **Provider Services:** Admission CRM tools, campus management systems, LMS.
* **Registry/Public Hook:** UGC/AICTE registry data, affiliation status filings.

---

## 12. Real Estate & Construction
* **Seeker Profile:** Real estate developers, commercial brokers.
* **Provider Services:** Lead gen for properties, 3D render visualization.
* **Registry/Public Hook:** **[The Loophole]** RERA registration filings (mandatory in India for real estate projects).

---

## 13. Hospitality & Food Service
* **Seeker Profile:** Fine dining outlets, cloud kitchen chains, premium hotels.
* **Provider Services:** POS systems, delivery-partner integration, hotel booking software.
* **Registry/Public Hook:** FSSAI licensing registry, presence/absence on Zomato/Swiggy delivery portals.

---

## 14. Retail & D2C Brands
* **Seeker Profile:** Lifestyle, clothing, cosmetics brands.
* **Provider Services:** Customer loyalty systems, packaging supply, catalog photo shoots.
* **Registry/Public Hook:** Shopify checkout tags, trademark filings.

---

## 15. Agriculture & Agritech
* **Seeker Profile:** Farmer Producer Organizations (FPOs), agribusiness distributors.
* **Provider Services:** Cold-chain transport, farm-management software.
* **Registry/Public Hook:** APMC mandi registration portals, FPO national directories.

---

## 16. Automotive & Dealerships
* **Seeker Profile:** Showrooms, fleet owners, EV charging operators.
* **Provider Services:** Dealership CRM, EV charger installs, fleet telematics.
* **Registry/Public Hook:** Vahan database indicators, showroom opening notices.

---

## 17. Energy & Sustainability
* **Seeker Profile:** Factories, commercial buildings.
* **Provider Services:** Solar power installs, ESG audits, waste management.
* **Registry/Public Hook:** Satellite mapping of roof areas, BRSR ESG compliance reporting.

---

## 18. Media & Entertainment
* **Seeker Profile:** Ad agencies, gaming developers.
* **Provider Services:** Video rendering, localization.
* **Registry/Public Hook:** Corporate youtube video cadence, press release timelines.

---

## 19. Financial Services & Fintech
* **Seeker Profile:** NBFCs, lending platforms.
* **Provider Services:** Automated KYC pipelines, collections systems.
* **Registry/Public Hook:** IRDAI compliance filings, Razorpay/Stripe checkout codes.

---

## 20. Professional Services
* **Seeker Profile:** Architecture firms, legal firms.
* **Provider Services:** Timesheet software, project management tools.
* **Registry/Public Hook:** Public directories, LinkedIn headcount trends.

---

## 21. Non-Profit & Government-Adjacent
* **Seeker Profile:** NGOs, CSR funds.
* **Provider Services:** Impact reporting tools, donor tracking dashboards.
* **Registry/Public Hook:** Darpan NGO registration portal (India).
