import { mountMpaPage } from "../lib/mountPage";
import { TieReviewPage } from "../pages/TieReviewPage";

mountMpaPage(<TieReviewPage />, { allowedRoles: ["recruiter"] });
