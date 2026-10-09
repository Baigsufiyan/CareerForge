from sklearn.metrics.pairwise import cosine_similarity

FEATURES = ["Video", "Reading", "Hands-on", "Course", "Beginner", "Intermediate", "Short", "Long"]
WEIGHTS = [2, 2, 2, 2, 1, 1, 1, 1]


def vector(tags):
    return [w if f in tags else 0 for f, w in zip(FEATURES, WEIGHTS)]


def recommend(resources, style, level, hours, top=2):
    learner = vector([style, "Beginner" if level == 0 else "Intermediate", "Short" if hours <= 5 else "Long"])
    items = [vector([r["format"], r["level"], r["length"]]) for r in resources]
    scores = cosine_similarity([learner], items)[0]
    ranked = sorted(zip(resources, scores), key=lambda x: -x[1])[:top]
    return [{**r, "fit": round(float(s) * 100)} for r, s in ranked]


if __name__ == "__main__":
    demo = [
        {"title": "Docs", "format": "Reading", "level": "Beginner", "length": "Short"},
        {"title": "Playlist", "format": "Video", "level": "Beginner", "length": "Short"},
        {"title": "Course", "format": "Course", "level": "Intermediate", "length": "Long"},
    ]
    print(recommend(demo, "Video", 0, 4))
