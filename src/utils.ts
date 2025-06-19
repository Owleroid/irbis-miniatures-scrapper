import { Dataset, KeyValueStore } from "crawlee";
import axios from "axios";

/**
 * Helper function to group products by collection.
 */
async function groupProductsByCollection() {
  const productsDataset = await Dataset.open("products");
  const productsData = await productsDataset.getData();

  const productsByCollection: Record<string, any[]> = {};

  productsData.items.forEach((product) => {
    const collectionName = product.collection || "Uncategorized";
    if (!productsByCollection[collectionName]) {
      productsByCollection[collectionName] = [];
    }
    productsByCollection[collectionName].push(product);
  });

  return productsByCollection;
}

/**
 * Helper function to retrieve collections.
 */
async function getCollections() {
  const collectionsDataset = await Dataset.open("collections");
  const collectionsData = await collectionsDataset.getData();
  return collectionsData.items;
}

/**
 * Export collections and group products by collection in a single JSON file.
 */
export async function exportProductsGroupedByCollection() {
  console.log("Exporting products grouped by collection...");

  const productsByCollection = await groupProductsByCollection();
  const collections = await getCollections();

  const keyValueStore = await KeyValueStore.open();

  await keyValueStore.setValue(
    "products_by_collection.json",
    productsByCollection
  );
  console.log(
    "Products grouped by collection exported to products_by_collection.json in the key-value store."
  );

  await keyValueStore.setValue("collections.json", collections);
  console.log(
    "Collections exported to collections.json in the key-value store."
  );
}

/**
 * Export product images data to a JSON file.
 */
export async function exportProductImages() {
  console.log("Exporting product images data...");

  try {
    const productImagesDataset = await Dataset.open("product_images");
    const productImagesData = await productImagesDataset.getData();

    if (productImagesData.items.length === 0) {
      console.log("No product images data found.");
      return;
    }

    const keyValueStore = await KeyValueStore.open();
    await keyValueStore.setValue(
      "product_images.json",
      productImagesData.items
    );

    console.log(
      `Exported data for ${productImagesData.items.length} products with images to product_images.json in the key-value store.`
    );
  } catch (error) {
    console.error("Error exporting product images data:", error);
  }
}

/**
 * Send collections and products grouped by collection to a backend API.
 */
export async function sendDataToBackend() {
  console.log("Sending collections and products to the backend...");

  const productsByCollection = await groupProductsByCollection();
  const collections = await getCollections();

  // Backend API endpoints
  const backendApiUrl = process.env.BACKEND_API_URL;
  const collectionsEndpoint = `${backendApiUrl}/collections`;
  const productsEndpoint = `${backendApiUrl}/products`;

  try {
    // Send collections to the backend
    const collectionsResponse = await axios.post(
      collectionsEndpoint,
      collections,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (collectionsResponse.status !== 200) {
      throw new Error(
        `Failed to send collections: ${collectionsResponse.statusText}`
      );
    }
    console.log("Collections sent successfully.");

    // Send products grouped by collection to the backend
    const productsResponse = await axios.post(
      productsEndpoint,
      productsByCollection,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (productsResponse.status !== 200) {
      throw new Error(
        `Failed to send products: ${productsResponse.statusText}`
      );
    }
    console.log("Products sent successfully.");
  } catch (error) {
    console.error(
      "An error occurred while sending data to the backend:",
      error
    );
  }
}
