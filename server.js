const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());

// ====== MongoDB Connection ======
mongoose.connect("mongodb://127.0.0.1:27017/votingapp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ====== User Schema ======
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});
const User = mongoose.model("User", userSchema);

// ====== Poll Schema ======
const pollSchema = new mongoose.Schema({
  question: String,
  options: [
    {
      text: String,
      votes: { type: Number, default: 0 }
    }
  ],
  createdBy: String
});
const Poll = mongoose.model("Poll", pollSchema);

// ====== Middleware (JWT Auth) ======
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ msg: "No token, auth denied" });

  try {
    const decoded = jwt.verify(token, "secret123");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token invalid" });
  }
};

// ====== Routes ======

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hash });
  await user.save();
  res.json({ msg: "User registered" });
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ msg: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, "secret123", { expiresIn: "1h" });
  res.json({ token });
});

// Create Poll
app.post("/polls", authMiddleware, async (req, res) => {
  const { question, options } = req.body;
  const poll = new Poll({
    question,
    options: options.map(opt => ({ text: opt })),
    createdBy: req.user.id
  });
  await poll.save();
  res.json(poll);
});

// Get All Polls
app.get("/polls", async (req, res) => {
  const polls = await Poll.find();
  res.json(polls);
});

// Vote
app.post("/polls/:id/vote", authMiddleware, async (req, res) => {
  const { optionIndex } = req.body;
  const poll = await Poll.findById(req.params.id);

  if (!poll) return res.status(404).json({ msg: "Poll not found" });

  poll.options[optionIndex].votes += 1;
  await poll.save();
  res.json(poll);
});

// ====== Start Server ======
app.listen(5000, () => console.log("Server running on http://localhost:5000"));
