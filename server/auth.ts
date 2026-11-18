import { cookies } from 'next/headers';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './cms';
const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = 'apex_admin_session';
const TTL_SECONDS = 12 * 60 * 60;

function config() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.SESSION_SECRET;
  if (!email || !secret || secret.length < 32) throw new HttpError(503, 'ADMIN_EMAIL или SESSION_SECRET не са настроени.');
  return {email, secret};
}
function sign(payload: string, secret: string) {
  return createHmac('sha256',secret).update(payload).digest('base64url');
}
export function createSession(email: string) {
  const {secret} = config();
  const data = Buffer.from(JSON.stringify({email,exp:Math.floor(Date.now()/1000)+TTL_SECONDS,nonce:randomBytes(8).toString('hex')})).toString('base64url');
  return `${data}.${sign(data,secret)}`;
}
export function cookieOptions() {
  return {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:TTL_SECONDS};
}
function sessionEmail(cookie: string|undefined): string | false {
  if (!cookie) return false;
  let settings;
  try {settings=config();} catch {return false;}
  const [payload,mac,other] = cookie.split('.');
  if (!payload || !mac || other || !/^[A-Za-z0-9_-]{43}$/.test(mac)) return false;
  const expected = sign(payload,settings.secret);
  if (!timingSafeEqual(Buffer.from(mac),Buffer.from(expected))) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return typeof decoded.email==='string' && Number.isInteger(decoded.exp) && decoded.exp>Math.floor(Date.now()/1000) && decoded.email;
  } catch {return false;}
}
export function isSessionValid(cookie: string|undefined) {
  const email=sessionEmail(cookie);
  return Boolean(email && email===config().email);
}
export async function staffIdentity() {
  const email=sessionEmail((await cookies()).get(COOKIE_NAME)?.value);
  if (!email) throw new HttpError(401,'Необходимо е влизане.');
  if (email===config().email) return {email,owner:true};
  if (email===process.env.STAFF_MANAGER_EMAIL?.trim().toLowerCase() && process.env.STAFF_MANAGER_PASSWORD_HASH) return {email,owner:false};
  throw new HttpError(403,'Липсва достъп до персонала.');
}
export async function getAdmin() {
  const cookie=(await cookies()).get(COOKIE_NAME)?.value;
  return isSessionValid(cookie) ? config().email : null;
}
export async function requireAdmin() {
  const email=await getAdmin();
  if (!email) throw new HttpError(401,'Необходимо е влизане в администраторския панел.');
  return email;
}
export async function verifyPassword(email: string, password: string) {
  const settings=config();
  const normalized=email.trim().toLowerCase();
  const manager=normalized!==settings.email && normalized===process.env.STAFF_MANAGER_EMAIL?.trim().toLowerCase() && Boolean(process.env.STAFF_MANAGER_PASSWORD_HASH);
  const encoded=(manager ? process.env.STAFF_MANAGER_PASSWORD_HASH : process.env.ADMIN_PASSWORD_HASH)||'';
  const [scheme,saltHex,hashHex]=encoded.split(':');
  if(scheme!=='scrypt'||!/^[0-9a-f]{32}$/.test(saltHex||'')||!/^[0-9a-f]{128}$/.test(hashHex||'')) throw new HttpError(503,'ADMIN_PASSWORD_HASH не е настроен коректно.');
  if(password.length>1024) return false;
  const derived=await scrypt(password,Buffer.from(saltHex,'hex'),64) as Buffer;
  const correct=timingSafeEqual(derived,Buffer.from(hashHex,'hex'));
  return correct && (normalized===settings.email || manager);
}
