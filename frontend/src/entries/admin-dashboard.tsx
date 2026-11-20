import { mountMpaPage } from "../lib/mountPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";

mountMpaPage(<AdminDashboardPage />, { allowedRoles: ["admin"] });
