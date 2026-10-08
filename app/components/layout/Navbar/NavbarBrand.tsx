import Image from "next/image";
import logo from "@/assets/logo.png";
import { useDownload } from "@/lib/DownloadContext";
import { useRouter } from "next/navigation";

export default function NavbarBrand() {
  const { isDownloading, cancelDownload } = useDownload();
  const router = useRouter();

  const handleLogoClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) {
      const confirm = window.confirm("هناك تحميل جاري. هل أنت متأكد أنك تريد المغادرة؟ سيتم إلغاء التحميل ومسح الملفات.");
      if (!confirm) return;
      await cancelDownload();
    }
    router.push("/");
  };

  return (
    <a className="flex flex-row gap-2 items-center cursor-pointer" onClick={handleLogoClick}>
      <Image
        src={logo}
        alt="logo"
        loading="eager"
        width={56}
        height={56}
        className="w-[40px] h-[40px] md:w-[48px] md:h-[48px] lg:w-[56px] lg:h-[56px] object-contain"
      />
    </a>
  );
}

