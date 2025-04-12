import { createCheerioRouter, Dataset } from "crawlee";

export const router = createCheerioRouter();

const processedCollections = new Set<string>();

/**
 * Extract product details from the page.
 */
async function productHandler(
  $: cheerio.Root,
  log: any,
  collectionName: string
) {
  const products: {
    name: string;
    description: string;
    price: string;
    collection: string;
  }[] = [];

  $(".tovar").each((_, el) => {
    const name = $(el).find("h2 a").text().trim();
    const description = $(el).find(".t_note").text().trim();
    const price = $(el).find("li.price span b").text().trim();

    products.push({ name, description, price, collection: collectionName });
  });

  if (products.length > 0) {
    log.info(
      `Extracted ${products.length} products for collection: ${collectionName}`
    );
    const productsDataset = await Dataset.open("products");
    await productsDataset.pushData(products);
  } else {
    log.info(`No products found for collection: ${collectionName}`);
  }
}

/**
 * Extract collection links and queue them for crawling.
 */
async function collectionHandler($: cheerio.Root, crawler: any, log: any) {
  const collectionLinks: { text: string; href: string }[] = [];

  $("nav.shop-folders-wrap ul.shop-folders li a").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href");

    if (href) {
      const fullUrl = `http://irbis-miniatures.com${href}`;
      if (!processedCollections.has(fullUrl)) {
        processedCollections.add(fullUrl);
        collectionLinks.push({ text, href: fullUrl });
        crawler.addRequests([
          { url: fullUrl, userData: { collectionName: text } },
        ]);
      }
    }
  });

  if (collectionLinks.length > 0) {
    log.info(`Found ${collectionLinks.length} new collection links.`);
    const collectionsDataset = await Dataset.open("collections");
    await collectionsDataset.pushData(collectionLinks);
  } else {
    log.info("No new collection links found.");
  }
}

/**
 * Main handler for pages.
 */
router.addDefaultHandler(async ({ $, request, log, crawler }) => {
  log.info(`Scraping page: ${request.url}`);

  const collectionName = request.userData.collectionName || "Uncategorized";

  // Check if the page contains products
  if ($(".tovar").length > 0) {
    log.info(`This page contains products for collection: ${collectionName}`);
    await productHandler($, log, collectionName);
  } else {
    log.info("No products found on this page. Checking for collections...");
    await collectionHandler($, crawler, log);
  }
});
