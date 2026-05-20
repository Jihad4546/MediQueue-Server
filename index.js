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
    const bookingCollection = db.collection("Bookings");

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    // ════════════════════════════════
    //         TUTOR ROUTES
    // ════════════════════════════════

    app.post("/addTutor", async (req, res) => {
      const addtutorData = req.body;
      const result = await dataCollection.insertOne(addtutorData);
      res.json(result);
    });

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

    app.get("/addTutor/:id", async (req, res) => {
      const { id } = req.params;
      const result = await dataCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // ── My Tutors by Email ── ✅ নতুন
    app.get("/myTutors/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const result = await dataCollection
          .find({ userEmail: email })
          .toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    app.put("/updateTutor/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = { ...req.body };
        delete updatedData._id; // MongoDB _id change করা যায় না

        const result = await dataCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    app.delete("/deleteTutor/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await dataCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });


    app.post("/bookSession", async (req, res) => {
      const bookingData = req.body;
      const sessionId = bookingData.tutorId;
      try {
        const result = await bookingCollection.insertOne(bookingData);

        if (result.insertedId) {
          const totalSlotUpdate = await dataCollection.updateOne(
            { _id: new ObjectId(sessionId) },
            [
              {
                $set: {
                  totalSlot: { $subtract: [{ $toInt: "$totalSlot" }, 1] },
                },
              },
            ]
          );

          res.send({
            success: true,
            booking: result,
            slotUpdate: totalSlotUpdate,
          });
        }
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Something went wrong" });
      }
    });

    app.get("/bookSession", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    app.delete("/bookSession/:id", async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/bookSession/check/:email/:tutorId", async (req, res) => {
      const { email, tutorId } = req.params;
      const existing = await bookingCollection.findOne({
        studentEmail: email,
        tutorId: tutorId,
      });
      res.send({ alreadyBooked: !!existing });
    });

    app.get("/bookSession/:email", async (req, res) => {
      const { email } = req.params;
      const result = await bookingCollection
        .find({ studentEmail: email })
        .toArray();
      res.send(result);
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