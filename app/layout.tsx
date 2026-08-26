import './globals.css';
import './service-control.css';
import PortalTools from '@/components/PortalTools';

export const metadata = {
  title: 'HSS Centralized Portal',
  description: 'Centralized Health, Safety & Security services, contracts, incidents and performance portal'
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}<PortalTools/></body></html>;
}
