# HireZilla

### AI-powered recruitment infrastructure for structured, evidence-driven hiring

HireZilla is an AI-assisted recruitment and talent assessment platform
designed to make hiring more structured, consistent, and scalable. It
aims to help recruiters move from manually reviewing large volumes of
applications to evaluating candidates through a configurable recruitment
pipeline.

The project is part of **Resurrect** and is being developed with a
prototype-first approach: establish a working product foundation,
validate the core workflow, and progressively evolve it toward a
production-ready recruitment platform.

> **Project status:** Prototype / active development. The repository
> contains the application foundation. The complete product vision and
> planned assessment workflow described below should not be interpreted
> as meaning every capability is already implemented or
> production-ready.

------------------------------------------------------------------------

## Contents

-   [Vision](#vision)
-   [The Problem](#the-problem)
-   [The HireZilla Approach](#the-hirezilla-approach)
-   [Recruitment Lifecycle](#recruitment-lifecycle)
-   [Recruiter Workflow](#recruiter-workflow)
-   [Candidate Workflow](#candidate-workflow)
-   [Recruitment Packages](#recruitment-packages)
-   [Assessment Framework](#assessment-framework)
-   [Scoring and Progression
    Principles](#scoring-and-progression-principles)
-   [Final Shortlisting](#final-shortlisting)
-   [AI Design Principles](#ai-design-principles)
-   [Technology Stack](#technology-stack)
-   [Repository Structure](#repository-structure)
-   [Architecture Overview](#architecture-overview)
-   [Getting Started](#getting-started)
-   [Environment Configuration](#environment-configuration)
-   [Development Commands](#development-commands)
-   [Testing](#testing)
-   [Security and Responsible
    Evaluation](#security-and-responsible-evaluation)
-   [Roadmap](#roadmap)
-   [Resurrect](#resurrect)
-   [Contributing](#contributing)
-   [License](#license)

------------------------------------------------------------------------

## Vision

Hiring should not depend on a recruiter manually opening hundreds of
resumes, repeatedly administering assessments, and stitching together
candidate information from disconnected tools.

HireZilla aims to provide a unified recruitment workflow in which
applicants are evaluated against job-specific requirements, assessment
stages are coordinated automatically, and recruiters receive a
structured shortlist with supporting evaluation information.

The goal is **not to automate away human judgment**. The goal is to
reduce repetitive work, make evaluation more consistent, and give
recruiters better information to make decisions.

### Long-term objectives

-   Reduce manual resume-review workload.
-   Support job-specific candidate evaluation.
-   Combine resume screening and assessments into a coherent recruitment
    pipeline.
-   Automate candidate communication and stage progression where
    appropriate.
-   Make evaluation criteria and scores understandable.
-   Give recruiters a structured shortlist instead of an unfiltered
    application pile.
-   Build a maintainable foundation that can grow beyond a prototype.

------------------------------------------------------------------------

## The Problem

Recruitment teams can face several recurring challenges:

-   High application volume for a single role.
-   Time-consuming manual resume screening.
-   Inconsistent evaluation between reviewers.
-   Difficulty assessing actual technical capability from resumes alone.
-   Disconnected aptitude, coding, and interview processes.
-   Repeated administrative work and candidate communication.
-   Limited visibility into why candidates progressed or were filtered
    out.

A resume is an introduction, not proof of skill. HireZilla is intended
to evaluate candidates through multiple stages rather than relying
exclusively on resume claims.

------------------------------------------------------------------------

## The HireZilla Approach

HireZilla is designed around a staged recruitment pipeline:

1.  **Resume screening** --- assess job relevance, eligibility,
    qualifications, experience, skills, projects, and resume
    presentation.
2.  **Aptitude assessment** --- evaluate quantitative, logical, verbal,
    and data-interpretation abilities.
3.  **Cognitive assessment (package-dependent)** --- assess selected
    cognitive abilities through interactive games.
4.  **Coding assessment** --- evaluate programming and problem-solving
    performance.
5.  **AI technical interview** --- evaluate technical knowledge,
    reasoning, and understanding of the candidate's submitted code.
6.  **Recruiter review** --- provide a ranked shortlist for human review
    and final decision-making.

Candidates progress according to the configured job workflow and the
qualification rules. Passing a later assessment does not retroactively
compensate for failing an earlier elimination stage.

------------------------------------------------------------------------

## Recruitment Lifecycle

``` mermaid
flowchart TD
    A[Recruiter creates a job] --> B[Applications received]
    B --> C[AI resume screening]
    C -->|Qualifies| D[Aptitude assessment]
    C -->|Does not qualify| X[Stage closed]
    D --> E{Package includes cognitive assessment?}
    E -->|Yes| F[Combined aptitude + cognitive assessment]
    E -->|No| G[Aptitude evaluation]
    F --> H{Qualifies?}
    G --> H
    H -->|No| X
    H -->|Yes| I[Coding / DSA assessment]
    I --> J{Qualifies?}
    J -->|No| X
    J -->|Yes| K[AI technical interview]
    K --> L[Candidate ranking and shortlist]
    L --> M[Recruiter / HR review]
    M --> N[Human hiring decision]
```

The diagram represents the intended product workflow. Package
configuration determines which assessments are applicable.

------------------------------------------------------------------------

## Recruiter Workflow

The recruiter experience is intended to cover the recruitment process
from job creation through shortlist review.

### 1. Company and recruiter onboarding

Recruiters create an account, establish their company profile, and
access the platform according to their subscription.

### 2. Subscription and job setup

The recruiter selects an eligible recruitment package and creates a job
opening with role details, job description, required skills, eligibility
criteria, and openings.

The job description is central to candidate evaluation. Screening
criteria should adapt to the role while preserving a consistent scoring
framework.

### 3. Application management

Applications are collected and organized for the corresponding job
opening. Candidate information and evaluation status should remain
associated with that opening.

### 4. Automated screening and assessments

HireZilla is designed to coordinate screening, assessment invitations,
stage evaluation, and candidate progression.

### 5. Shortlist review

Recruiters receive candidate rankings and structured evaluation
summaries, allowing them to review evidence and make the final decision.

------------------------------------------------------------------------

## Candidate Workflow

The candidate experience is intended to be straightforward and
transparent.

1.  Create an account and profile.
2.  Maintain one or more resumes.
3.  Apply for a job.
4.  Receive an assessment invitation when eligible.
5.  Complete the applicable assessment stages.
6.  Receive relevant communication about progression.

Candidates should not need to navigate unnecessary recruitment
complexity. Assessment instructions, timing, eligibility, and submission
status should be clear at each stage.

------------------------------------------------------------------------

## Recruitment Packages

HireZilla's planned package model provides different levels of
assessment depth.

  Capability                   Quick Interview   Medium Selection   Extreme Selection
  -------------------------- ----------------- ------------------ -------------------
  AI resume screening                 Included           Included            Included
  General aptitude                         ---           Included            Included
  Cognitive thinking games                 ---                ---            Included
  Coding assessment                        ---       One question        One question
  AI technical interview                   ---           Included            Included

The package model is designed to accommodate different hiring needs,
from resume-first screening to a more comprehensive multi-stage
evaluation.

Package availability, subscription limits, billing, and entitlements
must be enforced by the application rather than trusted solely to
frontend controls.

> Package names and feature definitions reflect the intended product
> plan. Pricing and commercial limits may change.

------------------------------------------------------------------------

## Assessment Framework

### 1. AI Resume Screening

Resume screening is intended to evaluate a candidate's resume against
the specific job description.

The planned evaluation considers seven core scoring categories, with
criteria dynamically adapted to the job while preserving the scoring
framework.

Areas of evaluation include:

-   Resume presentation and professionalism.
-   Readability and structure.
-   Job-relevant skills.
-   Educational qualifications.
-   Relevant experience and internships.
-   Projects and demonstrated work.
-   Job-specific eligibility and overall relevance.

Resume quality matters because a resume is also a candidate's
professional communication document. However, presentation should not
replace substantive assessment of capability.

**Planned qualifying threshold:** 80% for resume screening.

The screening output is intended to include a score, relevant evidence,
strengths, gaps, and a job-specific explanation.

#### Referral and recommendation handling

Referrals and recommendations may influence prioritization at the
resume-screening stage only.

They must not affect aptitude, cognitive, coding, technical-interview,
or other assessment scores. Assessment performance must reflect the
candidate's demonstrated answers and work.

------------------------------------------------------------------------

### 2. General Aptitude Assessment

The General Aptitude Assessment is an internally developed assessment
designed to evaluate foundational problem-solving abilities.

Planned areas include:

-   Quantitative aptitude.
-   Logical reasoning.
-   Verbal ability.
-   Data interpretation.

The assessment is intended to be timed and scored consistently.

**Planned qualifying threshold:** 80%.

Question count, duration, difficulty distribution, and the final scoring
model are subject to implementation decisions.

------------------------------------------------------------------------

### 3. Cognitive Thinking Assessment

The cognitive assessment is planned for the Extreme Selection package.

The initial beta is intended to contain **two games**.

#### Mathematical Operator Challenge

Candidates work with mathematical values and operators to construct an
expression that satisfies a target.

Intended evaluation dimensions include:

-   Logical thinking.
-   Calculation accuracy.
-   Processing speed.
-   Decision-making.
-   Time taken.

#### Working Memory Challenge

A game designed to assess working-memory performance, including the
ability to retain and use information while completing a task.

Detailed game mechanics and scoring are still subject to design and
validation.

#### Cognitive scoring

Speed and accuracy are intended to contribute to the score using a
defined scoring model. Early completion should not produce arbitrary
bonus points. The scoring should be designed to reward efficient and
correct performance without undermining accuracy.

When cognitive assessment is included, it is completed in the same
assessment sitting as General Aptitude and contributes to **one combined
assessment score**.

------------------------------------------------------------------------

### 4. Coding / DSA Assessment

The coding assessment is intended to measure programming and
problem-solving ability using a coding-execution service.

Planned assessment structure:

-   One coding problem per applicable package.
-   Automated execution against test cases.
-   Evaluation of correctness and problem-solving performance.
-   A score used to determine stage qualification.
-   The candidate's submitted solution retained as context for relevant
    technical-interview questions.

**Planned qualifying threshold:** 80%.

The coding-execution provider, supported languages, test-case weighting,
execution limits, and detailed scoring are to be finalized.

------------------------------------------------------------------------

### 5. AI Technical Interview

The planned AI Technical Interview is a **text-based assessment**.
Voice-based interviews and audio transcription are outside the current
scope of this design.

The interview contains 15 questions:

  Question category             Count
  -------------------------- --------
  Technical MCQs                   10
  Technical reasoning               3
  DSA / code comprehension          2
  **Total**                    **15**

#### Technical MCQs

Evaluate foundational and role-relevant technical knowledge.

#### Technical reasoning

Evaluate the candidate's ability to reason through technical scenarios
and problems.

#### Code comprehension

Two questions are generated in relation to the candidate's
coding-assessment submission. They are intended to examine the
candidate's understanding of their own solution rather than simply
presenting unrelated generic coding questions.

The interview evaluation is intended to consider answer accuracy,
correctness, and relevant reasoning. The exact rubric, score weighting,
interview duration, and report format remain to be finalized.

AI interview results are decision-support information. They do not
constitute an automated hiring decision.

------------------------------------------------------------------------

## Scoring and Progression Principles

The planned minimum threshold for applicable elimination stages is
**80%**.

  -----------------------------------------------------------------------
  Stage                               Planned qualifying rule
  ----------------------------------- -----------------------------------
  Resume screening                    At least 80%

  General aptitude                    At least 80%

  General aptitude + cognitive        At least 80% combined
  assessment                          

  Coding assessment                   At least 80%

  AI technical interview              Evaluated and reported; no
                                      independent 80% elimination rule
                                      currently defined
  -----------------------------------------------------------------------

### Independent stage qualification

Each elimination stage is evaluated independently.

A candidate cannot compensate for a failed stage with a higher score
from a previous stage.

For example, a candidate with 95% in resume screening and 78% in coding
does not qualify through the coding stage merely because their resume
score was high.

### Combined aptitude and cognitive evaluation

For packages containing both aptitude and cognitive assessment:

-   Both components are completed in one sitting.
-   They are treated as one stage.
-   They produce one combined score.
-   Qualification is based on the combined score.
-   Component scores may also be retained for reporting.

The final combination formula and component weights must be established
before production use.

------------------------------------------------------------------------

## Final Shortlisting

The planned final shortlist size follows the formula:

\[ `\boxed{\text{Shortlist Size}=2N+4}`{=tex} \]

Where `N` is the number of job openings.

    Openings (`N`)   Shortlist target
  ---------------- ------------------
                 1                  6
                 2                  8
                 3                 10
                 4                 12
                 5                 14

The shortlist is generated from candidates who have completed the
applicable pipeline, using the final ranking methodology.

Recruiters and HR review the shortlist and retain the authority to
decide whom to invite to the final interview and whom to hire.

If fewer candidates qualify than the target shortlist size, the system
should not fabricate or silently lower qualification standards. The
handling of undersized shortlists will be defined by recruitment policy.

------------------------------------------------------------------------

## AI Design Principles

HireZilla uses AI as an evaluation and workflow-support capability, not
as an unchecked decision-maker.

### Job-aware evaluation

Evaluation criteria should adapt to the job description, role, and
required skills while preserving a consistent underlying scoring
structure.

### Structured outputs

AI evaluation should return structured, validated results rather than
relying on unstructured paragraphs as the only output.

### Evidence-linked reasoning

Scores and feedback should be supported by information present in the
resume, assessment response, or code submission. The system should avoid
claims that cannot be traced to candidate-provided evidence.

### Deterministic rules for critical decisions

Where possible, calculations, thresholds, package entitlements, stage
progression, shortlist counts, and other rule-based operations should be
handled by application logic rather than entrusted to free-form AI
generation.

### Human oversight

Recruiters retain final decision-making authority.

### No referral leakage

Referral or recommendation information is restricted to the
resume-screening priority mechanism. It must not leak into subsequent
assessment scoring.

### No false certainty

Generative AI can make mistakes. HireZilla should be designed to
validate AI output, preserve source evidence, and allow review rather
than claim perfect accuracy.

------------------------------------------------------------------------

## Technology Stack

The repository's current configuration establishes the following
technology foundation.

  Technology                             Purpose
  -------------------------------------- -----------------------------------------
  React                                  Frontend application UI
  TypeScript                             Type-safe application development
  Vite                                   Frontend tooling and development server
  Node.js                                Server-side runtime
  Express                                HTTP server and backend application
  MongoDB                                Database
  Google Gemini API / Google GenAI SDK   AI integration
  Zod                                    Schema validation
  Multer                                 File upload handling
  PDF.js                                 PDF document processing
  JWT                                    Token-based authentication support
  Google Auth libraries                  Google authentication integration
  Tailwind CSS                           Styling
  Motion                                 UI animation
  Lucide React                           Icons
  Vitest                                 Testing
  Supertest                              HTTP endpoint testing
  esbuild                                Backend build tooling

Dependency versions and available functionality should be checked
against `package.json` before upgrading or changing the stack.

------------------------------------------------------------------------

## Repository Structure

The repository is organized into application areas rather than being a
single frontend-only project.

``` text
HireZilla/
├── backend/
│   └── src/
│       ├── app and routes
│       ├── configuration
│       ├── database
│       ├── services
│       └── server
├── frontend/
│   ├── application pages
│   ├── UI components
│   ├── assets
│   └── frontend tooling
├── shared/
│   └── shared application utilities
├── tests/
│   └── test suites
├── .env.example
├── .gitignore
├── AWS_DEPLOYMENT.md
├── index.html
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

> This is a high-level representation of the repository organization.
> Refer to the actual directory tree for exact files and modules.

------------------------------------------------------------------------

## Architecture Overview

HireZilla is structured around a frontend, backend, shared modules, and
external services.

``` mermaid
flowchart LR
    U[Recruiter / Candidate] --> FE[React Frontend]
    FE --> API[Express Backend]
    API --> DB[(MongoDB)]
    API --> AI[Gemini API]
    API --> FILE[File / PDF Processing]
    API --> AUTH[Authentication]
    API --> EXT[External Integrations]
```

### Frontend

The frontend is responsible for user interaction, page rendering, forms,
application workflows, assessment interfaces, and presenting evaluation
results.

### Backend

The backend is responsible for API handling, server-side validation,
authentication-related processing, application logic, persistence,
integrations, and protected operations.

### Shared modules

Shared code provides a place for utilities and logic used by more than
one part of the application.

### Database

MongoDB is used for persistence. Database connection and application
initialization are handled by the server startup process.

### AI integration

The Google GenAI SDK provides the integration layer for Gemini-based
functionality. AI calls should be performed in the appropriate
server-side context, with secrets kept out of client bundles.

### File and document processing

The dependency set includes Multer for file upload handling and PDF.js
for PDF processing. These components support document-related workflows,
subject to their actual application integration.

------------------------------------------------------------------------

## Getting Started

### Prerequisites

-   Node.js installed.
-   npm available.
-   MongoDB instance or compatible MongoDB connection.
-   Gemini API key for AI features.
-   Git.

### 1. Clone the repository

``` bash
git clone https://github.com/Abhinandan12317/HireZilla-.git
cd HireZilla-
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create a local environment file based on the repository template:

``` bash
cp .env.example .env
```

If the application expects `.env.local` in your local AI Studio
workflow, use the configuration file expected by that environment. Never
commit actual API keys, credentials, or secrets.

Populate the required variables based on `.env.example` and the backend
configuration.

### 4. Run the application

``` bash
npm run dev
```

The root development script starts the TypeScript server. The server
initializes the backend and, in development, integrates Vite middleware.

Check the terminal output for the actual port and startup status.

------------------------------------------------------------------------

## Environment Configuration

The repository includes an `.env.example` file. Use it as the
authoritative list of supported environment variables.

Configuration may include items for:

-   Gemini API access.
-   MongoDB connection.
-   Application environment.
-   Session and signed-URL secrets.
-   Google OAuth configuration.
-   Server port.

The exact variable names, required/optional status, defaults, and
behavior must be taken from `.env.example` and the backend configuration
module.

### Security rules

-   Do not commit `.env`, `.env.local`, or production secrets.
-   Never expose Gemini API keys in frontend code.
-   Use strong, persistent secrets in deployed environments.
-   Avoid ephemeral secrets for production.
-   Restrict credentials to the permissions they actually need.
-   Rotate credentials if they are exposed.

------------------------------------------------------------------------

## Development Commands

The repository currently defines the following npm scripts.

  -----------------------------------------------------------------------
  Command                             Purpose
  ----------------------------------- -----------------------------------
  `npm run dev`                       Start the root development server

  `npm start`                         Start the root server

  `npm run dev:backend`               Run the backend development
                                      server/watch process

  `npm run dev:frontend`              Run Vite using the frontend
                                      configuration

  `npm run build`                     Build using the root Vite
                                      configuration

  `npm run build:backend`             Bundle the backend using esbuild

  `npm run build:frontend`            Build the frontend using its Vite
                                      configuration

  `npm run preview`                   Preview the Vite build

  `npm run lint`                      Run the TypeScript no-emit check

  `npm test`                          Run Vitest

  `npm run clean`                     Remove configured build outputs
  -----------------------------------------------------------------------

Scripts are taken from the repository's package configuration. Their
successful execution depends on local configuration, installed
dependencies, and environment variables.

------------------------------------------------------------------------

## Testing

The project includes Vitest and Supertest in its dependency
configuration.

Testing is intended to help validate:

-   Backend route behavior.
-   API responses.
-   Validation logic.
-   Application services.
-   Core business rules.
-   Integration behavior where test infrastructure is available.

Run the test suite:

``` bash
npm test
```

Run the TypeScript check:

``` bash
npm run lint
```

Test coverage, CI automation, integration test infrastructure, and
production quality gates should be expanded as the application evolves.

------------------------------------------------------------------------

## Security and Responsible Evaluation

Recruitment software handles sensitive personal data. HireZilla's
development and deployment must account for the following.

### Candidate privacy

-   Collect only information required for the recruitment workflow.
-   Restrict candidate information to authorized users.
-   Avoid exposing resumes or assessment results through public URLs.
-   Establish appropriate retention and deletion policies.

### Authentication and authorization

-   Protect recruiter and candidate accounts.
-   Verify authorization on the server for sensitive operations.
-   Enforce company and job-level data isolation.
-   Do not rely on hidden UI elements as security controls.

### Uploaded documents

-   Validate uploaded file types and sizes.
-   Handle malformed or unsafe files.
-   Keep uploaded files protected.
-   Treat document content as untrusted input.

### AI evaluation

-   Validate generated data.
-   Keep scores tied to defined criteria.
-   Provide meaningful evaluation evidence.
-   Avoid unsupported conclusions about candidates.
-   Maintain human oversight.

### Assessment integrity

-   Define consistent assessment conditions.
-   Apply qualification rules consistently.
-   Protect assessment content where practical.
-   Log relevant assessment events without unnecessarily storing
    sensitive information.

These are design and implementation objectives. The presence of a
dependency or module does not itself establish that every security
control has been implemented.

------------------------------------------------------------------------

## Roadmap

The roadmap is directional. It does not claim that the listed features
are currently complete.

### Phase 1 --- Prototype foundation

-   Establish the application structure.
-   Build and validate primary user flows.
-   Confirm frontend/backend integration.
-   Connect required AI functionality.
-   Validate database operations.
-   Test the prototype end-to-end.

### Phase 2 --- Recruitment workflow

-   Recruiter onboarding and company profile.
-   Job creation and application management.
-   Candidate profile and resume management.
-   Resume screening.
-   Recruitment-stage tracking.

### Phase 3 --- Assessment engine

-   General aptitude assessment.
-   Cognitive thinking games.
-   Coding assessment integration.
-   AI technical interview.
-   Stage scoring and progression.

### Phase 4 --- Recruiter intelligence

-   Candidate ranking.
-   Evidence-based reports.
-   Shortlist generation.
-   Recruiter review tools.
-   Recruitment analytics.

### Phase 5 --- Production hardening

-   Authentication and authorization review.
-   Data isolation.
-   Security testing.
-   Error handling and observability.
-   Rate limiting.
-   Cost management.
-   Scalable storage and infrastructure.
-   Deployment, backups, and recovery.
-   Privacy and retention policies.

------------------------------------------------------------------------

## Resurrect

**Resurrect** is the broader project context in which HireZilla is being
developed.

HireZilla is a recruitment infrastructure project within this
initiative. Its development follows a prototype-first strategy: use
AI-assisted development to establish a functional system, evaluate the
architecture and workflows, and iteratively improve the product without
prematurely committing to unnecessary infrastructure.

The long-term objective is to move from a working prototype to a
reliable, maintainable, and deployable recruitment platform.

------------------------------------------------------------------------

## Contributing

Contributions, feedback, issue reports, and architectural suggestions
are welcome as the project develops.

When proposing changes:

1.  Explain the problem being solved.
2.  Describe the expected behavior.
3.  Identify relevant application areas.
4.  Consider security, data privacy, and validation.
5.  Include tests where practical.
6.  Avoid changing qualification rules or recruitment policy without
    explicit agreement.

For major changes, discuss the design before implementing them.

------------------------------------------------------------------------

## License

The project's license should be specified here once finalized.

Until a license is added and confirmed in the repository, reuse,
redistribution, and contribution rights should not be assumed.

------------------------------------------------------------------------

## Project

**HireZilla**\
AI-powered recruitment and talent assessment infrastructure.

Built as part of **Resurrect**.
