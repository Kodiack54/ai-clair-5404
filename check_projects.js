require("dotenv").config();
const { from } = require("./src/lib/db");

(async () => {
  const tables = ["dev_ai_todos", "dev_ai_bugs", "dev_ai_knowledge", "dev_ai_docs", "dev_ai_journal"];
  
  console.log("=== ITEMS BY PROJECT_ID STATUS ===");
  
  for (const table of tables) {
    const { data: allItems } = await from(table).select("project_id");
    let nullCount = 0, hasCount = 0;
    for (const item of allItems) {
      if (item.project_id) {
        hasCount++;
      } else {
        nullCount++;
      }
    }
    console.log(table.replace("dev_ai_", ""), "| NULL:", nullCount, "| Has:", hasCount);
  }
})();
