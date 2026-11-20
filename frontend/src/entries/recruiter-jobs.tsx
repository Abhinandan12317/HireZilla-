import { mountMpaPage } from "../lib/mountPage";
import { RecruiterJobsPage } from "../pages/RecruiterJobsPage";

mountMpaPage(<RecruiterJobsPage />, { allowedRoles: ["recruiter"] });
