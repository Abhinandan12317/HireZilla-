import { mountMpaPage } from "../lib/mountPage";
import { EasyApplyPage } from "../pages/EasyApplyPage";

mountMpaPage(<EasyApplyPage />, { allowedRoles: ["student"] });
