/**
 * Run the ss.lv market data scraper to collect pricing stats.
 * Usage: npx tsx scripts/scrape-market-data.mts
 */
import "dotenv/config";

// Force enable scraping for this run
process.env.SSLV_SCRAPER_ENABLED = "true";

const { runScraper } = await import("../src/server/services/scraper-sslv.js");

console.log("🔍 Starting ss.lv market data scraper...\n");
const result = await runScraper();

console.log("\n✅ Scraper complete!");
console.log(`   Categories processed: ${result.categoriesProcessed}`);
console.log(`   Snapshots created:    ${result.snapshotsCreated}`);
console.log(`   Region snapshots:     ${result.regionSnapshots}`);
console.log(`   Errors:               ${result.errors}`);

process.exit(0);
