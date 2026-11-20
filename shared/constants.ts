export const BRAND = {
  name: "HireZilla",
  tagline: "The monster of hiring",
  mascot: "Zilo",
  heroTagline: "From first click to first day — we've got the beast covered.",
  candidateCta: "Find your next opportunity",
  recruiterCta: "Start hiring",
  candidateValueHeading: "Show what you can do",
  candidateValueText:
    "Build one skills-and-project portfolio, then use it to apply for opportunities.",
  recruiterValueHeading: "Find talent beyond the resume",
  recruiterValueText:
    "Review structured skill evidence, compare applicants and move shortlisted candidates through screening.",
  mascotIntro: "Meet Zilo",
} as const;

export const RESUME_CATEGORY_KEYS = [
  "technicalSkillsMatch",
  "relevantWorkExperience",
  "projectsAndPracticalImplementation",
  "educationalQualifications",
  "resumePresentationAndReadability",
  "internshipsAndCertifications",
  "jobSpecificEligibility",
] as const;

export type ResumeCategoryKey = (typeof RESUME_CATEGORY_KEYS)[number];

export const RESUME_WEIGHTS: Record<ResumeCategoryKey, number> = {
  technicalSkillsMatch: 30,
  relevantWorkExperience: 20,
  projectsAndPracticalImplementation: 15,
  educationalQualifications: 10,
  resumePresentationAndReadability: 10,
  internshipsAndCertifications: 5,
  jobSpecificEligibility: 10,
} as const;

export const RESUME_CATEGORY_LABELS: Record<ResumeCategoryKey, string> = {
  technicalSkillsMatch: "Technical skills match",
  relevantWorkExperience: "Relevant work experience",
  projectsAndPracticalImplementation: "Projects and practical implementation",
  educationalQualifications: "Educational qualifications",
  resumePresentationAndReadability: "Resume presentation and readability",
  internshipsAndCertifications: "Internships and certifications",
  jobSpecificEligibility: "Job-specific eligibility",
};

export const RESUME_SCREENING_CONFIG = {
  rubricVersion: "P1-v1" as const,
  qualificationThreshold: 60,
  displayDecimalPlaces: 2,
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxPages: 10,
  minExtractedChars: 60,
  minCharsPerPage: 20,
} as const;

export const HATCHLING_ENTITLEMENT = {
  packageCode: "HATCHLING_FREE" as const,
  displayName: "Hatchling",
  tier: "FREE" as const,
  priceDisplay: "Free",
  priceAmount: 0,
  currency: "INR",
  billingInterval: null,
  tagline: "Small start. Discover your hiring power",
  availabilityLabel: "Available now",
  maxApplicationsPerJob: 20,
  resumeParsing: true,
  atsMatching: true,
  evidenceReport: true,
  automatedEmailInvitations: true,
  aiTextInterview: true,
  generalAptitude: false,
  dsaAssessment: false,
  cognitiveAssessment: false,
  hrVideoInterview: false,
  paymentRequired: false,
} as const;

export const PACKAGE_CATALOGUE = [
  {
    packageCode: "HATCHLING_FREE",
    displayName: "Hatchling",
    tier: "FREE",
    priceDisplay: "Free",
    tagline: "Small start. Discover your hiring power",
    availabilityLabel: "Available now",
    isAvailableInMvp: true,
    maxApplicationsPerJobLabel: "Up to 20 applications per job",
    features: [
      { label: "Up to 20 applications per job", included: true },
      { label: "Resume parsing (PDF validation & extraction)", included: true },
      { label: "AI-assisted resume and job match", included: true },
      { label: "Candidate evidence report (7 fixed categories)", included: true },
      { label: "Shortlist candidates", included: true },
      { label: "Automated email invitations", included: true },
      { label: "AI text interview", included: true },
      { label: "General aptitude assessment", included: false, plannedTier: "Titan" },
      { label: "DSA coding assessment", included: false, plannedTier: "Titan" },
      { label: "Cognitive games / activities", included: false, plannedTier: "Colossus" },
    ],
  },
  {
    packageCode: "TITAN",
    displayName: "Titan",
    tier: "MID",
    priceDisplay: "₹9,999–₹14,999 / month",
    tagline: "More power. smarter hiring. faster teams",
    availabilityLabel: "Coming soon",
    isAvailableInMvp: false,
    maxApplicationsPerJobLabel: "Planned: up to 50 applications per job",
    features: [
      { label: "Includes full Hatchling recruitment workflow", included: true },
      { label: "Planned: up to 50 applications per job", included: true },
      { label: "General aptitude assessment", included: true },
      { label: "One DSA assessment round", included: true },
      { label: "AI text-based interview", included: true },
      { label: "Cognitive games / activities", included: false, plannedTier: "Colossus" },
    ],
  },
  {
    packageCode: "COLOSSUS",
    displayName: "Colossus",
    tier: "HIGH",
    priceDisplay: "₹19,999–₹24,999 / month",
    tagline: "Unleash the full power of your hiring ecosystem",
    availabilityLabel: "Coming soon",
    isAvailableInMvp: false,
    maxApplicationsPerJobLabel: "Planned ecosystem scale",
    features: [
      { label: "Includes planned Hatchling & Titan workflows", included: true },
      { label: "General aptitude & DSA assessment rounds", included: true },
      { label: "AI text-based interview", included: true },
      { label: "Cognitive activities / games", included: true },
    ],
  },
] as const;

export const TIE_REASON_CODES = [
  { code: "mandatory_skill_depth", label: "Stronger evidence on mandatory technical criteria" },
  { code: "relevant_project_complexity", label: "Higher relevance/ownership in practical implementation" },
  { code: "experience_scope_fit", label: "Closer match to job-level experience scope" },
  { code: "eligibility_clarity", label: "Clearer demonstration of explicit eligibility criteria" },
  { code: "progress_both_review", label: "Both tied candidates merit progression to interview stage" },
  { code: "other_job_related_reason", label: "Other job-related reason (note required)" },
] as const;

export type TieReasonCode = (typeof TIE_REASON_CODES)[number]["code"];

export const PROTECTED_ATTRIBUTE_PATTERNS = [
  /\b(male|female|gender|man|woman|boy|girl|caste|religion|hindu|muslim|christian|sikh|brahmin|dalit|obc|age|years old|married|unmarried|pregnant|disability|ethnicity|race|skin colour|skin color)\b/i,
];
