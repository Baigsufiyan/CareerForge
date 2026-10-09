import { useEffect, useState } from "react";

const search = (site, q) => site + encodeURIComponent(q);
const YOUTUBE = "https://www.youtube.com/results?search_query=";
const GOOGLE = "https://www.google.com/search?q=";

const A = ({ href, children }) => <a className="text-blue-700 hover:underline" href={href} target="_blank">{children}</a>;
const List = ({ items }) => <ul className="list-disc pl-5 space-y-1 text-sm">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;

function Card({ title, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr>{head.map((h) => <th key={h} className="text-left font-medium p-2 border-b">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="p-2 border-b border-gray-100 align-top">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function Result({ plan, choice, profile, onBack }) {
  const [jd, setJd] = useState("");
  const [gap, setGap] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams({ career: plan.career, location: profile.location });
    fetch("/api/advice?" + q).then((r) => r.json()).then(setAdvice);
    fetch("/api/jobs?" + q).then((r) => r.json()).then(setJobs);
  }, [plan]);

  async function analyze() {
    const body = JSON.stringify({ text: jd, skills: plan.known });
    const res = await fetch("/api/analyze-jd", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    setGap(await res.json());
  }

  return (
    <div className="space-y-5">
      <Card title="Your career plan">
        <p className="text-2xl font-semibold">{plan.career}</p>
        {choice.match !== undefined && <p className="text-blue-700 font-medium">{choice.match}% match · {choice.why.join(" ")}</p>}
      </Card>

      <Card title="Skill level analysis">
        <Table head={["Skill", "Your level", "Status"]}
          rows={plan.levels.map((l) => [l.skill, l.level, l.ready ? "Job ready" : l.level === "Never used" ? "Learn" : "Practise"])} />
        <p className="text-sm mt-3"><b>Start with:</b> {plan.priority.join(", ") || "You know the core skills. Focus on projects."}</p>
      </Card>

      <Card title="6-month roadmap">
        <Table head={["Month", "Focus", "Hours"]} rows={plan.roadmap.map((m, i) => [i + 1, m.join(", "), profile.hours * 4])} />
        {plan.later.length > 0 && <p className="text-sm text-gray-500 mt-3">After 6 months: {plan.later.join(", ")}</p>}
      </Card>

      <Card title="Recommended learning resources">
        <p className="text-sm text-gray-500 mb-2">
          Ranked by content-based filtering on your learning style ({profile.style}), skill level, weekly time and budget.
        </p>
        <Table head={["Skill", "Best for you", "Format · Cost · Fit"]}
          rows={plan.resources.flatMap((r) => r.items.map((i, n) =>
            [n ? "" : r.skill, <A href={i.url}>{i.title}</A>, `${i.format} · ${i.cost} · ${i.fit}%`]))} />
      </Card>

      <Card title={`Courses for your budget (${profile.budget})`}>
        <Table head={["Course", "Cost"]} rows={plan.courses.map((c) => [<A href={c.url}>{c.title}</A>, c.cost])} />
      </Card>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Projects"><List items={plan.projects} /></Card>
        <Card title="Certifications">
          <List items={plan.certifications.map((c) => `${c.name} (${c.provider}, ${c.free ? "free" : "paid"})`)} />
          {!plan.certifications.length && <p className="text-sm text-gray-500">None within your budget.</p>}
        </Card>
        <Card title="Professional skills"><List items={plan.professional} /></Card>
      </div>

      <Card title="Job description analysis">
        <textarea className="w-full h-32 border border-gray-300 rounded p-3 text-sm" placeholder="Paste a job description"
          value={jd} onChange={(e) => setJd(e.target.value)} />
        <button className="mt-2 bg-blue-700 text-white px-5 py-2 rounded" onClick={analyze}>Analyze</button>
        {gap && (
          <Table head={["Required", "You have", "Missing"]}
            rows={[[gap.required.join(", ") || "-", gap.matching.join(", ") || "-", gap.missing.join(", ") || "-"]]} />
        )}
      </Card>

      <Card title="AI career advice">
        {!advice && <p className="text-sm">Generating AI advice...</p>}
        {advice && !advice.available && <p className="text-sm">AI advice is unavailable. Check GEMINI_API_KEY in backend/.env or make sure Ollama is running.</p>}
        {advice?.available && (
          <>
            <p className="text-xs text-gray-500 mb-4">
              Generated by {advice.model}
              {advice.sources.length ? " from live Google search results (sources below)." : ". AI-generated, not live data. Verify before following."}
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><h3 className="text-sm font-medium mb-1">Skills employers ask for</h3><List items={advice.skills} /></div>
              <div><h3 className="text-sm font-medium mb-1">How people get hired</h3><List items={advice.tips} /></div>
              <div><h3 className="text-sm font-medium mb-1">YouTube</h3>
                <List items={advice.videos.length ? advice.videos.map((v) => <A href={v.url}>{v.title}</A>)
                  : advice.youtube_channels.map((c) => <A href={search(YOUTUBE, c)}>{c}</A>)} /></div>
              <div><h3 className="text-sm font-medium mb-1">Courses</h3>
                <List items={[...advice.free_courses.map((c) => c + " (free)"), ...advice.paid_courses.map((c) => c + " (paid)")]
                  .map((c) => <A href={search(GOOGLE, c)}>{c}</A>)} /></div>
              {advice.sources.length > 0 && (
                <div><h3 className="text-sm font-medium mb-1">Sources</h3>
                  <List items={advice.sources.map((s) => <A href={s.url}>{s.title}</A>)} /></div>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title="Live job market">
        <p className="text-sm text-gray-500 mb-2">Your target: {profile.salary || "not set"} · {profile.location}</p>
        {jobs?.available ? (
          <>
            <p className="text-xs text-gray-500 mb-2">Live listings from Google Jobs.</p>
            <List items={jobs.jobs.map((j) => <A href={j.url}>{j.title}{j.salary && ` (${j.salary})`}</A>)} />
          </>
        ) : <p className="text-sm">{jobs ? "Live job data is unavailable (set SERPAPI_KEY in backend/.env)." : "Loading..."}</p>}
      </Card>

      <button className="border border-gray-300 bg-white px-5 py-2 rounded" onClick={onBack}>Choose a different career</button>
    </div>
  );
}
