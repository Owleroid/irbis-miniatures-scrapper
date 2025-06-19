import { CheerioCrawler, RequestQueue } from "crawlee";
import fs from "fs";
import path from "path";

import { router } from "./routes.js";
import {
  exportProductsGroupedByCollection,
  sendDataToBackend,
  exportProductImages,
} from "./utils.js";

const startUrls = ["http://irbis-miniatures.com/"];

(async () => {
  try {
    // Create output directories
    const outputDir = path.join(process.cwd(), "output");
    const imagesDir = path.join(outputDir, "images");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`Created images directory: ${imagesDir}`);
    }

    console.log("Initializing request queue...");
    const requestQueue = await RequestQueue.open();

    console.log("Adding start URL to the request queue...");
    await requestQueue.addRequest({ url: startUrls[0] });

    console.log("Starting the crawler...");
    const crawler = new CheerioCrawler({
      requestQueue,
      requestHandler: router,
      maxRequestsPerCrawl: 500, // Increased to handle product detail pages
      maxConcurrency: 10, // Increased concurrency for faster crawling
    });

    await crawler.run();
    console.log("Crawl completed. Exporting data...");

    await exportProductsGroupedByCollection();
    console.log(
      "Data export completed. Check the key-value store for products_by_collection.json."
    );

    await exportProductImages();
    console.log(
      "Product images data export completed. Check the key-value store for product_images.json."
    );

    // Uncomment the following lines to send data to the backend
    // await sendDataToBackend();
    // console.log("Data sent to the backend successfully.");
  } catch (error) {
    console.error("An error occurred during the crawl:", error);
  }
})();
