import {notFound} from 'next/navigation';
import {Planner} from '../../src/features/planner/model/usePlanner';
const routes=new Set(['play','future','afford','loan','decide','checkin','pro','me/guess','me/closest','me/sliders','me/balance','me/upload']);
export default async function Page({params}:{params:Promise<{path:string[]}>}){const {path}=await params;if(!routes.has(path.join('/')))notFound();return <Planner/>;}
