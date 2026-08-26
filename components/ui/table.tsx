import * as React from 'react';

export function Table({className='',...props}:React.TableHTMLAttributes<HTMLTableElement>){return <div className='ui-table-wrap'><table data-slot='table' className={className} {...props}/></div>}
export function TableHeader(props:React.HTMLAttributes<HTMLTableSectionElement>){return <thead data-slot='table-header' {...props}/>}
export function TableBody(props:React.HTMLAttributes<HTMLTableSectionElement>){return <tbody data-slot='table-body' {...props}/>}
export function TableRow({className='',...props}:React.HTMLAttributes<HTMLTableRowElement>){return <tr data-slot='table-row' className={className} {...props}/>}
export function TableHead({className='',...props}:React.ThHTMLAttributes<HTMLTableCellElement>){return <th data-slot='table-head' className={className} {...props}/>}
export function TableCell({className='',...props}:React.TdHTMLAttributes<HTMLTableCellElement>){return <td data-slot='table-cell' className={className} {...props}/>}
