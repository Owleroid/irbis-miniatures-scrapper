import { Dataset, KeyValueStore } from "crawlee";

/**
 * Export collections and group products by collection in a single JSON file.
 */
export async function exportProductsGroupedByCollection() {
  console.log("Exporting products grouped by collection...");

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

  const collectionsDataset = await Dataset.open("collections");
  const collectionsData = await collectionsDataset.getData();

  const keyValueStore = await KeyValueStore.open();

  await keyValueStore.setValue(
    "products_by_collection.json",
    productsByCollection
  );
  console.log(
    "Products grouped by collection exported to products_by_collection.json in the key-value store."
  );

  await keyValueStore.setValue("collections.json", collectionsData.items);
  console.log(
    "Collections exported to collections.json in the key-value store."
  );
}
