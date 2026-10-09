import json
import random
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

DATA = json.loads((Path(__file__).parents[1] / "data" / "careers.json").read_text(encoding="utf-8"))
CAREERS = DATA["careers"]
TRAITS = list(DATA["traits"])


def features(areas, traits):
    row = {"area=" + a: 1 for a in areas}
    for t in traits:
        row["trait=" + t] = row.get("trait=" + t, 0) + 1
    return row


def make_dataset(per_career=100):
    rng = random.Random(42)
    rows, labels = [], []
    for c in CAREERS:
        for _ in range(per_career):
            areas = [c["area"]] if rng.random() < 0.6 else []
            if rng.random() < 0.4:
                areas.append(rng.choice(CAREERS)["area"])
            traits = [t for t in c["traits"] for _ in range(rng.randint(0, 4))]
            traits += rng.sample(TRAITS, rng.randint(0, 3))
            rows.append(features(areas, traits))
            labels.append(c["name"])
    return rows, labels


def train(rows, labels):
    vec = DictVectorizer()
    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(vec.fit_transform(rows), labels)
    return model, vec


MODEL, VEC = train(*make_dataset())


def predict(areas, traits, top=3):
    probs = MODEL.predict_proba(VEC.transform([features(areas, traits)]))[0]
    ranked = sorted(zip(MODEL.classes_, probs), key=lambda x: -x[1])[:top]
    return [{"career": str(c), "match": round(float(p) * 100)} for c, p in ranked]


if __name__ == "__main__":
    x_train, x_test, y_train, y_test = train_test_split(*make_dataset(), test_size=0.2, random_state=42)
    model, vec = train(x_train, y_train)
    print("Accuracy:", round(accuracy_score(y_test, model.predict(vec.transform(x_test))), 2))
    print(predict([], ["people", "people", "organize"]))
