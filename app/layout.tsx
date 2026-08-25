import './globals.css';

export const metadata = {
  title: 'HSS & Facilities Portal',
  description: 'Integrated HSS, Facilities and Security Portal'
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
