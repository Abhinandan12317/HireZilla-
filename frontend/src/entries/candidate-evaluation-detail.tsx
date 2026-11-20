import { mountMpaPage } from "../lib/mountPage";
import { CandidateEvaluationDetailPage } from "../pages/CandidateEvaluationDetailPage";

mountMpaPage(<CandidateEvaluationDetailPage />, { allowedRoles: ["recruiter"] });
