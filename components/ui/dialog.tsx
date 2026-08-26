'use client';
import * as React from 'react';

type DialogContextValue={open:boolean;setOpen:(open:boolean)=>void};
const DialogContext=React.createContext<DialogContextValue|null>(null);

export function Dialog({open,onOpenChange,children}:React.PropsWithChildren<{open:boolean;onOpenChange:(open:boolean)=>void}>){return <DialogContext.Provider value={{open,setOpen:onOpenChange}}>{children}</DialogContext.Provider>}

export function DialogTrigger({asChild=false,children}:React.PropsWithChildren<{asChild?:boolean}>){
 const ctx=React.useContext(DialogContext);
 if(asChild&&React.isValidElement(children))return React.cloneElement(children as React.ReactElement<any>,{onClick:(e:React.MouseEvent)=>{(children.props as any).onClick?.(e);if(!e.defaultPrevented)ctx?.setOpen(true)}});
 return <button type='button' onClick={()=>ctx?.setOpen(true)}>{children}</button>;
}

export function DialogContent({className='',children,...props}:React.HTMLAttributes<HTMLDivElement>){
 const ctx=React.useContext(DialogContext);if(!ctx?.open)return null;
 return <div data-slot='dialog-overlay' className='ui-dialog-overlay' onMouseDown={()=>ctx.setOpen(false)}><div data-slot='dialog-content' role='dialog' aria-modal='true' className={`ui-dialog-content ${className}`} onMouseDown={e=>e.stopPropagation()} {...props}>{children}<button type='button' className='ui-dialog-close' aria-label='Close' onClick={()=>ctx.setOpen(false)}>×</button></div></div>;
}

export function DialogHeader({className='',...props}:React.HTMLAttributes<HTMLDivElement>){return <div data-slot='dialog-header' className={`ui-dialog-header ${className}`} {...props}/>}
export function DialogFooter({className='',...props}:React.HTMLAttributes<HTMLDivElement>){return <div data-slot='dialog-footer' className={`ui-dialog-footer ${className}`} {...props}/>}
export function DialogTitle({className='',...props}:React.HTMLAttributes<HTMLHeadingElement>){return <h2 data-slot='dialog-title' className={`ui-dialog-title ${className}`} {...props}/>}
export function DialogDescription({className='',...props}:React.HTMLAttributes<HTMLParagraphElement>){return <p data-slot='dialog-description' className={`ui-dialog-description ${className}`} {...props}/>}
