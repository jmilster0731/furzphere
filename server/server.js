require('dotenv').config(); // Load environment variables from .env file
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const port = process.env.PORT || 5000; // Use the environment variable for port
const usersAPI = require("./APIs/usersAPI");
const profilesAPI = require("./APIs/profilesAPI");
const multer = require('multer');
const path = require('path');
const s3 = require('./storage'); // Import the S3 client from your storage.js file

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// Configure Multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Auth Routes

// Login 
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Retrieve the user from the database based on the email
    const user = await usersAPI.getUserByEmail(email);
    // Check if a user with the provided email exists
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    // Compare the provided password with the hashed password stored in the database
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    // If the passwords match, the login is successful
    if (passwordMatch) {
      // Generate a JWT token containing the user information
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send the token as a response
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Token Authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.sendStatus(401);
    return;
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      res.sendStatus(403);
      return;
    }
    req.user = user;
    next();
  });
}

// User Routes

// Route to retrieve user information based on token
app.get('/get_user', authenticateToken, async (req, res) => {
  try {
    const user = await usersAPI.getUserById(req.user.userId);
    const userInformation = {
      id: user.id,
      username: req.user.username,
      email: req.user.email,
      profile_id: user.profile_id, 
    };
    res.json(userInformation);
  } catch (error) {
    console.error('Error retrieving user information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to create a user
app.post("/create_user", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    await usersAPI.createUser(username, password, email);
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/update_user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { profile_id } = req.body;

    // Update the user with the provided profile_id
    await usersAPI.updateUser(id, { profile_id });

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to create a user profile
app.post("/create_user_profile", async (req, res) => {
  try {
    const { user_id, bio, location, birthday, profile_picture_url } = req.body;
    // Create the user profile using the provided data
    const profileId = await profilesAPI.createUserProfile(user_id, bio, location, birthday, profile_picture_url);
    res.status(201).json({ id: profileId, message: "User profile created successfully" });
  } catch (error) {
    console.error("Error creating user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/profiles/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    // Fetch the user profile from the database using the profileId
    const userProfile = await profilesAPI.getUserProfile(profileId);
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to update a user profile
app.put("/update_user_profile/:profileId", async (req, res) => {
  try {
    const { profileId } = req.params;
    const updatedFields = req.body;

    // Update the user profile with the provided fields
    await profilesAPI.updateUserProfile(profileId, updatedFields);

    res.status(200).json({ message: "User profile updated successfully" });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate a unique key for the S3 object
const generateUniqueKey = (file) => {
  const hash = crypto.createHash('md5').update(file.originalname + Date.now()).digest('hex');
  const extension = file.originalname.split('.').pop();
  return `uploads/${hash}.${extension}`;
};

// Route for uploading the profile picture
app.post('/upload_profile_picture', upload.single('profilePicture'), (req, res) => {
  const profilePicture = req.file;

  const key = generateUniqueKey(profilePicture);

  const uploadParams = {
    Bucket: 'furzphere',
    Key: key,
    Body: profilePicture.buffer,
  };

  s3.upload(uploadParams, (err, data) => {
    if (err) {
      console.error('Error uploading profile picture to S3:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      const profile_picture_url = data.Location;
      res.json({ profile_picture_url });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});