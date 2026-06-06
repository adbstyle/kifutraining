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

WECHSELTORE_BLOCK = (
"Wechseltore                                                         G     F      E\n"
"\n"
"                    Offen          Zwei Teams spielen 3:3. Dribbelt ein Kind über die Mittel-\n"
"                    starten        linie, kann es in dieser Hälfte ein Tor erzielen. Dribbelt es\n"
"                                   wieder zurück, sind die anderen beiden Tore freigeschal-\n"
"                                   tet.\n"
"\n"
"                    Üben           – Täuschen und in den freien Raum dribbeln\n"
"                                   – Als Mitspieler/innen freilaufen, anspielbar sein\n"
"\n"
"                    Wett-          Welches Team erzielt innerhalb von fünf Minuten mehr\n"
"                    eifern         Tore?\n"
)

def test_parse_full_exercise_block():
    ex = parser.parse_exercise_block(WECHSELTORE_BLOCK)
    assert ex["name"] == "Wechseltore"
    assert ex["kategorien"] == ["G", "F", "E"]
    assert ex["aufbau"].startswith("Zwei Teams spielen 3:3.")
    assert "Mittellinie" in ex["aufbau"]          # de-hyphenated
    assert ex["ueben"] == [
        "Täuschen und in den freien Raum dribbeln",
        "Als Mitspieler/innen freilaufen, anspielbar sein",
    ]
    assert ex["wetteifern"].startswith("Welches Team erzielt")

SIMPLE_BLOCK = (
"Freies Kleinfeldspiel                                               G     F      E\n"
"\n"
"                         Den Kindern steht vor dem Training mind. ein Kleinfeld zur\n"
"                         Verfügung. Sobald die ersten Kinder auf dem Feld erscheinen,\n"
"                         spielen sie frei auf dem vorbereiteten Kleinfeld.\n"
)

def test_parse_simple_block_has_only_aufbau():
    ex = parser.parse_exercise_block(SIMPLE_BLOCK)
    assert ex["name"] == "Freies Kleinfeldspiel"
    assert ex["aufbau"].startswith("Den Kindern steht vor dem Training")
    assert ex["ueben"] == []
    assert ex["wetteifern"] is None

PAGE_TWO_EXERCISES = (
"Freies Kleinfeldspiel                                               G     F      E\n"
"\n"
"                         Den Kindern steht ein Kleinfeld zur Verfügung.\n"
"\n"
"Dribblestart                                                        G     F      E\n"
"\n"
"                         Sobald die Kinder kommen, umdribbeln sie die Gegenstände.\n"
)

def test_split_page_into_two_exercises():
    blocks = parser.split_page_into_exercises(PAGE_TWO_EXERCISES)
    assert len(blocks) == 2
    assert parser.split_title_and_categories(blocks[0].splitlines()[0])[0] == "Freies Kleinfeldspiel"
    assert parser.split_title_and_categories(blocks[1].splitlines()[0])[0] == "Dribblestart"
