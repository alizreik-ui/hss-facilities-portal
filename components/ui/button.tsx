'use client';
import * as React from 'react';

type ButtonProps=React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'default'|'outline'|'ghost';size?:'default'|'icon-sm';asChild?:boolean};

export function Button({variant='default',size='default',asChild=false,className='',children,...props}:ButtonProps){
 const classes=`ui-button ui-button-${variant} ui-button-${size} ${className}`.trim();
 if(asChild&&React.isValidElement(children))return React.cloneElement(children as React.ReactElement<any>,{...props,className:classes});
 return <button data-slot='button' className={classes} {...props}>{children}</button>;
}
