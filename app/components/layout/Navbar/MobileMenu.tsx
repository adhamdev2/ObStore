import React from "react";
import Link from "next/link";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import NavbarItems from "@/constants/Navbar";
import { useAuth } from "@/lib/auth";

export default function MobileMenu({
  setIsOpen,
}: {
  setIsOpen: (v: boolean) => void;
}) {
  const { user } = useAuth();

  return (
    <div className="absolute top-0 right-0 left-0 w-[100%] h-screen flex flex-col items-center justify-start gap-0 z-[999] bg-black/70 backdrop-blur-[24.87px]">
      <div className="flex flex-col w-full pt-[95px] gap-[12px] px-8 text-white">
        {NavbarItems.filter(item => {
          if (item.href === "/") return true;
          return !!user;
        }).map((item, idx) => (
          <React.Fragment key={item.href}>
            {idx !== 0 && (
              <div
                className="w-full h-[0.2px] opacity-50"
                style={{
                  border: "0.2px solid",
                  borderImage:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, #D1D1D1 50.48%, rgba(153,153,153,0) 100%) 1",
                  borderImageSlice: 0.5,
                }}
              />
            )}
            <Link
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="text-[17.78px] font-normal py-4 flex items-center justify-center gap-3 w-full"
            >
              {item.icon && <item.icon size={20} />}
            </Link>
          </React.Fragment>
        ))}

        {/* Auth Section for Mobile */}
        <div
          className="w-full h-[0.2px] opacity-50 mt-4 mb-2"
          style={{
            border: "0.2px solid",
            borderImage:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, #D1D1D1 50.48%, rgba(153,153,153,0) 100%) 1",
            borderImageSlice: 0.5,
          }}
        />
        <AuthMobileItem setIsOpen={setIsOpen} />
      </div>
    </div>
  );
}

function AuthMobileItem({ setIsOpen }: { setIsOpen: (v: boolean) => void }) {
  const { user, login, logout, isLoading, error } = useAuth();

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 w-full py-4 text-red-500">
        <span className="font-bold">{error}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 w-full py-4 text-primary">
        <Loader2 className="animate-spin" size={20} />
        <span>Loading...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-col items-center gap-4 w-full py-4">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pr-6 pl-2 p-2">
            <img 
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
              className="w-8 h-8 rounded-full" 
              alt="Avatar" 
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
            <span className="text-white text-[17.78px] font-medium">{user.username}</span>
        </div>
        <button
          onClick={() => { logout(); setIsOpen(false); }}
          className="text-[17.78px] font-normal py-2 flex items-center justify-center gap-3 w-full text-red-400 hover:text-red-300"
        >
          <LogOut size={20} className="pointer-events-none" />
          <span>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { login(); setIsOpen(false); }}
      className="text-[17.78px] font-normal py-4 flex items-center gap-3 justify-center w-full text-primary hover:text-primary/80"
    >
      <LogIn size={20} className="pointer-events-none" />
      <span>Login with Discord</span>
    </button>
  );
}
