import json
from pathlib import Path
import yaml

def test_vokabular_matches_schema_enums():
    vocab = yaml.safe_load(Path("data/vokabular.yaml").read_text(encoding="utf-8"))
    schema = json.loads(Path("schema/uebung.schema.json").read_text(encoding="utf-8"))
    props = schema["properties"]

    assert set(vocab["erscheinungsform"]) == set(props["erscheinungsform"]["items"]["enum"])
    assert set(vocab["feldtyp"]) == {v for v in props["feldtyp"]["enum"] if v is not None}
    assert set(vocab["trainingsteil"]) == set(props["trainingsteil"]["enum"])
    assert set(vocab["hauptteilkategorie"]) == set(props["hauptteilkategorie"]["enum"])
