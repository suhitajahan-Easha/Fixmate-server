import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

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
app.get("/services", async (req, res) => {
  try {
    const { id } = req.query;

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
        // query = { technicianId: id };
        query = {
          $or: [{ technicianId: id }, { technicianEmail: users.email }],
        };
      } else if (users.role === "admin") {
        query = {};
      } else {
        query = { approvalStatus: "approved", isAvailable: true };
      }
    } else {
      // Public users can see approved services
      query = { approvalStatus: "approved", isAvailable: true };
    }

    const result = await services.find(query).sort({ createdAt: -1 }).toArray();

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
      }
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

app.get("/", (req, res) => {
  res.send("serving.....asignment9");
});

app.listen(PORT, () => {
  console.log(`server is running at ${PORT}`);
});
