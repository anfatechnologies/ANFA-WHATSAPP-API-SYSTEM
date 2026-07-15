import ThreeDBackground from "@/components/ThreeDBackground";
import HeroSection from "@/components/HeroSection";
import FeatureCards from "@/components/FeatureCards";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-foreground overflow-hidden font-sans selection:bg-green-500/30">
      {/* 3D Background renders in the absolute background */}
      <ThreeDBackground />
      
      {/* Overlay to ensure text readability */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#0a0a0a]/50 to-[#0a0a0a]"></div>
      
      {/* Main Content */}
      <main className="relative z-10 flex min-h-screen flex-col">
        <HeroSection />
        <FeatureCards />
        
        <footer className="mt-auto border-t border-gray-800 bg-gray-950 py-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} ANFA Technologies. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
