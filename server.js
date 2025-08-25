// server.js
require('dotenv').config();
const express = require('express');
const { CosmosClient } = require('@azure/cosmos');

// --- Cosmos DB Setup ---
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = 'RecipeBookDB';
const containerId = 'Recipes';

if (!endpoint || !key) {
  throw new Error("Azure Cosmos DB credentials not found in .env file.");
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

console.log("Successfully connected to Cosmos DB.");

// --- Express Server Setup ---
const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- API Routes ---

// GET: Fetch all recipes
app.get('/api/recipes', async (req, res) => {
  try {
    const { resources: recipes } = await container.items.readAll().fetchAll();
    res.status(200).json(recipes);
  } catch (error) {
    res.status(500).send(error);
  }
});

// POST: Create a new recipe
app.post('/api/recipes', async (req, res) => {
  try {
    const newRecipe = {
      name: req.body.name,
      course: req.body.course,
      ingredients: req.body.ingredients,
      instructions: req.body.instructions
    };
    const { resource: createdRecipe } = await container.items.create(newRecipe);
    res.status(201).json(createdRecipe);
  } catch (error) {
    res.status(500).send(error);
  }
});

// PUT: Update an existing recipe
app.put('/api/recipes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedRecipeData = {
            id: id,
            name: req.body.name,
            course: req.body.course, // This is the partition key
            ingredients: req.body.ingredients,
            instructions: req.body.instructions
        };

        // The partition key value must be passed to the item() method
        const { resource: replacedItem } = await container.item(id, updatedRecipeData.course).replace(updatedRecipeData);

        res.status(200).json(replacedItem);
    } catch (error) {
        if (error.code === 404) {
            return res.status(404).send("Recipe not found.");
        }
        res.status(500).send(error);
    }
});

// DELETE: Delete a recipe
app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const partitionKeyValue = req.body.course; // Partition key is needed

        if (!partitionKeyValue) {
             return res.status(400).send("Course (partition key) is required in the request body for deletion.");
        }

        await container.item(id, partitionKeyValue).delete();
        res.status(204).send(); // Success, no content
    } catch (error) {
        if (error.code === 404) {
             return res.status(404).send("Recipe not found.");
        }
        res.status(500).send(error);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
