'use client';
import * as React from 'react';

type TabsContextValue={value:string;setValue:(value:string)=>void};
const TabsContext=React.createContext<TabsContextValue|null>(null);

export function Tabs({defaultValue,value:onValue,onValueChange,className='',children}:React.PropsWithChildren<{defaultValue?:string;value?:string;onValueChange?:(value:string)=>void;className?:string}>){
 const [local,setLocal]=React.useState(defaultValue||'');
 const value=onValue??local;
 const setValue=(next:string)=>{if(onValue===undefined)setLocal(next);onValueChange?.(next)};
 return <TabsContext.Provider value={{value,setValue}}><div data-slot='tabs' className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({className='',...props}:React.HTMLAttributes<HTMLDivElement>){return <div data-slot='tabs-list' role='tablist' className={`ui-tabs-list ${className}`} {...props}/>}

export function TabsTrigger({value,className='',children,onClick,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{value:string}){
 const ctx=React.useContext(TabsContext);const active=ctx?.value===value;
 return <button data-slot='tabs-trigger' type='button' role='tab' value={value} aria-selected={active} data-state={active?'active':'inactive'} className={`ui-tabs-trigger ${className}`} onClick={e=>{onClick?.(e);if(!e.defaultPrevented)ctx?.setValue(value)}} {...props}>{children}</button>;
}

export function TabsContent({value,className='',children,...props}:React.HTMLAttributes<HTMLDivElement>&{value:string}){
 const ctx=React.useContext(TabsContext);if(ctx?.value!==value)return null;
 return <div data-slot='tabs-content' role='tabpanel' className={className} {...props}>{children}</div>;
}
