import { DeadlockApiClient } from "@deadlock/shared";

export const deadlockClient = new DeadlockApiClient({
  baseUrl: process.env.DEADLOCK_API_BASE_URL,
  apiKey: process.env.DEADLOCK_API_KEY,
});
