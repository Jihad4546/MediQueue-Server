const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 1000;
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
    const bookingCollection = db.collection("Bookings");

    // ---------------- ROOT ----------------
    app.get("/", (req, res) => {
      res.send("Server is running");
    });

    // ---------------- TUTORS ----------------
    app.post("/addTutor", async (req, res) => {
      const result = await dataCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/addTutor", async (req, res) => {
      const result = await dataCollection.find().toArray();
      res.send(result);
    });

    app.get("/addTutor/:id", async (req, res) => {
      const result = await dataCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ---------------- BOOKINGS ----------------

    // CREATE BOOKING
    app.post("/bookSession", async (req, res) => {
      try {
        const result = await bookingCollection.insertOne(req.body);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // GET USER BOOKINGS (IMPORTANT)
    app.get("/bookSession/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const result = await bookingCollection
          .find({ studentEmail: email })
          .toArray();

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // CANCEL BOOKING (IMPORTANT FIX)
    app.patch("/cancelBooking/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "cancelled" } }
        );

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // DELETE BOOKING
    app.delete("/bookSession/:id", async (req, res) => {
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected");
  } finally {
    // keep alive
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log("Server running on port", port);
});