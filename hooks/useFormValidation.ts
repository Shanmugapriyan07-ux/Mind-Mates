// hooks/useFormValidation.ts

import { useState, useCallback, useRef, useEffect } from 'react';

type FormValues = Record<string, any>;
type ValidationRule = (value: any, allValues?: FormValues) => string | null;
type ValidationRules = Record<string, ValidationRule>;
type ValidationState = Record<string, string | null>;
type TouchedState = Record<string, boolean>;
type TimeoutMap = Record<string, ReturnType<typeof setTimeout>>;

export const useFormValidation = (
  initialValues: FormValues,
  validationRules: ValidationRules,
) => {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<ValidationState>({});
  const [touched, setTouched] = useState<TouchedState>({});
  const [isValidating, setIsValidating] = useState(false);

  const validationTimers = useRef<TimeoutMap>({});

  // Debug: Log when values change
  useEffect(() => {
    console.log('?? Form values updated:', values);
  }, [values]);

  // Core validation function
  const validate = useCallback(
    (fieldName: string, value: any) => {
      const rule = validationRules[fieldName];
      if (!rule) return null;

      return rule(value, values);
    },
    [validationRules, values],
  );

  // Debounced validation
  const validateField = useCallback(
    (fieldName: string, value: any) => {
      if (validationTimers.current[fieldName]) {
        clearTimeout(validationTimers.current[fieldName]);
      }

      setIsValidating(true);

      validationTimers.current[fieldName] = setTimeout(() => {
        const error = validate(fieldName, value);
        setErrors(prev => ({
          ...prev,
          [fieldName]: error,
        }));
        setIsValidating(false);
      }, 500);
    },
    [validate],
  );

  // ? FIXED: Handle field change
  const handleChange = useCallback(
    (fieldName: string, value: any) => {
      console.log('?? handleChange called:', fieldName, value);

      setValues(prev => {
        const updated = {
          ...prev,
          [fieldName]: value,
        };
        console.log('? New values:', updated);
        return updated;
      });

      if (touched[fieldName]) {
        validateField(fieldName, value);
      }
    },
    [touched, validateField],
  );

  // Handle blur
  const handleBlur = useCallback(
    (fieldName: string) => {
      console.log('??? Blur on:', fieldName);

      setTouched(prev => ({
        ...prev,
        [fieldName]: true,
      }));

      const error = validate(fieldName, values[fieldName]);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error,
      }));
    },
    [validate, values],
  );

  // Validate all
  const validateAll = useCallback(() => {
    const newErrors: ValidationState = {};
    let isValid = true;

    Object.keys(validationRules).forEach(fieldName => {
      const error = validate(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);

    const allTouched: TouchedState = {};
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
