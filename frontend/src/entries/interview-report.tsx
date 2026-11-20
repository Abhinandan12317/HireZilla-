import { mountMpaPage } from "../lib/mountPage";
import { InterviewReportPage } from "../pages/InterviewReportPage";

mountMpaPage(<InterviewReportPage />, { allowedRoles: ["recruiter"] });
