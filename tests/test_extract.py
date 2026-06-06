import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import extract

# Reale `pdfimages -list`-Ausgabe der Manual-Seite 62: drei Diagramme plus ein
# smask (Alpha-Kanal von Bild 0), der die alte index-basierte Zuordnung verschob.
_LISTING_S62 = """\
page   num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
--------------------------------------------------------------------------------------------
  62     0 image     307   232  icc     3   8  jpeg   no     11153  0   120   120 13.5K 6.5%
  62     1 smask     307   232  gray    1   8  jpeg   no     11153  0   120   120  705B 1.0%
  62     2 image     304   228  icc     3   8  jpeg   no     11154  0   120   120 12.2K 6.0%
  62     3 image     307   232  icc     3   8  jpeg   no     11155  0   120   120 11.4K 5.4%
"""


def test_parse_real_image_nums_filtert_smask():
    assert extract.parse_real_image_nums(_LISTING_S62) == {0, 2, 3}


def test_parse_real_image_nums_ignoriert_stencil():
    listing = (
        "page   num  type   width height\n"
        "-------------------------------\n"
        "  70     0 image     307   232\n"
        "  70     1 stencil   307   232\n"
    )
    assert extract.parse_real_image_nums(listing) == {0}


def test_parse_real_image_nums_leer_ohne_bilder():
    assert extract.parse_real_image_nums("hdr\n----\n") == set()


def test_png_num_aus_dateiname():
    assert extract._png_num(Path("/tmp/p62-003.png")) == 3
