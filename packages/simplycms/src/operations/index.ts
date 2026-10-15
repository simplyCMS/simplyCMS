// simplycms/operations (T2, server-only): опис операції, виконавець з явним
// суб'єктом, спільні перевірки. Реєстр `CORE_OPERATIONS` живе в `admin-server`
// (він і є переліком операцій): тут про нього знати не можна — цикл.
export {
  OPERATION_ID_FORMAT,
  assertVersionThenHash,
  defineOperation,
} from './define';
export type {
  ExecuteResult,
  IdempotencyRequest,
  OperationContext,
  OperationDef,
} from './define';
export { executeOperation } from './execute';
export { generateToken } from './http/token-auth';
export { wireDate } from './http/wire';
export {
  IDEMPOTENCY_LOCK_TIMEOUT_MS,
  IDEMPOTENCY_TTL_HOURS,
} from './http/idempotency';
