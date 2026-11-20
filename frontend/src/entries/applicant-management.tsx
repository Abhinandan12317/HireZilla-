import { mountMpaPage } from "../lib/mountPage";
import { ApplicantManagementPage } from "../pages/ApplicantManagementPage";

mountMpaPage(<ApplicantManagementPage />, { allowedRoles: ["recruiter"] });
