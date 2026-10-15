import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  type BinaryLike,
} from 'node:crypto';

/**
 * Ітерації — дефолт Postgres (`scram_iterations` з PG16 не чіпаємо): верифікатор
 * не має бути ні слабшим, ні дорожчим для логіну, ніж той, що зробив би сервер.
 */
const SCRAM_ITERATIONS = 4096;
const SALT_BYTES = 16;

const hmac = (key: BinaryLike, text: string): Buffer =>
  createHmac('sha256', key).update(text).digest();

/**
 * Верифікатор SCRAM-SHA-256 у форматі `pg_authid.rolpassword`
 * (RFC 5802/7677): `SCRAM-SHA-256$<iter>:<salt>$<StoredKey>:<ServerKey>`.
 * Чиста функція — її правильність доводить оракул-тест проти самого Postgres.
 *
 * Пароль має бути друкованим ASCII: SASLprep над ним тотожний, а для решти
 * libpq і node-postgres нормалізують по-різному (перевіряє викликач).
 */
export function scramSha256Verifier(
  password: string,
  salt: Buffer,
  iterations: number,
): string {
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const storedKey = createHash('sha256')
    .update(hmac(salted, 'Client Key'))
    .digest('base64');
  const serverKey = hmac(salted, 'Server Key').toString('base64');
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}

/** Верифікатор із випадковою сіллю й ітераціями за дефолтом Postgres. */
export function newScramVerifier(password: string): string {
  return scramSha256Verifier(
    password,
    randomBytes(SALT_BYTES),
    SCRAM_ITERATIONS,
  );
}
