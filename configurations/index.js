import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import development from "./development.js";
import production from "./production.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, `../env/.env.${process.env.NODE_ENV}`);

dotenv.config({ path: envPath });

const NODE_ENV = process.env.NODE_ENV ?? "development";
const ENV_VAR = process.env;

const configurations = {
    development,
    production
};

export default { ...configurations[NODE_ENV], ...ENV_VAR }; 
