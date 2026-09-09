import { createFileRoute } from '@tanstack/react-router';
import { Footer, Nav } from '../components/chrome';
import { CompareSection } from '../components/compare';
import {
  EcosystemSection,
  FinalCta,
  RoadmapSection,
} from '../components/ecosystem';
import { Hero } from '../components/hero';
import { LiveStatsProvider, useRevealObserver } from '../components/primitives';
import {
  FeaturesSection,
  HowItWorksSection,
  UpdatesSection,
} from '../components/sections';
import { StackSection } from '../components/stack';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  useRevealObserver();

  return (
    <LiveStatsProvider>
      <Nav />
      <main>
        <Hero />
        <UpdatesSection />
        <HowItWorksSection />
        <FeaturesSection />
        <StackSection />
        <CompareSection />
        <EcosystemSection />
        <RoadmapSection />
        <FinalCta />
      </main>
      <Footer />
    </LiveStatsProvider>
  );
}
