// API Configuration
const API_BASE = '/api';
let currentUser = null;
let currentTicket = null;
let authToken = localStorage.getItem('token');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  if (authToken) {
    fetchUserProfile();
  } else {
    // Redirect to login if not on login page
    if (!window.location.pathname.includes('index.html')) {
      window.location.href = '/index.html';
    }
  }

  // Setup event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // New ticket button
  const newTicketBtn = document.getElementById('btn-new-ticket');
  if (newTicketBtn) {
    newTicketBtn.addEventListener('click', showNewTicketForm);
  }

  // Send reply button
  const sendReplyBtn = document.getElementById('btn-send-reply');
  if (sendReplyBtn) {
    sendReplyBtn.addEventListener('click', sendReply);
  }

  // Reply content textarea
  const replyContent = document.getElementById('reply-content');
  if (replyContent) {
    replyContent.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendReply();
      }
    });
  }

  // Search functionality
  const searchInput = document.getElementById('dash-ticket-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(searchTickets, 300));
  }
}

// User Profile
async function fetchUserProfile() {
  try {
    const response = await fetch(`${API_BASE}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      currentUser = await response.json();
      updateUserInterface();
      loadTickets();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    logout();
  }
}

function updateUserInterface() {
  if (!currentUser) return;
  
  // Update user info in sidebar
  const usernameElements = document.querySelectorAll('.user-username');
  const avatarElements = document.querySelectorAll('.user-avatar');
  
  usernameElements.forEach(el => {
    el.textContent = currentUser.username;
  });
  
  avatarElements.forEach(el => {
    if (currentUser.avatar) {
      el.src = `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png?size=64`;
    }
  });
}

// Ticket Management
async function loadTickets() {
  try {
    const response = await fetch(`${API_BASE}/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const tickets = await response.json();
      displayTicketList(tickets);
    }
  } catch (error) {
    console.error('Failed to load tickets:', error);
    showToast('Failed to load tickets', 'error');
  }
}

function displayTicketList(tickets) {
  const ticketList = document.getElementById('ticket-list');
  if (!ticketList) return;
  
  if (tickets.length === 0) {
    ticketList.innerHTML = `
      <div class="p-3 text-center">
        <p class="text-slate-400 text-sm">No tickets yet</p>
        <button onclick="showNewTicketForm()" class="mt-2 text-xs text-green-400 hover:text-green-300">Create your first ticket</button>
      </div>
    `;
    return;
  }
  
  ticketList.innerHTML = tickets.map(ticket => `
    <div class="ticket-item ticket-card-hover p-3 rounded-xl border border-white/5 bg-dm-elevated cursor-pointer hover:border-green-500/20" onclick="loadTicket('${ticket.ticketId}')">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-white truncate">${ticket.title}</h3>
          <p class="text-[11px] text-slate-500 mt-0.5">${ticket.ticketId}</p>
        </div>
        <span class="status-badge ${getStatusClass(ticket.status)} text-[10px] px-2 py-1 rounded-full font-medium">
          ${ticket.status.replace('_', ' ')}
        </span>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-slate-500">
        <span class="priority-badge ${getPriorityClass(ticket.priority)}">
          ${ticket.priority}
        </span>
        <span>${formatDate(ticket.createdAt)}</span>
      </div>
      <div class="mt-2">
        <p class="text-[11px] text-slate-400 line-clamp-2">${ticket.description}</p>
      </div>
    </div>
  `).join('');
}

async function loadTicket(ticketId) {
  try {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const ticket = await response.json();
      currentTicket = ticket;
      displayTicketDetail(ticket);
    } else {
      showToast('Ticket not found', 'error');
    }
  } catch (error) {
    console.error('Failed to load ticket:', error);
    showToast('Failed to load ticket', 'error');
  }
}

function displayTicketDetail(ticket) {
  // Hide empty state and show ticket detail
  document.getElementById('ticket-empty').classList.add('hidden');
  document.getElementById('ticket-detail').classList.remove('hidden');
  document.getElementById('new-ticket-form').classList.add('hidden');
  
  // Update ticket header
  const header = document.getElementById('ticket-header');
  header.innerHTML = `
    <div class="flex-1 min-w-0">
      <h2 class="text-sm font-semibold text-white truncate">${ticket.title}</h2>
      <p class="text-[11px] text-slate-500 mt-0.5">${ticket.ticketId} • ${formatDate(ticket.createdAt)}</p>
    </div>
    <div class="flex items-center gap-2">
      <span class="status-badge ${getStatusClass(ticket.status)} text-[10px] px-2 py-1 rounded-full font-medium">
        ${ticket.status.replace('_', ' ')}
      </span>
      <button onclick="updateTicketStatus('${ticket.ticketId}', 'closed')" class="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
        Close
      </button>
    </div>
  `;
  
  // Display messages
  const thread = document.getElementById('ticket-thread');
  thread.innerHTML = ticket.messages.map(message => `
    <div class="msg-wrap flex gap-2 ${message.userId._id === currentUser._id ? 'flex-row-reverse' : ''}">
      <img src="${message.userId.avatar ? `https://cdn.discordapp.com/avatars/${message.userId.discordId}/${message.userId.avatar}.png?size=64` : '/default-avatar.png'}" 
           alt="avatar" class="w-6 h-6 rounded-full flex-shrink-0" />
      <div class="max-w-[75%]">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-[11px] font-medium text-slate-300">${message.userId.username}</span>
          <span class="text-[10px] text-slate-500">${formatDate(message.createdAt)}</span>
        </div>
        <div class="rounded-xl ${message.userId._id === currentUser._id ? 'bg-green-500/10 border-green-500/20' : 'bg-dm-input'} px-3 py-2">
          <p class="text-[13px] text-slate-200 msg-bubble">${message.content}</p>
        </div>
      </div>
    </div>
  `).join('');
  
  // Scroll to bottom
  thread.scrollTop = thread.scrollHeight;
}

async function sendReply() {
  const content = document.getElementById('reply-content').value.trim();
  if (!content || !currentTicket) return;
  
  try {
    const response = await fetch(`${API_BASE}/tickets/${currentTicket.ticketId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content })
    });
    
    if (response.ok) {
      document.getElementById('reply-content').value = '';
      loadTicket(currentTicket.ticketId); // Reload ticket to show new message
    } else {
      showToast('Failed to send message', 'error');
    }
  } catch (error) {
    console.error('Failed to send reply:', error);
    showToast('Failed to send message', 'error');
  }
}

async function updateTicketStatus(ticketId, status) {
  try {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status })
    });
    
    if (response.ok) {
      loadTicket(ticketId);
      loadTickets(); // Refresh list
      showToast(`Ticket ${status}`, 'success');
    } else {
      showToast('Failed to update ticket', 'error');
    }
  } catch (error) {
    console.error('Failed to update ticket status:', error);
    showToast('Failed to update ticket', 'error');
  }
}

function showNewTicketForm() {
  document.getElementById('ticket-empty').classList.add('hidden');
  document.getElementById('ticket-detail').classList.add('hidden');
  document.getElementById('new-ticket-form').classList.remove('hidden');
  
  // Initialize form if not already done
  if (!document.getElementById('ticket-form-content')) {
    initializeTicketForm();
  }
}

function initializeTicketForm() {
  const formContent = document.getElementById('step-category');
  if (!formContent) return;
  
  formContent.innerHTML = `
    <div id="ticket-form-content">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Title</label>
          <input type="text" id="ticket-title" class="w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-dm-input text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/30" placeholder="Brief description of your issue" required>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Category</label>
          <select id="ticket-category" class="w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-dm-input text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/30">
            <option value="general">General</option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="account">Account</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Priority</label>
          <select id="ticket-priority" class="w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-dm-input text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/30">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea id="ticket-description" rows="4" class="w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-dm-input text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none" placeholder="Detailed description of your issue..." required></textarea>
        </div>
        
        <div class="flex gap-3 pt-4">
          <button type="button" onclick="createTicket()" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium px-4 py-2 rounded-lg transition-all">
            Create Ticket
          </button>
          <button type="button" onclick="cancelNewTicket()" class="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}

async function createTicket() {
  const title = document.getElementById('ticket-title').value.trim();
  const description = document.getElementById('ticket-description').value.trim();
  const category = document.getElementById('ticket-category').value;
  const priority = document.getElementById('ticket-priority').value;
  
  if (!title || !description) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, description, category, priority })
    });
    
    if (response.ok) {
      const ticket = await response.json();
      showToast('Ticket created successfully', 'success');
      loadTickets();
      loadTicket(ticket.ticketId);
    } else {
      showToast('Failed to create ticket', 'error');
    }
  } catch (error) {
    console.error('Failed to create ticket:', error);
    showToast('Failed to create ticket', 'error');
  }
}

function cancelNewTicket() {
  document.getElementById('new-ticket-form').classList.add('hidden');
  document.getElementById('ticket-empty').classList.remove('hidden');
}

// Utility functions
function getStatusClass(status) {
  const classes = {
    'open': 'bg-green-500/10 text-green-400 border-green-500/20',
    'in_progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'closed': 'bg-red-500/10 text-red-400 border-red-500/20',
    'resolved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };
  return classes[status] || classes.open;
}

function getPriorityClass(priority) {
  const classes = {
    'low': 'text-blue-400',
    'medium': 'text-yellow-400',
    'high': 'text-orange-400',
    'urgent': 'text-red-400'
  };
  return classes[priority] || classes.medium;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function searchTickets() {
  const query = document.getElementById('dash-ticket-search').value.toLowerCase();
  const tickets = document.querySelectorAll('.ticket-item');
  
  tickets.forEach(ticket => {
    const text = ticket.textContent.toLowerCase();
    ticket.style.display = text.includes(query) ? 'block' : 'none';
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('nw-toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `nw-toast nw-toast-${type}`;
  
  const icons = {
    success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>',
    info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };
  
  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span>${message}</span>
    <span class="nw-toast-close" onclick="this.parentElement.remove()">×</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

function logout() {
  localStorage.removeItem('token');
  authToken = null;
  currentUser = null;
  window.location.href = '/index.html';
}

// Legacy functions for compatibility
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  localStorage.setItem('token', data.token);
  window.location.href = '/dashboard.html';
}

async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  alert('Registered! Now login');
}
