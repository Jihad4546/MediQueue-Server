const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

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

const JWKS = createRemoteJWKSet(
  new URL (`${process.env.CLIENT_URL}/api/auth/jwks`)
)


// varifyToken fix করুন
const varifyToken = async (req, res, next) => {
  const header = req?.headers.authorization;
  if (!header) return res.status(401).json({ message: 'unauthorized' });
  
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'unauthorized' });

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload; 
    next();
  } catch (error) {
    console.log("varifyToken error:", error.message);
    return res.status(403).json({ message: "forbidden" });
  }
};
async function run() {
  try {
    // await client.connect();

    const db = client.db("Mediqueue");
    const dataCollection = db.collection("Database");
    const bookingCollection = db.collection("Bookings");

    app.get("/", (req, res) => {
      res.send("Server is running");
    });

    app.post("/addTutor", varifyToken, async (req, res) => {
      try {
        const tutorData = req.body;
        console.log("POST /addTutor body:", tutorData)

        const result = await dataCollection.insertOne(tutorData);
        console.log("POST /addTutor result:", result)

        if (result.acknowledged) {
          res.status(201).send({ success: true, insertedId: result.insertedId });
        } else {
          res.status(400).send({ success: false, message: "Failed to add tutor" });
        }
      } catch (err) {
        console.error("POST /addTutor error:", err);
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.get("/addTutor",  async (req, res) => {
      try {
        const { search, startDate, endDate, limit } = req.query;
        console.log("GET /addTutor query:", { search, startDate, endDate, limit })

        let query = {};

        if (search) {
          query.destinationName = { $regex: search, $options: "i" };
        }

        if (startDate || endDate) {
          query.departureDate = {};
          if (startDate) query.departureDate.$gte = startDate;
          if (endDate) query.departureDate.$lte = endDate;
        }

        console.log("GET /addTutor mongo query:", JSON.stringify(query))

        let cursor = dataCollection.find(query);
        
        if (limit) {
          cursor = cursor.limit(parseInt(limit));
        }

        const result = await cursor.toArray();
        console.log("GET /addTutor result count:", result.length)
        res.send(result);
      } catch (err) {
        console.error("GET /addTutor error:", err)
        res.status(500).send({ error: err.message });
      }
    });

    app.get("/addTutor/:id", varifyToken, async (req, res) => {
      console.log("GET /addTutor/:id =>", req.params.id)

      const result = await dataCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      console.log("GET /addTutor/:id found:", result)
      res.send(result);
    });

    app.get("/myTutors/:email", async (req, res) => {
      try {
        const email = req.params.email;
        console.log("GET /myTutors email:", email)

        const result = await dataCollection.find({ userEmail: email }).toArray();
        console.log("GET /myTutors result count:", result.length)
        res.send(result);
      } catch (err) {
        console.error("GET /myTutors error:", err)
        res.status(500).send({ error: err.message });
      }
    });

    app.put("/updateTutor/:id", varifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        console.log("PUT /updateTutor id:", id, "data:", updatedData)

        delete updatedData._id;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedData };

        const result = await dataCollection.updateOne(filter, updateDoc);
        console.log("PUT /updateTutor result:", result)

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
          res.send({ success: true, message: "Tutor updated successfully" });
        } else {
          res.status(400).send({ success: false, message: "No changes made" });
        }
      } catch (err) {
        console.error("PUT /updateTutor error:", err);
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.delete("/deleteTutor/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("DELETE /deleteTutor id:", id)

        const result = await dataCollection.deleteOne({ _id: new ObjectId(id) });
        console.log("DELETE /deleteTutor result:", result)

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Tutor deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Tutor not found" });
        }
      } catch (err) {
        console.error("DELETE /deleteTutor error:", err)
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.get("/bookSession/check/:email/:tutorId", async (req, res) => {
      try {
        const { email, tutorId } = req.params;
        console.log("GET /bookSession/check =>", { email, tutorId })

        const existingBooking = await bookingCollection.findOne({
          studentEmail: email,
          tutorId: tutorId,
        });
        console.log("GET /bookSession/check existingBooking:", existingBooking)

        if (existingBooking) {
          return res.send({ alreadyBooked: true });
        }

        res.send({ alreadyBooked: false });
      } catch (err) {
        console.error("GET /bookSession/check error:", err)
        res.status(500).send({ error: err.message });
      }
    });

    app.post("/bookSession", async (req, res) => {
      try {
        const bookingData = req.body;
        console.log("POST /bookSession body:", bookingData)

        const exist = await bookingCollection.findOne({
          studentEmail: bookingData.studentEmail,
          tutorId: bookingData.tutorId,
        });
        console.log("POST /bookSession duplicate check:", exist)

        if (exist) {
          return res.send({ success: false, message: "You already booked this session" });
        }

        const tutor = await dataCollection.findOne({
          _id: new ObjectId(bookingData.tutorId),
        });
        console.log("POST /bookSession tutor:", tutor)

        if (!tutor) {
          return res.send({ success: false, message: "Tutor not found" });
        }

        if (Number(tutor.totalSlot || 0) <= 0) {
          console.log("POST /bookSession no slots left for tutorId:", bookingData.tutorId)
          return res.send({ success: false, message: "This session is fully booked. You can't join at the moment." });
        }

        const result = await bookingCollection.insertOne(bookingData);
        console.log("POST /bookSession insertResult:", result)

        if (result.acknowledged) {
          await dataCollection.updateOne(
            { _id: new ObjectId(bookingData.tutorId) },
            { $inc: { totalSlot: -1 } },
          );
          console.log("POST /bookSession slot decremented for tutorId:", bookingData.tutorId)

          res.send({ success: true, message: "Booking successful and slot decreased by 1!" });
        } else {
          res.send({ success: false, message: "Failed to save booking" });
        }
      } catch (err) {
        console.error("POST /bookSession error:", err)
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.get("/bookSession/:email", async (req, res) => {
      try {
        const email = req.params.email;
        console.log("GET /bookSession email:", email)

        const result = await bookingCollection.find({ studentEmail: email }).toArray();
        console.log("GET /bookSession result count:", result.length)
        res.send(result);
      } catch (err) {
        console.error("GET /bookSession error:", err)
        res.status(500).send({ error: err.message });
      }
    });

    app.patch("/cancelBooking/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("PATCH /cancelBooking id:", id)

        const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
        console.log("PATCH /cancelBooking booking:", booking)

        if (!booking) {
          return res.status(404).send({ success: false, message: "Booking not found" });
        }

       

        if (booking.bookStatus === "cancelled") {
          console.log("PATCH /cancelBooking already cancelled, id:", id)
          return res.status(400).send({ success: false, message: "Already cancelled" });
        }

        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { bookStatus: "cancelled" } }
        );
        console.log("PATCH /cancelBooking updateResult:", result)

        if (result.modifiedCount > 0) {
          await dataCollection.updateOne(
            { _id: new ObjectId(booking.tutorId) },
            { $inc: { totalSlot: 1 } }
          );
          console.log("PATCH /cancelBooking slot restored for tutorId:", booking.tutorId)

          res.send({ success: true, message: "Booking cancelled and slot restored" });
        } else {
          res.status(400).send({ success: false, message: "Failed to update status" });
        }
      } catch (err) {
        console.error("PATCH /cancelBooking error:", err)
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.delete("/bookSession/:id", async (req, res) => {
      console.log("DELETE /bookSession id:", req.params.id)
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      console.log("DELETE /bookSession result:", result)
      res.send(result);
    });

  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log("Server running on port", port);
});