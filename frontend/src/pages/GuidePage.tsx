import { Link } from "react-router-dom";
import { AedGuideSteps, GuideIntro, GuideNote } from "../components/AedGuide";

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Instrukcja</p>
      <h1 className="h-display mt-2">Jak użyć AED</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">Pięć kroków. Defibrylator prowadzi Cię głosem – wystarczy go włączyć.</p>
      <div className="mt-8 max-w-3xl">
        <GuideIntro />
      </div>
      <div className="mt-4">
        <AedGuideSteps />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <GuideNote />
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/" className="btn btn-primary">Znajdź najbliższy AED</Link>
        <a href="tel:112" className="btn btn-outline">Zadzwoń 112</a>
      </div>
    </div>
  );
}
