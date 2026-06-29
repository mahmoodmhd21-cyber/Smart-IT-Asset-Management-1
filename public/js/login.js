// Form elements used by the login page.
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const showPasswordInput = document.getElementById('showPassword');
const loginButton = document.getElementById('loginButton');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const formError = document.getElementById('formError');

// Simple email format check before sending the request to the server.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Display an error message in the selected error element.
function setError(element, message) {
  element.textContent = message;
}

// Remove old errors before each new validation attempt.
function clearErrors() {
  setError(emailError, '');
  setError(passwordError, '');
  setError(formError, '');
}

// Validate required fields and email format.
function validateForm() {
  let isValid = true;
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  clearErrors();

  if (!email) {
    setError(emailError, 'Email is required.');
    isValid = false;
  } else if (!emailPattern.test(email)) {
    setError(emailError, 'Please enter a valid email address.');
    isValid = false;
  }

  if (!password) {
    setError(passwordError, 'Password is required.');
    isValid = false;
  }

  return isValid;
}

// Disable the button while the login request is running.
function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? 'Logging in...' : 'Login';
}

// Toggle password visibility without changing the entered value.
showPasswordInput.addEventListener('change', () => {
  passwordInput.type = showPasswordInput.checked ? 'text' : 'password';
});

// Submit login details to the backend API.
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed. Please try again.');
    }

    // Save login data for pages that need authenticated user details.
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
  } catch (error) {
    setError(formError, error.message);
  } finally {
    setLoading(false);
  }
});
