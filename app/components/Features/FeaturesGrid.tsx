import React from 'react';
import FeatureCard from './FeatureCard';

export default function FeaturesGrid() {
  // الداتا وفيها الأيقونات كـ SVG
  const featuresData = [
    {
      title: "الضمان",
      description: "نوفر لكم ضمان على اغلب منتجاتنا",
      icon: (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
      )
    },
    {
      title: "الدعم الفني",
      description: "فريق دعم متواجد على مدار الساعة لمساعدتكم في أي وقت",
      icon: (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
        </svg>
      )
    },
    {
      title: "الجودة",
      description: "نضمن لكم أعلى معايير الجودة في جميع خدماتنا ومنتجاتنا",
      icon: (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      )
    },
    {
      title: "السرعة",
      description: "تنفيذ سريع ودقيق لجميع طلباتكم في أسرع وقت ممكن",
      icon: (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      )
    }
  ];

  return (
    <section className="min-h-screen  py-20 px-6 flex items-center justify-center" dir="rtl">
      <div className="max-w-[1700px] w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 justify-items-center">
          {featuresData.map((feature, index) => (
            <FeatureCard 
              key={index} 
              title={feature.title} 
              description={feature.description}
              icon={feature.icon} 
            />
          ))}
        </div>
      </div>
    </section>
  );
}