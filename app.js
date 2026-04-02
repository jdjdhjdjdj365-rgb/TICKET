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
