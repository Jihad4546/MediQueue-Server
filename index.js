const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 1000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("Mediqueue");
    const dataCollection = db.collection("Database");

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    // POST - tutor add
    app.post("/addTutor", async (req, res) => {
      const addtutorData = req.body;
      const result = await dataCollection.insertOne(addtutorData);
      res.json(result);
    });

    // GET - all tutors with filter
    app.get("/addTutor", async (req, res) => {
      const limit = parseInt(req.query.limit);
      const search = req.query.search || "";
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      const filter = {};

      if (search) {
        filter.tutorName = { $regex: search, $options: "i" };
      }

      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
      }

      let query = dataCollection.find(filter);
      if (limit) query = query.limit(6);

      const result = await query.toArray();
      res.json(result);
    });

    // GET - single tutor by id
    app.get("/addTutor/:id", async (req, res) => {
      const { id } = req.params;
      const result = await dataCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});