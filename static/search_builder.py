import re

FIELD_BEHAVIOR = {
    "Text": True,
    "Front": True,
    "Extra": True,
    "CID": False,
    "NID": False
}

def parse_terms(input_string):
    """Extract quoted or comma-separated terms."""
    return [match[0] or match[1] for match in re.findall(r'"([^"]+)"|([^,]+)', input_string)]

def build_clause(terms, field, wildcard_fields={"Text", "Front", "Extra"}):
    clauses = []
    for term in terms:
        words = term.strip().split()
        part = " ".join(
            f"({field}:*{w}*)" if field in wildcard_fields else f"({field}:{w})"
            for w in words
        )
        clauses.append(f"({part})")
    return f"({' OR '.join(clauses)})"

def build_output_string(entries, field):
    """Builds OR-clause from checkbox entries and field logic."""
    if not entries:
        return ""

    if field == "Any":
        return f"({' OR '.join(f'({entry})' for entry in entries)})"

    needs_wildcard = FIELD_BEHAVIOR.get(field, True)
    output_parts = []
    for entry in entries:
        words = entry.strip().split()
        if not words:
            continue
        if len(words) == 1:
            w = words[0]
            clause = f"({field}:*{w}*)" if needs_wildcard else f"({field}:{w})"
            output_parts.append(clause)
        else:
            word_clauses = " ".join(
                f"({field}:*{w}*)" if needs_wildcard else f"({field}:{w})"
                for w in words
            )
            output_parts.append(f"({word_clauses})")
    return f"({' OR '.join(output_parts)})"

def build_placeholder(field):
    """Returns example placeholder string based on selected field."""
    example_words = ["jo1", "antisaccromyces", "poopy"]
    if field == "Any":
        return f"({' OR '.join(f'({w})' for w in example_words)})"
    needs_wildcard = FIELD_BEHAVIOR.get(field, True)
    return f"({' OR '.join(f'({field}:*{w}*)' if needs_wildcard else f'({field}:{w})' for w in example_words)})"