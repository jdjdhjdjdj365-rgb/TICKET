const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

mongoose.connect('mongodb://127.0.0.1:27017/tickets');

// Discord Configuration
const DISCORD_CLIENT_ID = 'YOUR_DISCORD_CLIENT_ID';
const DISCORD_CLIENT_SECRET = 'YOUR_DISCORD_CLIENT_SECRET';
const DISCORD_REDIRECT_URI = 'http://localhost:3000/auth/discord/callback';
const DISCORD_GUILD_ID = 'Y1410175025796874333'; // For role checking
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1489290445019418811/aqgelFRBHm-UeRYZ7X4lI7a084-agQp7VH3U52CZFRXMOhHeFAJSdcMWpnyoPYiTl2cH '; // For ticket notifications
const JWT_SECRET = 'your-jwt-secret-change-this';

// Admin role mappings (configure based on your Discord server)
const ADMIN_ROLE_MAPPINGS = {
  // Discord Role ID -> Admin Role
  'ADMIN_ROLE_ID': 'admin',
  'MODERATOR_ROLE_ID': 'moderator', 
  'STAFF_ROLE_ID': 'staff',
  'SUPPORT_ROLE_ID': 'support'
};

// Permission definitions
const ROLE_PERMISSIONS = {
  admin: ['view_tickets', 'manage_tickets', 'assign_tickets', 'delete_tickets', 'view_users', 'manage_users', 'view_analytics', 'manage_system'],
  moderator: ['view_tickets', 'manage_tickets', 'assign_tickets', 'view_users'],
  staff: ['view_tickets', 'manage_tickets'],
  support: ['view_tickets']
};

// User Schema
const User = mongoose.model('User', {
  discordId: String,
  username: String,
  email: String,
  avatar: String,
  discriminator: String,
  accessToken: String,
  refreshToken: String,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
  roles: [{ type: String }], // Discord roles and custom roles
  isAdmin: { type: Boolean, default: false },
  isStaff: { type: Boolean, default: false },
  permissions: [{
    type: String,
    enum: ['view_tickets', 'manage_tickets', 'assign_tickets', 'delete_tickets', 'view_users', 'manage_users', 'view_analytics', 'manage_system']
  }]
});

// Ticket Schema
const Ticket = mongoose.model('Ticket', {
  ticketId: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['technical', 'billing', 'account', 'general'], default: 'general' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'closed', 'resolved'], default: 'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  closedAt: Date,
  messages: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    isStaff: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
});

// Generate unique ticket ID
function generateTicketId() {
  const prefix = 'TK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Discord Webhook Notification
async function sendDiscordWebhook(ticket, user, action = 'created') {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'YOUR_DISCORD_WEBHOOK_URL') {
    console.log('Discord webhook not configured');
    return;
  }

  try {
    const embed = {
      title: action === 'created' ? ' New Ticket Created' : ' Ticket Updated',
      description: `**${ticket.title}**\n\n${ticket.description.substring(0, 500)}${ticket.description.length > 500 ? '...' : ''}`,
      color: action === 'created' ? 0x00ff00 : 0x0099ff,
      fields: [
        {
          name: ' Ticket ID',
          value: ticket.ticketId,
          inline: true
        },
        {
          name: ' Created by',
          value: `${user.username}#${user.discriminator}`,
          inline: true
        },
        {
          name: ' Category',
          value: ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1),
          inline: true
        },
        {
          name: ' Priority',
          value: ticket.priority.toUpperCase(),
          inline: true
        },
        {
          name: ' Status',
          value: ticket.status.replace('_', ' ').toUpperCase(),
          inline: true
        },
        {
          name: ' Created',
          value: new Date(ticket.createdAt).toLocaleString(),
          inline: true
        }
      ],
      footer: {
        text: '7rz Ticket System',
        icon_url: 'https://cdn.rmz.gg/store/logo/ca1c1aa1fe5f4e3357522d5580b2a52efae79d99.png'
      },
      timestamp: new Date().toISOString()
    };

    // Add priority color coding
    const priorityColors = {
      low: 0x808080,    // Gray
      medium: 0xffff00,  // Yellow
      high: 0xff9900,    // Orange
      urgent: 0xff0000    // Red
    };
    embed.color = priorityColors[ticket.priority] || embed.color;

    // Add user avatar if available
    if (user.avatar) {
      embed.author = {
        name: `${user.username}#${user.discriminator}`,
        icon_url: `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
      };
    }

    const payload = {
      username: '7rz Tickets',
      avatar_url: 'https://cdn.rmz.gg/store/logo/ca1c1aa1fe5f4e3357522d5580b2a52efae79d99.png',
      embeds: [embed]
    };

    // Add mention for staff if urgent priority
    if (ticket.priority === 'urgent') {
      payload.content = '@here  **URGENT TICKET** ';
    }

    await axios.post(DISCORD_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`Discord webhook sent for ticket ${ticket.ticketId}`);
  } catch (error) {
    console.error('Failed to send Discord webhook:', error.response?.data || error.message);
  }
}

// Discord OAuth Routes
app.get('/auth/discord', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email%20guilds`;
  res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user information and guild roles
    const [userResponse, guildResponse] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      axios.get(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${access_token}` }
      }).catch(() => ({ data: { roles: [] } })) // Fallback if guild access fails
    ]);

    const discordUser = userResponse.data;
    const guildMember = guildResponse.data;

    // Find or create user with role mapping
    let user = await User.findOne({ discordId: discordUser.id });
    
    // Map Discord roles to admin roles
    const userRoles = [];
    const userPermissions = new Set();
    let isAdmin = false;
    let isStaff = false;
    
    if (guildMember.roles) {
      guildMember.roles.forEach(roleId => {
        const adminRole = ADMIN_ROLE_MAPPINGS[roleId];
        if (adminRole) {
          userRoles.push(adminRole);
          
          // Add permissions based on role
          const permissions = ROLE_PERMISSIONS[adminRole] || [];
          permissions.forEach(perm => userPermissions.add(perm));
          
          if (adminRole === 'admin') isAdmin = true;
          if (['admin', 'moderator', 'staff'].includes(adminRole)) isStaff = true;
        }
      });
    }
    
    if (!user) {
      user = new User({
        discordId: discordUser.id,
        username: discordUser.username,
        email: discordUser.email,
        avatar: discordUser.avatar,
        discriminator: discordUser.discriminator,
        accessToken: access_token,
        refreshToken: refresh_token,
        roles: userRoles,
        permissions: Array.from(userPermissions),
        isAdmin,
        isStaff
      });
    } else {
      // Update existing user roles and permissions
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.lastLogin = new Date();
      user.roles = userRoles;
      user.permissions = Array.from(userPermissions);
      user.isAdmin = isAdmin;
      user.isStaff = isStaff;
    }
    
    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, discordId: user.discordId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set session
    req.session.userId = user._id;
    req.session.token = token;

    // Redirect to frontend with token
    res.redirect(`http://localhost:3000/dashboard.html?token=${token}`);
    
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Middleware to verify JWT and load user
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-accessToken -refreshToken');
    
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Middleware to check admin permissions
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware to check if user is staff
function requireStaff(req, res, next) {
  if (!req.user.isStaff) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
}

// Ticket Routes
app.get('/api/tickets', authenticateToken, requirePermission('view_tickets'), async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id })
      .populate('userId', 'username avatar discriminator')
      .populate('assignedTo', 'username avatar discriminator')
      .sort({ createdAt: -1 });
    
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    
    const ticket = new Ticket({
      ticketId: generateTicketId(),
      userId: req.user._id,
      title,
      description,
      category: category || 'general',
      priority: priority || 'medium'
    });
    
    await ticket.save();
    await ticket.populate('userId', 'username avatar discriminator');
    
    // Send Discord webhook notification
    await sendDiscordWebhook(ticket, req.user, 'created');
    
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.get('/api/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ 
      ticketId: req.params.ticketId, 
      userId: req.user.userId 
    })
      .populate('userId', 'username avatar discriminator')
      .populate('assignedTo', 'username avatar discriminator')
      .populate('messages.userId', 'username avatar discriminator');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

app.post('/api/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    const ticket = await Ticket.findOne({ 
      ticketId: req.params.ticketId, 
      userId: req.user.userId 
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Ticket is closed' });
    }
    
    ticket.messages.push({
      userId: req.user.userId,
      content,
      isStaff: false
    });
    
    ticket.updatedAt = new Date();
    await ticket.save();
    
    await ticket.populate('messages.userId', 'username avatar discriminator');
    
    res.json(ticket.messages[ticket.messages.length - 1]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

app.patch('/api/tickets/:ticketId/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const ticket = await Ticket.findOne({ 
      ticketId: req.params.ticketId, 
      userId: req.user.userId 
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.status = status;
    ticket.updatedAt = new Date();
    
    if (status === 'closed') {
      ticket.closedAt = new Date();
    }
    
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// User Profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-accessToken -refreshToken');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Admin Routes

// Get all tickets (admin view)
app.get('/api/admin/tickets', authenticateToken, requirePermission('view_tickets'), async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    
    const tickets = await Ticket.find(filter)
      .populate('userId', 'username avatar discriminator')
      .populate('assignedTo', 'username avatar discriminator')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Ticket.countDocuments(filter);
    
    res.json({
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get all users (admin view)
app.get('/api/admin/users', authenticateToken, requirePermission('view_users'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-accessToken -refreshToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await User.countDocuments(filter);
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Assign ticket to staff
app.patch('/api/admin/tickets/:ticketId/assign', authenticateToken, requirePermission('assign_tickets'), async (req, res) => {
  try {
    const { assignedTo } = req.body;
    
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Verify assigned user exists and has staff permissions
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser || !assignedUser.isStaff) {
        return res.status(400).json({ error: 'Invalid staff assignment' });
      }
    }
    
    ticket.assignedTo = assignedTo;
    ticket.status = 'in_progress';
    ticket.updatedAt = new Date();
    
    await ticket.save();
    await ticket.populate('assignedTo', 'username avatar discriminator');
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// Add staff reply to ticket
app.post('/api/admin/tickets/:ticketId/messages', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { content } = req.body;
    
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Ticket is closed' });
    }
    
    ticket.messages.push({
      userId: req.user._id,
      content,
      isStaff: true
    });
    
    ticket.updatedAt = new Date();
    await ticket.save();
    
    await ticket.populate('messages.userId', 'username avatar discriminator');
    
    res.json(ticket.messages[ticket.messages.length - 1]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Update ticket status (admin)
app.patch('/api/admin/tickets/:ticketId/status', authenticateToken, requirePermission('manage_tickets'), async (req, res) => {
  try {
    const { status } = req.body;
    
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.status = status;
    ticket.updatedAt = new Date();
    
    if (status === 'closed') {
      ticket.closedAt = new Date();
    }
    
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// Delete ticket (admin only)
app.delete('/api/admin/tickets/:ticketId', authenticateToken, requirePermission('delete_tickets'), async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({ ticketId: req.params.ticketId });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// Get analytics data
app.get('/api/admin/analytics', authenticateToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    const periodMap = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    const days = periodMap[period] || 7;
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const [
      totalTickets,
      openTickets,
      closedTickets,
      ticketsByCategory,
      ticketsByPriority,
      ticketsByStatus,
      newTickets,
      activeUsers,
      staffPerformance
    ] = await Promise.all([
      Ticket.countDocuments({ createdAt: { $gte: startDate } }),
      Ticket.countDocuments({ status: 'open', createdAt: { $gte: startDate } }),
      Ticket.countDocuments({ status: 'closed', createdAt: { $gte: startDate } }),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { 
          _id: { 
            $dateToString: { 
              format: '%Y-%m-%d', 
              date: '$createdAt' 
            } 
          }, 
          count: { $sum: 1 } 
        } },
        { $sort: { _id: 1 } }
      ]),
      User.countDocuments({ lastLogin: { $gte: startDate } }),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: startDate }, assignedTo: { $ne: null } } },
        { $group: { 
          _id: '$assignedTo', 
          ticketsHandled: { $sum: 1 },
          avgResponseTime: { $avg: '$updatedAt' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
        { $unwind: '$staff' },
        { $project: {
          staffName: '$staff.username',
          ticketsHandled: 1,
          avgResponseTime: 1
        }}
      ])
    ]);
    
    res.json({
      period,
      overview: {
        totalTickets,
        openTickets,
        closedTickets,
        activeUsers
      },
      charts: {
        byCategory: ticketsByCategory,
        byPriority: ticketsByPriority,
        byStatus: ticketsByStatus,
        newTickets: newTickets
      },
      staffPerformance
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Update user roles (admin only)
app.patch('/api/admin/users/:userId/roles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { roles, permissions } = req.body;
    
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.roles = roles || [];
    user.permissions = permissions || [];
    user.isAdmin = roles.includes('admin');
    user.isStaff = roles.some(role => ['admin', 'moderator', 'staff'].includes(role));
    
    await user.save();
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user roles' });
  }
});

// Legacy routes for compatibility
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashed });
  await user.save();
  res.json({ message: 'Registered!' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).send('Wrong password');

  const token = jwt.sign({ id: user._id }, 'secret');
  res.json({ token });
});

app.listen(3000, () => console.log('7rz Server running on http://localhost:3000'));