export class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
