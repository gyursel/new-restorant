import { redirect } from 'next/navigation';
import { staffIdentity } from '../../../../server/auth';
import LoginForm from '../../login/login-form';

export default async function Page() {
  if (await staffIdentity().catch(() => null)) redirect('/admin/staff');
  return <LoginForm staff />;
}
