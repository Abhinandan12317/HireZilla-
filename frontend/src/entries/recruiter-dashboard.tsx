import { mountMpaPage } from "../lib/mountPage";
import { RecruiterDashboard } from "../pages/RecruiterDashboard";

mountMpaPage(<RecruiterDashboard />, { allowedRoles: ["recruiter"] });
