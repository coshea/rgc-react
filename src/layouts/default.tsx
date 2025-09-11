// import { MainNavbar } from "@/components/main-navbar";
import { MainNavbarWithAvatar as MainNavbar } from "@/components/navbar-with-avatar";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col h-screen">
      <MainNavbar />
      <main className="container mx-auto max-w-7xl px-6 grow pt-6">
        {children}
      </main>
      <footer className="w-full flex items-center justify-center py-3"></footer>
    </div>
  );
}
