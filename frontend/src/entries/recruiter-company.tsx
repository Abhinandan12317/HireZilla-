import { mountMpaPage } from "../lib/mountPage";
import { RecruiterCompanyPage } from "../pages/RecruiterCompanyPage";

mountMpaPage(<RecruiterCompanyPage />, { allowedRoles: ["recruiter"] });
