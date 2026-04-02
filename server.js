
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

mongoose.connect('mongodb://127.0.0.1:27017/tickets');

const User = mongoose.model('User', {
  email: String,
  password: String
});

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashed });
  await user.save();
  res.json({ message: 'Registered!' });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).send('Wrong password');

  const token = jwt.sign({ id: user._id }, 'secret');
  res.json({ token });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));