// Admin Dashboard JavaScript
const API_BASE = '/api';
let currentUser = null;
let authToken = localStorage.getItem('token');

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in and has admin permissions
  if (authToken) {
    fetchAdminProfile();
  } else {
    window.location.href = '/index.html';
  }

  // Setup event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // Ticket filters
  const ticketFilter = document.getElementById('ticket-filter');
  if (ticketFilter) {
    ticketFilter.addEventListener('change', loadAdminTickets);
  }

  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', loadAdminTickets);
  }

  // User search
  const userSearch = document.getElementById('user-search');
  if (userSearch) {
    userSearch.addEventListener('input', debounce(searchUsers, 300));
  }
}

// Admin Profile
async function fetchAdminProfile() {
  try {
    const response = await fetch(`${API_BASE}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      currentUser = await response.json();
      
      // Check if user has admin permissions
      if (!currentUser.isAdmin && !currentUser.isStaff) {
        showToast('Access denied. Admin permissions required.', 'error');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 2000);
        return;
      }
      
      updateAdminInterface();
      loadDashboardData();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Failed to fetch admin profile:', error);
    logout();
  }
}

function updateAdminInterface() {
  if (!currentUser) return;
  
  // Update admin info in sidebar
  const usernameElements = document.querySelectorAll('.admin-username');
  const avatarElements = document.querySelectorAll('.admin-avatar');
  const rolesElements = document.querySelectorAll('.admin-roles');
  
  usernameElements.forEach(el => {
    el.textContent = currentUser.username;
  });
  
  avatarElements.forEach(el => {
    if (currentUser.avatar) {
      el.src = `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png?size=64`;
    }
  });
  
  rolesElements.forEach(el => {
    el.textContent = currentUser.roles.join(', ') || 'User';
  });
}

// Section Navigation
function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('[id$="-section"]').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Show selected section
  const selectedSection = document.getElementById(`${sectionName}-section`);
  if (selectedSection) {
    selectedSection.classList.remove('hidden');
  }
  
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });
  
  event.currentTarget.classList.add('active');
  
  // Update page title
  const pageTitle = document.querySelector('.admin-page-title');
  if (pageTitle) {
    const titles = {
      'dashboard': 'Admin Dashboard',
      'tickets': 'All Tickets',
      'users': 'User Management',
      'analytics': 'Analytics'
    };
    pageTitle.textContent = titles[sectionName] || 'Admin Dashboard';
  }
  
  // Load section-specific data
  switch (sectionName) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'tickets':
      loadAdminTickets();
      break;
    case 'users':
      loadAdminUsers();
      break;
    case 'analytics':
      loadAnalytics();
      break;
  }
}

// Dashboard Data
async function loadDashboardData() {
  try {
    const response = await fetch(`${API_BASE}/admin/analytics?period=7d`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      updateDashboardStats(data.overview);
      loadRecentTickets();
    } else {
      showToast('Failed to load dashboard data', 'error');
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

function updateDashboardStats(stats) {
  document.getElementById('total-tickets').textContent = stats.totalTickets || 0;
  document.getElementById('open-tickets').textContent = stats.openTickets || 0;
  document.getElementById('active-users').textContent = stats.activeUsers || 0;
  
  // Calculate response rate (placeholder logic)
  const responseRate = stats.totalTickets > 0 
    ? Math.round((stats.closedTickets / stats.totalTickets) * 100) 
    : 0;
  document.getElementById('response-rate').textContent = `${responseRate}%`;
}

async function loadRecentTickets() {
  try {
    const response = await fetch(`${API_BASE}/admin/tickets?limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayRecentTickets(data.tickets);
    } else {
      showToast('Failed to load recent tickets', 'error');
    }
  } catch (error) {
    console.error('Failed to load recent tickets:', error);
    showToast('Failed to load recent tickets', 'error');
  }
}

function displayRecentTickets(tickets) {
  const container = document.getElementById('recent-tickets');
  if (!container) return;
  
  if (tickets.length === 0) {
    container.innerHTML = `
      <div class="text-center text-slate-400 py-8">
        <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.084 1.736.246 2.5.5v-6.25a.75.75 0 00-.75-.75h-15a.75.75 0 00-.75.75V21a.75.75 0 00.75.75h5.092c.08-.277.2-.539.36-.775M3 12.75V7.5h12v5.25M3 18v2.25h12V18M12 12.75h.008v.008H12v-.008z"/></svg>
        <p>No recent tickets</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = tickets.map(ticket => `
    <div class="flex items-center justify-between p-4 bg-dm-elevated rounded-lg border border-white/5 hover:border-slate-600/20 transition-colors">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 mb-2">
          <span class="text-sm font-medium text-white truncate">${ticket.title}</span>
          <span class="status-badge ${getStatusClass(ticket.status)} text-[10px] px-2 py-1 rounded-full font-medium">
            ${ticket.status.replace('_', ' ')}
          </span>
        </div>
        <div class="flex items-center gap-4 text-[11px] text-slate-500">
          <span>${ticket.ticketId}</span>
          <span>by ${ticket.userId.username}</span>
          <span>${formatDate(ticket.createdAt)}</span>
        </div>
      </div>
      <button onclick="viewTicket('${ticket.ticketId}')" class="ml-4 px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
        View
      </button>
    </div>
  `).join('');
}

// Admin Tickets
async function loadAdminTickets() {
  try {
    const status = document.getElementById('ticket-filter')?.value || '';
    const category = document.getElementById('category-filter')?.value || '';
    
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    
    const response = await fetch(`${API_BASE}/admin/tickets?${params}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayAdminTickets(data.tickets);
    } else {
      showToast('Failed to load tickets', 'error');
    }
  } catch (error) {
    console.error('Failed to load tickets:', error);
    showToast('Failed to load tickets', 'error');
  }
}

function displayAdminTickets(tickets) {
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;
  
  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-8 text-center text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.084 1.736.246 2.5.5v-6.25a.75.75 0 00-.75-.75h-15a.75.75 0 00-.75.75V21a.75.75 0 00.75.75h5.092c.08-.277.2-.539.36-.775M3 12.75V7.5h12v5.25M3 18v2.25h12V18M12 12.75h.008v.008H12v-.008z"/></svg>
          <p>No tickets found</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = tickets.map(ticket => `
    <tr class="hover:bg-dm-elevated transition-colors">
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${ticket.ticketId}</td>
      <td class="px-6 py-4 text-sm text-white max-w-xs truncate">${ticket.title}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
        <div class="flex items-center gap-2">
          <img src="${ticket.userId.avatar ? `https://cdn.discordapp.com/avatars/${ticket.userId.discordId}/${ticket.userId.avatar}.png?size=32` : '/default-avatar.png'}" 
               alt="avatar" class="w-6 h-6 rounded-full" />
          <span>${ticket.userId.username}</span>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${ticket.category}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="priority-badge ${getPriorityClass(ticket.priority)} text-xs font-medium">
          ${ticket.priority}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="status-badge ${getStatusClass(ticket.status)} text-xs px-2 py-1 rounded-full font-medium">
          ${ticket.status.replace('_', ' ')}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
        ${ticket.assignedTo ? ticket.assignedTo.username : 'Unassigned'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${formatDate(ticket.createdAt)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <div class="flex items-center gap-2">
          <button onclick="viewTicket('${ticket.ticketId}')" class="text-blue-400 hover:text-blue-300 transition-colors" title="View">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>
          <button onclick="assignTicket('${ticket.ticketId}')" class="text-green-400 hover:text-green-300 transition-colors" title="Assign">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </button>
          ${currentUser.isAdmin ? `
            <button onclick="deleteTicket('${ticket.ticketId}')" class="text-red-400 hover:text-red-300 transition-colors" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Admin Users
async function loadAdminUsers() {
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayAdminUsers(data.users);
    } else {
      showToast('Failed to load users', 'error');
    }
  } catch (error) {
    console.error('Failed to load users:', error);
    showToast('Failed to load users', 'error');
  }
}

function displayAdminUsers(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  
  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.084 1.736.246 2.5.5v-6.25a.75.75 0 00-.75-.75h-15a.75.75 0 00-.75.75V21a.75.75 0 00.75.75h5.092c.08-.277.2-.539.36-.775M3 12.75V7.5h12v5.25M3 18v2.25h12V18M12 12.75h.008v.008H12v-.008z"/></svg>
          <p>No users found</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr class="hover:bg-dm-elevated transition-colors">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center gap-3">
          <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=40` : '/default-avatar.png'}" 
               alt="avatar" class="w-8 h-8 rounded-full" />
          <div>
            <div class="text-sm font-medium text-white">${user.username}</div>
            <div class="text-xs text-slate-500">${user.discriminator}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${user.email || 'N/A'}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex flex-wrap gap-1">
          ${user.roles.map(role => `
            <span class="text-xs px-2 py-1 rounded-full ${getRoleClass(role)}">
              ${role}
            </span>
          `).join('') || '<span class="text-xs text-slate-500">User</span>'}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="text-xs px-2 py-1 rounded-full ${user.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
          ${user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${formatDate(user.createdAt)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <div class="flex items-center gap-2">
          ${currentUser.isAdmin ? `
            <button onclick="editUserRoles('${user._id}')" class="text-blue-400 hover:text-blue-300 transition-colors" title="Edit Roles">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Analytics
async function loadAnalytics() {
  try {
    const response = await fetch(`${API_BASE}/admin/analytics?period=30d`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayAnalytics(data);
    } else {
      showToast('Failed to load analytics', 'error');
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

function displayAnalytics(data) {
  // Simple text-based charts (in a real app, you'd use a charting library)
  const categoryChart = document.getElementById('category-chart');
  const priorityChart = document.getElementById('priority-chart');
  
  if (categoryChart && data.charts.byCategory) {
    categoryChart.innerHTML = data.charts.byCategory.map(item => `
      <div class="flex justify-between items-center py-2">
        <span class="text-sm text-slate-300">${item._id}</span>
        <span class="text-sm font-medium text-white">${item.count}</span>
      </div>
    `).join('');
  }
  
  if (priorityChart && data.charts.byPriority) {
    priorityChart.innerHTML = data.charts.byPriority.map(item => `
      <div class="flex justify-between items-center py-2">
        <span class="text-sm text-slate-300">${item._id}</span>
        <span class="text-sm font-medium text-white">${item.count}</span>
      </div>
    `).join('');
  }
}

// Ticket Actions
function viewTicket(ticketId) {
  // Open ticket in new tab or modal
  window.open(`/dashboard.html?ticket=${ticketId}`, '_blank');
}

async function assignTicket(ticketId) {
  // Simple assignment to current admin (in real app, show staff selection modal)
  try {
    const response = await fetch(`${API_BASE}/admin/tickets/${ticketId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ assignedTo: currentUser._id })
    });
    
    if (response.ok) {
      showToast('Ticket assigned successfully', 'success');
      loadAdminTickets(); // Refresh list
    } else {
      showToast('Failed to assign ticket', 'error');
    }
  } catch (error) {
    console.error('Failed to assign ticket:', error);
    showToast('Failed to assign ticket', 'error');
  }
}

async function deleteTicket(ticketId) {
  if (!confirm('Are you sure you want to delete this ticket?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/admin/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      showToast('Ticket deleted successfully', 'success');
      loadAdminTickets(); // Refresh list
    } else {
      showToast('Failed to delete ticket', 'error');
    }
  } catch (error) {
    console.error('Failed to delete ticket:', error);
    showToast('Failed to delete ticket', 'error');
  }
}

// User Actions
function editUserRoles(userId) {
  // In a real app, show a modal for editing roles
  const newRoles = prompt('Enter roles (comma-separated):');
  if (newRoles) {
    updateUserRoles(userId, newRoles.split(',').map(r => r.trim()));
  }
}

async function updateUserRoles(userId, roles) {
  try {
    const permissions = roles.flatMap(role => ROLE_PERMISSIONS[role] || []);
    
    const response = await fetch(`${API_BASE}/admin/users/${userId}/roles`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ roles, permissions })
    });
    
    if (response.ok) {
      showToast('User roles updated successfully', 'success');
      loadAdminUsers(); // Refresh list
    } else {
      showToast('Failed to update user roles', 'error');
    }
  } catch (error) {
    console.error('Failed to update user roles:', error);
    showToast('Failed to update user roles', 'error');
  }
}

// Search functionality
async function searchUsers() {
  const query = document.getElementById('user-search').value.toLowerCase();
  
  try {
    const response = await fetch(`${API_BASE}/admin/users?search=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayAdminUsers(data.users);
    }
  } catch (error) {
    console.error('Failed to search users:', error);
  }
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

function getRoleClass(role) {
  const classes = {
    'admin': 'bg-red-500/10 text-red-400',
    'moderator': 'bg-orange-500/10 text-orange-400',
    'staff': 'bg-blue-500/10 text-blue-400',
    'support': 'bg-green-500/10 text-green-400'
  };
  return classes[role] || 'bg-slate-500/10 text-slate-400';
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

// Role permissions mapping (should match server-side)
const ROLE_PERMISSIONS = {
  admin: ['view_tickets', 'manage_tickets', 'assign_tickets', 'delete_tickets', 'view_users', 'manage_users', 'view_analytics', 'manage_system'],
  moderator: ['view_tickets', 'manage_tickets', 'assign_tickets', 'view_users'],
  staff: ['view_tickets', 'manage_tickets'],
  support: ['view_tickets']
};
