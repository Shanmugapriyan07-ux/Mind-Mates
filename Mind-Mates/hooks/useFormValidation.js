// hooks/useFormValidation.js
// DEBUGGED VERSION - Fixed common issues

import { useState, useCallback, useRef, useEffect } from 'react';

export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  
  const validationTimers = useRef({});

  // Debug: Log when values change
  useEffect(() => {
    console.log('📝 Form values updated:', values);
  }, [values]);

  // Core validation function
  const validate = useCallback((fieldName, value) => {
    const rule = validationRules[fieldName];
    if (!rule) return null;

    const error = rule(value, values);
    return error;
  }, [validationRules, values]);

  // Debounced validation
  const validateField = useCallback((fieldName, value) => {
    if (validationTimers.current[fieldName]) {
      clearTimeout(validationTimers.current[fieldName]);
    }

    setIsValidating(true);

    validationTimers.current[fieldName] = setTimeout(() => {
      const error = validate(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
      setIsValidating(false);
    }, 500);
  }, [validate]);

  // ✅ FIXED: Handle field change
  const handleChange = useCallback((fieldName, value) => {
    console.log('🔄 handleChange called:', fieldName, value);
    
    // ✅ CRITICAL: Update state immediately
    setValues(prev => {
      const updated = {
        ...prev,
        [fieldName]: value
      };
      console.log('✅ New values:', updated);
      return updated;
    });

    // Validate if touched
    if (touched[fieldName]) {
      validateField(fieldName, value);
    }
  }, [touched, validateField]);

  // Handle blur
  const handleBlur = useCallback((fieldName) => {
    console.log('👁️ Blur on:', fieldName);
    
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    const error = validate(fieldName, values[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, [validate, values]);

  // Validate all
  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(fieldName => {
      const error = validate(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    
    const allTouched = {};
    Object.keys(validationRules).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    return isValid;
  }, [validate, validationRules, values]);

  // Reset
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsValidating(false);
    
    Object.keys(validationTimers.current).forEach(key => {
      if (validationTimers.current[key]) {
        clearTimeout(validationTimers.current[key]);
      }
    });
  }, [initialValues]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.keys(validationTimers.current).forEach(key => {
        if (validationTimers.current[key]) {
          clearTimeout(validationTimers.current[key]);
        }
      });
    };
  }, []);

  return {
    values,
    errors,
    touched,
    isValidating,
    handleChange,
    handleBlur,
    validateAll,
    reset,
  };
};