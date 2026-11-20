import { mountMpaPage } from "../lib/mountPage";
import { InterviewSetupPage } from "../pages/InterviewSetupPage";

mountMpaPage(<InterviewSetupPage />, { allowedRoles: ["recruiter"] });
