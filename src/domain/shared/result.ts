// ============================================================
// Casa Quest — Domain: Result Type
// Rust-style Result for error handling without exceptions.
// ============================================================

/** Success variant */
export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

/** Failure variant */
export interface Failure<E = DomainError> {
  readonly success: false;
  readonly error: E;
}

/** Result type: either success with value T, or failure with error E */
export type Result<T, E = DomainError> = Success<T> | Failure<E>;

/** Create a successful result */
export function success<T>(value: T): Success<T> {
  return { success: true, value };
}

/** Create a failed result */
export function failure<E = DomainError>(error: E): Failure<E> {
  return { success: false, error };
}

/** Base domain error class */
export class DomainError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

/** Validation error — input doesn't meet requirements */
export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/** Business rule error — operation violates domain rules */
export class BusinessRuleError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BUSINESS_RULE_ERROR', details);
    this.name = 'BusinessRuleError';
  }
}

/** Not found error — entity doesn't exist */
export class NotFoundError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

/** Unauthorized error — user lacks permission */
export class UnauthorizedError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', details);
    this.name = 'UnauthorizedError';
  }
}

/** Map HTTP status code from domain error code */
export function domainErrorToHttpStatus(error: DomainError): number {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'BUSINESS_RULE_ERROR':
      return 422;
    default:
      return 500;
  }
}
