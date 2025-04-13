import { CheerioCrawler, RequestQueue } from "crawlee";

import { router } from "./routes.js";
import {
  exportProductsGroupedByCollection,
  sendDataToBackend,
} from "./utils.js";

const startUrls = ["http://irbis-miniatures.com/"];

(async () => {
  try {
    console.log("Initializing request queue...");
    const requestQueue = await RequestQueue.open();

    console.log("Adding start URL to the request queue...");
    await requestQueue.addRequest({ url: startUrls[0] });

    console.log("Starting the crawler...");
    const crawler = new CheerioCrawler({
      requestQueue,
      requestHandler: router,
      maxRequestsPerCrawl: 50,
    });

    await crawler.run();
    console.log("Crawl completed. Exporting data...");

    await exportProductsGroupedByCollection();
    console.log(
      "Data export completed. Check the key-value store for products_by_collection.json."
    );

    // Uncomment the following lines to send data to the backend
    // await sendDataToBackend();
    // console.log("Data sent to the backend successfully.");
  } catch (error) {
    console.error("An error occurred during the crawl:", error);
  }
})();
