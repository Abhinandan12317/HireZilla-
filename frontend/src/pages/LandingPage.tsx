import {
  ArrowRight,
  Award,
  CheckCircle2,
  Code2,
  FileSearch,
  Layers,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { BRAND, PACKAGE_CATALOGUE, RESUME_CATEGORY_LABELS, RESUME_WEIGHTS } from "../../../shared/constants";
import { PublicFooter, PublicNavbar } from "../components/Layout";
import { routes } from "../lib/navigation";

const HERO_ARCHITECTURE_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBTUfnRHlBMz7tQkyOob_QwhTUtkbmzkIx6xZuxXAmRWgGRNXAj3sol-6oAf3CZLKQpV3QCYdowoftdMYd1e9tj_mEy8KVrOciVcle7px7qjXTFlPXcDFZ8mBaYFIE9X20iyonIRsRbrDqX3KZWu0naWMmY92CgtBaE3Rpi-I9kaK6KFn9tIjTyKR0eO1rS_bG4R-3lScjH8pp8DI9i2zk0-7QHTrc1_lx1p2jz5eXi";

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper-base text-on-surface">
      <PublicNavbar />

      <main className="flex-1">
        {/* 1. HERO SECTION */}
        <section className="relative bg-on-surface text-white overflow-hidden">
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 20% 25%, #6246ea 0%, transparent 45%), radial-gradient(circle at 82% 70%, #c8f169 0%, transparent 38%)",
            }}
          />
          <div className="relative max-w-[1320px] mx-auto px-4 sm:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Editorial Column */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold tracking-wide text-tertiary-fixed">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{BRAND.name} · {BRAND.tagline}</span>
              </div>

              <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[54px] leading-[1.08] tracking-tight text-white">
                {BRAND.heroTagline}
              </h1>

              <p className="text-base sm:text-lg text-white/80 max-w-2xl leading-relaxed">
                Prove engineering and domain skills with verified project portfolios, transparent 7-category resume screening, and structured AI text interviews — where human recruiters stay in charge of every hiring decision.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <a
                  href={routes.jobs}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed font-bold text-sm hover:bg-tertiary-fixed-dim transition-all shadow-md"
                >
                  <span>{BRAND.candidateCta}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={routes.signup()}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary-container text-white font-bold text-sm hover:bg-secondary-container transition-all border border-white/15"
                >
                  <span>{BRAND.recruiterCta}</span>
                </a>
                <a
                  href={routes.portfolio("arjun-mehta")}
                  className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-white/85 hover:text-white underline underline-offset-4"
                >
                  <span>View sample portfolio</span>
                </a>
              </div>
            </div>

            {/* Right Tactile Layered Cards */}
            <div className="lg:col-span-5 relative flex flex-col gap-4">
              {/* Top Tier Badge */}
              <div className="self-end px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3 text-xs">
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed" />
                <span className="font-semibold text-white">Hatchling · Free</span>
                <span className="text-white/70 tabular-nums">Up to 20 / job</span>
              </div>

              {/* Central Portfolio Card */}
              <div className="bg-surface-card text-on-surface rounded-2xl p-6 shadow-2xl border border-border-subtle">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary font-display font-bold text-lg flex items-center justify-center">
                      AM
                    </div>
                    <div>
                      <p className="font-display font-bold text-base text-on-surface">
                        Arjun Mehta
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Senior Backend &amp; Distributed Systems · /p/arjun-mehta
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-xs font-bold">
                    Referred
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Go", "FastAPI", "gRPC", "PostgreSQL", "Redis"].map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-md bg-paper-base border border-border-subtle text-xs font-semibold text-on-surface"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Overlapping ATS Evidence Snippet */}
                <div className="mt-4 p-4 rounded-xl bg-surface-container-low border border-primary/15">
                  <div className="flex items-center justify-between text-xs font-bold text-primary mb-2">
                    <span className="flex items-center gap-1.5">
                      <FileSearch className="w-4 h-4" />
                      <span>7-Category Weighted ATS Screening</span>
                    </span>
                    <span className="text-base font-display tabular-nums">94.30 / 100</span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Threshold 60.00% · Qualified · Traceable excerpt verified in Page 1 (`raft-kv-core`, FastAPI microservices).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. TRUST / VALUE STRIP */}
        <section className="bg-surface-card border-b border-border-subtle">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-display font-bold text-2xl text-primary tabular-nums">7 Categories</p>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                Fixed 100% rubric weights with dynamic job criteria
              </p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-primary tabular-nums">60.00%</p>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                Deterministic qualification gate calculated on backend
              </p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-primary tabular-nums">Referral-First</p>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                Trusted referrals ranked first without altering ATS scores
              </p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-primary tabular-nums">Human Final Say</p>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                AI surfaces evidence; recruiters own every shortlist &amp; hire
              </p>
            </div>
          </div>
        </section>

        {/* 3. FEATURE SHOWCASE */}
        <section className="max-w-[1320px] mx-auto px-4 sm:px-8 py-16 space-y-16">
          {/* Feature 1: Students */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Code2 className="w-4 h-4" />
                <span>For Students &amp; Candidates</span>
              </span>
              <h2 className="font-display font-bold text-3xl text-on-surface">
                {BRAND.candidateValueHeading}
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                {BRAND.candidateValueText} Apply in seconds with your PDF resume, optional referral code, and live application progress tracker.
              </p>
              <ul className="space-y-2 text-sm text-on-surface">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>6-step structured portfolio builder with shareable `/p/your-slug` link</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>Transparent application timeline without hidden rejections</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>Server-timed, autosaving written technical interview runner</span>
                </li>
              </ul>
              <div className="pt-2">
                <a
                  href={routes.jobs}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-white text-sm font-semibold hover:bg-primary transition-colors"
                >
                  <span>Explore Open Roles</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-6 bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
              <div className="h-56 bg-surface-container-low relative overflow-hidden">
                <img
                  src={HERO_ARCHITECTURE_IMG}
                  alt="Candidate engineering architecture visualization"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-display font-bold text-base text-on-surface flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span>raft-kv-core · Public Portfolio Project</span>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Demonstrates Go ring-buffer backpressure, Raft pre-vote quorum &amp; gRPC telemetry.
                  </p>
                </div>
                <a
                  href={routes.portfolio("arjun-mehta")}
                  className="shrink-0 px-3.5 py-2 rounded-lg border border-border-subtle text-xs font-bold text-primary hover:bg-surface-container-low"
                >
                  Open /p/arjun-mehta
                </a>
              </div>
            </div>
          </div>

          {/* Feature 2: Recruiters & 7-Category ATS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1 bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base text-on-surface">
                  Fixed P1 Resume Rubric Weights
                </h3>
                <span className="text-xs font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-full">
                  60% Qualification Threshold
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(RESUME_WEIGHTS).map(([key, weight]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-on-surface">
                        {RESUME_CATEGORY_LABELS[key as keyof typeof RESUME_CATEGORY_LABELS]}
                      </span>
                      <span className="text-primary font-mono tabular-nums">{weight}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-primary-container rounded-full"
                        style={{ width: `${weight * 3}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <ShieldCheck className="w-4 h-4" />
                <span>For Recruiters &amp; Hiring Teams</span>
              </span>
              <h2 className="font-display font-bold text-3xl text-on-surface">
                {BRAND.recruiterValueHeading}
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                {BRAND.recruiterValueText}
              </p>
              <ul className="space-y-2 text-sm text-on-surface">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>Every ATS score backed by exact PDF page excerpts &amp; confidence flags</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>Side-by-side tie-break review requiring documented job-related reasons</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>Scenario-based AI text interview evaluation with verbatim citations</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 4. WORKFLOW STRIP + MEET ZILO */}
          <div id="how-it-works" className="bg-surface-card rounded-2xl border border-border-subtle p-8 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {BRAND.mascotIntro} · End-to-End Hiring Flow
                </span>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-on-surface mt-1">
                  From first click to human panel decision
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold self-start">
                Hatchling MVP Available Now
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { step: "01", title: "Create Portfolio", desc: "Build verified projects & skills", Icon: Layers },
                { step: "02", title: "Easy Apply (PDF)", desc: "Magic-byte validated upload + optional referral", Icon: FileSearch },
                { step: "03", title: "ATS Evidence", desc: "7-category weighted scoring & 60% gate", Icon: Award },
                { step: "04", title: "AI Text Interview", desc: "Timed scenario prompts & autosave", Icon: MessageSquareText },
                { step: "05", title: "Recruiter Decision", desc: "Human review, tie resolution & panel invite", Icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.Icon;
                return (
                  <div
                    key={item.step}
                    className="p-4 rounded-xl bg-paper-base border border-border-subtle flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">{item.step}</span>
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-sm text-on-surface">
                      {item.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant leading-snug">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. PACKAGE PREVIEW */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-on-surface">
                  Start free with Hatchling
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Transparent MVP entitlements with zero hidden checkout flows.
                </p>
              </div>
              <a
                href={routes.packages}
                className="text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>Compare all packages</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PACKAGE_CATALOGUE.map((pkg) => (
                <div
                  key={pkg.packageCode}
                  className={`rounded-2xl p-6 border flex flex-col justify-between ${
                    pkg.isAvailableInMvp
                      ? "bg-surface-card border-primary shadow-md ring-1 ring-primary/15"
                      : "bg-surface-card/75 border-border-subtle opacity-90"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="font-display font-bold text-xl text-on-surface">
                        {pkg.displayName}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          pkg.isAvailableInMvp
                            ? "bg-tertiary-fixed text-on-tertiary-fixed"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {pkg.availabilityLabel}
                      </span>
                    </div>
                    <p className="font-display font-bold text-2xl text-primary">
                      {pkg.priceDisplay}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">{pkg.tagline}</p>

                    <ul className="mt-5 space-y-2 text-xs text-on-surface">
                      {pkg.features.slice(0, 5).map((f) => (
                        <li key={f.label} className="flex items-start gap-2">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              f.included ? "text-status-success" : "text-outline-variant"
                            }`}
                          />
                          <span className={f.included ? "" : "text-outline line-through"}>
                            {f.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6">
                    {pkg.isAvailableInMvp ? (
                      <a
                        href={routes.signup()}
                        className="block w-full text-center py-2.5 rounded-lg bg-primary-container text-white text-sm font-bold hover:bg-primary transition-colors"
                      >
                        Activate Hatchling
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 rounded-lg bg-surface-container-high text-outline text-sm font-bold cursor-not-allowed"
                      >
                        Coming soon
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
