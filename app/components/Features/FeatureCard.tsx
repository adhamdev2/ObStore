import React from 'react';

const FeatureCard = ({ title, description, icon }: any) => {
  return (
    <div 
      dir="rtl"
      className="flex flex-col items-center justify-center w-full max-w-[394px] h-[495px] rounded-[34px] bg-white/5 backdrop-blur-[30px] border border-white/5 p-8 text-center transition-transform hover:scale-105"
    >
      <div className="flex items-center justify-center w-[130px] h-[130px] rounded-full bg-purple-500/20 text-purple-400 mb-12">
        {icon}
      </div>

      <h3 className="text-white text-3xl font-bold mb-6">
        {title}
      </h3>

      <p className="text-white/60 text-xl leading-relaxed max-w-[280px]">
        {description}
      </p>
    </div>
  );
};

export default FeatureCard;