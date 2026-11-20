import { mountMpaPage } from "../lib/mountPage";
import { StudentApplicationsPage } from "../pages/StudentApplicationsPage";

mountMpaPage(<StudentApplicationsPage />, { allowedRoles: ["student"] });
