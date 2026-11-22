import {redirect} from 'next/navigation';
import StaffWorkspace from './StaffWorkspace';
import './staff.css';
import {staffIdentity} from '../../server/auth';
import Admin from './panel';
export const dynamic='force-dynamic';
export default async function Page(){const user=await staffIdentity().catch(() => null);if(!user)redirect('/admin/login');if(user.owner)return <Admin/>;return <main className="staff-manager"><h1>Персонал</h1><StaffWorkspace manager/></main>;}
