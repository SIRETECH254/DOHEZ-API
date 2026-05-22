

/**
 * Custom error handler function to create an error with a status code.
 * 
 * @param statusCode - The HTTP status code (e.g., 400, 401, 404, 500)
 * @param message - A human-readable error message
 * @returns An Error object with an added statusCode property
 */
export const errorHandler = (statusCode: number, message: string): Error => {

  const error = new Error(message);

  (error as any).statusCode = statusCode;

  return error;

};
