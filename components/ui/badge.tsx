import * as React from 'react';

export function Badge({variant='default',className='',...props}:React.HTMLAttributes<HTMLSpanElement>&{variant?:'default'|'outline'|'secondary'}){
 return <span data-slot='badge' className={`ui-badge ui-badge-${variant} ${className}`} {...props}/>;
}
