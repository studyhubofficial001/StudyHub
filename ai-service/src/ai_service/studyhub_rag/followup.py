"""studyhub_rag/followup.py: decides, with NO model call, whether a question can be understood on its own.

"what is java?"            -> standalone: the chat history is not needed, so it is dropped and the cache may be used.
"what is its output?"      -> follow-up : needs the history (normal path, slower, never cached).
"what is the time complexity" has no topic word (it depends on the previous message) -> follow-up.

When unsure, the answer is "follow-up": a wrong guess then only costs speed, never a wrong cached answer.
Add words to the sets below if you see a follow-up being treated as standalone (or the other way round).
"""
import re

_WORD = re.compile(r"[a-z0-9_+#]+")

# words that point back at the earlier conversation
REFERENCES = {
    "it", "its", "this", "that", "these", "those", "they", "them", "their", "he", "she", "him", "her",
    "above", "below", "previous", "previously", "earlier", "before", "last", "same", "again", "more", "further",
    "another", "other", "else", "also", "too", "continue", "next", "former", "latter", "instead",
    # Hinglish
    "isko", "iska", "iski", "iske", "isme", "isse", "ise", "uska", "uski", "uske", "usko", "usme", "usse",
    "yeh", "ye", "yah", "woh", "wo", "vo", "upar", "pehle", "phir", "lekin",
}
STARTERS = {"and", "also", "but", "so", "then", "ok", "okay", "aur", "or"}
PHRASES = ("what about", "how about", "the code", "the program", "the answer", "the output", "the error",
           "the above", "your answer", "you said", "you gave", "you wrote", "in detail", "in short", "with example")

# words that carry no topic
STOPWORDS = {
    "what", "is", "are", "was", "were", "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "with",
    "how", "why", "when", "where", "which", "who", "does", "do", "did", "can", "could", "will", "would", "should",
    "give", "write", "explain", "define", "describe", "differentiate", "discuss", "state", "list", "tell", "show",
    "me", "my", "please", "pls", "about", "between", "from", "by", "be", "been", "as", "vs", "versus", "i", "you",
    "kya", "hai", "hota", "hoti", "hote", "kaise", "kyun", "kyu", "batao", "bataiye", "samjhao", "samjhaiye",
    "ka", "ki", "ke", "ko", "me", "mein", "se", "ho", "hain",
}
# words common to every subject: alone they do not say WHAT the question is about
GENERIC = {
    "time", "space", "complexity", "example", "examples", "output", "outputs", "code", "program", "programs",
    "answer", "answers", "definition", "meaning", "advantages", "advantage", "disadvantages", "disadvantage",
    "difference", "differences", "steps", "step", "syntax", "algorithm", "working", "uses", "use", "types", "type",
    "features", "feature", "explanation", "short", "brief", "detail", "detailed", "simple", "error", "errors",
    "bug", "fix", "solution", "approach", "implementation", "application", "applications", "diagram", "table",
    "points", "point", "notes", "note", "summary", "question", "questions", "difficult", "easy", "easier",
}


def is_standalone(question: str) -> bool:
    text = " ".join(question.lower().split())
    words = _WORD.findall(text)
    if len(words) < 3:
        return False
    if words[0] in STARTERS:
        return False
    if any(w in REFERENCES for w in words):
        return False
    if any(p in text for p in PHRASES):
        return False
    return any(w not in STOPWORDS and w not in GENERIC for w in words)