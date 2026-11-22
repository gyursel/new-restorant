import { redirect } from 'next/navigation';
import { staffIdentity } from '../../../server/auth';
import StaffWorkspace from '../StaffWorkspace';
import '../staff.css';

export default async function Page() {
  const user = await staffIdentity().catch(() => null);
  if (!user) redirect('/admin/staff/login');
  return <main className="staff-manager"><StaffWorkspace manager={!user.owner} standalone /></main>;
}
