import './globals.css';

export const metadata = {
  title: 'HSS & Facilities Portal',
  description: 'Integrated HSS, Facilities, Security and Operations Portal'
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
