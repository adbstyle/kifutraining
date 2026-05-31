import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import parser

def test_slugify_basic():
    assert parser.slugify("Wechseltore") == "wechseltore"

def test_slugify_umlaute_und_spaces():
    assert parser.slugify("Über die Brücke – um eine Wache") == "ueber-die-bruecke-um-eine-wache"

def test_slugify_collapses_separators():
    assert parser.slugify("Feuerball (Tupfball)") == "feuerball-tupfball"

def test_title_with_all_categories():
    line = "Wechseltore                                   G     F      E"
    assert parser.split_title_and_categories(line) == ("Wechseltore", ["G", "F", "E"])

def test_title_with_dashes_and_umlaut():
    line = "Über die Brücke – um eine Wache                G     F      E"
    title, cats = parser.split_title_and_categories(line)
    assert title == "Über die Brücke – um eine Wache"
    assert cats == ["G", "F", "E"]

def test_line_without_categories_returns_empty_list():
    title, cats = parser.split_title_and_categories("Dribbling")
    assert title == "Dribbling"
    assert cats == []

def test_join_dehyphenates_and_joins():
    lines = ["Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittel-",
             "linie, kann es in dieser Hälfte ein Tor erzielen."]
    assert parser.join_text(lines) == (
        "Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittellinie, "
        "kann es in dieser Hälfte ein Tor erzielen."
    )

def test_split_bullets():
    lines = ["– Den Ball nur mit links führen",
             "– Abwechslungsweise links und rechts führen",
             "  sowie Finten schlagen"]
    assert parser.split_bullets(lines) == [
        "Den Ball nur mit links führen",
        "Abwechslungsweise links und rechts führen sowie Finten schlagen",
    ]
