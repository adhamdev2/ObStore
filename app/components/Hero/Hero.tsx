"use client";

import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

interface HeroProps {
  onDownload?: () => void;
  isDownloading?: boolean;
}

export default function Hero({ onDownload, isDownloading }: HeroProps) {
  return (
    <section className="mx-auto max-w-[95%] px-6 lg:px-0 pt-10 md:pt-20 lg: mt-[5%] overflow-x-hidden">
      <div className="flex flex-col-reverse md:flex-row items-center justify-start gap-12 md:gap-6 text-center md:text-right">
        {/* Character Image - Bottom on Mobile, Left on Desktop */}

        <motion.div
          className="flex justify-center md:justify-start items-center rounded-full w-full md:w-auto"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img
            src="/char.png"
            alt="Character"
            className="w-full max-w-[400px] lg:w-[650px] md:max-w-full"
          />
        </motion.div>
        {/* Content - Top on Mobile, Right on Desktop */}
        <motion.div
          className="flex flex-col items-center justify-start md:items-end gap-6 px-0 md:px-6 py-6 w-full md:w-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-[75px] font-extrabold w-full leading-tight" dir="rtl">
            ابدأ تجربتك <span className="bg-linear-to-l from-purple-400 to-purple-600 bg-clip-text text-transparent">الأسطورية</span> في <span dir="ltr" className="inline-block text-[30px] sm:text-[40px] md:text-[55px]">FiveM</span> <br /> <span className="bg-linear-to-l from-purple-400 to-purple-600 bg-clip-text text-transparent">مع برنامج OB.</span>
          </h1>

          <p dir="rtl" className="lg:max-w-3xl max-w-2xl text-white/40 text-sm md:text-xl leading-relaxed">
            حوّل تجربة FiveM إلى مستوى جديد بجرافيكس واقعي ومتطور، محاكاة وخامات 4K عالية الجودة، مع أداء محسّن وسلس يضيف فخامة وتجربة واقعية وبيئة لعب ممتعة .
          </p>

          <div className="flex flex-row-reverse items-center justify-center md:justify-start gap-6 w-full md:w-auto">
            {/* Discord Invite */}
            <a href="https://discord.gg/ob1/" target="_blank" rel="noopener noreferrer" className="hover:scale-105 transition-transform duration-300">
              <img src="/invite.png" alt="Discord Invite" className="h-10 sm:h-12 md:h-16 lg:w-[311px] lg:h-[147px] w-auto object-contain" />
            </a>

            {/* Download Button */}
            <Button
              onClick={onDownload}
              disabled={isDownloading}
              className="border border-white text-white bg-transparent px-6 py-3 sm:px-10 sm:py-5 text-sm sm:text-base md:text-lg h-fit hover:bg-white hover:text-black font-bold transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                "حمل الان"
              )}
            </Button>
          </div>
        </motion.div>


      </div>
    </section>
  );
}


