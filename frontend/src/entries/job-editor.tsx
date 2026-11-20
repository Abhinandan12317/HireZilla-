import { mountMpaPage } from "../lib/mountPage";
import { JobEditorPage } from "../pages/JobEditorPage";

mountMpaPage(<JobEditorPage />, { allowedRoles: ["recruiter"] });
