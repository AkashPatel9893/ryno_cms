import Workspace from "../workspace";
import { notFound } from "next/navigation";
export function generateStaticParams() { return ['dashboard','orders','reports','marketing','partners','analytics','data','payments'].map(section=>({section})); }
export default async function Page({params}:{params:Promise<{section:string}>}) { const {section}=await params; if(!['dashboard','orders','reports','marketing','partners','analytics','data','payments'].includes(section)) notFound(); return <Workspace key={section} initialSection={section} />; }
