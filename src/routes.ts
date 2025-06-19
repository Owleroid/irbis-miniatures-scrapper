import { createCheerioRouter, Dataset } from "crawlee";
import fs from "fs";
import path from "path";
import axios from "axios";

export const router = createCheerioRouter();

const processedCollections = new Set<string>();
const processedProducts = new Set<string>();

/**
 * Extract product details from the page.
 */
async function productHandler(
  $: cheerio.Root,
  log: any,
  collectionName: string,
  crawler: any
) {
  const products: {
    name: string;
    description: string;
    price: string;
    collection: string;
    url: string;
  }[] = [];

  $(".tovar").each((_, el) => {
    const name = $(el).find("h2 a").text().trim();
    const description = $(el).find(".t_note").text().trim();
    const price = $(el).find("li.price span b").text().trim();
    const productUrl = $(el).find("h2 a").attr("href");

    if (productUrl) {
      const fullProductUrl = `http://irbis-miniatures.com${productUrl}`;

      // Add product detail page to crawler queue
      if (!processedProducts.has(fullProductUrl)) {
        processedProducts.add(fullProductUrl);
        crawler.addRequests([
          {
            url: fullProductUrl,
            userData: {
              label: "PRODUCT_DETAIL",
              productName: name,
              collectionName: collectionName,
            },
          },
        ]);
      }

      products.push({
        name,
        description,
        price,
        collection: collectionName,
        url: fullProductUrl,
      });
    }
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
 * Download an image from a URL and save it to the specified path
 */
async function downloadImage(
  imageUrl: string,
  outputPath: string
): Promise<void> {
  try {
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "stream",
    });

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save the image
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading image from ${imageUrl}:`, error);
    throw error;
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
    await productHandler($, log, collectionName, crawler);
  } else {
    log.info("No products found on this page. Checking for collections...");
    await collectionHandler($, crawler, log);
  }
});

/**
 * Handler for product detail pages.
 */
router.addHandler("PRODUCT_DETAIL", async ({ $, request, log }) => {
  const { productName, collectionName } = request.userData;
  log.info(`Scraping product detail page: ${productName}`);

  const images: { url: string; filename: string }[] = [];

  // Extract all product images from the page
  // Main product image
  const mainImage = $("#tovar_card a.highslide").attr("href");
  if (mainImage) {
    const fullImageUrl = `http://irbis-miniatures.com${mainImage}`;
    const filename = path.basename(mainImage);
    images.push({ url: fullImageUrl, filename });
  }

  // Additional product images
  $("#tovar_detail .full a.highslide").each((_, el) => {
    const imageHref = $(el).attr("href");
    if (imageHref && imageHref.includes("/d/")) {
      // Extract the actual image URL from the thumbnail URL
      const fullImageUrl = `http://irbis-miniatures.com${imageHref}`;
      const filename = path.basename(imageHref);
      images.push({ url: fullImageUrl, filename });
    }
  });

  if (images.length > 0) {
    log.info(`Found ${images.length} images for product: ${productName}`);

    // Create a sanitized folder name
    const sanitizedProductName = productName
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const outputDir = path.join("output", "images", sanitizedProductName);

    // Download each image
    for (const [index, image] of images.entries()) {
      const outputPath = path.join(outputDir, image.filename);
      log.info(
        `Downloading image ${index + 1}/${images.length} to ${outputPath}`
      );

      try {
        await downloadImage(image.url, outputPath);
        log.info(`Successfully downloaded image: ${image.filename}`);
      } catch (error) {
        log.error(`Failed to download image ${image.url}: ${error}`);
      }
    }

    // Save product images data
    const productImagesDataset = await Dataset.open("product_images");
    await productImagesDataset.pushData({
      productName,
      collectionName,
      images,
      outputDir,
    });
  } else {
    log.info(`No images found for product: ${productName}`);
  }
});
