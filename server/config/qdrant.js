const mongoose = require("mongoose");
const { QdrantClient } = require("@qdrant/js-client-rest");

// Must be the same collection the Python service writes to (COLLECTION in embeddings.py).
const COLLECTION = process.env.QDRANT_COLLECTION || "resources";

let client = null;
const getClient = () => {
  if (!process.env.QDRANT_URL) {
    throw new Error("QDRANT_URL is not set in the Node .env file");
  }
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }
  return client;
};

// Remove every vector (chunk) of one resource. LangChain stores the id under metadata.resource_id.
const deleteResourceVectors = async (resourceId) => {
  try {
    await getClient().delete(COLLECTION, {
      wait: true,
      filter: { must: [{ key: "metadata.resource_id", match: { value: String(resourceId) } }] },
    });
  } catch (error) {
    if (error && error.status === 404) return; // collection does not exist yet: nothing to delete
    throw error;
  }
};

// Remove the OCR text of every page. The Python service saves them in the same database.
const deleteResourcePageTexts = async (resourceId) => {
  const result = await mongoose.connection
    .collection("page_texts")
    .deleteMany({ resourceId: String(resourceId) });
  return result.deletedCount;
};

module.exports = { deleteResourceVectors, deleteResourcePageTexts };
