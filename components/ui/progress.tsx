export function Progress({value=0,className=''}:{value?:number;className?:string}){
 const width=Math.max(0,Math.min(100,Number(value)||0));
 return <div data-slot='progress' className={`ui-progress ${className}`} role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}><div data-slot='progress-indicator' className='ui-progress-indicator' style={{width:`${width}%`}}/></div>;
}
