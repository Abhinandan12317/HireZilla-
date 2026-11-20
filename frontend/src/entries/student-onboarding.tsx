import { mountMpaPage } from "../lib/mountPage";
import { StudentPortfolioBuilder } from "../pages/StudentPortfolioBuilder";

mountMpaPage(<StudentPortfolioBuilder />, { allowedRoles: ["student"] });
