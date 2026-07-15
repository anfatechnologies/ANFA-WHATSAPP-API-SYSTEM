import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import ArchitectureSection from '@/components/landing/ArchitectureSection';
import FeatureGrid from '@/components/landing/FeatureGrid';
import HowItWorks from '@/components/landing/HowItWorks';
import MetricsStrip from '@/components/landing/MetricsStrip';
import TechStack from '@/components/landing/TechStack';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-primary-500/30">
      <Navbar />
      <main>
        <HeroSection />
        <ArchitectureSection />
        <FeatureGrid />
        <HowItWorks />
        <MetricsStrip />
        <TechStack />
      </main>
      <Footer />
    </div>
  );
}
