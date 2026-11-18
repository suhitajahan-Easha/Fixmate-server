import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const mongoclient = await connectToMongoDB();
const db = mongoclient.db("Assignment-9ph");
const user = db.collection("user");
const services = db.collection("services");
const bookings = db.collection("bookings");
const payments = db.collection("payments");

await payments.createIndex({ stripeSessionId: 1 }, { unique: true });

//service related api
// app.post("/services", async (req, res) => {
//   const service = req.body;
//   const result = await services.insertOne(service);
//   res.send(result);
// });
app.post("/services", async (req, res) => {
  try {
    const service = req.body;

    console.log("Received service:", service);

    const result = await services.insertOne({
      ...service,
      createdAt: new Date(),
    });

    res.status(201).send({
      success: true,
      message: "Service added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Service insert error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to add service",
    });
  }
});
//getting all servicess api
// app.get("/services", async (req, res) => {
//   try {
//     const { id } = req.query;

//     let query = {};

//     if (id) {
//       // Find user by ID
//       const users = await user.findOne({
//         _id: new ObjectId(id),
//       });
//       console.log("Received ID:", id);
//       console.log("Found user:", users);

//       if (!users) {
//         return res.status(404).send({
//           success: false,
//           message: "User not found",
//         });
//       }

//       // Search services according to user role
//       if (users.role === "technician") {
//         // query = { technicianId: id };
//         query = {
//           $or: [{ technicianId: id }, { technicianEmail: users.email }],
//         };
//       } else if (users.role === "admin") {
//         query = {};
//       } else {
//         query = { approvalStatus: "approved", isAvailable: true };
//       }
//     } else {
//       // Public users can see approved services
//       query = { approvalStatus: "approved", isAvailable: true };
//     }

//     const result = await services.find(query).sort({ createdAt: -1 }).
//     limit(req.query.limit ? Number(req.query.limit) : 0).toArray();

//     res.status(200).send({
//       success: true,
//       message: "Services fetched successfully",
//       result,
//     });
//   } catch (error) {
//     console.error("Get services error:", error);

//     res.status(500).send({
//       success: false,
//       message: "Failed to fetch services",
//     });
//   }
// });

app.get("/services", async (req, res) => {
  try {
    const { id, category, limit } = req.query;

    let query = {};

    if (id) {
      // Find user by ID
      const users = await user.findOne({
        _id: new ObjectId(id),
      });

      console.log("Received ID:", id);
      console.log("Found user:", users);

      if (!users) {
        return res.status(404).send({
          success: false,
          message: "User not found",
        });
      }

      // Search services according to user role
      if (users.role === "technician") {
        query = {
          $or: [{ technicianId: id }, { technicianEmail: users.email }],
        };
      } else if (users.role === "admin") {
        query = {};
      } else {
        query = {
          approvalStatus: "approved",
          isAvailable: true,
        };
      }
    } else {
      // Public users can see approved services
      query = {
        approvalStatus: "approved",
        isAvailable: true,
      };
    }

    // Apply category filter only for public/customer queries
    if (
      !id ||
      (id &&
        (await user.findOne({ _id: new ObjectId(id) }))?.role === "customer")
    ) {
      if (category) {
        query.category = category;
      }
    }

    // Get services
    let servicesQuery = services.find(query).sort({ createdAt: -1 });

    if (limit && Number(limit) > 0) {
      servicesQuery = servicesQuery.limit(Number(limit));
    }

    const result = await servicesQuery.toArray();

    res.status(200).send({
      success: true,
      message: "Services fetched successfully",
      result,
    });
  } catch (error) {
    console.error("Get services error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch services",
    });
  }
});

//service detail page public
app.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid service ID",
      });
    }

    const result = await services.findOne({
      _id: new ObjectId(id),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!result) {
      return res.status(404).send({
        success: false,
        message: "Service not found or unavailable",
      });
    }

    const technician = await user.findOne(
      { email: result.technicianEmail },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          area: 1,
          bio: 1,
        },
      },
    );

    res.status(200).send({
      success: true,
      message: "Service details fetched successfully",
      result,
      technician,
    });
  } catch (error) {
    console.error("Get service details error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch service details",
    });
  }
});
//editing any service both for technitian and admin

app.patch("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, ...updateData } = req.body;

    let query = {};

    const users = await user.findOne({
      _id: new ObjectId(userId),
    });

    if (!users) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    const service = await services.findOne({
      _id: new ObjectId(id),
    });

    if (!service) {
      return res.status(404).send({
        success: false,
        message: "Service not found",
      });
    }

    if (users.role === "admin") {
      if (!["approved", "rejected"].includes(updateData.approvalStatus)) {
        return res.status(400).send({
          success: false,
          message: "Invalid approval status",
        });
      }

      query = { approvalStatus: updateData.approvalStatus };
    } else if (users.role === "technician") {
      if (service.technicianId !== userId) {
        return res.status(403).send({
          success: false,
          message: "You cannot update this service",
        });
      }

      if ("approvalStatus" in updateData) {
        return res.status(403).send({
          success: false,
          message: "Technicians cannot change approval status",
        });
      }

      const allowedFields = [
        "title",
        "category",
        "description",
        "image",
        "basePrice",
        "estimatedDuration",
        "serviceMode",
        "serviceArea",
        "isAvailable",
      ];

      allowedFields.forEach((field) => {
        if (field in updateData) {
          query[field] = updateData[field];
        }
      });

      const isEditing = allowedFields.some(
        (field) => field !== "isAvailable" && field in updateData,
      );

      if (isEditing) {
        query.approvalStatus = "pending";
      }
    } else {
      return res.status(403).send({
        success: false,
        message: "You are not allowed to update services",
      });
    }

    query.updatedAt = new Date();

    const result = await services.updateOne(
      { _id: new ObjectId(id) },
      { $set: query },
    );

    res.send({
      success: true,
      message: "Service updated successfully",
    });
  } catch (error) {
    console.error("Update service error:", error);
    res.status(500).send({
      success: false,
      message: "Failed to update service",
    });
  }
});

//deleting service by technician

app.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Find user
    const users = await user.findOne({
      _id: new ObjectId(userId),
    });

    if (!users) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Only technicians can delete services
    if (users.role !== "technician") {
      return res.status(403).send({
        success: false,
        message: "Only technicians can delete services",
      });
    }

    // Find service
    const service = await services.findOne({
      _id: new ObjectId(id),
    });

    if (!service) {
      return res.status(404).send({
        success: false,
        message: "Service not found",
      });
    }

    // Check service ownership
    if (service.technicianId !== userId) {
      return res.status(403).send({
        success: false,
        message: "You cannot delete another technician's service",
      });
    }

    // Delete service
    const result = await services.deleteOne({
      _id: new ObjectId(id),
    });

    res.send({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to delete service",
    });
  }
});

///admin seeing all user api and edit api
app.get("/users", async (req, res) => {
  try {
    const result = await user
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            role: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).send({
      success: true,
      message: "Users fetched successfully",
      result,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

//api for making other admin

app.patch("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    // Check required data
    if (!userId || !role) {
      return res.status(400).send({
        success: false,
        message: "User ID and role are required",
      });
    }

    // Check valid role
    const allowedRoles = ["customer", "technician", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).send({
        success: false,
        message: "Invalid role",
      });
    }

    // Check valid MongoDB IDs
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Find the logged-in user in the database
    const adminUser = await user.findOne({
      _id: new ObjectId(userId),
    });

    if (!adminUser) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Check admin role
    if (adminUser.role !== "admin") {
      return res.status(403).send({
        success: false,
        message: "Only admins can change user roles",
      });
    }

    // Prevent admin from changing their own role
    if (adminUser._id.toString() === id) {
      return res.status(403).send({
        success: false,
        message: "You cannot change your own role",
      });
    }

    // Find the target user
    const targetUser = await user.findOne({
      _id: new ObjectId(id),
    });

    if (!targetUser) {
      return res.status(404).send({
        success: false,
        message: "Target user not found",
      });
    }

    // Update target user's role
    await user.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role: role,
        },
      },
    );

    res.status(200).send({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error) {
    console.error("Update user role error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to update user role",
    });
  }
});

// Create a repair booking
app.post("/bookings", async (req, res) => {
  try {
    const {
      customerId,
      serviceId,
      customerPhone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    // Check required fields
    if (
      !customerId ||
      !serviceId ||
      !customerPhone ||
      !address ||
      !preferredDate ||
      !problemDescription
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide all required information",
      });
    }

    // Check valid IDs
    if (!ObjectId.isValid(customerId) || !ObjectId.isValid(serviceId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid customer or service ID",
      });
    }

    // Validate problem description
    if (problemDescription.trim().length < 20) {
      return res.status(400).send({
        success: false,
        message: "Problem description must be at least 20 characters",
      });
    }

    // Check preferred date
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Dhaka",
    });

    if (isNaN(new Date(preferredDate).getTime()) || preferredDate < today) {
      return res.status(400).send({
        success: false,
        message: "Please select today or a future date",
      });
    }

    // Find customer
    const customer = await user.findOne({
      _id: new ObjectId(customerId),
    });

    if (!customer) {
      return res.status(404).send({
        success: false,
        message: "Customer not found",
      });
    }

    // Only customers can request repairs
    if (customer.role !== "customer") {
      return res.status(403).send({
        success: false,
        message: "Only customers can request a repair",
      });
    }

    // Find approved and available service
    const service = await services.findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).send({
        success: false,
        message: "Service not found or unavailable",
      });
    }

    // Prevent customers from booking their own service
    if (customer.email === service.technicianEmail) {
      return res.status(403).send({
        success: false,
        message: "You cannot request your own service",
      });
    }

    // Check for an existing active booking
    const existingBooking = await bookings.findOne({
      serviceId: serviceId,
      customerEmail: customer.email,
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (existingBooking) {
      return res.status(409).send({
        success: false,
        message: "You already have an active request for this service",
      });
    }

    // Create booking
    const newBooking = {
      serviceId: serviceId,
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,

      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,

      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customerPhone.trim(),

      address: address.trim(),
      preferredDate: new Date(preferredDate),
      problemDescription: problemDescription.trim(),

      status: "requested",
      finalAmount: service.basePrice,
      paymentStatus: "unpaid",

      createdAt: new Date(),
    };

    const result = await bookings.insertOne(newBooking);

    res.status(201).send({
      success: true,
      message: "Repair request submitted successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to submit repair request",
    });
  }
});

///getting booking api

app.get("/bookings", async (req, res) => {
  try {
    const { userId } = req.query;

    // Check user ID
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).send({
        success: false,
        message: "Valid user ID is required",
      });
    }

    // Find logged-in user
    const currentUser = await user.findOne({
      _id: new ObjectId(userId),
    });

    if (!currentUser) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    let query = {};

    // Customer sees their own bookings
    if (currentUser.role === "customer") {
      query = {
        customerEmail: currentUser.email,
      };
    }
    // Technician sees bookings for their services
    else if (currentUser.role === "technician") {
      query = {
        technicianEmail: currentUser.email,
      };
    }
    // Admin sees all bookings
    else if (currentUser.role === "admin") {
      query = {};
    } else {
      return res.status(403).send({
        success: false,
        message: "You are not allowed to view bookings",
      });
    }

    // Get bookings
    const result = await bookings.find(query).sort({ createdAt: -1 }).toArray();

    res.status(200).send({
      success: true,
      message: "Bookings fetched successfully",
      result,
    });
  } catch (error) {
    console.error("Get bookings error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

//booking edit api technician and customer

// PATCH: Update booking status (Customer and Technician)
app.patch("/bookings/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status, finalAmount } = req.body;

    // Validate IDs
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID or user ID",
      });
    }

    // Validate requested status
    const allowedStatuses = [
      "cancelled",
      "accepted",
      "rejected",
      "in-progress",
      "completed",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking status",
      });
    }

    // Find current user
    const currentUser = await user.findOne({
      _id: new ObjectId(userId),
    });

    if (!currentUser) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Admin cannot update bookings
    if (currentUser.role === "admin") {
      return res.status(403).send({
        success: false,
        message: "Admin cannot update bookings",
      });
    }

    // Only customers and technicians can update bookings
    if (!["customer", "technician"].includes(currentUser.role)) {
      return res.status(403).send({
        success: false,
        message: "You are not allowed to update bookings",
      });
    }

    // Find booking
    const booking = await bookings.findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    let updateQuery = {};
    let isValidTransition = false;

    // Customer can only cancel their own requested booking
    if (currentUser.role === "customer") {
      if (booking.customerEmail !== currentUser.email) {
        return res.status(403).send({
          success: false,
          message: "You can only update your own bookings",
        });
      }

      if (booking.status === "requested" && status === "cancelled") {
        isValidTransition = true;

        updateQuery = {
          customerEmail: currentUser.email,
        };
      }
    }

    // Technician can update bookings assigned to them
    if (currentUser.role === "technician") {
      if (booking.technicianEmail !== currentUser.email) {
        return res.status(403).send({
          success: false,
          message: "You can only update bookings assigned to you",
        });
      }

      if (
        booking.status === "requested" &&
        ["accepted", "rejected"].includes(status)
      ) {
        isValidTransition = true;
      }

      if (booking.status === "accepted" && status === "in-progress") {
        isValidTransition = true;
      }

      if (booking.status === "in-progress" && status === "completed") {
        isValidTransition = true;
      }

      updateQuery = {
        technicianEmail: currentUser.email,
      };
    }

    if (!isValidTransition) {
      return res.status(400).send({
        success: false,
        message: "This booking status update is not allowed",
      });
    }

    // Technician must provide final amount when completing a booking
    if (status === "completed") {
      if (
        typeof finalAmount !== "number" ||
        !Number.isFinite(finalAmount) ||
        finalAmount <= 0
      ) {
        return res.status(400).send({
          success: false,
          message: "A valid final amount greater than zero is required",
        });
      }
    }

    // Prepare update fields
    const updateFields = {
      status,
      updatedAt: new Date(),
    };

    if (status === "completed") {
      updateFields.finalAmount = finalAmount;
    }

    // Update only if the booking still has its previous status
    const result = await bookings.updateOne(
      {
        _id: new ObjectId(id),
        status: booking.status,
        ...updateQuery,
      },
      {
        $set: updateFields,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(409).send({
        success: false,
        message: "Booking was already updated. Please refresh and try again.",
      });
    }

    res.status(200).send({
      success: true,
      message: "Booking updated successfully",
    });
  } catch (error) {
    console.error("Update booking error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to update booking",
    });
  }
});

///payment api

app.post("/payments/create-checkout-session", async (req, res) => {
  try {
    const { bookingId, customerEmail } = req.body;

    // 1. Validate required fields
    if (!bookingId || !ObjectId.isValid(bookingId) || !customerEmail) {
      return res.status(400).send({
        success: false,
        message: "Valid booking ID and customer email are required",
      });
    }

    // 2. Find booking
    const booking = await bookings.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    // 3. Check booking ownership
    if (booking.customerEmail !== customerEmail) {
      return res.status(403).send({
        success: false,
        message: "You cannot pay for another customer's booking",
      });
    }

    // 4. Only completed bookings can be paid
    if (booking.status !== "completed") {
      return res.status(400).send({
        success: false,
        message: "Only completed bookings can be paid",
      });
    }

    // 5. Check payment status
    if (booking.paymentStatus !== "unpaid") {
      return res.status(400).send({
        success: false,
        message: "This booking is already paid",
      });
    }

    // 6. Validate final amount
    if (
      typeof booking.finalAmount !== "number" ||
      !Number.isFinite(booking.finalAmount) ||
      booking.finalAmount <= 0
    ) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking amount",
      });
    }

    // 7. Check whether a payment already exists
    const existingPayment = await payments.findOne({
      bookingId: booking._id.toString(),
      paymentStatus: "paid",
    });

    if (existingPayment) {
      return res.status(400).send({
        success: false,
        message: "This booking has already been paid",
      });
    }

    // 8. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: booking.serviceTitle,
            },
            unit_amount: Math.round(booking.finalAmount * 100),
          },
          quantity: 1,
        },
      ],

      customer_email: booking.customerEmail,

      metadata: {
        bookingId: booking._id.toString(),
        customerEmail: booking.customerEmail,
      },

      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
    });

    // 9. Return Checkout URL
    res.status(200).send({
      success: true,
      message: "Checkout session created successfully",
      url: session.url,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to create checkout session",
    });
  }
});

app.post("/payments/verify", async (req, res) => {
  try {
    const { sessionId } = req.body;

    // 1. Validate session ID
    if (!sessionId) {
      return res.status(400).send({
        success: false,
        message: "Stripe session ID is required",
      });
    }

    // 2. Retrieve Stripe Checkout Session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // 3. Check payment status
    if (session.payment_status !== "paid") {
      return res.status(400).send({
        success: false,
        message: "Payment has not been completed",
      });
    }

    // 4. Get booking information from Stripe metadata
    const { bookingId, customerEmail } = session.metadata || {};

    if (!bookingId || !ObjectId.isValid(bookingId) || !customerEmail) {
      return res.status(400).send({
        success: false,
        message: "Invalid payment metadata",
      });
    }

    // 5. Find booking
    const booking = await bookings.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    // 6. Verify customer and amount
    if (
      booking.customerEmail !== customerEmail ||
      session.customer_email !== customerEmail ||
      session.amount_total !== Math.round(booking.finalAmount * 100)
    ) {
      return res.status(400).send({
        success: false,
        message: "Payment information does not match booking",
      });
    }

    // 7. Check booking status
    if (booking.status !== "completed") {
      return res.status(400).send({
        success: false,
        message: "Booking is not completed",
      });
    }

    // 8. Check if this session was already saved
    const existingPayment = await payments.findOne({
      stripeSessionId: session.id,
    });

    if (existingPayment) {
      return res.status(200).send({
        success: true,
        message: "Payment already verified",
        payment: existingPayment,
      });
    }

    // 9. Check if booking was already paid
    if (booking.paymentStatus === "paid") {
      return res.status(400).send({
        success: false,
        message: "This booking has already been paid",
      });
    }

    // 10. Get Stripe transaction ID
    const transactionId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!transactionId) {
      return res.status(400).send({
        success: false,
        message: "Stripe transaction ID not found",
      });
    }

    // 11. Prepare payment document
    const payment = {
      bookingId: booking._id.toString(),
      serviceTitle: booking.serviceTitle,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      technicianName: booking.technicianName,
      technicianEmail: booking.technicianEmail,
      amount: booking.finalAmount,
      currency: "usd",
      transactionId,
      stripeSessionId: session.id,
      paymentStatus: "paid",
      paidAt: new Date(),
    };

    // 12. Insert payment and update booking safely
    const updateResult = await bookings.updateOne(
      {
        _id: booking._id,
        status: "completed",
        paymentStatus: "unpaid",
      },
      {
        $set: { paymentStatus: "paid" },
      },
    );

    if (updateResult.modifiedCount === 0) {
      const savedPayment = await payments.findOne({
        stripeSessionId: session.id,
      });

      if (savedPayment) {
        return res.status(200).send({
          success: true,
          message: "Payment already verified",
          payment: savedPayment,
        });
      }

      return res.status(400).send({
        success: false,
        message: "Booking is already paid or cannot be paid",
      });
    }

    try {
      await payments.insertOne(payment);
    } catch (error) {
      // Roll back booking status if payment insert fails
      await bookings.updateOne(
        {
          _id: booking._id,
          paymentStatus: "paid",
        },
        {
          $set: { paymentStatus: "unpaid" },
        },
      );

      throw error;
    }

    // 13. Send successful response
    res.status(200).send({
      success: true,
      message: "Payment verified successfully",
      payment,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to verify payment",
    });
  }
});

app.get("/", (req, res) => {
  res.send("serving.....asignment9");
});

app.listen(PORT, () => {
  console.log(`server is running at ${PORT}`);
});

export default app;
