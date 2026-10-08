import NavbarItems from "@/constants/Navbar";
import { useAuth } from "@/lib/auth";
import { useDownload } from "@/lib/DownloadContext";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export default function DesktopNav({ pathname }: { pathname: string }) {
  const { user } = useAuth();
  const { isDownloading, cancelDownload } = useDownload();
  const { t, isArabic } = useTranslation();
  const router = useRouter();

  const handleLinkClick = async (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (isDownloading) {
      const confirm = window.confirm("هناك تحميل جاري. هل أنت متأكد أنك تريد المغادرة؟ سيتم إلغاء التحميل ومسح الملفات.");
      if (!confirm) return;
      await cancelDownload();
    }
    router.push(href);
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="flex flex-row items-center gap-[10px] relative"
      style={{
        background: "transparent",
      }}
    >

      {NavbarItems.filter(item => {
        if (item.href === "/") return true;
        return !!user;
      }).map((item) => {
        const isCurrent =
          (item.href === pathname ||
            (item.href !== "/" &&
              pathname.startsWith(item.href)));

        const Icon = item.icon;
        const label = t[item.labelKey];

        return (
          <a
            key={item.href}
            href={item.href}
            onClick={(e) => handleLinkClick(e, item.href)}
            aria-label={label}
            className={`group h-[68px] w-[68px] hover:w-[150px] focus-visible:w-[150px] p-[22px] rounded-[22px] transition-[width,background-color,color] duration-300 ease-out flex items-center justify-start gap-2 cursor-pointer overflow-hidden ${isCurrent ? "bg-primary/10 text-white" : "text-white/70 hover:text-white"
              }`}
          >
            {Icon && <Icon size={24} className="shrink-0" />}
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 ease-out group-hover:max-w-[90px] group-hover:opacity-100 group-focus-visible:max-w-[90px] group-focus-visible:opacity-100">
              {label}
            </span>
          </a>
        );
      })}
    </div>
  );
}

