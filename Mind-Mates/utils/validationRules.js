// Email validation
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@gmail\.com$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid Gmail address';
  }
  
  return null;
};

// Password validation
export const validatePassword = (password) => {
  if (!password) {
    return 'Password is required';
  }
  
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  
  // Optional: Strong password check
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return 'Password must contain uppercase, lowercase, and number';
  }
  
  return null;
};

export const validateConfirmPassword = (confirmPassword, allValues) => {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  
  if (confirmPassword !== allValues.password) {
    return 'Passwords do not match';
  }
  
  return null;
};



// Name validation
export const validateName = (name) => {
  if (!name || !name.trim()) {
    return 'Name is required';
  }
  
  if (name.trim().length < 2) {
    return 'Name must be at least 2 characters';
  }
  
  if (name.trim().length > 50) {
    return 'Name must be less than 50 characters';
  }
  
  return null;
};

// Confirm password validation


// Login validation rules
export const loginValidationRules = {
  email: validateEmail,
  password: validatePassword,
};

// Signup validation rules
export const signupValidationRules = {
  name: validateName,
  email: validateEmail,
  password: validatePassword,
  confirmPassword: validateConfirmPassword,
};