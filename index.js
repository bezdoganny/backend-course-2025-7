const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Command } = require("commander");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const program = new Command();

program
  .requiredOption("--host <host>", "Server host")
  .requiredOption("--port <port>", "Server port", parseInt)
  .requiredOption("--cache <dir>", "Cache directory");

program.parse(process.argv);
const options = program.opts();

// create cache folder
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: options.cache });

let inventory = [];
let nextId = 1;

function findItem(id) {
  return inventory.find(i => i.id === id);
}

// -------------------- SWAGGER SETUP --------------------
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "Inventory Service for Lab 6"
    },
  },
  apis: ["./app.js"], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});

// ===================== ROUTES ============================

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register new inventory item
 */
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).json({ error: "inventory_name is required" });
  }

  const id = nextId++;
  const photo = req.file ? req.file.filename : null;

  const item = {
    id,
    name: inventory_name,
    description: description || "",
    photo
  };

  inventory.push(item);

  res.status(201).json({
    id: item.id,
    name: item.name,
    description: item.description,
    photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
  });
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all items
 */
app.get("/inventory", (req, res) => {
  res.json(
    inventory.map(i => ({
      id: i.id,
      name: i.name,
      description: i.description,
      photoUrl: i.photo ? `/inventory/${i.id}/photo` : null
    }))
  );
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get item by ID
 */
app.get("/inventory/:id", (req, res) => {
  const item = findItem(Number(req.params.id));

  if (!item) return res.status(404).json({ error: "Not found" });

  res.json({
    id: item.id,
    name: item.name,
    description: item.description,
    photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
  });
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update name/description
 */
app.put("/inventory/:id", (req, res) => {
  const item = findItem(Number(req.params.id));

  if (!item) return res.status(404).json({ error: "Not found" });

  const { name, description } = req.body;

  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;

  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get item photo
 */
app.get("/inventory/:id/photo", (req, res) => {
  const item = findItem(Number(req.params.id));

  if (!item || !item.photo) {
    return res.status(404).json({ error: "Not found" });
  }

  const filePath = path.resolve(options.cache, item.photo);

  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(filePath);
});

app.get("/inventory/:id/photo", (req, res) => {
    const id = parseInt(req.params.id);
    const item = findItem(id);

    if (!item || !item.photo) {
        return res.status(404).json({ error: "Not found" });
    }

    const filePath = path.resolve(options.cache, item.photo);

    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(filePath);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Update photo
 */
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = findItem(Number(req.params.id));

  if (!item) return res.status(404).json({ error: "Not found" });
  if (!req.file) return res.status(400).json({ error: "photo is required" });

  item.photo = req.file.filename;

  res.json({ message: "Photo updated" });
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete item
 */
app.delete("/inventory/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) return res.status(404).json({ error: "Not found" });

  inventory.splice(index, 1);

  res.json({ message: "Deleted" });
});

// ---------- HTML FORMS ----------
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

// ---------- SEARCH ----------
/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search by ID
 */
app.post("/search", (req, res) => {
  const id = parseInt(req.body.id);
  const includePhoto = !!req.body.has_photo;

  const item = findItem(id);
  if (!item) return res.status(404).json({ error: "Not found" });

  let desc = item.description;
  if (includePhoto && item.photo) {
    desc += ` | Photo: http://${options.host}:${options.port}/inventory/${item.id}/photo`;
  }

  res.json({ id: item.id, name: item.name, description: desc });
});

// ---------- 405 HANDLER ----------
app.use((req, res) => {
  res.status(405).json({ error: "Method Not Allowed" });
});

// ---------- START SERVER ----------
app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
