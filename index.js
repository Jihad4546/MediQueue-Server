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
    const dataCollection = db.collection("Database"); // Tutors database
    const bookingCollection = db.collection("Bookings");

    // ---------------- ROOT ----------------
    app.get("/", (req, res) => {
      res.send("Server is running");
    });
    // ---------------- ADD NEW TUTOR (POST) ----------------
    app.post("/addTutor", async (req, res) => {
      try {
        const tutorData = req.body;

        // ডাটাবেজে ডেটা ইনসার্ট করা হচ্ছে
        const result = await dataCollection.insertOne(tutorData);

        if (result.acknowledged) {
          // ফ্রন্টএন্ড এই ট্রু ভ্যালু পেলে সফলতার টোস্ট দেখাবে
          res
            .status(201)
            .send({ success: true, insertedId: result.insertedId });
        } else {
          res
            .status(400)
            .send({ success: false, message: "Failed to add tutor" });
        }
      } catch (err) {
        console.error("Error inserting tutor:", err);
        res.status(500).send({ success: false, error: err.message });
      }
    });

    // ---------------- TUTORS ----------------
    app.get("/addTutor", async (req, res) => {
      try {
        const { search, startDate, endDate, limit } = req.query; // ✅ limit যোগ

        const allData = await dataCollection.find({}).toArray();

        const filteredResult = allData.filter((tutor) => {
          if (search && search.trim() !== "") {
            const tutorName = tutor.destinationName
              ? tutor.destinationName.toLowerCase()
              : "";
            if (!tutorName.includes(search.toLowerCase())) return false;
          }

          if (startDate || endDate) {
            if (!tutor.departureDate) return false;
            const tutorDateTimestamp = new Date(tutor.departureDate).getTime();

            if (startDate) {
              const startTimestamp = new Date(
                `${startDate}T00:00:00.000Z`,
              ).getTime();
              if (tutorDateTimestamp < startTimestamp) return false;
            }

            if (endDate) {
              const endTimestamp = new Date(
                `${endDate}T23:59:59.999Z`,
              ).getTime();
              if (tutorDateTimestamp > endTimestamp) return false;
            }
          }

          return true;
        });

        const limitNum = parseInt(limit) || 0;
        const result =
          limitNum > 0 ? filteredResult.slice(0, limitNum) : filteredResult; // ✅

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }


    });

    app.get("/addTutor/:id", async (req, res) => {
      const result = await dataCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ---------------- GET TUTORS BY USER EMAIL ----------------
    app.get("/myTutors/:email", async (req, res) => {
      try {
        const email = req.params.email;
        // ডাটাবেজের 'userEmail' ফিল্ডের সাথে ইউজারের ইমেইল ম্যাচ করে ডাটা আনা হচ্ছে
        const result = await dataCollection
          .find({ userEmail: email })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // ---------------- UPDATE TUTOR (PUT) ----------------
    app.put("/updateTutor/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        // মঙ্গোডিবি-র সিকিউরিটির জন্য অবজেক্ট আইডি থেকে _id ফিল্ডটি আলাদা করে নেওয়া ভালো
        delete updatedData._id;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedData,
        };

        const result = await dataCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
          res.send({ success: true, message: "Tutor updated successfully" });
        } else {
          res.status(400).send({ success: false, message: "No changes made" });
        }
      } catch (err) {
        console.error("Error updating tutor:", err);
        res.status(500).send({ success: false, error: err.message });
      }
    });

    // ---------------- DELETE TUTOR (DELETE) ----------------
    app.delete("/deleteTutor/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await dataCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Tutor deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Tutor not found" });
        }
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    // ---------------- BOOKINGS ----------------

    // ১. CHECK ALREADY BOOKED (FRONT-END REQ MATCHED)
    app.get("/bookSession/check/:email/:tutorId", async (req, res) => {
      try {
        const { email, tutorId } = req.params;

        const existingBooking = await bookingCollection.findOne({
          studentEmail: email,
          tutorId: tutorId,
        });

        if (existingBooking) {
          return res.send({ alreadyBooked: true });
        }

        res.send({ alreadyBooked: false });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // ২. CREATE BOOKING (UPDATED WITH SUCCESS PROPERTY)
    app.post("/bookSession", async (req, res) => {
      try {
        const bookingData = req.body;

        // ১. একই স্টুডেন্ট এই টিউটরকে অলরেডি বুক করেছে কিনা চেক (Double Booking Protection)
        const exist = await bookingCollection.findOne({
          studentEmail: bookingData.studentEmail,
          tutorId: bookingData.tutorId,
        });

        if (exist) {
          return res.send({
            success: false,
            message: "You already booked this session",
          });
        }

        // ২. ডাটাবেজ থেকে টিউটরের বর্তমান স্লট চেক করা
        const tutor = await dataCollection.findOne({
          _id: new ObjectId(bookingData.tutorId),
        });

        if (!tutor) {
          return res.send({ success: false, message: "Tutor not found" });
        }

        // সিট বা স্লট সংখ্যা চেক করা (totalSlot = 0 হলে বুকিং ব্লক)
        if (Number(tutor.totalSlot || 0) <= 0) {
          return res.send({
            success: false,
            message:
              "This session is fully booked. You can't join at the moment.",
          });
        }

        // ৩. সব ঠিক থাকলে বুকিং কালেকশনে ডেটা সেভ করা
        const result = await bookingCollection.insertOne(bookingData);

        if (result.acknowledged) {
          // ৪. 🎯 সফল বুকিংয়ের পর স্বয়ংক্রিয়ভাবে টিউটরের totalSlot ১টি কমিয়ে দেওয়া ($inc: -1)
          await dataCollection.updateOne(
            { _id: new ObjectId(bookingData.tutorId) },
            { $inc: { totalSlot: -1 } },
          );

          res.send({
            success: true,
            message: "Booking successful and slot decreased by 1!",
          });
        } else {
          res.send({ success: false, message: "Failed to save booking" });
        }
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    // ৩. DECREASE SLOT (FRONT-END REQ MATCHED)

    // GET USER BOOKINGS
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

    // CANCEL BOOKING
    app.patch("/cancelBooking/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // স্ট্যাটাস আপডেট করা
        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { bookStatus: "cancelled" } },
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Updated" });
        } else {
          res.status(404).send({ success: false, message: "Not found" });
        }
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
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
