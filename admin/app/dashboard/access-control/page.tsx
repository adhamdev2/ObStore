"use client";

import { useState } from "react";
import { Shield, Globe, ShieldAlert, Network, X, Plus, Save } from "lucide-react";

const countries = [
  "أفغانستان", "ألبانيا", "الجزائر", "أندورا", "أنغولا", "الأرجنتين", "أرمينيا", "أستراليا", "النمسا", "أذربيجان",
  "الباهاما", "البحرين", "بنغلاديش", "باربادوس", "بيلاروسيا", "بلجيكا", "بليز", "بنين", "بوتان", "بوليفيا",
  "البوسنة والهرسك", "بوتسوانا", "البرازيل", "بروناي", "بلغاريا", "بوركينا فاسو", "بوروندي", "كابو فيردي", "كمبوديا", "الكاميرون",
  "كندا", "جمهورية إفريقيا الوسطى", "تشاد", "تشيلي", "الصين", "كولومبيا", "جزر القمر", "الكونغو", "كوستاريكا", "كرواتيا",
  "كوبا", "قبرص", "جمهورية التشيك", "الدنمارك", "جيبوتي", "دومينيكا", "جمهورية الدومينيكان", "الإكوادور", "مصر", "السلفادور",
  "غينيا الاستوائية", "إريتريا", "إستونيا", "إسواتيني", "إثيوبيا", "فيجي", "فنلندا", "فرنسا", "الغابون", "غامبيا",
  "جورجيا", "ألمانيا", "غانا", "اليونان", "غرينادا", "غواتيمالا", "غينيا", "غينيا بيساو", "غويانا", "هايتي",
  "هندوراس", "المجر", "آيسلندا", "الهند", "إندونيسيا", "إيران", "العراق", "أيرلندا", "إسرائيل", "إيطاليا",
  "جامايكا", "اليابان", "الأردن", "كازاخستان", "كينيا", "كيريباتي", "الكويت", "قرغيزستان", "لاوس", "لاتفيا",
  "لبنان", "ليسوتو", "ليبيريا", "ليبيا", "ليختنشتاين", "ليتوانيا", "لوكسمبورغ", "مدغشقر", "مالاوي", "ماليزيا",
  "المالديف", "مالي", "مالطا", "جزر مارشال", "موريتانيا", "موريشيوس", "المكسيك", "ميكرونيزيا", "مولدوفا", "موناكو",
  "منغوليا", "الجبل الأسود", "المغرب", "موزمبيق", "ميانمار", "ناميبيا", "ناورو", "نيبال", "هولندا", "نيوزيلندا",
  "نيكاراغوا", "النيجر", "نيجيريا", "كوريا الشمالية", "مقدونيا الشمالية", "النرويج", "عمان", "باكستان", "بالاو", "فلسطين",
  "بنما", "بابوا غينيا الجديدة", "باراغواي", "بيرو", "الفلبين", "بولندا", "البرتغال", "قطر", "رومانيا", "روسيا",
  "رواندا", "سانت كيتس ونيفيس", "سانت لوسيا", "سانت فنسنت والغرينادين", "ساموا", "سان مارينو", "ساو تومي وبرينسيب", "السعودية", "السنغال", "صربيا",
  "سيشل", "سيراليون", "سنغافورة", "سلوفاكيا", "سلوفينيا", "جزر سليمان", "الصومال", "جنوب إفريقيا", "كوريا الجنوبية", "جنوب السودان",
  "إسبانيا", "سريلانكا", "السودان", "سورينام", "السويد", "سويسرا", "سوريا", "تايوان", "طاجيكستان", "تنزانيا",
  "تايلاند", "تيمور الشرقية", "توجو", "تونغا", "ترينيداد وتوباغو", "تونس", "تركيا", "تركمانستان", "توفالو", "أوغندا",
  "أوكرانيا", "الإمارات العربية المتحدة", "المملكة المتحدة", "الولايات المتحدة", "أوروغواي", "أوزبكستان", "فانواتو", "الفاتيكان", "فنزويلا", "فيتنام",
  "اليمن", "زامبيا", "زيمبابوي"
];

export default function AccessControlPage() {
  const [blockVpn, setBlockVpn] = useState(false);
  const [blockTor, setBlockTor] = useState(false);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [countrySelect, setCountrySelect] = useState("");
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [ipInput, setIpInput] = useState("");

  const handleAddCountry = () => {
    if (countrySelect && !blockedCountries.includes(countrySelect)) {
      setBlockedCountries([...blockedCountries, countrySelect]);
      setCountrySelect("");
    }
  };

  const handleRemoveCountry = (country: string) => {
    setBlockedCountries(blockedCountries.filter(c => c !== country));
  };

  const handleAddIp = () => {
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipInput && ipRegex.test(ipInput) && !blockedIps.includes(ipInput)) {
      setBlockedIps([...blockedIps, ipInput]);
      setIpInput("");
    }
  };

  const handleRemoveIp = (ip: string) => {
    setBlockedIps(blockedIps.filter(i => i !== ip));
  };

  const handleSave = () => {
    console.log({
      blockVpn,
      blockTor,
      blockedCountries,
      blockedIps
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-6 min-h-screen" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" />
          التحكم في الوصول
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          إدارة إعدادات الأمان وحظر الوصول بناءً على الشبكة أو الموقع الجغرافي أو عناوين IP محددة
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Network className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">إعدادات الشبكة</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium text-foreground">حظر VPN و Proxy</p>
                <p className="text-[13px] text-muted-foreground mt-1">منع المستخدمين من الدخول باستخدام شبكات افتراضية أو بروكسي</p>
              </div>
              <button
                onClick={() => setBlockVpn(!blockVpn)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${blockVpn ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${blockVpn ? "-translate-x-6" : "-translate-x-1"}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium text-foreground">حظر شبكة Tor</p>
                <p className="text-[13px] text-muted-foreground mt-1">منع الوصول من عقد شبكة Tor المجهولة</p>
              </div>
              <button
                onClick={() => setBlockTor(!blockTor)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${blockTor ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${blockTor ? "-translate-x-6" : "-translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">القيود الجغرافية</h2>
          </div>
          
          <div>
            <p className="text-[14px] text-foreground mb-3">حظر دول معينة من الوصول للمنصة</p>
            <div className="flex gap-2 mb-4">
              <select
                value={countrySelect}
                onChange={(e) => setCountrySelect(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:border-primary"
              >
                <option value="">اختر دولة لحظرها...</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddCountry}
                disabled={!countrySelect}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 min-h-[50px] p-3 bg-background border border-border rounded-lg">
              {blockedCountries.length === 0 ? (
                <p className="text-[13px] text-muted-foreground w-full text-center py-2">لا توجد دول محظورة حالياً</p>
              ) : (
                blockedCountries.map((country) => (
                  <span
                    key={country}
                    className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-[13px] font-medium"
                  >
                    {country}
                    <button
                      onClick={() => handleRemoveCountry(country)}
                      className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">إدارة عناوين IP</h2>
        </div>

        <div>
          <p className="text-[14px] text-foreground mb-3">حظر عناوين IP محددة من الوصول للمنصة</p>
          <div className="flex gap-2 mb-4 max-w-md">
            <input
              type="text"
              placeholder="أدخل عنوان IP (مثال: 192.168.1.1)"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:border-primary text-left"
              dir="ltr"
            />
            <button
              onClick={handleAddIp}
              disabled={!ipInput}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[50px] p-3 bg-background border border-border rounded-lg">
            {blockedIps.length === 0 ? (
              <p className="text-[13px] text-muted-foreground w-full text-center py-2">لا توجد عناوين IP محظورة حالياً</p>
            ) : (
              blockedIps.map((ip) => (
                <span
                  key={ip}
                  className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-[13px] font-medium font-mono"
                  dir="ltr"
                >
                  {ip}
                  <button
                    onClick={() => handleRemoveIp(ip)}
                    className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-opacity hover:opacity-90 shadow-sm"
        >
          <Save className="w-4 h-4" />
          حفظ التغييرات
        </button>
      </div>
    </div>
  );
}
