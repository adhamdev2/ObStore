import {  Instagram } from "lucide-react";
import { FaTiktok } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="mt-24 border-neutral-800">
      <div className="mx-auto max-w-[80%] px-6 py-12 text-center flex flex-col items-center gap-12">
        <img src="/logo.png" alt="brand" className="w-[178.79px]" />

        <p className="mx-auto mb-6 max-w-[60%] text-sm font-normal text-white/50 lg:text-[20.44px]" dir="rtl">
مرحباً بكمً في متجر OB، وجهتك الأولئ للحصول على جميع منتجات لعبة فايف إم الإكترونية والمنتجات الرقمية، نقدم خدمات شاملة لتعزيز تجربة لعبك باحترافية وسرعة ومع أداء محسّن وسلس يضيف فخامة وتجربة واقعية        </p>

        <div className="mb-6 flex justify-center gap-8 text-white">
          <a href="https://www.tiktok.com/@o.b0z/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
        <FaTiktok size={28}/>

          </a>
          <a href="https://www.instagram.com/o_b0s/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            <Instagram size={28} />
          </a>
          <a href="https://discord.com/invite/ob1/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
</svg>

          </a>
        </div>

        <p className="text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Copyright 2026 OB Store, All Rights Reserved Powered by Graphicode inc.
        </p>
      </div>
    </footer>
  );
}
