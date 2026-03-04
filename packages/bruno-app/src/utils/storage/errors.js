/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ERROR TRANSFORMATION LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Normalizes errors from different storage backends into a standard contract
 * format as defined in Phase 0, Section 4.
 *
 * Standard Error Format:
 * {
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Human-readable message",
 *     details: { ... },
 *     retryable: boolean,
 *     statusCode: number
 *   }
 * }
 */

// Error codes from Phase 0, Section 4.2
export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  // Filesystem-specific codes
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',
  ENOENT: 'FILE_NOT_FOUND',
  EACCES: 'PERMISSION_DENIED',
  EEXIST: 'CONFLICT'
};

// HTTP status code to error code mapping
const HTTP_STATUS_TO_CODE = {
  400: ERROR_CODES.INVALID_REQUEST,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  422: ERROR_CODES.UNPROCESSABLE_ENTITY,
  429: ERROR_CODES.RATE_LIMITED,
  500: ERROR_CODES.INTERNAL_ERROR,
  503: ERROR_CODES.SERVICE_UNAVAILABLE
};

// Retryable status codes
const RETRYABLE_CODES = new Set([
  ERROR_CODES.RATE_LIMITED,
  ERROR_CODES.INTERNAL_ERROR,
  ERROR_CODES.SERVICE_UNAVAILABLE
]);

/**
 * Transform cloud (HTTP) error to standard format
 */
export function transformCloudError(error) {
  // Axios error structure
  if (error.response) {
    const { status, data } = error.response;

    // Server returned standard error format
    if (data?.error) {
      return {
        error: {
          code: data.error.code || HTTP_STATUS_TO_CODE[status] || ERROR_CODES.INTERNAL_ERROR,
          message: data.error.message || error.message,
          details: data.error.details || {},
          retryable: data.error.retryable ?? RETRYABLE_CODES.has(data.error.code),
          statusCode: status
        }
      };
    }

    // Server returned plain error message
    const errorCode = HTTP_STATUS_TO_CODE[status] || ERROR_CODES.INTERNAL_ERROR;
    const errorMessage = typeof data === 'string' ? data : (data?.message || error.message);

    return {
      error: {
        code: errorCode,
        message: errorMessage,
        details: { status },
        retryable: RETRYABLE_CODES.has(errorCode),
        statusCode: status
      }
    };
  }

  // Network error (no response)
  if (error.request) {
    return {
      error: {
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Network error: Unable to reach server',
        details: { originalError: error.message },
        retryable: true,
        statusCode: 503
      }
    };
  }

  // Other Axios error
  return {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message || 'An unexpected error occurred',
      details: {},
      retryable: false,
      statusCode: 500
    }
  };
}

/**
 * Transform local (filesystem) error to standard format
 */
export function transformLocalError(error) {
  // Node.js filesystem errors
  if (error.code) {
    const errorCode = ERROR_CODES[error.code] || ERROR_CODES.INTERNAL_ERROR;
    let message = error.message;

    // Enhance error messages for common filesystem errors
    switch (error.code) {
      case 'ENOENT':
        message = `File or directory not found: ${error.path || 'unknown path'}`;
        break;
      case 'EACCES':
        message = `Permission denied: ${error.path || 'unknown path'}`;
        break;
      case 'EEXIST':
        message = `File or directory already exists: ${error.path || 'unknown path'}`;
        break;
    }

    return {
      error: {
        code: errorCode,
        message,
        details: {
          path: error.path,
          syscall: error.syscall,
          errno: error.errno
        },
        retryable: false,
        statusCode: 500
      }
    };
  }

  // Generic error
  return {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message || 'An unexpected error occurred',
      details: {},
      retryable: false,
      statusCode: 500
    }
  };
}

/**
 * Transform error based on storage mode
 * @param {Error} error - The error to transform
 * @param {'local' | 'cloud'} mode - The storage mode
 * @returns {Object} Standardized error object
 */
export function transformError(error, mode) {
  if (mode === 'cloud') {
    return transformCloudError(error);
  } else {
    return transformLocalError(error);
  }
}

/**
 * Retry logic helper
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of successful execution
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      const transformedError = transformError(error, 'cloud');
      if (!transformedError.error.retryable || attempt === maxRetries) {
        throw transformedError;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, delay, transformedError);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff with max delay
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw transformError(lastError, 'cloud');
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error) {
  if (error?.error?.retryable !== undefined) {
    return error.error.retryable;
  }
  if (error?.error?.code) {
    return RETRYABLE_CODES.has(error.error.code);
  }
  return false;
}

/**
 * Extract error message from standardized error
 */
export function getErrorMessage(error) {
  return error?.error?.message || error?.message || 'An unexpected error occurred';
}

/**
 * Extract error code from standardized error
 */
export function getErrorCode(error) {
  return error?.error?.code || ERROR_CODES.INTERNAL_ERROR;
}
