import { mountMpaPage } from "../lib/mountPage";
import { StudentDashboard } from "../pages/StudentDashboard";

mountMpaPage(<StudentDashboard />, { allowedRoles: ["student"] });
