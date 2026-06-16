import { AsyncLocalStorage } from 'async_hooks';

export const orgContextStorage = new AsyncLocalStorage<string>();
