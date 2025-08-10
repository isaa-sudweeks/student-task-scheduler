"use client";
import React from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
export function AuthButtons(){const {data:session,status}=useSession();if(status==='loading')return <div/>;if(!session){return(<div className='flex gap-2'><button className='rounded border px-3 py-2' onClick={()=>signIn('github')}>Sign in with GitHub</button><button className='rounded border px-3 py-2' onClick={()=>signIn('credentials',{email:`dev+${Date.now()}@example.com`})}>Dev login</button></div>);}return(<div className='flex items-center gap-3'><span className='text-sm opacity-80'>{session.user?.email}</span><button className='rounded border px-3 py-2' onClick={()=>signOut()}>Sign out</button></div>);}
