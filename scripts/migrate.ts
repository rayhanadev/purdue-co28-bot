import { resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";

import { db } from "../src/db";

(async () => {
  await migrate(db, { migrationsFolder: resolve(__dirname, "../migrations") });
})();
