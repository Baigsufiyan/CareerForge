import { useState } from "react";
import { createRoot } from "react-dom/client";
import Result from "./Result.jsx";
import "./index.css";

const AREAS = ["Software Development", "Data & Analytics", "AI/ML", "Cloud/DevOps", "Cybersecurity",
  "Mobile Development", "Digital Marketing", "Social Media Management", "Content Creation", "Video Editing",
  "UI/UX Design", "Graphic Design", "Finance/Accounting", "HR/Recruitment", "Business/Operations"];
const FIELDS = {
  education: ["Education", ["High school", "Diploma", "Bachelor's degree", "Master's degree", "Other"]],
  experience: ["Experience", ["Student / Fresher", "0-2 years", "2-5 years", "5+ years"]],
  location: ["Location", ["India", "United States", "United Kingdom", "Canada", "Australia", "Germany", "Other"]],
  budget: ["Learning budget", ["Free only", "Low", "Medium", "High"]],
  style: ["How do you prefer to learn?", ["Video", "Reading", "Hands-on", "Course"]],
};
const LEVELS = ["Never used it", "Know the basics", "Comfortable using it", "Can teach it"];

const card = "bg-white border border-gray-200 rounded p-6";
const input = "w-full border border-gray-300 rounded px-3 py-2 bg-white";
const btn = "bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800";
const choiceBtn = "flex gap-3 w-full text-left border rounded px-4 py-2 cursor-pointer hover:border-blue-700";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function App() {
  const [step, setStep] = useState("home");
  const [profile, setProfile] = useState({ areas: [], education: "Bachelor's degree", experience: "Student / Fresher",
    location: "India", salary: "", budget: "Free only", style: "Video", hours: 8 });
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState([]);
  const [traits, setTraits] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [choice, setChoice] = useState(null);
  const [levels, setLevels] = useState({});
  const [plan, setPlan] = useState(null);

  const set = (key, value) => setProfile({ ...profile, [key]: value });
  const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  async function start(e) {
    e.preventDefault();
    setData(await (await fetch("/api/questions")).json());
    setIndex(0);
    setTraits([]);
    setStep("questions");
  }

  async function next() {
    const all = [...traits, ...picked.map((i) => data.questions[index].options[i].trait)];
    setTraits(all);
    setPicked([]);
    if (index + 1 < data.questions.length) return setIndex(index + 1);
    setSuggestions(await post("/api/suggest", { areas: profile.areas, traits: all }));
    setStep("suggest");
  }

  function choose(name, info = {}) {
    setChoice({ ...data.careers.find((c) => c.name === name), ...info });
    setLevels({});
    setIndex(0);
    setStep("skills");
  }

  async function rate(value) {
    const all = { ...levels, [choice.skills[index]]: value };
    setLevels(all);
    if (index + 1 < choice.skills.length) return setIndex(index + 1);
    setPlan(await post("/api/plan", { ...profile, hours: Number(profile.hours), career: choice.name, levels: all }));
    setStep("result");
  }

  const q = data?.questions[index];

  return (
    <>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 font-semibold text-lg">Personalized Learning Recommendation System</div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {step === "home" && (
          <div className={card}>
            <h1 className="text-2xl font-semibold mb-3">Find a career that fits you</h1>
            <p className="text-gray-600 mb-6">
              Confused between roles? Answer a few simple questions about what you enjoy and what you already know.
              We suggest careers, you pick one, and you get one clear learning plan.
            </p>
            <button className={btn} onClick={() => setStep("profile")}>Get started</button>
          </div>
        )}

        {step === "profile" && (
          <form onSubmit={start} className={card + " space-y-6"}>
            <div>
              <h2 className="font-semibold">Areas you are curious about</h2>
              <p className="text-sm text-gray-500 mb-3">Optional. Pick up to 4, or none if you are unsure.</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {AREAS.map((a) => (
                  <label key={a} className="flex gap-2 text-sm border border-gray-200 rounded px-3 py-2">
                    <input type="checkbox" checked={profile.areas.includes(a)}
                      onChange={() => (profile.areas.includes(a) || profile.areas.length < 4) && set("areas", toggle(profile.areas, a))} />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {Object.entries(FIELDS).map(([key, [label, options]]) => (
                <label key={key}>{label}
                  <select className={input} value={profile[key]} onChange={(e) => set(key, e.target.value)}>
                    {options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
              ))}
              <label>Target salary
                <input className={input} placeholder="e.g. 6 LPA" value={profile.salary} onChange={(e) => set("salary", e.target.value)} />
              </label>
              <label>Learning hours per week
                <input className={input} type="number" min="1" required value={profile.hours} onChange={(e) => set("hours", e.target.value)} />
              </label>
            </div>
            <button className={btn}>Continue</button>
          </form>
        )}

        {step === "questions" && (
          <div className={card}>
            <p className="text-sm text-gray-500">Question {index + 1} of {data.questions.length} · tick all that apply</p>
            <h2 className="text-lg font-medium my-4">{q.question}</h2>
            <div className="space-y-2 mb-5">
              {q.options.map((o, i) => (
                <label key={o.text} className={choiceBtn + (picked.includes(i) ? " border-blue-700" : " border-gray-300")}>
                  <input type="checkbox" checked={picked.includes(i)} onChange={() => setPicked(toggle(picked, i))} />
                  {o.text}
                </label>
              ))}
            </div>
            <button className={btn} onClick={next}>{picked.length ? "Next" : "None of these"}</button>
          </div>
        )}

        {step === "suggest" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Careers that fit you</h2>
            {suggestions.map((s) => (
              <div key={s.career} className={card + " flex flex-wrap justify-between items-center gap-4"}>
                <div>
                  <p className="font-semibold">{s.career} <span className="text-blue-700">{s.match}% match</span></p>
                  <p className="text-sm text-gray-600">{s.why.join(" ")}</p>
                </div>
                <button className={btn} onClick={() => choose(s.career, s)}>Choose</button>
              </div>
            ))}
            <label className={card + " block text-sm"}>Or choose any other career
              <select className={input} value="" onChange={(e) => choose(e.target.value)}>
                <option value="" disabled>Select a career</option>
                {data.careers.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {step === "skills" && (
          <div className={card}>
            <p className="text-sm text-gray-500">{choice.name} · skill {index + 1} of {choice.skills.length}</p>
            <h2 className="text-lg font-medium my-4">How well do you know {choice.skills[index]}?</h2>
            <div className="space-y-2">
              {LEVELS.map((l, i) => <button key={l} className={choiceBtn + " border-gray-300"} onClick={() => rate(i)}>{l}</button>)}
            </div>
          </div>
        )}

        {step === "result" && <Result plan={plan} choice={choice} profile={profile} onBack={() => setStep("suggest")} />}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
